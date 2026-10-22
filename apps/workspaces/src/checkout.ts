import { type Checkout, checkoutSchema } from "@kandamkulathi/contracts/sensitive";

interface CheckoutInstance {
  open(): void;
  close(): void;
}
interface CheckoutConstructor {
  new (
    options: Checkout & {
      name: string;
      handler(value: unknown): void;
      modal: { ondismiss(): void };
      retry: { enabled: false };
    },
  ): CheckoutInstance;
}
declare global {
  interface Window {
    Razorpay?: CheckoutConstructor;
  }
}
let loading: Promise<void> | undefined;
function load() {
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.referrerPolicy = "no-referrer";
    const timeout = setTimeout(() => {
      script.remove();
      reject(new Error("Checkout unavailable"));
    }, 10000);
    script.onload = () => {
      clearTimeout(timeout);
      if (window.Razorpay) resolve();
      else reject(new Error("Checkout unavailable"));
    };
    script.onerror = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error("Checkout unavailable"));
    };
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
export function browserCheckout(local: boolean) {
  let active: CheckoutInstance | undefined;
  let cancel: (() => void) | undefined;
  let closed = false;
  let opening = false;
  return {
    dispose() {
      closed = true;
      const instance = active;
      cancel?.();
      instance?.close();
    },
    async open(input: Checkout, isCurrent: () => boolean): Promise<unknown> {
      const parsed = checkoutSchema.parse(input);
      if (
        closed ||
        !isCurrent() ||
        opening ||
        active ||
        (local && !parsed.key.startsWith("rzp_test_"))
      )
        throw new Error("Checkout unavailable");
      opening = true;
      try {
        await load();
        const Constructor = window.Razorpay;
        if (closed || !isCurrent() || !Constructor) throw new Error("Checkout unavailable");
        return await new Promise((resolve, reject) => {
          let settled = false;
          const finish = (value?: unknown) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            active = undefined;
            cancel = undefined;
            if (value) resolve(value);
            else reject(new Error("Reconciliation required"));
          };
          const timeout = setTimeout(
            () => {
              const instance = active;
              finish();
              instance?.close();
            },
            5 * 60 * 1000,
          );
          cancel = () => finish();
          try {
            active = new Constructor({
              ...parsed,
              name: "Kandamkulathi",
              handler: finish,
              modal: { ondismiss: () => finish() },
              retry: { enabled: false },
            });
            if (!isCurrent()) {
              const instance = active;
              finish();
              instance.close();
              return;
            }
            active.open();
          } catch {
            const instance = active;
            finish();
            instance?.close();
          }
        });
      } finally {
        opening = false;
      }
    },
  };
}
