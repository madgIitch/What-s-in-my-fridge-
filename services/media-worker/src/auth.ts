type TokenInfo = {
  aud?: string;
  email?: string;
  email_verified?: string;
  exp?: string;
  iss?: string;
};

export async function verifyTaskOidc(
  header: string | string[] | undefined,
  audience = process.env.WORKER_OIDC_AUDIENCE,
  serviceAccount = process.env.TASKS_SERVICE_ACCOUNT_EMAIL,
  fetcher: typeof fetch = fetch,
) {
  if (typeof header !== "string" || !header.startsWith("Bearer ") || !audience || !serviceAccount) return false;
  const token = header.slice(7);
  if (token.split(".").length !== 3) return false;
  try {
    const response = await fetcher(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return false;
    const claims = await response.json() as TokenInfo;
    return claims.aud === audience
      && claims.email === serviceAccount
      && claims.email_verified === "true"
      && (claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com")
      && Number(claims.exp) > Date.now() / 1000;
  } catch {
    return false;
  }
}
