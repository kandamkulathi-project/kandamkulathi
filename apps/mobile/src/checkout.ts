import type { Checkout } from "@kandamkulathi/contracts/sensitive";
import { checkoutSchema } from "@kandamkulathi/contracts/sensitive";
import Constants, { ExecutionEnvironment } from "expo-constants";

// Razorpay 3.0.0 ships no declaration for its entry point. Keep its untyped output unknown.
interface NativeCheckout {
  open(input: Checkout & { name: string; retry: { enabled: false } }): Promise<unknown>;
}
let sdkBusy = false;
export function nativeCheckout(local: boolean) {
  let disposed = false;
  let cancel: (() => void) | undefined;
  return {
    dispose() {
      disposed = true;
      cancel?.();
    },
    async open(input: Checkout): Promise<unknown> {
      const checkout = checkoutSchema.parse(input);
      if (
        disposed ||
        sdkBusy ||
        (local && !checkout.key.startsWith("rzp_test_")) ||
        Constants.executionEnvironment === ExecutionEnvironment.StoreClient
      )
        throw new Error("A supported native development build is required");
      sdkBusy = true;
      let sdk: NativeCheckout;
      try {
        sdk = (require("react-native-razorpay") as { default: NativeCheckout }).default;
      } catch {
        sdkBusy = false;
        throw new Error("Native checkout unavailable");
      }
      return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (value?: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          cancel = undefined;
          if (value && !disposed) resolve(value);
          else reject(new Error("Reconciliation required"));
        };
        const timeout = setTimeout(() => finish(), 5 * 60 * 1000);
        cancel = () => finish();
        // Keep the SDK lock until the actual SDK settles, even if our lifecycle/timeout invalidates the promise.
        try {
          void sdk
            .open({ ...checkout, name: "Kandamkulathi", retry: { enabled: false } })
            .then(finish, () => finish())
            .finally(() => {
              sdkBusy = false;
            });
        } catch {
          sdkBusy = false;
          finish();
        }
      });
    },
  };
}
