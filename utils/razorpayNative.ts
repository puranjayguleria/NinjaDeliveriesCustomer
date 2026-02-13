import { Platform } from "react-native";

export type RazorpayNativeOptions = {
  key: string;
  order_id: string;
  amount: string; // paise string
  currency: string;
  name: string;
  description?: string;
  prefill?: {
    contact?: string;
    email?: string;
    name?: string;
  };
  notes?: Record<string, any>;
  theme?: {
    color?: string;
  };
};

export type RazorpayNativeResult = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
} & Record<string, any>;

const TAG = "\uD83D\uDCB3[RZPNative]";

export function getRazorpayNativeModule(): any | null {
  try {
    // Lazy require so Expo Go/dev environments don't crash.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-razorpay");
    // Some builds expose it as { default: { open } } (ESM interop)
    return mod?.open ? mod : mod?.default ? mod.default : mod;
  } catch (e) {
    if (__DEV__) console.warn(TAG, "native_module_unavailable", e);
    return null;
  }
}

export async function openRazorpayNative(
  options: RazorpayNativeOptions
): Promise<RazorpayNativeResult> {
  const RazorpayCheckout = getRazorpayNativeModule();
  if (!RazorpayCheckout?.open) {
    const err: any = new Error("Razorpay native checkout unavailable");
    err.code = "NATIVE_UNAVAILABLE";
    throw err;
  }

  if (__DEV__) {
    console.log(TAG, "open", {
      platform: Platform.OS,
      order_id: options.order_id,
      amount: options.amount,
      currency: options.currency,
      hasPrefill: !!options.prefill,
    });
  }

  const res = await RazorpayCheckout.open(options);
  if (__DEV__) console.log(TAG, "success", res);
  return res as RazorpayNativeResult;
}
