import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "../../lib/api";

export default function SettingsPage() {
  const sources = useQuery({
    queryKey: ["sources"],
    queryFn: () => apiGet<any[]>("/sources")
  });

  const [kind, setKind] = useState<"M3U"|"XTREAM">("M3U");
  const [name, setName] = useState("");
  const [m3uUrl, setM3uUrl] = useState("");
  const [epgUrl, setEpgUrl] = useState("");

  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [headersJson, setHeadersJson] = useState("{\n  \"User-Agent\": \"Mozilla/5.0\",\n  \"Referer\": \"\"\n}");
  const [timeoutMs, setTimeoutMs] = useState(15000);
  const [refreshMinutes, setRefreshMinutes] = useState(360);

  const [status, setStatus] = useState<string | undefined>();

  async function validate() {
    setStatus("Validating...");
    try {
      const headers = JSON.parse(headersJson || "{}");
      const config = kind === "M3U"
        ? { m3uUrl }
        : { baseUrl, username, password };

      const r = await apiPost<any>("/sources/validate", {
        kind,
        config,
        headers,
        timeoutMs
      });
      setStatus(`OK. Counts: live=${r.counts.live}, movies=${r.counts.movies}, series=${r.counts.series}`);
    } catch (e: any) {
      setStatus(`Validation failed: ${e.message}`);
    }
  }

  async function addSource() {
    setStatus("Adding...");
    try {
      const headers = JSON.parse(headersJson || "{}");
      const body: any = {
        kind, name, headers,
        timeoutMs,
        refreshIntervalMinutes: refreshMinutes
      };
      if (kind === "M3U") {
        body.m3uUrl = m3uUrl;
        body.epgUrl = epgUrl || undefined;
      } else {
        body.baseUrl = baseUrl;
        body.username = username;
        body.password = password;
      }
      await apiPost("/sources", body);
      await sources.refetch();
      setStatus("Added. Initial refresh scheduled.");
    } catch (e: any) {
      setStatus(`Add failed: ${e.message}`);
    }
  }

  async function refresh(id: string) {
    setStatus("Refreshing...");
    await apiPost(`/sources/${id}/refresh`, {});
    await sources.refetch();
    setStatus("Refreshed.");
  }

  async function refreshEpg(id: string) {
    setStatus("Refreshing EPG...");
    const r = await apiPost(`/epg/${id}/refresh`, {});
    setStatus(`EPG: ${r.message} Inserted=${r.inserted}`);
  }

  return (
    <div className="container">
      <div className="grid cols2" style={{ alignItems: "start" }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Sources</h2>
          <p className="muted">
            Add **authorized** sources only. This app does not include any playlists or credentials.
          </p>

          <div className="row">
            <select value={kind} onChange={(e) => setKind(e.target.value as any)}>
              <option value="M3U">M3U</option>
              <option value="XTREAM">Xtream</option>
            </select>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Source name" />
          </div>

          {kind === "M3U" ? (
            <div style={{ marginTop: 12 }} className="grid">
              <input value={m3uUrl} onChange={(e) => setM3uUrl(e.target.value)} placeholder="M3U URL" />
              <input value={epgUrl} onChange={(e) => setEpgUrl(e.target.value)} placeholder="XMLTV EPG URL (optional)" />
            </div>
          ) : (
            <div style={{ marginTop: 12 }} className="grid">
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="Base URL (http://host:port)" />
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
              <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
            </div>
          )}

          <div style={{ marginTop: 12 }} className="grid">
            <textarea value={headersJson} onChange={(e) => setHeadersJson(e.target.value)} rows={5} />
            <div className="row">
              <div style={{ flex: 1 }}>
                <label className="muted">Timeout (ms)</label>
                <input value={timeoutMs} onChange={(e) => setTimeoutMs(parseInt(e.target.value, 10) || 15000)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="muted">Refresh interval (min)</label>
                <input value={refreshMinutes} onChange={(e) => setRefreshMinutes(parseInt(e.target.value, 10) || 360)} />
              </div>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn secondary" onClick={validate}>Test connection</button>
            <button className="btn" onClick={addSource}>Add source</button>
          </div>

          {status && <div style={{ marginTop: 12 }} className="card">{status}</div>}
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Manage</h2>
          <div style={{ maxHeight: 650, overflow: "auto" }}>
            {(sources.data ?? []).map((s) => (
              <div key={s.id} className="card" style={{ marginBottom: 10 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div className="muted">{s.kind} · refresh {s.refreshIntervalMinutes}m · timeout {s.timeoutMs}ms</div>
                    {s.lastError && <div className="muted">Last error: {s.lastError}</div>}
                  </div>
                  <div className="row">
                    <button className="btn secondary" onClick={() => refresh(s.id)}>Refresh</button>
                    <button className="btn secondary" onClick={() => refreshEpg(s.id)}>EPG</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="muted">
            Security note: for production, set <code>PROXY_HOST_ALLOWLIST</code> to restrict upstream hosts.
          </p>
        </div>
      </div>
    </div>
  );
}
