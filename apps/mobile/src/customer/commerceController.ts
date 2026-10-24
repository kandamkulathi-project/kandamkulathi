import type { ClientSession } from "@kandamkulathi/contracts/client";
import {
  type DeliveryAddress,
  deliveryAddressSchema,
} from "../../../../packages/contracts/src/commerce-address";
import {
  type CartInput,
  type CheckoutInput,
  type CommerceCataloguePage,
  type CommerceCheckout,
  type CommerceQuote,
  cartSchema,
  checkoutSchema,
  commerceCheckoutSchema,
  commerceQuoteSchema,
} from "../../../../packages/contracts/src/commerce-catalogue";
import {
  type CommercePaymentView,
  commercePaymentViewSchema,
} from "../../../../packages/contracts/src/commerce-http";
import {
  type CreatePayment,
  createPaymentSchema,
} from "../../../../packages/contracts/src/commerce-payments";
import {
  type createAuthoritativeCommerceApi,
  customerCheckoutInput,
} from "../../../workspaces/src/customer/commerce/authoritative-api";
import type { Failure, Reply } from "../../../workspaces/src/customer/commerce/contracts";
import { nativeSessionAllowed } from "./commerce";
import type { NativeCommerceHardware, NativeCommerceHardwareStage } from "./commerceHardware";

/** The canonical owner API, supplied by the parent's native bearer runtime. */
type CanonicalCommerceApi = ReturnType<typeof createAuthoritativeCommerceApi>;
export type NativeCommerceCommands = Pick<
  CanonicalCommerceApi,
  "quote" | "checkout" | "createPayment" | "readPayment" | "reconcilePayment"
> & {
  catalogue(signal: AbortSignal, after?: string): Promise<Reply<CommerceCataloguePage>>;
};
export type CommerceLocation = { reference: string; title: string };
/** Opaque-in-use volatile handoff. Contains address data: NEVER persist, log or serialize it.
 * Parent may retain ONLY across ordinary background -> fresh SAME-owner session validation.
 * Clear on logout, denial/revocation, owner change or this authority's original expiry. */
export type NativeCommerceRecovery = Readonly<{
  ownerId: string;
  sessionExpiresAt: string;
  checkout: CheckoutInput;
  quote: CommerceQuote;
  reservation: CommerceCheckout | null;
  paymentCommand: CreatePayment | null;
  payment: CommercePaymentView | null;
}>;
// Memory-only provenance: a serialized, reconstructed or caller-fabricated object is not recovery.
const issuedRecoveries = new WeakSet<NativeCommerceRecovery>();
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
export type CommerceDraftAddress = Record<keyof DeliveryAddress, string>;
export const emptyCommerceAddress = (): CommerceDraftAddress => ({
  recipientName: "",
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "IN",
  contactPhone: "",
});
export type NativeCommerceState = {
  status: "idle" | "loading" | "ready" | "invalid" | Failure;
  catalogue: CommerceCataloguePage | null;
  locationId: string;
  lines: CartInput["lines"];
  address: CommerceDraftAddress;
  quote: CommerceQuote | null;
  reservation: CommerceCheckout | null;
  payment: CommercePaymentView | null;
  /** Unknown transport outcome is not business failure. Edits/new identities stay locked. */
  recovery: "checkout" | "payment" | null;
  restored: boolean;
  hardware: "idle" | "awaiting_server" | NativeCommerceHardwareStage;
};
const initial = (): NativeCommerceState => ({
  status: "idle",
  catalogue: null,
  locationId: "",
  lines: [],
  address: emptyCommerceAddress(),
  quote: null,
  reservation: null,
  payment: null,
  recovery: null,
  restored: false,
  hardware: "idle",
});
export type NativeCommerceControllerOptions = {
  api: NativeCommerceCommands;
  locations: readonly CommerceLocation[];
  session(): ClientSession | null;
  active(): boolean;
  /** Parent injects the existing Expo Crypto randomUUID binding. */
  uuid(): string;
  onRevoked?(): void;
  /** Supply only AFTER successful current GET-session authority revalidation. */
  recovery?: NativeCommerceRecovery | null | undefined;
  hardware?: NativeCommerceHardware;
};

