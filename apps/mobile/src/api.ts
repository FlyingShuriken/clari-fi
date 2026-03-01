export interface VerifyResponse {
  tokenType: string;
  accessToken: string;
  expiresIn: string;
  user: {
    id: string;
    email: string;
    supabaseUserId: string;
  };
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  options: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }

  return (await response.json()) as T;
}
