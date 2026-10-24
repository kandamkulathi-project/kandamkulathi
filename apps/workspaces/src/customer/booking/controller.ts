import {
  type AppointmentPage,
  type BookingConsultationAdapter,
  type BookingCustomerApi,
  type BookingRecord,
  type ClientSession,
  customerSession,
  type Directory,
  type Failure,
  type HoldPage,
  holdBookingRequestSchema,
  type Offer,
  object,
  parseAppointments,
  parseDirectory,
  parseHold,
  parseReply,
  parseSlots,
  type Reply,
  type Selection,
  type SlotPage,
} from "./contracts";

export type ViewResource<T> = Reply<T> | { status: "idle" | "loading" };
export type BookingSnapshot = {
  directory: ViewResource<Directory>;
  slots: ViewResource<SlotPage>;
  appointments: ViewResource<AppointmentPage>;
  hold: ViewResource<HoldPage>;
  join: "idle" | "loading" | "pending" | Failure;
  selection: Selection | null;
  uncertain: boolean;
  remainingSeconds: number;
  canRefreshHold: boolean;
};
const initial = (): BookingSnapshot => ({
  directory: { status: "idle" },
  slots: { status: "idle" },
  appointments: { status: "idle" },
  hold: { status: "idle" },
  join: "idle",
  selection: null,
  uncertain: false,
  remainingSeconds: 0,
  canRefreshHold: false,
});

