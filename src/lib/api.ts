export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export async function api<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api" + url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Rota-Client": "web",
      ...options.headers,
    },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({
      message: "Bağlantı kurulamadı. Lütfen yeniden deneyin.",
    }));
    throw new ApiError(response.status, data.message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}
export const post = <T>(url: string, body: unknown) =>
  api<T>(url, { method: "POST", body: JSON.stringify(body) });
