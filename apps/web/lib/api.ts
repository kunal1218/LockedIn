const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4001";

export const apiGet = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
};
