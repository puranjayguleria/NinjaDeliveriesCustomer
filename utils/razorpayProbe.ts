export function probeRazorpayNative(): {
  available: boolean;
  hasOpen: boolean;
  keys: string[];
  error?: string;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-razorpay");
    const keys = mod ? Object.keys(mod) : [];
    const hasOpen = !!mod?.open || !!mod?.default?.open;
    return { available: !!mod, hasOpen, keys };
  } catch (e: any) {
    return {
      available: false,
      hasOpen: false,
      keys: [],
      error: String(e?.message || e),
    };
  }
}
