import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "../../lib/api";
import HlsPlayer from "../components/HlsPlayer";
import { usePlayerStore } from "../../lib/store";

type GroupRow = { groupTitle: string; count: number };
type ChannelRow = any;

export default function LivePage() {
  const [group, setGroup] = useState<string | undefined>();
  const [search, setSearch] = useState<string>("");
  const [selected, setSelected] = useState<ChannelRow | undefined>();

  const lowLatency = usePlayerStore(s => s.lowLatency);
  const toggleLowLatency = usePlayerStore(s => s.toggleLowLatency);
  const aspect = usePlayerStore(s => s.aspect);
  const toggleAspect = usePlayerStore(s => s.toggleAspect);

  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => apiGet<GroupRow[]>("/live/groups")
  });

  const channels = useQuery({
    queryKey: ["channels", group, search],
    queryFn: () => apiGet<ChannelRow[]>(`/live/channels?group=${encodeURIComponent(group ?? "")}&search=${encodeURIComponent(search)}&limit=200`),
  });

  async function playChannel(ch: ChannelRow) {
    setSelected(ch);

    // Create playback session. For HLS: use /proxy/hls/{playId}/manifest.m3u8
    const session = await apiPost<{ok:boolean; id:string}>("/playback/session", {
      kind: "LIVE",
      url: ch.stream_url,
      headers: {} // NOTE: if your source needs headers, store source headers and send them here
    });

    const src = ch.stream_type === "HLS"
      ? `http://localhost:8787/proxy/hls/${session.id}/manifest.m3u8`
      : `http://localhost:8787/proxy/file/${session.id}`;

    setSelected({ ...ch, _playSrc: src });
  }

  function zap(delta: number) {
    const list = channels.data ?? [];
    const idx = selected ? list.findIndex(x => x.id === selected.id) : -1;
    const next = list[Math.max(0, Math.min(list.length - 1, idx + delta))];
    if (next) playChannel(next);
  }

  // keyboard/remote zapping (↑↓)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") zap(1);
      if (e.key === "ArrowUp") zap(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, channels.data]);

  return (
    <div className="container">
      <div className="grid cols2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>Live TV</h2>
            <div className="row">
              <button className="btn secondary" onClick={toggleLowLatency}>{lowLatency ? "Low latency: ON" : "Low latency: OFF"}</button>
              <button className="btn secondary" onClick={toggleAspect}>{aspect === "contain" ? "Aspect: Contain" : "Aspect: Cover"}</button>
            </div>
          </div>

          <div style={{ marginTop: 12 }} className="row">
            <select value={group ?? ""} onChange={(e) => setGroup(e.target.value || undefined)}>
              <option value="">All groups</option>
              {(groups.data ?? []).map(g => <option key={g.groupTitle} value={g.groupTitle}>{g.groupTitle} ({g.count})</option>)}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search channels..." />
          </div>

          <div style={{ marginTop: 12, maxHeight: 540, overflow: "auto" }}>
            {(channels.data ?? []).map((ch) => (
              <div key={ch.id} className="card" style={{ marginBottom: 10, cursor: "pointer", borderColor: selected?.id === ch.id ? "#1f6feb" : undefined }}
                   onClick={() => playChannel(ch)}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{ch.name}</div>
                    <div className="muted">{ch.group_title ?? "Other"}</div>
                  </div>
                  <div className="row">
                    <span className="tag">{ch.stream_type}</span>
                    <span className="tag"><span className="kbd">↑</span>/<span className="kbd">↓</span> zap</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ height: 650 }}>
          {selected ? (
            <HlsPlayer
              title={selected.name}
              src={selected._playSrc}
              kind={selected.stream_type}
              lowLatency={lowLatency}
            />
          ) : (
            <div className="muted">Select a channel to start playback.</div>
          )}
          <div className="row" style={{ marginTop: 10, justifyContent: "space-between" }}>
            <button className="btn secondary" onClick={() => zap(-1)}>Prev</button>
            <button className="btn secondary" onClick={() => zap(1)}>Next</button>
          </div>
        </div>
      </div>
    </div>
  );
}
