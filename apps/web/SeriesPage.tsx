import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";

export default function SeriesPage() {
  const [search, setSearch] = useState("");

  const series = useQuery({
    queryKey: ["series", search],
    queryFn: () => apiGet<any[]>(`/vod/series?search=${encodeURIComponent(search)}&limit=200`)
  });

  return (
    <div className="container">
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Series</h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search series..." />
        </div>

        <p className="muted" style={{ marginTop: 8 }}>
          This scaffold lists series but does not fetch episodes yet because it needs storing provider IDs for Xtream series.
          Add columns like provider_series_id and provider_source_kind to support episode ingest.
        </p>

        <div style={{ marginTop: 12 }} className="grid cols3">
          {(series.data ?? []).map((s) => (
            <div key={s.id} className="card">
              <div style={{ fontWeight: 700 }}>{s.title}</div>
              <div className="muted">{s.category ?? "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
