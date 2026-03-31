/**
 * Evolution API v2 — envio de texto.
 * @see https://doc.evolution-api.com/v2/api-reference/message-controller/send-text
 */
export async function evolutionSendText(params: {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
  /** E.164 sem símbolos, ex.: 5511987654321 */
  number: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
  const base = params.baseUrl.replace(/\/$/, "");
  const url = `${base}/message/sendText/${encodeURIComponent(params.instanceName)}`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 25_000);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: params.apiKey,
    },
    body: JSON.stringify({
      number: params.number,
      text: params.text,
    }),
    signal: ac.signal,
  }).finally(() => clearTimeout(t));

  const text = await res.text();
  if (res.ok) {
    return { ok: true };
  }
  return { ok: false, status: res.status, body: text.slice(0, 500) };
}
