import { XMLParser } from "fast-xml-parser";

export interface XmlTvProgramme {
  channel: string;
  title: string;
  startUtcMs: number;
  endUtcMs: number;
  desc?: string | null;
}

/**
 * Parse XMLTV datetime like: 20250115193000 +0000
 */
export function parseXmlTvDate(s: string): number {
  // "YYYYMMDDHHmmss Z"
  const m = /^([0-9]{4})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})([0-9]{2})\s*([\+\-][0-9]{4})/.exec(s.trim());
  if (!m) return Date.now();
  const [_, Y, Mo, D, h, mi, se, tz] = m;
  // Build ISO like: 2025-01-15T19:30:00+00:00
  const iso = `${Y}-${Mo}-${D}T${h}:${mi}:${se}${tz.slice(0, 3)}:${tz.slice(3)}`;
  return Date.parse(iso);
}

export function parseXmlTv(xml: string): XmlTvProgramme[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
    // keep arrays for programme nodes
    isArray: (name) => name === "programme" || name === "channel"
  });

  const doc: any = parser.parse(xml);
  const progs = doc?.tv?.programme ?? [];
  const out: XmlTvProgramme[] = [];

  for (const p of progs) {
    const channel = p?.["@_channel"];
    const start = p?.["@_start"];
    const stop = p?.["@_stop"];
    if (!channel || !start || !stop) continue;

    const titleNode = p?.title;
    const descNode = p?.desc;

    const title = (Array.isArray(titleNode) ? titleNode[0]?.["#text"] : titleNode?.["#text"]) ?? "Untitled";
    const desc = (Array.isArray(descNode) ? descNode[0]?.["#text"] : descNode?.["#text"]) ?? null;

    out.push({
      channel,
      title,
      startUtcMs: parseXmlTvDate(start),
      endUtcMs: parseXmlTvDate(stop),
      desc
    });
  }

  return out;
}