export class NativeCommerceController {
  private state = initial();
  private listeners = new Set<() => void>();
  private pending: AbortController | null = null;
  private epoch = 0;
  private dead = false;
  private foreground = true;
  private owner: string | null;
  private recoveryExpiresAt: string;
  private checkoutCommand: CheckoutInput | null = null;
  private paymentCommand: CreatePayment | null = null;
  private saved: NativeCommerceState | null = null;
  constructor(private readonly options: NativeCommerceControllerOptions) {
    this.owner = options.session()?.userId ?? null;
    this.recoveryExpiresAt = options.session()?.expiresAt ?? "";
    const recovery = options.recovery;
    if (recovery) {
      if (
        !issuedRecoveries.has(recovery) ||
        !this.allowed() ||
        recovery.ownerId !== this.owner ||
        recovery.sessionExpiresAt !== options.session()?.expiresAt ||
        Date.parse(recovery.sessionExpiresAt) <= Date.now() ||
        !Number.isFinite(Date.parse(recovery.sessionExpiresAt))
      ) {
        this.dispose();
        return;
      }
      try {
        const checkout = checkoutSchema.parse(recovery.checkout);
        const quote = commerceQuoteSchema.parse(recovery.quote);
        const reservation = recovery.reservation
          ? commerceCheckoutSchema.parse(recovery.reservation)
          : null;
        const paymentCommand = recovery.paymentCommand
          ? createPaymentSchema.parse(recovery.paymentCommand)
          : null;
        const payment = recovery.payment ? commercePaymentViewSchema.parse(recovery.payment) : null;
        if (
          checkout.quoteKey !== quote.quoteKey ||
          (paymentCommand &&
            (!reservation ||
              paymentCommand.subject.kind !== "order" ||
              paymentCommand.subject.id !== reservation.orderId)) ||
          (payment &&
            (!paymentCommand ||
              payment.operationId !== paymentCommand.operationId ||
              payment.subject.kind !== "order" ||
              payment.subject.id !== reservation?.orderId))
        )
          throw Error("Mismatched recovery");
        this.checkoutCommand = checkout;
        this.paymentCommand = paymentCommand;
        this.recoveryExpiresAt = recovery.sessionExpiresAt;
        this.state = {
          ...initial(),
          status: "ready",
          locationId: checkout.locationId,
          lines: checkout.lines,
          address: { ...checkout.deliveryAddress, line2: checkout.deliveryAddress.line2 ?? "" },
          quote,
          reservation,
          payment,
          restored: true,
          recovery: reservation ? (paymentCommand && !payment ? "payment" : null) : "checkout",
        };
      } catch {
        this.dispose();
      }
    }
  }
  /** Call BEFORE runtime disposal/unmount on ordinary background only. Deep-frozen copy.
   * No command exists before explicit checkout confirmation, so ordinary drafts are not carried. */
  snapshotRecovery = (): NativeCommerceRecovery | null => {
    const session = this.options.session();
    const state = this.saved ?? this.state;
    if (
      this.dead ||
      !this.owner ||
      session?.userId !== this.owner ||
      !nativeSessionAllowed(session) ||
      Date.parse(this.recoveryExpiresAt) <= Date.now() ||
      !this.checkoutCommand ||
      !state.quote
    )
      return null;
    const recovery = freeze({
      ownerId: this.owner,
      sessionExpiresAt: this.recoveryExpiresAt,
      checkout: checkoutSchema.parse(this.checkoutCommand),
      quote: commerceQuoteSchema.parse(state.quote),
      reservation: state.reservation ? commerceCheckoutSchema.parse(state.reservation) : null,
      paymentCommand: this.paymentCommand ? createPaymentSchema.parse(this.paymentCommand) : null,
      payment: state.payment ? commercePaymentViewSchema.parse(state.payment) : null,
    });
    issuedRecoveries.add(recovery);
    return recovery;
  };
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: NativeCommerceState) {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  private allowed() {
    const session = this.options.session();
    return (
      !this.dead &&
      this.foreground &&
      this.options.active() &&
      session?.userId === this.owner &&
      Date.parse(this.recoveryExpiresAt) > Date.now() &&
      nativeSessionAllowed(session)
    );
  }
  /** Called on logout, session replacement, expiry and unmount. Never reactivated. */
  dispose = (status: "anonymous" | "denied" = "anonymous") => {
    this.dead = true;
    this.epoch++;
    this.pending?.abort();
    this.pending = null;
    this.checkoutCommand = null;
    this.paymentCommand = null;
    this.saved = null;
    this.publish({ ...initial(), status });
  };
  checkAuthority = () => {
    const session = this.options.session();
    if (
      session?.userId !== this.owner ||
      Date.parse(this.recoveryExpiresAt) <= Date.now() ||
      !nativeSessionAllowed(session) ||
      (this.foreground && !this.allowed())
    )
      this.dispose();
  };
  /** Background aborts and redacts. Same-lifetime foreground retains SAME recovery IDs. */
  setForeground = (value: boolean) => {
    if (this.dead || value === this.foreground) return;
    this.foreground = value;
    if (!value) {
      this.epoch++;
      this.pending?.abort();
      this.pending = null;
      this.saved = {
        ...this.state,
        status: "ready",
        restored: this.state.restored || this.state.hardware !== "idle",
        hardware: this.state.hardware === "idle" ? "idle" : "awaiting_server",
        recovery:
          this.paymentCommand && !this.state.payment
            ? "payment"
            : this.checkoutCommand && !this.state.reservation
              ? "checkout"
              : this.state.recovery,
      };
      this.publish({ ...initial(), status: "anonymous" });
    } else if (this.allowed()) {
      if (this.saved)
        this.publish({ ...this.saved, quote: this.checkoutCommand ? this.saved.quote : null });
      this.saved = null;
    } else this.dispose();
  };
  private editable() {
    return this.allowed() && !this.pending && !this.checkoutCommand && !this.state.reservation;
  }
  private edit(change: Partial<NativeCommerceState>) {
    if (!this.editable()) return;
    this.publish({ ...this.state, ...change, status: "ready", quote: null });
  }
  selectLocation = (id: string) => {
    if (this.options.locations.some((location) => location.reference === id))
      this.edit({ locationId: id });
  };
  setAddress = (key: keyof CommerceDraftAddress, value: string) => {
    if (key !== "country") this.edit({ address: { ...this.state.address, [key]: value } });
  };
  setQuantity = (skuId: string, quantity: number) => {
    if (!this.editable() || !Number.isSafeInteger(quantity) || quantity < 0) return;
    // Only server-supplied SKU identifiers may enter a cart. Canonical schema checks bounds.
    if (
      !this.state.catalogue?.items.some((product) => product.skuId === skuId) &&
      !this.state.lines.some((line) => line.skuId === skuId)
    )
      return;
    const lines = this.state.lines.filter((line) => line.skuId !== skuId);
    if (quantity) lines.push({ skuId, quantity });
    if (
      lines.length &&
      !cartSchema.safeParse({ locationId: this.state.locationId, lines }).success
    ) {
      this.publish({ ...this.state, status: "invalid", quote: null });
      return;
    }
    this.edit({ lines });
  };
  private async run<T>(
    action: (signal: AbortSignal) => Promise<Reply<T>>,
    apply: (data: T) => Partial<NativeCommerceState>,
    recovery: NativeCommerceState["recovery"] = this.state.recovery,
    timeoutMs = 15000,
  ) {
    if (!this.allowed()) {
      this.checkAuthority();
      return;
    }
    if (this.pending) return;
    const abort = new AbortController();
    const epoch = this.epoch;
    this.pending = abort;
    this.publish({ ...this.state, status: "loading", recovery });
    const timeout = setTimeout(() => {
      if (epoch !== this.epoch || this.pending !== abort) return;
      abort.abort();
      this.pending = null;
      this.epoch++;
      if (this.allowed()) this.publish({ ...this.state, status: "error", recovery });
      else this.dispose();
    }, timeoutMs);
    try {
      let reply: Reply<T>;
      try {
        reply = await action(abort.signal);
      } catch {
        reply = { status: "error" };
      }
      if (epoch !== this.epoch || abort.signal.aborted) return;
      if (!this.allowed()) {
        this.dispose();
        return;
      }
      if (reply.status === "anonymous" || reply.status === "denied") {
        this.dispose(reply.status);
        this.options.onRevoked?.();
        return;
      }
      if (reply.status === "ready") {
        const next = { ...this.state, ...apply(reply.data) };
        this.publish({
          ...next,
          status: "ready",
          recovery:
            this.checkoutCommand && !next.reservation
              ? "checkout"
              : this.paymentCommand && !next.payment
                ? "payment"
                : null,
        });
      } else this.publish({ ...this.state, status: reply.status, recovery });
    } finally {
      clearTimeout(timeout);
      if (this.pending === abort) this.pending = null;
    }
  }
  loadCatalogue = (after?: string) =>
    this.run(
      (signal) => this.options.api.catalogue(signal, after),
      (catalogue) => ({ catalogue }),
    );
  requestQuote = async () => {
    if (!this.editable()) return;
    const cart = cartSchema.safeParse({
      locationId: this.state.locationId,
      lines: this.state.lines,
    });
    const address = deliveryAddressSchema.safeParse(this.state.address);
    if (
      !cart.success ||
      !address.success ||
      !this.options.locations.some((location) => location.reference === this.state.locationId)
    ) {
      this.publish({ ...this.state, quote: null, status: "invalid" });
      return;
    }
    this.publish({ ...this.state, quote: null });
    await this.run(
      (signal) => this.options.api.quote(cart.data, signal),
      (quote) => ({ quote }),
    );
  };
  /** A distinct user press AFTER displaying the server quote is required. */
  confirmCheckout = async () => {
    if (!this.allowed() || this.pending || this.state.reservation) return;
    if (!this.checkoutCommand) {
      if (!this.state.quote) return;
      try {
        this.checkoutCommand = customerCheckoutInput(
          {
            cart: cartSchema.parse({ locationId: this.state.locationId, lines: this.state.lines }),
            quote: this.state.quote,
            deliveryAddress: deliveryAddressSchema.parse(this.state.address),
            operationId: this.options.uuid(),
          },
          checkoutSchema,
        );
      } catch {
        this.publish({ ...this.state, status: "invalid" });
        return;
      }
    }
    const command = this.checkoutCommand;
    await this.run(
      (signal) => this.options.api.checkout(command, signal),
      (reservation) => ({ reservation, restored: false }),
      "checkout",
    );
  };
  createPayment = async () => {
    const orderId = this.state.reservation?.orderId;
    if (!this.allowed() || this.pending || !orderId || this.state.payment) return;
    try {
      this.paymentCommand ??= createPaymentSchema.parse({
        operationId: this.options.uuid(),
        subject: { kind: "order", id: orderId },
        method: "razorpay",
      });
    } catch {
      this.publish({ ...this.state, status: "invalid" });
      return;
    }
    const command = this.paymentCommand;
    await this.run(
      (signal) => this.options.api.createPayment(orderId, command, signal),
      (payment) => ({ payment, restored: false }),
      "payment",
    );
  };
  refreshPayment = (reconcile = false) => {
    const payment = this.state.payment;
    if (!payment) return Promise.resolve();
    return this.run(
      (signal) =>
        reconcile
          ? this.options.api.reconcilePayment(payment, signal)
          : this.options.api.readPayment(payment, signal),
      (current) => ({ payment: current, restored: false }),
    );
  };
  /** Only a distinct user press may launch hardware, never an effect or SDK callback. */
  openPayment = async () => {
    if (!this.allowed() || this.pending) return;
    const payment = this.state.payment;
    const hardware = this.options.hardware;
    if (!hardware) {
      this.publish({ ...this.state, status: "unavailable" });
      return;
    }
    if (payment?.state !== "ready" || this.state.restored) return;
    const epoch = this.epoch;
    // Once SDK launch is requested, old READY is last-known until an authoritative read returns.
    this.publish({ ...this.state, restored: true });
    try {
      // HTTP phases are individually bounded in the adapter; SDK gets its existing five minutes.
      await this.run(
        (signal) =>
          hardware.launch(
            payment,
            signal,
            () => this.allowed() && epoch === this.epoch,
            (value) => {
              if (this.allowed() && epoch === this.epoch && !signal.aborted)
                this.publish({ ...this.state, hardware: value });
            },
          ),
        (current) => ({ payment: current, restored: false }),
        this.state.recovery,
        6 * 60 * 1000,
      );
    } finally {
      if (this.allowed() && epoch === this.epoch)
        this.publish({
          ...this.state,
          hardware:
            this.state.payment?.state === "captured" || this.state.payment?.state === "failed"
              ? "idle"
              : "awaiting_server",
        });
    }
  };
}
