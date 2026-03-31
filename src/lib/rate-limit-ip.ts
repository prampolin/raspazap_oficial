/** Limite simples por IP (memória do processo). Adequado para reduzir abuso em rotas públicas. */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

const buckets = new Map<string, { count: number; windowStart: number }>();

export function rateLimitIp(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || now - b.windowStart >= WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (b.count >= MAX_REQUESTS) return false;
  b.count += 1;
  return true;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}
