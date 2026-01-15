export async function fetchText(url: string, opts: { headers: Record<string,string>, timeoutMs: number }) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), opts.timeoutMs);
  try {
    const res = await fetch(url, { headers: opts.headers, signal: ac.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}
