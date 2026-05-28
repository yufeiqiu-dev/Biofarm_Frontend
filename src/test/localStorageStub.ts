import { beforeEach, afterEach } from 'vitest';

export function setupLocalStorageStub(): Map<string, string> {
  const store = new Map<string, string>();
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

  const mock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
  };

  beforeEach(() => {
    store.clear();
    Object.defineProperty(window, 'localStorage', {
      value: mock,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(window, 'localStorage', originalDescriptor);
    }
  });

  return store;
}
