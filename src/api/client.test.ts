import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest, setSessionGetter } from './client';

describe('apiRequest', () => {
  beforeEach(() => {
    setSessionGetter(null);
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
      ...response,
    });
    vi.stubGlobal('fetch', spy);
    return spy;
  }

  describe('error normalisation', () => {
    it('surfaces a string detail as the error message', async () => {
      mockFetch({ ok: false, status: 400, json: async () => ({ detail: 'Insufficient stock' }) });
      await expect(apiRequest('/x')).rejects.toThrow('Insufficient stock');
    });

    it('joins a FastAPI validation-error array', async () => {
      mockFetch({
        ok: false,
        status: 422,
        json: async () => ({ detail: [{ msg: 'price must be >= 0' }, { msg: 'name is required' }] }),
      });
      await expect(apiRequest('/x')).rejects.toThrow('price must be >= 0; name is required');
    });

    it('does not log the error body to the console', async () => {
      // This runs in the customer's console on the deployed site. Whatever the
      // API said about the failure belongs in the thrown Error, where the UI
      // decides what is safe to show.
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch({ ok: false, status: 500, json: async () => ({ detail: 'internal detail' }) });

      await expect(apiRequest('/x')).rejects.toThrow();

      expect(consoleError).not.toHaveBeenCalled();
    });
  });

  describe('empty responses', () => {
    it('returns undefined for 204 rather than parsing an empty body', async () => {
      mockFetch({ status: 204, json: async () => { throw new Error('no body'); } });
      await expect(apiRequest('/x')).resolves.toBeUndefined();
    });
  });

  describe('auth', () => {
    it('throws a named error when called before AuthProvider mounts', async () => {
      mockFetch({});
      await expect(apiRequest('/x', { auth: true })).rejects.toThrow(
        'Session getter is not configured'
      );
    });

    it('sends the access token, and the id token when there is one', async () => {
      const spy = mockFetch({});
      setSessionGetter(async () => ({ accessToken: 'acc-1', idToken: 'id-1' }));

      await apiRequest('/x', { auth: true });

      const headers = spy.mock.calls[0][1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer acc-1');
      // X-Id-Token is where the checkout endpoint reads the customer email from.
      expect(headers.get('X-Id-Token')).toBe('id-1');
    });

    it('omits X-Id-Token when the session has no id token', async () => {
      const spy = mockFetch({});
      setSessionGetter(async () => ({ accessToken: 'acc-1' }));

      await apiRequest('/x', { auth: true });

      expect((spy.mock.calls[0][1].headers as Headers).get('X-Id-Token')).toBeNull();
    });
  });

  describe('timeouts', () => {
    it('passes an abort signal so a request cannot hang forever', async () => {
      const spy = mockFetch({});
      await apiRequest('/x');
      expect(spy.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it('reports a timeout in words the UI can show', async () => {
      // A backend that accepts the connection and then stops answering used to
      // leave the page on its loading state indefinitely, with no error.
      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        }))
      );

      await expect(apiRequest('/x', { timeoutMs: 10 })).rejects.toThrow(/timed out/i);
    });

    it("aborts when the caller's own signal fires", async () => {
      const controller = new AbortController();
      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        }))
      );

      const pending = apiRequest('/x', { signal: controller.signal });
      controller.abort();

      await expect(pending).rejects.toThrow();
    });
  });
});

describe('combining abort signals', () => {
  // AbortSignal.any landed in Chrome 116, Firefox 124 and Safari 17.4. On
  // anything older it is undefined, and calling it throws - which would not
  // degrade a request but break every one of them.
  /** A fetch that never resolves on its own, and rejects the way the real one
   *  does - including immediately when handed a signal that is already
   *  aborted, which fires no event to listen for. */
  function hangingFetch() {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
        const fail = () => reject(new DOMException('aborted', 'AbortError'));
        if (init.signal?.aborted) return fail();
        init.signal?.addEventListener('abort', fail, { once: true });
      })),
    );
  }

  it("aborts on the caller's signal without AbortSignal.any", async () => {
    const original = AbortSignal.any;
    // @ts-expect-error - simulating an older browser
    AbortSignal.any = undefined;
    try {
      hangingFetch();
      const controller = new AbortController();
      const pending = apiRequest('/x', { signal: controller.signal });
      controller.abort();
      await expect(pending).rejects.toThrow();
    } finally {
      AbortSignal.any = original;
    }
  });

  it('still times out without AbortSignal.any', async () => {
    const original = AbortSignal.any;
    // @ts-expect-error - simulating an older browser
    AbortSignal.any = undefined;
    try {
      hangingFetch();
      const controller = new AbortController();
      await expect(
        apiRequest('/x', { signal: controller.signal, timeoutMs: 10 }),
      ).rejects.toThrow(/timed out/i);
    } finally {
      AbortSignal.any = original;
    }
  });

  it('honours a signal that was already aborted before the call', async () => {
    hangingFetch();
    const controller = new AbortController();
    controller.abort();
    await expect(apiRequest('/x', { signal: controller.signal })).rejects.toThrow();
  });
});
