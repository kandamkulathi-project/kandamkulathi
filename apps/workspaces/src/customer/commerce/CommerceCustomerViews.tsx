import { type ClientSession, sessionSchema } from "@kandamkulathi/contracts/client";
import { formatMoney, foundation, type Locale } from "@kandamkulathi/i18n";
import { Button, Notice } from "@kandamkulathi/ui";
import { useEffect, useId, useMemo, useState } from "react";
import {
  type AddressInput,
  type Catalogue,
  type CommerceApi,
  type Failure,
  type MutationContext,
  type PrivateCommerce,
  parseAddress,
  parseCatalogue,
  parsePrivate,
  parseQuantity,
} from "./contracts";
import { CommerceResource, type ResourceState } from "./resource";
import "./commerce.css";

export type CommerceSession =
  | { status: "ready"; session: ClientSession; epoch: string }
  | { status: Failure | "loading" };
export type CommerceCustomerProps = {
  locale: Locale;
  api?: CommerceApi;
  session: CommerceSession;
  onRefreshSession?: () => void;
  onSignIn?: () => void;
  onSignOut?: () => void;
};
function StateNotice({ state, locale }: { state: string; locale: Locale }) {
  const labels = foundation[locale];
  const message =
    state === "loading"
      ? labels.loading
      : state === "anonymous"
        ? labels.anonymous
        : state === "denied"
          ? labels.denied
          : state === "unavailable"
            ? labels.unavailable
            : state === "conflict"
              ? "The record changed. Refresh before trying again."
              : "We could not load commerce data. Refresh to check the current state.";
  return <Notice error={state === "error" || state === "conflict"}>{message}</Notice>;
}
function useResource<T>() {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  const resource = useMemo(() => new CommerceResource<T>(setState), []);
  useEffect(() => () => resource.clear(), [resource]);
  return [state, resource] as const;
}

