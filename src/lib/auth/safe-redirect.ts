/** Evita open redirect: só caminhos relativos na própria origem. */
export function safeAuthRedirectPath(
  raw: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!raw || typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }
  return raw;
}
