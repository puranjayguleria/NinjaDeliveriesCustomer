export type RazorpayWebViewSuccess = (response: any) => void | Promise<void>;
export type RazorpayWebViewFailure = (error: any) => void | Promise<void>;

type Entry = {
  onSuccess?: RazorpayWebViewSuccess;
  onFailure?: RazorpayWebViewFailure;
  createdAt: number;
};

const store = new Map<string, Entry>();

const TTL_MS = 15 * 60 * 1000; // 15 minutes

function cleanup() {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (now - val.createdAt > TTL_MS) store.delete(key);
  }
}

export function registerRazorpayWebViewCallbacks(entry: {
  onSuccess?: RazorpayWebViewSuccess;
  onFailure?: RazorpayWebViewFailure;
}): string {
  cleanup();
  const sessionId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  store.set(sessionId, { ...entry, createdAt: Date.now() });
  return sessionId;
}

export function consumeRazorpayWebViewCallbacks(sessionId?: string | null): Entry {
  if (!sessionId) return { createdAt: Date.now() };
  const entry = store.get(sessionId);
  if (entry) store.delete(sessionId);
  return entry ?? { createdAt: Date.now() };
}
