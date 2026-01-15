import React, { useEffect, useState } from "react";

export default function DiagnosticsPage() {
  const [cap, setCap] = useState<any>({});
  useEffect(() => {
    const info: any = {};
    info.userAgent = navigator.userAgent;
    info.hardwareConcurrency = (navigator as any).hardwareConcurrency;
    info.deviceMemory = (navigator as any).deviceMemory;
    info.connection = (navigator as any).connection ? {
      effectiveType: (navigator as any).connection.effectiveType,
      downlink: (navigator as any).connection.downlink,
      rtt: (navigator as any).connection.rtt,
      saveData: (navigator as any).connection.saveData
    } : null;
    setCap(info);
  }, []);

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Diagnostics</h2>
        <p className="muted">
          This page shows device/browser hints. For stream diagnostics (codec, bandwidth, dropped frames),
          pull stats from hls.js and <code>video.getVideoPlaybackQuality()</code> during playback.
        </p>

        <pre className="card" style={{ overflow: "auto" }}>
{JSON.stringify(cap, null, 2)}
        </pre>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Next steps for full diagnostics</h3>
          <ul>
            <li>Show codec support via <code>navigator.mediaCapabilities.decodingInfo()</code>.</li>
            <li>Expose hls.js events (FRAG_BUFFERED, LEVEL_SWITCHED, ERROR) into a log panel.</li>
            <li>Show dropped frames via <code>getVideoPlaybackQuality()</code> where supported.</li>
            <li>Track rebuffer events + bitrate timeline.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
