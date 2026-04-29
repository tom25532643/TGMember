export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  let data: any = null;

  try {
    data = await res.json();
  } catch {}

  if (!res.ok) {
    throw new ApiError(
      data?.detail || data?.message || `HTTP ${res.status}`,
      res.status,
      data,
    );
  }

  return data;
}
