/** Keep a read-only view stable when features retain it or copy their context. */
export function createLivePresentations(initial: Readonly<Record<string, unknown>>) {
  let snapshot = Object.freeze({ ...initial });
  const value = new Proxy(Object.create(null) as Readonly<Record<string, unknown>>, {
    get: (_target, key) => Reflect.get(snapshot, key),
    has: (_target, key) => Reflect.has(snapshot, key),
    ownKeys: () => Reflect.ownKeys(snapshot),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(snapshot, key);
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
    set: () => false,
    defineProperty: () => false,
    deleteProperty: () => false,
    setPrototypeOf: () => false,
    preventExtensions: () => false,
  });
  return {
    value,
    update(next: Readonly<Record<string, unknown>>) {
      snapshot = Object.freeze({ ...next });
    },
  };
}
