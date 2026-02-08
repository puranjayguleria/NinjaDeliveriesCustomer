// Minimal module/type shims to keep TypeScript happy when modules don't ship types.
// Runtime behavior is unaffected.

declare module "@env" {
  export const GOOGLE_PLACES_API_KEY: string;
}

declare module "lodash" {
  const lodash: any;
  export = lodash;
}

declare module "react-native-razorpay" {
  const RazorpayCheckout: any;
  export default RazorpayCheckout;
}
