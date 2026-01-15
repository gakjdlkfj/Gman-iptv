import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost } from "../../lib/api";
import HlsPlayer from "../components/HlsPlayer";

export default function MoviesPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>();

  const movies = useQuery({
    queryKey: ["movies", search],
    queryFn: () => apiGet<any[]>(`/vod/movies?search=${encodeURIComponent(search)}&limit=200`)
  });

  async function playMovie(m: any) {
    const session = await apiPost<{ok:boolean; id:string}>("/playback/session", {
      kind: "MOVIE",
      url: m.stream_url,
      headers: {}
    });
    setSelected({ ...m, _playSrc: `http://localhost:8787/proxy/file/${session.id}` });
  }

  return (
    <div className="container">
      <div className="grid cols2" style={{ alignItems: "start" }}>
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>Movies</h2>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search movies..." />
          </div>
          <div style={{ marginTop: 12, maxHeight: 600, overflow: "auto" }}>
            {(movies.data ?? []).map((m) => (
              <div key={m.id} className="card" style={{ marginBottom: 10, cursor: "pointer", borderColor: selected?.id === m.id ? "#1f6feb" : undefined }}
                   onClick={() => playMovie(m)}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{m.title}</div>
                    <div className="muted">{m.category ?? "—"}</div>
                  </div>
                  <span className="tag">MP4</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ height: 650 }}>
          {selected ? (
            <HlsPlayer title={selected.title} src={selected._playSrc} kind={"MP4"} lowLatency={false} />
          ) : (
            <div className="muted">Select a movie to play.</div>
          )}
        </div>
      </div>
    </div>
  );
}
