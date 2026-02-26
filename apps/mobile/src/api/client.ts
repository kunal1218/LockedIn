export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ApiRequestOptions = {
  method?: ApiMethod;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const DEFAULT_PRODUCTION_API_BASE_URL = "https://api-production-ccb1.up.railway.app";

const inferApiBaseUrl = (): string => {
  const explicit =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL;

  if (explicit && explicit.trim()) {
    return trimTrailingSlash(explicit.trim());
  }
  return DEFAULT_PRODUCTION_API_BASE_URL;
};

export const API_BASE_URL = inferApiBaseUrl();

const resolveApiError = async (response: Response): Promise<ApiError> => {
  let message = `API error: ${response.status}`;

  try {
    const payload = (await response.json()) as { error?: string };
    if (payload?.error) {
      message = payload.error;
    }
  } catch {
    // Ignore parse failures and use the status fallback.
  }

  return new ApiError(response.status, message);
};

const apiRequest = async <T>(
  path: string,
  { method = "GET", body, token, headers = {} }: ApiRequestOptions = {}
): Promise<T> => {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const requestHeaders: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body:
      typeof body === "undefined"
        ? undefined
        : isFormData
        ? (body as FormData)
        : JSON.stringify(body),
  });

  if (!response.ok) {
    throw await resolveApiError(response);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const responseText = await response.text();
  if (!responseText) {
    return {} as T;
  }

  return JSON.parse(responseText) as T;
};

export const apiGet = async <T>(path: string, token?: string | null): Promise<T> =>
  apiRequest<T>(path, { token });

export const apiPost = async <T>(
  path: string,
  body: unknown,
  token?: string | null,
  headers?: Record<string, string>
): Promise<T> => apiRequest<T>(path, { method: "POST", body, token, headers });

export const apiPut = async <T>(
  path: string,
  body: unknown,
  token?: string | null
): Promise<T> => apiRequest<T>(path, { method: "PUT", body, token });

export const apiPatch = async <T>(
  path: string,
  body: unknown,
  token?: string | null
): Promise<T> => apiRequest<T>(path, { method: "PATCH", body, token });

export const apiDelete = async <T>(
  path: string,
  token?: string | null,
  body?: unknown
): Promise<T> =>
  apiRequest<T>(path, {
    method: "DELETE",
    token,
    body,
  });
