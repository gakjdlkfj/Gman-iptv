import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "../../lib/api";
import HlsPlayer from "../components/HlsPlayer";

type ChannelRow = any;

export default function MultiViewPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [audioIdx, setAudioIdx] = useState<number>(0);
  const [playTiles, setPlayTiles] = useState<any[]>([]);
  const [lowLatency, setLowLatency] = useState(true);

  const channels = useQuery({
    queryKey: ["channels_mv"],
    queryFn: () => apiGet<ChannelRow[]>(`/live/channels?limit=200`)
  });

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const has = prev.includes(id);
      const next = has ? prev.filter(x => x !== id) : [...prev, id];
      return next.slice(0, 4);
    });
  }

  async function start() {
    const list = (channels.data ?? []).filter(c => selectedIds.includes(c.id));
    const tiles = [];
    for (const ch of list) {
      const session = await apiPost<{ok:boolean; id:string}>("/playback/session", {
        kind: "LIVE",
        url: ch.stream_url,
        headers: {}
      });
      const src = ch.stream_type === "HLS"
        ? `http://localhost:8787/proxy/hls/${session.id}/manifest.m3u8`
        : `http://localhost:8787/proxy/file/${session.id}`;
      tiles.push({ ...ch, _playSrc: src });
    }
    setPlayTiles(tiles);
    setAudioIdx(0);
  }

  const grid = useMemo(() => {
    const cols = 2;
    return { cols };
  }, []);

  return (
    <div className="container">
      <div className="grid cols2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>Multiview</h2>
            <div className="row">
              <button className="btn secondary" onClick={() => setLowLatency(!lowLatency)}>
                {lowLatency ? "Low latency: ON" : "Low latency: OFF"}
              </button>
              <button className="btn" onClick={start} disabled={selectedIds.length === 0}>Start</button>
            </div>
          </div>

          <p className="muted" style={{ marginTop: 8 }}>
            Performance-aware tip: many devices can't decode 4 HLS streams smoothly.
            Start with 2 tiles, then scale up.
          </p>

          <div style={{ marginTop: 12, maxHeight: 580, overflow: "auto" }}>
            {(channels.data ?? []).map((ch) => {
              const active = selectedIds.includes(ch.id);
              return (
                <div key={ch.id} className="card" style={{ marginBottom: 10, cursor: "pointer", borderColor: active ? "#1f6feb" : undefined }}
                     onClick={() => toggle(ch.id)}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{ch.name}</div>
                      <div className="muted">{ch.group_title ?? "Other"}</div>
                    </div>
                    <div className="row">
                      <span className="tag">{ch.stream_type}</span>
                      {active && <span className="tag">Selected</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card" style={{ height: 700 }}>
          {playTiles.length === 0 ? (
            <div className="muted">Select up to 4 channels on the left, then click Start.</div>
          ) : (
            <div className="grid cols2" style={{ height: 660 }}>
              {playTiles.map((t, idx) => (
                <div key={t.id} className="card" style={{ padding: 0, overflow: "hidden", borderColor: idx === audioIdx ? "#1f6feb" : "#1f2a3a" }}
                     onClick={() => setAudioIdx(idx)}>
                  <HlsPlayer
                    title={`${t.name} ${idx === audioIdx ? "(AUDIO)" : ""}`}
                    src={t._playSrc}
                    kind={t.stream_type}
                    lowLatency={lowLatency}
                    muted={idx !== audioIdx}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
