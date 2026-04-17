const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

type RequestOptions = RequestInit & {
  auth?: boolean;
};

type AccessTokenGetter = () => Promise<string | null>;

let accessTokenGetter: AccessTokenGetter | null = null;

export function setAccessTokenGetter(getter: AccessTokenGetter | null) {
  accessTokenGetter = getter;
}

export async function apiRequest<T>(
    path: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const { auth = false, headers, ...rest } = options;
  
    const finalHeaders = new Headers(headers);
    finalHeaders.set("Content-Type", "application/json");
  
    if (auth) {
      if (!accessTokenGetter) {
        throw new Error("Access token getter is not configured");
      }
  
      const token = await accessTokenGetter();
      
      if (!token) {
        throw new Error("User is not authenticated");
      }
  
      finalHeaders.set("Authorization", `Bearer ${token}`);
    }
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
    });
  
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
  
      try {
        const errorData = await response.json();
        console.error("API error response:", errorData);
  
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
  
    if (response.status === 204) {
      return undefined as T;
    }
  
    return response.json() as Promise<T>;
  }