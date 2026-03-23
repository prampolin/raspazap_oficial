function normalizeAdminEmailToken(token: string): string {
  let t = token.trim().toLowerCase();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim().toLowerCase();
  }
  return t;
}

/** E-mails com acesso ao painel admin (separados por vírgula em ADMIN_EMAILS). */
export function getAdminEmailSet(): Set<string> {
  const raw = process.env.ADMIN_EMAILS?.trim() ?? "";
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;\n]+/)
      .map((e) => normalizeAdminEmailToken(e))
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const set = getAdminEmailSet();
  if (set.size === 0) return false;
  return set.has(email.trim().toLowerCase());
}

export function isAdminConfigured(): boolean {
  return getAdminEmailSet().size > 0;
}
