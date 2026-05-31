// @ts-nocheck
// Thin fetch wrapper.

export type Req = {
  base: string;
  path: string;
  method?: string;
  body?: unknown;
  rawBody?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

export type Resp = {
  status: number;
  text: string;
  json: any | null;
  durationMs: number;
};

export async function send(req: Req): Promise<Resp> {
  const init: RequestInit = { method: req.method ?? "POST" };
  if (req.rawBody !== undefined) {
    init.body = req.rawBody;
    init.headers = { "Content-Type": "application/json", ...(req.headers ?? {}) };
  } else if (req.body !== undefined) {
    init.body = JSON.stringify(req.body);
    init.headers = { "Content-Type": "application/json", ...(req.headers ?? {}) };
  } else if (req.headers) {
    init.headers = req.headers;
  }
  if (req.timeoutMs) {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), req.timeoutMs);
    init.signal = ctl.signal;
  }
  const start = performance.now();
  const r = await fetch(`${req.base}${req.path}`, init);
  const text = await r.text();
  const durationMs = performance.now() - start;
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {}
  }
  return { status: r.status, text, json, durationMs };
}

export async function readyzLanguages(base: string): Promise<Record<string, boolean>> {
  try {
    const r = await fetch(`${base}/readyz`);
    const j: any = await r.json().catch(() => ({}));
    const langs = j?.languages ?? {};
    const out: Record<string, boolean> = {};
    for (const k of Object.keys(langs)) out[k] = !!langs[k]?.ok;
    return out;
  } catch {
    return {};
  }
}

export async function reachable(base: string): Promise<boolean> {
  try {
    const r = await fetch(`${base}/healthz`);
    return r.ok;
  } catch {
    return false;
  }
}
