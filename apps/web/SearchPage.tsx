import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/api";

export default function SearchPage() {
  const [q, setQ] = useState("");

  const data = useQuery({
    queryKey: ["search", q],
    queryFn: () => apiGet<any>(`/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0
  });

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Global Search</h2>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Live + Movies + Series..." />

        {q.trim().length === 0 ? (
          <p className="muted" style={{ marginTop: 12 }}>Type to search across merged catalogs.</p>
        ) : (
          <div style={{ marginTop: 12 }} className="grid cols2">
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Channels</h3>
              {(data.data?.channels ?? []).map((c: any) => (
                <div key={c.id} className="card" style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div className="muted">{c.group_title ?? "Other"}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0 }}>VOD</h3>
              {(data.data?.vod ?? []).map((v: any) => (
                <div key={v.id} className="card" style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{v.title}</div>
                  <div className="muted">{v.kind} · {v.category ?? "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
