import { sessionSchema } from "@kandamkulathi/contracts/client";
import { formatMoney, foundation, type Locale } from "@kandamkulathi/i18n";
import { Button, Notice } from "@kandamkulathi/ui";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  type ApprovedProductPresentation,
  type AuthoritativeCheckoutInput,
  type AuthoritativeCommerceSchemas,
  type AuthoritativeDeliveryAddress,
  type AuthoritativeOrder,
  type AuthoritativeOrderDetail,
  type AuthoritativePage,
  type AuthoritativePayment,
  type AuthoritativePaymentInput,
  type AuthoritativeQuote,
  type AuthoritativeReservation,
  type AuthoritativeTransport,
  approvedImageSource,
  createAuthoritativeCommerceApi,
  customerCheckoutInput,
  type RuntimeSchema,
} from "./authoritative-api";
import { createBrowserPayment } from "./browserPayment";
import type { CommerceSession } from "./CommerceCustomerViews";
import type { Reply } from "./contracts";
import { CommerceResource, type ResourceState } from "./resource";
import "./commerce.css";

function parser<T>(schema: RuntimeSchema<T> | undefined) {
  return (value: unknown): T => {
    if (!schema) throw new Error("Authoritative schema integration pending");
    return schema.parse(value);
  };
}
function useAuthorityResource<T>() {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  const resource = useMemo(() => new CommerceResource<T>(setState), []);
  useEffect(() => () => resource.clear(), [resource]);
  return [state, resource] as const;
}
function Status({ state }: { state: string }) {
  return (
    <Notice error={["error", "conflict", "denied"].includes(state)}>
      {state === "conflict"
        ? "The price, stock or operation changed. Refresh current data before proceeding."
        : state === "loading"
          ? "Loading current server data…"
          : state === "anonymous"
            ? "Sign in to view your account."
            : state === "denied"
              ? "This record is not available to your account."
              : state === "unavailable"
                ? "This service is unavailable. Integration or policy approval is pending."
                : "The response could not be verified. Refresh current server state."}
    </Notice>
  );
}
function ProductImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const safe = approvedImageSource(src);
  if (!safe || failed) return <Notice>Product image unavailable.</Notice>;
  return (
    <img
      src={safe}
      alt={alt}
      width={320}
      height={240}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
export type AuthoritativeCommerceCustomerProps<Product> = {
  locale: Locale;
  session: CommerceSession;
  transport: AuthoritativeTransport;
  schemas: AuthoritativeCommerceSchemas<Product>;
  /** Reviewed clinic/location directory projection, not customer-entered UUIDs. */
  locations?: { reference: string; title: string }[];
  onRefreshSession?: () => void;
};

/** HTTP-backed customer entry. Missing authoritative schema/adapters stay
 * individually unavailable; the aggregate proposed port is NOT used here. */
export function AuthoritativeCommerceCustomerViews<Product>(
  props: AuthoritativeCommerceCustomerProps<Product>,
) {
  const { locale, schemas, transport, session } = props;
  const api = useMemo(
    () => createAuthoritativeCommerceApi(transport, schemas),
    [transport, schemas],
  );
  const [catalogue, resource] = useAuthorityResource<AuthoritativePage<Product>>();
  const [after, setAfter] = useState<string | undefined>();
  const [concern, setConcern] = useState("");
  useEffect(() => {
    resource.clear();
    void resource.run((signal) => api.catalogue(signal, after), parser(schemas.cataloguePage));
    return () => resource.clear();
  }, [api, schemas.cataloguePage, after, resource]);
  const verified = session.status === "ready" ? sessionSchema.safeParse(session.session) : null;
  const id = useId();
  const presentations =
    catalogue.status === "ready" && schemas.presentProduct
      ? catalogue.data.items.map(schemas.presentProduct)
      : [];
  const concerns = [...new Set(presentations.flatMap((item) => item.concerns))];
  const filteredProducts = presentations.filter(
    (item) => !concern || item.concerns.includes(concern),
  );
  return (
    <div className="customer-commerce" lang="en" data-authoritative-commerce>
      <h2>{foundation[locale].commerce}</h2>
      {locale !== "en" && (
        <Notice>New commerce labels are in English. Reviewed translations are pending.</Notice>
      )}
      <section aria-labelledby={`${id}-catalogue`}>
        <h3 id={`${id}-catalogue`}>Product catalogue</h3>
        {catalogue.status !== "ready" ? (
          <Status state={catalogue.status} />
        ) : !schemas.presentProduct ? (
          <Status state="unavailable" />
        ) : (
          <>
            <label htmlFor={`${id}-concern`}>
              Concern
              <select
                id={`${id}-concern`}
                value={concern}
                onChange={(event) => setConcern(event.target.value)}
              >
                <option value="">All concerns on this page</option>
                {concerns.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            {filteredProducts.length === 0 && <Notice>{foundation[locale].empty}</Notice>}
            <ul className="commerce-products">
              {filteredProducts.map((item) => (
                <li key={item.reference}>
                  <details>
                    <summary>{item.title}</summary>
                    {item.image && <ProductImage key={item.image.src} {...item.image} />}
                    <p>{item.description}</p>
                    {item.displayPricePaise !== undefined && (
                      <p>{formatMoney(item.displayPricePaise, locale)}</p>
                    )}
                    {item.stockStatus !== undefined && <p>Stock: {item.stockStatus}</p>}
                    {item.consultOnly && (
                      <p>Consultation required. The server checks purchase eligibility.</p>
                    )}
                  </details>
                </li>
              ))}
            </ul>
            <Button
              disabled={!catalogue.data.nextCursor}
              onClick={() => {
                setConcern("");
                setAfter(catalogue.data.nextCursor ?? undefined);
              }}
            >
              Next catalogue page
            </Button>
          </>
        )}
        <Button
          disabled={catalogue.status === "loading"}
          onClick={() => {
            resource.clear();
            void resource.run(
              (signal) => api.catalogue(signal, after),
              parser(schemas.cataloguePage),
            );
          }}
        >
          Refresh catalogue
        </Button>
        <Notice>
          Category, variant and stock presentation requires the frozen approved product projection.
          Missing fields are not inferred.
        </Notice>
      </section>
      {verified?.success &&
      verified.data.workspaces.includes("customer") &&
      Date.parse(verified.data.expiresAt) > Date.now() &&
      session.status === "ready" ? (
        <AuthorityBoundary
          key={`${verified.data.userId}:${session.epoch}:${verified.data.expiresAt}:${locale}`}
          {...props}
          expiresAt={verified.data.expiresAt}
          api={api}
          products={presentations}
        />
      ) : (
        <Status state={session.status === "ready" ? "denied" : session.status} />
      )}
    </div>
  );
}

type Api<Product> = Omit<
  ReturnType<typeof createAuthoritativeCommerceApi>,
  "schemas" | "catalogue" | "product"
> & {
  schemas: AuthoritativeCommerceSchemas<Product>;
  catalogue: (signal: AbortSignal, after?: string) => Promise<Reply<AuthoritativePage<Product>>>;
  product: (id: string, signal: AbortSignal) => Promise<Reply<Product>>;
};
function AuthorityBoundary<Product>(
  props: AuthoritativeCommerceCustomerProps<Product> & {
    expiresAt: string;
    api: Api<Product>;
    products: ApprovedProductPresentation[];
  },
) {
  const [cleared, setCleared] = useState(false);
  useEffect(() => {
    const clear = () => setCleared(true);
    const hide = () => {
      if (document.visibilityState === "hidden") clear();
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) clear();
    };
    const timeout = setTimeout(
      clear,
      Math.min(2147483647, Math.max(0, Date.parse(props.expiresAt) - Date.now())),
    );
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", restore);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("pageshow", restore);
    };
  }, [props.expiresAt]);
  if (cleared)
    return (
      <section data-authoritative-private="cleared">
        <Notice>Private data cleared. Recheck your session to continue.</Notice>
        {props.onRefreshSession && (
          <Button onClick={props.onRefreshSession}>Recheck session</Button>
        )}
      </section>
    );
  return <AuthorityPrivate {...props} onPrivateDenied={() => setCleared(true)} />;
}

