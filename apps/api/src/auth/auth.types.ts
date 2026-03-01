export interface VerifiedSupabaseIdentity {
  sub: string;
  email: string;
}

export interface AppTokenPayload {
  sub: string;
  email: string;
  supabaseUserId: string;
}