export function CommerceCustomerViews(props: CommerceCustomerProps) {
  const { locale, api, session } = props;
  const [catalogue, resource] = useResource<Catalogue>();
  const [category, setCategory] = useState("");
  const [concern, setConcern] = useState("");
  const filterId = useId();
  useEffect(() => {
    resource.clear();
    void resource.run(
      (signal) =>
        api ? api.catalogue({ locale, signal }) : Promise.resolve({ status: "unavailable" }),
      parseCatalogue,
    );
    return () => resource.clear();
  }, [api, locale, resource]);
  const refresh = () => {
    resource.clear();
    void resource.run(
      (signal) =>
        api ? api.catalogue({ locale, signal }) : Promise.resolve({ status: "unavailable" }),
      parseCatalogue,
    );
  };
  const parsed = session.status === "ready" ? sessionSchema.safeParse(session.session) : null;
  const valid =
    parsed?.success &&
    parsed.data.workspaces.includes("customer") &&
    Date.parse(parsed.data.expiresAt) > Date.now();
  return (
    <div className="customer-commerce" data-commerce-view lang={locale}>
      <h2>{foundation[locale].commerce}</h2>
      {locale !== "en" && (
        <Notice>
          <span lang="en">
            New commerce labels are in English. Reviewed translations are pending.
          </span>
        </Notice>
      )}
      <section aria-labelledby={`${filterId}-catalogue`}>
        <h3 id={`${filterId}-catalogue`} lang="en">
          Product catalogue
        </h3>
        {catalogue.status !== "ready" ? (
          <>
            <StateNotice state={catalogue.status} locale={locale} />
            <Button onClick={refresh} disabled={catalogue.status === "loading"}>
              Refresh catalogue
            </Button>
          </>
        ) : (
          <>
            <div className="actions" lang="en">
              <label htmlFor={`${filterId}-category`}>
                Category
                <select
                  id={`${filterId}-category`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All categories</option>
                  {catalogue.data.categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor={`${filterId}-concern`}>
                Concern
                <select
                  id={`${filterId}-concern`}
                  value={concern}
                  onChange={(e) => setConcern(e.target.value)}
                >
                  <option value="">All concerns</option>
                  {catalogue.data.concerns.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {catalogue.data.products.filter(
              (p) =>
                (!category || p.categoryIds.includes(category)) &&
                (!concern || p.concernIds.includes(concern)),
            ).length === 0 && <Notice>{foundation[locale].empty}</Notice>}
            <ul className="commerce-products">
              {catalogue.data.products
                .filter(
                  (p) =>
                    (!category || p.categoryIds.includes(category)) &&
                    (!concern || p.concernIds.includes(concern)),
                )
                .map((product) => (
                  <li key={product.id}>
                    <details>
                      <summary>{product.name}</summary>
                      <p>{product.description}</p>
                      <ul>
                        {product.variants.map((variant) => (
                          <li key={variant.id}>
                            {variant.name} — {formatMoney(variant.pricePaise, locale)}
                            <p lang="en">
                              Stock: {variant.stock}. Purchase:{" "}
                              {variant.purchase.replaceAll("_", " ")}.
                            </p>
                          </li>
                        ))}
                      </ul>
                      {product.variants.length === 0 && <Notice>{foundation[locale].empty}</Notice>}
                    </details>
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>
      {session.status === "ready" && valid && parsed?.success ? (
        <PrivateBoundary
          key={`${parsed.data.userId}:${parsed.data.expiresAt}:${session.epoch}:${locale}`}
          {...props}
          verifiedSession={parsed.data}
          catalogue={catalogue.status === "ready" ? catalogue.data : undefined}
        />
      ) : (
        <section aria-label="Customer account">
          <StateNotice
            state={session.status === "ready" ? "denied" : session.status}
            locale={locale}
          />
          {session.status === "anonymous" && props.onSignIn && (
            <Button onClick={props.onSignIn}>Sign in</Button>
          )}
        </section>
      )}
    </div>
  );
}

function PrivateBoundary(
  props: CommerceCustomerProps & {
    verifiedSession: ClientSession;
    catalogue?: Catalogue | undefined;
  },
) {
  const [invalidated, setInvalidated] = useState(false);
  useEffect(() => {
    const clear = () => setInvalidated(true);
    const hide = () => {
      if (document.visibilityState === "hidden") clear();
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) clear();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", clear);
    window.addEventListener("pageshow", restore);
    const timer = setTimeout(
      clear,
      Math.max(0, Date.parse(props.verifiedSession.expiresAt) - Date.now()),
    );
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", clear);
      window.removeEventListener("pageshow", restore);
    };
  }, [props.verifiedSession.expiresAt]);
  if (invalidated)
    return (
      <section data-commerce-private="cleared">
        <Notice>{foundation[props.locale].anonymous}</Notice>
        {props.onRefreshSession && (
          <Button onClick={props.onRefreshSession}>{foundation[props.locale].retry}</Button>
        )}
      </section>
    );
  return <PrivateViews {...props} onInvalidate={() => setInvalidated(true)} />;
}

function PrivateViews({
  api,
  locale,
  verifiedSession,
  catalogue,
  onSignOut,
  onInvalidate,
}: CommerceCustomerProps & {
  verifiedSession: ClientSession;
  catalogue?: Catalogue | undefined;
  onInvalidate: () => void;
}) {
  const [state, resource] = useResource<PrivateCommerce>();
  const [refreshCount, setRefreshCount] = useState(0);
  const parse = (value: unknown) => parsePrivate(value, verifiedSession.userId);
  useEffect(() => {
    resource.clear();
    void resource.run(
      (signal) =>
        api ? api.readPrivate({ signal, locale }) : Promise.resolve({ status: "unavailable" }),
      (value) => parsePrivate(value, verifiedSession.userId),
    );
    return () => resource.clear();
  }, [api, locale, resource, verifiedSession.userId]);
  const refresh = () => {
    resource.clear();
    setRefreshCount((value) => value + 1);
    void resource.run(
      (signal) =>
        api ? api.readPrivate({ signal, locale }) : Promise.resolve({ status: "unavailable" }),
      parse,
    );
  };
  function mutate(call: (api: CommerceApi, context: MutationContext) => Promise<unknown>) {
    if (!api || state.status !== "ready" || state.data.operation !== "idle") return;
    const revision = state.data.revision;
    const operationId = crypto.randomUUID();
    void resource.run((signal) => call(api, { signal, locale, revision, operationId }), parse);
  }
  return (
    <section data-commerce-private={state.status} lang="en">
      <div className="actions">
        <Button disabled={state.status === "loading"} onClick={refresh}>
          Refresh account and cart
        </Button>
        {onSignOut && (
          <Button
            onClick={() => {
              resource.clear();
              onInvalidate();
              onSignOut();
            }}
          >
            Sign out
          </Button>
        )}
      </div>
      {state.status !== "ready" ? (
        <StateNotice state={state.status} locale={locale} />
      ) : (
        <CommerceForms
          key={`${state.data.revision}:${refreshCount}`}
          data={state.data}
          catalogue={catalogue}
          locale={locale}
          mutate={mutate}
        />
      )}
    </section>
  );
}

type Mutate = (call: (api: CommerceApi, context: MutationContext) => Promise<unknown>) => void;
function CommerceForms({
  data,
  catalogue,
  locale,
  mutate,
}: {
  data: PrivateCommerce;
  catalogue?: Catalogue | undefined;
  locale: Locale;
  mutate: Mutate;
}) {
  const id = useId();
  const [variantId, setVariantId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [error, setError] = useState("");
  const [address, setAddress] = useState<AddressInput>({
    recipient: "",
    line1: "",
    city: "",
    state: "",
    pincode: "",
    phone: "",
  });
  const locked = data.operation !== "idle";
  const variants =
    catalogue?.products.flatMap((p) =>
      p.variants
        .filter((v) => v.purchase === "allowed" && v.stock === "available")
        .map((v) => ({ ...v, name: `${p.name} — ${v.name}` })),
    ) ?? [];
  return (
    <>
      <h3>Account</h3>
      <p>{data.account.displayName}</p>
      {locked && (
        <Notice>
          Operation: {data.operation.replaceAll("_", " ")}. Refresh to check the server state before
          another action.
        </Notice>
      )}
      {error && <Notice error>{error}</Notice>}
      <section aria-labelledby={`${id}-cart`}>
        <h3 id={`${id}-cart`}>Cart</h3>
        <form
          className="commerce-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (variants.some((v) => v.id === variantId))
              mutate((api, context) => api.addItem({ variantId, quantity: 1 }, context));
          }}
        >
          <label htmlFor={`${id}-variant`}>
            Product variant
            <select
              id={`${id}-variant`}
              required
              value={variantId}
              disabled={locked || variants.length === 0}
              onChange={(e) => setVariantId(e.target.value)}
            >
              <option value="">Select a variant</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={locked || !variantId}>
            Add to cart
          </Button>
        </form>
        {data.cart.lines.length === 0 ? (
          <Notice>{foundation[locale].empty}</Notice>
        ) : (
          <ul className="commerce-lines">
            {data.cart.lines.map((line) => (
              <li key={line.variantId}>
                <p>
                  {line.name} — {formatMoney(line.lineTotalPaise, locale)}
                </p>
                <QuantityForm
                  name={line.name}
                  quantity={line.quantity}
                  disabled={locked}
                  onSubmit={(quantity) =>
                    mutate((api, context) =>
                      api.setQuantity({ variantId: line.variantId, quantity }, context),
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
        <p>
          Server total: <strong>{formatMoney(data.cart.totalPaise, locale)}</strong>
        </p>
        {data.cart.pricing === "stale" && (
          <Notice error>Prices have changed. Refresh the cart before checkout.</Notice>
        )}
        <form
          className="commerce-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              !locked &&
              data.cart.checkoutAllowed &&
              data.cart.pricing === "current" &&
              data.cart.lines.length > 0 &&
              data.addresses.some((a) => a.id === addressId && a.serviceability === "available")
            )
              mutate((api, context) => api.requestCheckout({ addressId }, context));
          }}
        >
          <label htmlFor={`${id}-delivery`}>
            Delivery address
            <select
              id={`${id}-delivery`}
              required
              value={addressId}
              disabled={locked}
              onChange={(e) => setAddressId(e.target.value)}
            >
              <option value="">Select an address</option>
              {data.addresses.map((a) => (
                <option key={a.id} value={a.id} disabled={a.serviceability !== "available"}>
                  {a.recipient}, {a.line1}, {a.pincode} — {a.serviceability}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            disabled={
              locked ||
              !data.cart.checkoutAllowed ||
              data.cart.pricing !== "current" ||
              !addressId ||
              data.cart.lines.length === 0
            }
          >
            Request checkout
          </Button>
        </form>
        <p>
          Checkout and payment require server verification. A request does not confirm an order or
          payment.
        </p>
      </section>
      <section aria-labelledby={`${id}-addresses`}>
        <h3 id={`${id}-addresses`}>Addresses</h3>
        {data.addresses.length === 0 ? (
          <Notice>{foundation[locale].empty}</Notice>
        ) : (
          <ul>
            {data.addresses.map((a) => (
              <li key={a.id}>
                {a.recipient}, {a.line1}, {a.city}, {a.state}, {a.pincode}. Serviceability:{" "}
                {a.serviceability}.
              </li>
            ))}
          </ul>
        )}
        <form
          className="commerce-form"
          onSubmit={(event) => {
            event.preventDefault();
            try {
              const input = parseAddress(address);
              setError("");
              mutate((api, context) => api.saveAddress(input, context));
            } catch {
              setError(
                "Enter all address fields, a six-digit Indian pincode and a valid phone number.",
              );
            }
          }}
        >
          <fieldset disabled={locked}>
            <legend>Add an address</legend>
            {(
              [
                ["recipient", "Recipient", "name"],
                ["line1", "Address line", "address-line1"],
                ["city", "City", "address-level2"],
                ["state", "State", "address-level1"],
                ["pincode", "Pincode", "postal-code"],
                ["phone", "Phone", "tel"],
              ] as const
            ).map(([field, label, autoComplete]) => (
              <label className="commerce-field" key={field} htmlFor={`${id}-${field}`}>
                {label}
                <input
                  id={`${id}-${field}`}
                  required
                  autoComplete={autoComplete}
                  type={field === "phone" ? "tel" : "text"}
                  inputMode={field === "pincode" ? "numeric" : undefined}
                  maxLength={
                    field === "pincode" ? 6 : field === "phone" ? 16 : field === "line1" ? 300 : 100
                  }
                  value={address[field]}
                  onChange={(e) => setAddress({ ...address, [field]: e.target.value })}
                />
              </label>
            ))}
            <Button type="submit">Save address</Button>
          </fieldset>
        </form>
      </section>
      <section aria-labelledby={`${id}-orders`}>
        <h3 id={`${id}-orders`}>Order history</h3>
        {data.orders.length === 0 ? (
          <Notice>{foundation[locale].empty}</Notice>
        ) : (
          <ul className="commerce-lines">
            {data.orders.map((order) => (
              <li key={order.id}>
                <details>
                  <summary>
                    Order {order.reference} — {order.status}
                  </summary>
                  <p>Server total: {formatMoney(order.totalPaise, locale)}</p>
                  <p>Payment: {order.payment.replaceAll("_", " ")}</p>
                  <p>Tracking: {order.tracking}</p>
                  <Button
                    disabled={locked || !order.reorderAllowed}
                    onClick={() =>
                      mutate((api, context) => api.reorder({ orderId: order.id }, context))
                    }
                  >
                    Reorder {order.reference}
                  </Button>
                  <p>Reorder checks current prices, stock and eligibility on the server.</p>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function QuantityForm({
  name,
  quantity,
  disabled,
  onSubmit,
}: {
  name: string;
  quantity: number;
  disabled: boolean;
  onSubmit: (value: number) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(String(quantity));
  const [error, setError] = useState(false);
  return (
    <form
      className="commerce-form"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          const parsed = parseQuantity(value);
          setError(false);
          onSubmit(parsed);
        } catch {
          setError(true);
        }
      }}
    >
      <label htmlFor={id}>
        Quantity for {name}
        <input
          id={id}
          type="number"
          min="0"
          max="999"
          step="1"
          required
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={error}
          aria-describedby={`${id}-help`}
        />
      </label>
      <p id={`${id}-help`}>
        Use 0 to remove this item. {error ? "Enter a whole number from 0 to 999." : ""}
      </p>
      <Button type="submit" disabled={disabled}>
        Update quantity
      </Button>
    </form>
  );
}
