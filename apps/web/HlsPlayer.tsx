import React, { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";

type Props = {
  title?: string;
  src: string;          // proxied URL
  kind: "HLS" | "MP4" | "UNKNOWN";
  lowLatency: boolean;
  muted?: boolean;
  onTime?: (t: number) => void;
  initialTime?: number;
};

export default function HlsPlayer(props: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [stats, setStats] = useState<{ bw?: number; dropped?: number; level?: number; audioTrack?: number; subtitleTrack?: number }>({});
  const [err, setErr] = useState<string | undefined>();

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    setErr(undefined);

    // cleanup old instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (props.kind === "MP4") {
      v.src = props.src;
      v.muted = !!props.muted;
      v.play().catch(() => {});
      return;
    }

    if (props.kind !== "HLS") {
      setErr("Unsupported stream type in browser. If this is MPEG-TS, add a server-side transmuxer to HLS.");
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: props.lowLatency,
        backBufferLength: 30,
        maxBufferLength: props.lowLatency ? 10 : 30,
        liveSyncDuration: props.lowLatency ? 3 : 6,
        liveMaxLatencyDuration: props.lowLatency ? 8 : 20
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          // Recovery strategy
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            setErr(`${data.type}: ${data.details}`);
            hls.destroy();
          }
        }
      });

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        const l = hls.currentLevel;
        const bw = hls.bandwidthEstimate;
        setStats(s => ({ ...s, level: l, bw }));
      });

      hls.attachMedia(v);
      hls.loadSource(props.src);

      v.muted = !!props.muted;
      v.play().catch(() => {});
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      v.src = props.src;
      v.muted = !!props.muted;
      v.play().catch(() => {});
    } else {
      setErr("HLS not supported in this browser.");
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [props.src, props.kind, props.lowLatency, props.muted]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => props.onTime?.(v.currentTime);
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [props.onTime]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (props.initialTime && props.initialTime > 0) {
      try { v.currentTime = props.initialTime; } catch {}
    }
  }, [props.initialTime]);

  return (
    <div className="videoWrap" style={{ height: "100%" }}>
      <video ref={videoRef} controls playsInline style={{ objectFit: "contain" }} />
      <div className="overlay">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="pill">
            <span style={{ fontWeight: 600 }}>{props.title ?? "Player"}</span>
            <span className="tag">{props.kind}</span>
            {props.lowLatency && <span className="tag">Low Latency</span>}
          </div>
          <div className="pill">
            {stats.bw ? <span className="muted">BW: {Math.round(stats.bw/1000)} kbps</span> : <span className="muted">BW: —</span>}
            {Number.isFinite(stats.level) ? <span className="muted">Level: {stats.level}</span> : <span className="muted">Level: —</span>}
          </div>
        </div>
        {err && <div style={{ marginTop: 8 }} className="card">{err}</div>}
      </div>
    </div>
  );
}
