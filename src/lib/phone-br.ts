/** Normaliza dígitos BR (DDD + número, 10 ou 11 dígitos) para E.164 Brasil (55…). */
export function toE164BR(digits: string): string | null {
  const d = digits.replace(/\D/g, "");
  if (d.length < 10 || d.length > 11) return null;
  return `55${d}`;
}
