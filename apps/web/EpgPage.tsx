import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";

type ChannelRow = any;
type EpgRow = any;

export default function EpgPage() {
  const [windowHours, setWindowHours] = useState<2|4|24>(2);

  const channels = useQuery({
    queryKey: ["channels_for_epg"],
    queryFn: () => apiGet<ChannelRow[]>(`/live/channels?limit=50`)
  });

  const now = Date.now();
  const from = now - (30 * 60_000);
  const to = now + (windowHours * 60 * 60_000);

  const channelKeys = useMemo(() => {
    // This scaffold uses xmltv channel id as channel_key. For M3U you should map tvg-id to XMLTV channel id.
    // We'll just use epg_channel_id if present, else tvg_id else channel id.
    return (channels.data ?? []).map((c) => c.epg_channel_id || c.tvg_id || c.id);
  }, [channels.data]);

  const epg = useQuery({
    queryKey: ["epg", windowHours, channelKeys.join("|")],
    queryFn: () => apiGet<EpgRow[]>(`/epg?channelKeys=${encodeURIComponent(channelKeys.join(","))}&from=${from}&to=${to}`),
    enabled: channelKeys.length > 0
  });

  // group EPG by channel_key
  const byChannel = useMemo(() => {
    const m = new Map<string, EpgRow[]>();
    for (const p of (epg.data ?? [])) {
      const k = p.channel_key as string;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(p);
    }
    return m;
  }, [epg.data]);

  return (
    <div className="container">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>EPG</h2>
          <div className="row">
            <label className="muted">Window</label>
            <select value={windowHours} onChange={(e) => setWindowHours(parseInt(e.target.value,10) as any)}>
              <option value={2}>2h</option>
              <option value={4}>4h</option>
              <option value={24}>24h</option>
            </select>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          This is a simplified EPG view. For a production-grade grid (virtualized timeline, smooth scroll, Now/Next, reminders),
          implement a row-virtualized timeline with absolute-positioned programme blocks.
        </p>

        <div style={{ marginTop: 12, maxHeight: 600, overflow: "auto" }}>
          {(channels.data ?? []).map((c) => {
            const key = c.epg_channel_id || c.tvg_id || c.id;
            const progs = byChannel.get(key) ?? [];
            const nowProg = progs.find(p => p.start_utc_ms <= now && p.end_utc_ms > now);
            const nextProg = progs.find(p => p.start_utc_ms > now);
            return (
              <div key={c.id} className="card" style={{ marginBottom: 10 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div className="tag">{c.group_title ?? "Other"}</div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <div><span className="muted">Now:</span> {nowProg ? nowProg.title : "—"}</div>
                  <div><span className="muted">Next:</span> {nextProg ? nextProg.title : "—"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
