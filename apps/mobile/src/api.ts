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

export interface SupabaseSignInResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: {
    id: string;
    email?: string;
  };
}

function sanitizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export async function requestSupabasePasswordSignIn(
  supabaseUrl: string,
  supabaseAnonKey: string,
  email: string,
  password: string,
): Promise<SupabaseSignInResponse> {
  const cleanedUrl = sanitizeUrl(supabaseUrl);
  const cleanedAnonKey = supabaseAnonKey.trim();

  const response = await fetch(
    `${cleanedUrl}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        apikey: cleanedAnonKey,
        Authorization: `Bearer ${cleanedAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim(),
        password,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase sign-in failed (${response.status}): ${text}`);
  }

  return (await response.json()) as SupabaseSignInResponse;
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
