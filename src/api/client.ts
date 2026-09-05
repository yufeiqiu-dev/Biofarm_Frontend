const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Fail at load rather than per request. Unset, every path resolved against the
// string "undefined", so the app looked like a backend outage - every page
// erroring, nothing in the network tab pointing at a configuration problem.
if (!API_BASE_URL) {
  throw new Error(
    "VITE_API_BASE_URL is not set. It must include the /api/v1 prefix, " +
      "e.g. http://127.0.0.1:8000/api/v1 - see README.md."
  );
}

// A request with no deadline never resolves and never rejects if the backend
// accepts the connection and then stops answering. The UI is left on its
// loading state with no error and no way back short of a reload.
const REQUEST_TIMEOUT_MS = 30_000;

type RequestOptions = RequestInit & {
  auth?: boolean;
  /** Override the default deadline, in milliseconds. */
  timeoutMs?: number;
};

/**
 * Combine abort signals, falling back where `AbortSignal.any` is missing.
 *
 * `AbortSignal.any` landed in Chrome 116, Firefox 124 and Safari 17.4 - so on
 * anything older than roughly early 2024 it is `undefined`, and calling it
 * throws a TypeError. That would not degrade a request, it would break every
 * one of them, on a browser old enough that the customer has no idea why the
 * site does nothing. The fallback is small enough that guessing about who is
 * still on Safari 17.3 is not worth it.
 */
function combineSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals);
  }

  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}

type SessionTokens = { accessToken: string; idToken?: string };
type SessionGetter = () => Promise<SessionTokens | null>;

let sessionGetter: SessionGetter | null = null;

export function setSessionGetter(getter: SessionGetter | null) {
  sessionGetter = getter;
}

export async function apiRequest<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { auth = false, headers, timeoutMs = REQUEST_TIMEOUT_MS, signal, ...rest } = options;

    const finalHeaders = new Headers(headers);
    finalHeaders.set("Content-Type", "application/json");

    if (auth) {
      if (!sessionGetter) {
        throw new Error("Session getter is not configured");
      }

      const session = await sessionGetter();

      if (!session) {
        throw new Error("User is not authenticated");
      }

      finalHeaders.set("Authorization", `Bearer ${session.accessToken}`);
      if (session.idToken) {
        finalHeaders.set("X-Id-Token", session.idToken);
      }
    }

    // Honour a caller's own signal alongside the deadline, so component
    // unmounts still abort in flight.
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
    const abortSignal = signal
      ? combineSignals([signal, timeoutController.signal])
      : timeoutController.signal;

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        ...rest,
        headers: finalHeaders,
        signal: abortSignal,
      });
    } catch (err) {
      if (timeoutController.signal.aborted) {
        throw new Error(`Request timed out after ${timeoutMs / 1000}s. Please try again.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;

      try {
        // Deliberately not logged. The body carries whatever the API chose to
        // say about the failure, and this runs in the customer's console on the
        // deployed site; the message is surfaced through the thrown Error, which
        // is where the UI can decide what is safe to show.
        const errorData = await response.json();

        const detail = errorData?.detail;

        if (typeof detail === "string") {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          errorMessage = detail
            .map((item) => {
              if (typeof item === "string") return item;
              if (item?.msg) return item.msg;
              return JSON.stringify(item);
            })
            .join("; ");
        } else if (detail && typeof detail === "object") {
          errorMessage = JSON.stringify(detail);
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        } else {
          errorMessage = JSON.stringify(errorData);
        }
      } catch {
        // ignore JSON parse failure
      }

      throw new Error(errorMessage);
    }

    if (response.status === 204 || response.status === 205) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
