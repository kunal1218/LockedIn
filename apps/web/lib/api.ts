const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001"
).replace(/\/$/, "");

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
};

const apiRequest = async <T>(
  path: string,
  { method = "GET", body, token, signal }: ApiRequestOptions = {}
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    let message = `API error: ${response.status}`;

    try {
      const data = (await response.json()) as { error?: string };
      if (data?.error) {
        message = data.error;
      }
    } catch {
      // Ignore JSON parse errors.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
};

export const apiGet = async <T>(
  path: string,
  token?: string,
  options: Pick<ApiRequestOptions, "signal"> = {}
): Promise<T> => apiRequest<T>(path, { token, ...options });

export const apiPost = async <T>(
  path: string,
  body: unknown,
  token?: string
): Promise<T> => apiRequest<T>(path, { method: "POST", body, token });

export const apiPatch = async <T>(
  path: string,
  body: unknown,
  token?: string
): Promise<T> => apiRequest<T>(path, { method: "PATCH", body, token });

export const apiPut = async <T>(
  path: string,
  body: unknown,
  token?: string
): Promise<T> => apiRequest<T>(path, { method: "PUT", body, token });

export const apiDelete = async <T>(path: string, token?: string): Promise<T> =>
  apiRequest<T>(path, { method: "DELETE", token });
