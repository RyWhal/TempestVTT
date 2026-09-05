// Serialize writes to the same resource, including writes from separate hook instances.
// A failed request must not prevent subsequent edits from being saved.
const writes = new Map<string, Promise<unknown>>();

export function enqueueWrite<T>(key: string, write: () => Promise<T>): Promise<T> {
  const next = (writes.get(key) ?? Promise.resolve()).catch(() => undefined).then(write);
  writes.set(key, next);
  void next.finally(() => {
    if (writes.get(key) === next) writes.delete(key);
  }).catch(() => undefined);
  return next;
}
