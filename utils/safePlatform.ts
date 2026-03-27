// Safe Platform wrapper that delays access until runtime
let _Platform: any = null;

export function getPlatform() {
  if (!_Platform) {
    _Platform = require('react-native').Platform;
  }
  return _Platform;
}

export const SafePlatform = new Proxy({} as any, {
  get(target, prop) {
    return getPlatform()[prop];
  }
});