function AuthorityPrivate<Product>({
  api,
  schemas,
  locale,
  locations,
  products,
  session,
  onPrivateDenied,
}: AuthoritativeCommerceCustomerProps<Product> & {
  api: Api<Product>;
  onPrivateDenied: () => void;
  products: ApprovedProductPresentation[];
}) {
  const [orders, orderResource] = useAuthorityResource<AuthoritativePage<AuthoritativeOrder>>();
  const [detail, detailResource] = useAuthorityResource<AuthoritativeOrderDetail>();
  const [quote, quoteResource] = useAuthorityResource<AuthoritativeQuote>();
  const [reservation, reservationResource] = useAuthorityResource<AuthoritativeReservation>();
  const [payment, paymentResource] = useAuthorityResource<AuthoritativePayment>();
  const [hasPayment, setHasPayment] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<AuthoritativePayment | null>(null);
  const checkout = useRef<ReturnType<typeof createBrowserPayment> | null>(null);
  useEffect(() => {
    const adapter = createBrowserPayment(
      api,
      () =>
        session.status === "ready" &&
        Date.parse(session.session.expiresAt) > Date.now() &&
        document.visibilityState !== "hidden",
    );
    checkout.current = adapter;
    const revoke = () => adapter.dispose();
    const hide = () => {
      if (document.visibilityState === "hidden") revoke();
    };
    window.addEventListener("pagehide", revoke);
    document.addEventListener("visibilitychange", hide);
    return () => {
      checkout.current = null;
      window.removeEventListener("pagehide", revoke);
      document.removeEventListener("visibilitychange", hide);
      adapter.dispose();
    };
  }, [api, session]);
  useEffect(() => {
    if (payment.status === "ready") setPaymentTarget(payment.data);
  }, [payment]);
  const paymentAttempts = useRef(new Map<string, AuthoritativePaymentInput>());
  const [after, setAfter] = useState<string | undefined>();
  const [locationId, setLocationId] = useState("");
  const [lines, setLines] = useState([{ key: "initial", skuId: "", quantity: "1" }]);
  const [confirmed, setConfirmed] = useState(false);
  const [hasQuote, setHasQuote] = useState(false);
  const [hasReservation, setHasReservation] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [address, setAddress] = useState<AuthoritativeDeliveryAddress>({
    recipientName: "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "IN",
    contactPhone: "",
  });
  const [addressError, setAddressError] = useState(false);
  const attempt = useRef<AuthoritativeCheckoutInput | null>(null);
  const id = useId();
  const variants = products.flatMap((product) =>
    (product.variants ?? []).map((variant) => ({
      ...variant,
      title: `${product.title} — ${variant.title}`,
    })),
  );
  const deniedState = [
    orders.status,
    detail.status,
    quote.status,
    reservation.status,
    payment.status,
  ].find((status) => status === "anonymous" || status === "denied");
  useEffect(() => {
    if (deniedState) onPrivateDenied();
  }, [deniedState, onPrivateDenied]);
  useEffect(() => {
    orderResource.clear();
    void orderResource.run((signal) => api.orders(signal, after), parser(schemas.orderPage));
    return () => orderResource.clear();
  }, [api, schemas.orderPage, orderResource, after]);
  const invalidateQuote = () => {
    quoteResource.clear();
    setHasQuote(false);
    setConfirmed(false);
  };
  const locked = hasReservation;
  const cart = () => ({
    locationId,
    lines: lines.map((line) => ({ skuId: line.skuId, quantity: Number(line.quantity) })),
  });
  function reserve() {
    if (
      !confirmed ||
      quote.status !== "ready" ||
      !schemas.checkoutInput ||
      hasReservation ||
      attempt.current
    )
      return;
    let input: AuthoritativeCheckoutInput;
    try {
      if (!schemas.deliveryAddress || !schemas.checkoutInput) return;
      input = customerCheckoutInput(
        {
          cart: cart(),
          deliveryAddress: schemas.deliveryAddress.parse(address),
          operationId: crypto.randomUUID(),
          quote: quote.data,
        },
        schemas.checkoutInput,
      );
    } catch {
      setAddressError(true);
      return;
    }
    setAddressError(false);
    attempt.current = input;
    setHasReservation(true);
    void reservationResource.run(
      (signal) => api.checkout(input, signal),
      parser(schemas.reservation),
    );
  }
  if (deniedState) return <Status state={deniedState} />;
  return (
    <section data-authoritative-private>
      <h3>Account</h3>
      <Notice>Profile editing is unavailable.</Notice>
      <h3>Delivery address</h3>
      <Notice>
        The address is collected inline for this order. A saved addressbook and pincode
        serviceability checks are unavailable; the server must approve checkout eligibility.
      </Notice>
      <fieldset className="commerce-form" disabled={hasReservation}>
        <legend>Address for this checkout</legend>
        {(
          [
            ["recipientName", "Recipient name", "name"],
            ["line1", "Address line 1", "address-line1"],
            ["line2", "Address line 2 (optional)", "address-line2"],
            ["city", "City", "address-level2"],
            ["region", "State / region", "address-level1"],
            ["postalCode", "Postal code", "postal-code"],
            ["contactPhone", "Contact phone (E164)", "tel"],
          ] as const
        ).map(([field, label, autoComplete]) => (
          <label key={field} htmlFor={`${id}-delivery-${field}`}>
            {label}
            <input
              id={`${id}-delivery-${field}`}
              autoComplete={autoComplete}
              value={address[field] ?? ""}
              onChange={(event) => {
                setAddress({ ...address, [field]: event.target.value });
                setAddressError(false);
                setConfirmed(false);
              }}
            />
          </label>
        ))}
        <p>Country: India (IN)</p>
      </fieldset>
      {addressError && (
        <Notice error>
          Check the delivery address, six-digit postal code and E164 phone number. The address must
          pass the shared checkout validation before submission.
        </Notice>
      )}
      <section aria-labelledby={`${id}-cart`}>
        <h3 id={`${id}-cart`}>Cart quote</h3>
        <p>
          This editable draft is not a saved cart or a stock hold. Only the server establishes
          prices and purchase eligibility.
        </p>
        <form
          className="commerce-form"
          onSubmit={(event) => {
            event.preventDefault();
            invalidateQuote();
            setHasQuote(true);
            void quoteResource.run((signal) => api.quote(cart(), signal), parser(schemas.quote));
          }}
        >
          {(!locations?.length || !variants.length) && (
            <Notice>
              Product variants or clinic selection are unavailable. Approved catalogue and location
              adapters must be connected before requesting a quote.
            </Notice>
          )}
          <fieldset disabled={locked || (hasQuote && quote.status === "loading")}>
            <legend>Draft items</legend>
            <label htmlFor={`${id}-location`}>
              Clinic
              <select
                id={`${id}-location`}
                required
                value={locationId}
                onChange={(event) => {
                  setLocationId(event.target.value);
                  invalidateQuote();
                }}
              >
                <option value="">Choose a clinic</option>
                {locations?.map((location) => (
                  <option key={location.reference} value={location.reference}>
                    {location.title}
                  </option>
                ))}
              </select>
            </label>
            {lines.map((line, index) => (
              <div className="commerce-field" key={line.key}>
                <label htmlFor={`${id}-sku-${index}`}>
                  Product variant {index + 1}
                  <select
                    id={`${id}-sku-${index}`}
                    required
                    value={line.skuId}
                    onChange={(event) => {
                      setLines(
                        lines.map((value, position) =>
                          position === index ? { ...value, skuId: event.target.value } : value,
                        ),
                      );
                      invalidateQuote();
                    }}
                  >
                    <option value="">Choose a product variant</option>
                    {variants.map((variant) => (
                      <option key={variant.reference} value={variant.reference}>
                        {variant.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label htmlFor={`${id}-quantity-${index}`}>
                  Quantity {index + 1}
                  <input
                    id={`${id}-quantity-${index}`}
                    required
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    value={line.quantity}
                    onChange={(event) => {
                      setLines(
                        lines.map((value, position) =>
                          position === index ? { ...value, quantity: event.target.value } : value,
                        ),
                      );
                      invalidateQuote();
                    }}
                  />
                </label>
              </div>
            ))}
            <Button
              onClick={() => {
                setLines([...lines, { key: crypto.randomUUID(), skuId: "", quantity: "1" }]);
                invalidateQuote();
              }}
            >
              Add draft line
            </Button>
            <Button type="submit" disabled={!locations?.length || !variants.length}>
              Get current server quote
            </Button>
          </fieldset>
        </form>
        {hasQuote &&
          (quote.status !== "ready" ? (
            <Status state={quote.status} />
          ) : (
            <>
              <p>Server total: {formatMoney(quote.data.amountPaise, locale)}</p>
              <ul>
                {quote.data.lines.map((line) => (
                  <li key={line.skuId}>
                    {line.skuId}: {line.quantity} — {formatMoney(line.amountPaise, locale)}
                  </li>
                ))}
              </ul>
              <p>A quote is not a stock hold or payment.</p>
              <label htmlFor={`${id}-confirm`}>
                <input
                  id={`${id}-confirm`}
                  type="checkbox"
                  checked={confirmed}
                  disabled={locked}
                  onChange={(event) => setConfirmed(event.target.checked)}
                />
                I confirm these current items and the server total.
              </label>
              <Button
                disabled={
                  !confirmed ||
                  locked ||
                  !schemas.checkoutInput ||
                  !schemas.reservation ||
                  !schemas.deliveryAddress
                }
                onClick={reserve}
              >
                Reserve order
              </Button>
            </>
          ))}
        {hasReservation &&
          (reservation.status === "ready" ? (
            <Notice>
              Order {reservation.data.orderId} is reserved until {reservation.data.expiresAt}.
              Server amount: {formatMoney(reservation.data.amountPaise, locale)}. Payment has not
              been confirmed. Refresh order history to check authoritative state.
            </Notice>
          ) : (
            <>
              <Status state={reservation.status} />
              {reservation.status !== "loading" && (
                <>
                  <Notice>
                    The reservation outcome is uncertain. Do not start another checkout. Check order
                    history, or retry only this identical operation.
                  </Notice>
                  <Button
                    onClick={() => {
                      const input = attempt.current;
                      if (input)
                        void reservationResource.run(
                          (signal) => api.checkout(input, signal),
                          parser(schemas.reservation),
                        );
                    }}
                  >
                    Retry identical reservation
                  </Button>
                </>
              )}
            </>
          ))}
        <Notice>
          Open an eligible order below to request its payment intent. Pay with Razorpay is available
          only for a current ready intent with verified sandbox checkout details. Browser returns
          never establish payment success.
        </Notice>
      </section>
      <section aria-labelledby={`${id}-orders`}>
        <h3 id={`${id}-orders`}>Order history</h3>
        <Button
          disabled={orders.status === "loading"}
          onClick={() => {
            setSelectedOrder(null);
            detailResource.clear();
            orderResource.clear();
            void orderResource.run(
              (signal) => api.orders(signal, after),
              parser(schemas.orderPage),
            );
          }}
        >
          Refresh order history
        </Button>
        {orders.status !== "ready" ? (
          <Status state={orders.status} />
        ) : (
          <>
            {orders.data.items.length === 0 && <Notice>{foundation[locale].empty}</Notice>}
            <ul>
              {orders.data.items.map((order) => (
                <li key={order.orderId}>
                  <p>
                    Order {order.orderId} — {order.status.replaceAll("_", " ")}. Server total:{" "}
                    {formatMoney(order.amountPaise, locale)}
                  </p>
                  <Button
                    onClick={() => {
                      setSelectedOrder(order.orderId);
                      detailResource.clear();
                      void detailResource.run(
                        (signal) => api.order(order.orderId, signal),
                        parser(schemas.orderDetail),
                      );
                    }}
                  >
                    View order {order.orderId}
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              disabled={!orders.data.nextCursor}
              onClick={() => {
                setSelectedOrder(null);
                detailResource.clear();
                setAfter(orders.data.nextCursor ?? undefined);
              }}
            >
              Next orders page
            </Button>
          </>
        )}
        {selectedOrder &&
          (detail.status !== "ready" ? (
            <Status state={detail.status} />
          ) : (
            <section aria-label="Order detail">
              <h4>Order {detail.data.orderId}</h4>
              <p>Status: {detail.data.status.replaceAll("_", " ")}</p>
              <p>Server total: {formatMoney(detail.data.amountPaise, locale)}</p>
              <ul>
                {detail.data.lines.map((line) => (
                  <li key={line.skuId}>
                    {line.skuId}: {line.quantity} — {formatMoney(line.amountPaise, locale)}
                  </li>
                ))}
              </ul>
              {detail.data.deliveryAddress ? (
                <p>
                  Delivery snapshot: {detail.data.deliveryAddress.recipientName},{" "}
                  {detail.data.deliveryAddress.line1}, {detail.data.deliveryAddress.line2},{" "}
                  {detail.data.deliveryAddress.city}, {detail.data.deliveryAddress.region},{" "}
                  {detail.data.deliveryAddress.postalCode}, {detail.data.deliveryAddress.country}.
                </p>
              ) : (
                <Notice>Delivery snapshot is unavailable in this projection.</Notice>
              )}
              <Button
                disabled={
                  !schemas.paymentInput ||
                  !schemas.payment ||
                  (hasPayment && payment.status === "loading")
                }
                onClick={() => {
                  const orderId = detail.data.orderId;
                  let input = paymentAttempts.current.get(orderId);
                  if (!input) {
                    input = {
                      operationId: crypto.randomUUID(),
                      subject: { kind: "order", id: orderId },
                      method: "razorpay",
                    };
                    paymentAttempts.current.set(orderId, input);
                  }
                  const request = input;
                  setHasPayment(true);
                  void paymentResource.run(
                    (signal) => api.createPayment(orderId, request, signal),
                    parser(schemas.payment),
                  );
                }}
              >
                Request or retry identical Razorpay payment intent
              </Button>
              {(!schemas.paymentInput || !schemas.payment) && <Status state="unavailable" />}
              <Notice>
                Fulfillment and shipment tracking are unavailable. Invoice/document retrieval and
                reorder are unavailable.
              </Notice>
            </section>
          ))}
        {hasPayment &&
          (payment.status !== "ready" ? (
            <Status state={payment.status} />
          ) : (
            <Notice>
              Payment intent for {payment.data.subject.kind} {payment.data.subject.id}:{" "}
              {payment.data.state}. Server amount: {formatMoney(payment.data.amountPaise, locale)}.
              Pending, ready and unknown are not captured. Refresh the order to verify its current
              state.
            </Notice>
          ))}
        {paymentTarget && (
          <div>
            <Button
              disabled={
                payment.status !== "ready" ||
                payment.data.state !== "ready" ||
                !schemas.paymentCheckout
              }
              onClick={() => {
                if (payment.status !== "ready" || payment.data.state !== "ready") return;
                const expected = payment.data;
                void paymentResource.run(
                  (signal) =>
                    checkout.current?.launch(expected, signal) ??
                    Promise.resolve({ status: "unavailable" as const }),
                  parser(schemas.payment),
                );
              }}
            >
              Pay with Razorpay
            </Button>
            <p>
              Razorpay completion, dismissal or errors only trigger a server status check. Payment
              is confirmed only by the server; your existing intent is retained.
            </p>
            <Button
              disabled={payment.status === "loading"}
              onClick={() =>
                void paymentResource.run(
                  (signal) => api.readPayment(paymentTarget, signal),
                  parser(schemas.payment),
                )
              }
            >
              Refresh payment status
            </Button>
            <Button
              disabled={payment.status === "loading" || !schemas.reconcileInput}
              onClick={() =>
                void paymentResource.run(
                  (signal) => api.reconcilePayment(paymentTarget, signal),
                  parser(schemas.payment),
                )
              }
            >
              Reconcile existing payment
            </Button>
            <p>
              These actions check the existing intent. They do not create a charge or launch
              payment.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}