/** Shared web/native presentation store. It never confirms, expires or pays a booking. */
export class BookingController {
  private state = initial();
  private listeners = new Set<() => void>();
  private generation = 0;
  private requests = new Set<AbortController>();
  private clock: { server: number; local: number } | undefined;
  private lastHold: BookingRecord | undefined;
  private alive = true;
  constructor(
    private api: BookingCustomerApi | undefined,
    private session: ClientSession | null,
    private consultation?: BookingConsultationAdapter,
    private now = () => Date.now(),
  ) {}
  getSnapshot = () => this.state;
  start = () => {
    this.alive = true;
    void this.load();
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(change: Partial<BookingSnapshot>) {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }
  private authorized() {
    return this.alive && customerSession(this.session, this.now()) !== null;
  }
  private abort() {
    this.generation++;
    for (const request of this.requests) request.abort();
    this.requests.clear();
    if (this.state.appointments.status === "loading")
      this.set({ appointments: { status: "idle" } });
  }
  invalidate = () => {
    this.abort();
    this.lastHold = undefined;
    this.clock = undefined;
    this.set({
      ...initial(),
      directory: { status: "anonymous" },
      appointments: { status: "anonymous" },
    });
    this.alive = false;
  };
  private async request<T>(
    operation: ((signal: AbortSignal) => Promise<unknown>) | undefined,
    parse: (value: unknown) => T,
  ): Promise<Reply<T> | null> {
    if (!this.authorized()) {
      this.invalidate();
      return null;
    }
    if (!operation) return { status: "unavailable" };
    const generation = this.generation;
    const abort = new AbortController();
    this.requests.add(abort);
    const timeout = setTimeout(() => abort.abort(), 5000);
    try {
      const raw = await Promise.race([
        operation(abort.signal),
        new Promise<never>((_, reject) =>
          abort.signal.addEventListener("abort", () => reject(Error("Aborted")), { once: true }),
        ),
      ]);
      if (generation !== this.generation) return null;
      if (!this.authorized()) {
        this.invalidate();
        return null;
      }
      const reply = parseReply(raw, parse);
      if (reply.status === "anonymous" || reply.status === "denied") {
        this.abort();
        this.lastHold = undefined;
        this.clock = undefined;
        this.alive = false;
        this.set({ ...initial(), directory: reply, appointments: reply });
        return null;
      }
      return reply;
    } catch {
      return generation === this.generation && this.authorized() ? { status: "error" } : null;
    } finally {
      clearTimeout(timeout);
      this.requests.delete(abort);
    }
  }
  async load() {
    if (!this.authorized()) {
      this.invalidate();
      return;
    }
    this.set({ directory: { status: "loading" }, appointments: { status: "loading" } });
    await Promise.all([
      this.request(this.api?.directory.bind(this.api), parseDirectory).then((directory) => {
        if (directory) this.set({ directory });
      }),
      this.refreshAppointments(),
    ]);
  }
  async refreshAppointments() {
    this.set({ appointments: { status: "loading" } });
    const reply = await this.request(this.api?.appointments.bind(this.api), parseAppointments);
    if (
      reply?.status === "ready" &&
      reply.data.bookings.some((b) => b.ownerId !== this.session?.userId)
    ) {
      this.set({ appointments: { status: "error" } });
      return;
    }
    if (reply) this.set({ appointments: reply });
  }
  async select(selection: Selection) {
    if (!this.authorized() || this.state.hold.status === "loading" || this.state.uncertain) return;
    const directory = this.state.directory;
    if (
      directory.status !== "ready" ||
      !directory.data.clinics.some((c) => c.id === selection.clinicId) ||
      !directory.data.services.some((s) => s.id === selection.serviceId) ||
      !directory.data.doctors.some(
        (d) => d.doctorId === selection.doctorId && d.clinicIds.includes(selection.clinicId),
      )
    ) {
      this.abort();
      this.set({ selection: null, slots: { status: "error" } });
      return;
    }
    this.abort();
    this.set({ selection, slots: { status: "loading" } });
    const reply = await this.request(this.api?.slots.bind(this.api, selection), parseSlots);
    if (
      reply?.status === "ready" &&
      reply.data.offers.some(
        (o) =>
          o.slot.doctorId !== selection.doctorId ||
          o.slot.clinicId !== selection.clinicId ||
          o.serviceId !== selection.serviceId,
      )
    ) {
      this.set({ slots: { status: "error" } });
      return;
    }
    if (reply) this.set({ slots: reply });
  }
  clearSelection() {
    if (this.state.hold.status === "loading" || this.state.uncertain) return;
    this.abort();
    this.set({ selection: null, slots: { status: "idle" } });
  }
  async hold(offer: Offer) {
    if (
      !this.authorized() ||
      this.state.uncertain ||
      this.state.hold.status === "loading" ||
      this.state.slots.status !== "ready" ||
      !this.state.slots.data.offers.includes(offer)
    )
      return;
    const slot = offer.slot;
    const input = holdBookingRequestSchema.parse({
      doctorId: slot.doctorId,
      clinicId: slot.clinicId,
      ownerId: this.session?.userId,
      availabilityId: slot.availabilityId,
      expectedAvailabilityRevision: slot.availabilityRevision,
      modality: slot.modality,
      start: slot.interval.start,
    });
    this.set({ hold: { status: "loading" }, slots: { status: "idle" } });
    const reply = await this.request(this.api?.hold.bind(this.api, input), parseHold);
    if (!reply) return;
    if (
      reply.status === "ready" &&
      (reply.data.booking.ownerId !== input.ownerId ||
        reply.data.booking.slot.doctorId !== input.doctorId ||
        reply.data.booking.slot.clinicId !== input.clinicId ||
        reply.data.booking.slot.availabilityId !== input.availabilityId ||
        reply.data.booking.slot.modality !== input.modality ||
        reply.data.booking.slot.interval.start !== input.start)
    ) {
      this.set({ hold: { status: "error" }, uncertain: true });
      return;
    }
    this.applyHold(reply);
    if (reply.status === "error") this.set({ uncertain: true });
  }
  private applyHold(reply: Reply<HoldPage>) {
    if (reply.status === "ready") {
      this.clock = { server: Date.parse(reply.data.serverNow), local: this.now() };
      this.lastHold = reply.data.booking;
      this.set({ canRefreshHold: true });
    }
    this.set({ hold: reply });
    this.tick();
  }
  tick = () => {
    if (!this.authorized()) {
      if (this.alive) this.invalidate();
      return;
    }
    const hold = this.state.hold;
    const clock = this.clock;
    const seconds =
      hold.status === "ready" && hold.data.booking.state === "held" && clock
        ? Math.max(
            0,
            Math.ceil(
              (Date.parse(hold.data.booking.holdExpiresAt) -
                clock.server -
                Math.max(0, this.now() - clock.local)) /
                1000,
            ),
          )
        : 0;
    if (seconds !== this.state.remainingSeconds) this.set({ remainingSeconds: seconds });
  };
  async refreshHold() {
    if (!this.lastHold || this.state.hold.status === "loading") return;
    const previous = this.lastHold;
    this.set({ hold: { status: "loading" } });
    const reply = await this.request(
      this.api?.read.bind(this.api, { bookingId: previous.id }),
      parseHold,
    );
    if (
      reply?.status === "ready" &&
      (reply.data.booking.id !== previous.id ||
        reply.data.booking.ownerId !== this.session?.userId ||
        reply.data.booking.revision < previous.revision)
    ) {
      this.set({ hold: { status: "error" } });
      return;
    }
    if (reply) this.applyHold(reply);
  }
  async join(booking: BookingRecord) {
    if (
      this.state.join === "loading" ||
      booking.state !== "confirmed" ||
      booking.slot.modality !== "online" ||
      this.state.appointments.status !== "ready" ||
      !this.state.appointments.data.bookings.includes(booking)
    )
      return;
    this.set({ join: "loading" });
    const reply = await this.request(
      this.consultation?.join.bind(this.consultation, { bookingId: booking.id }),
      (data) => {
        object(data, ["state"]);
        if ((data as { state: unknown }).state !== "pending") throw Error("Invalid join result");
        return "pending" as const;
      },
    );
    if (reply) this.set({ join: reply.status === "ready" ? "pending" : reply.status });
  }
}
