export interface XtreamConfig {
  baseUrl: string; // e.g. http://host:port
  username: string;
  password: string;
}

export interface XtreamLiveCategory { category_id: string; category_name: string; }
export interface XtreamLiveStream {
  stream_id: string;
  name: string;
  stream_icon?: string;
  epg_channel_id?: string;
  category_id?: string;
}

export interface XtreamVodCategory { category_id: string; category_name: string; }
export interface XtreamVodStream {
  stream_id: string;
  name: string;
  stream_icon?: string;
  category_id?: string;
  container_extension?: string; // mp4, mkv, etc.
}

export interface XtreamSeries {
  series_id: string;
  name: string;
  cover?: string;
  category_id?: string;
}

export interface XtreamSeriesInfo {
  episodes?: Record<string, Array<{
    id: string;
    episode_num: number;
    title: string;
    container_extension?: string;
  }>>;
}

export class XtreamClient {
  constructor(
    private cfg: XtreamConfig,
    private timeoutMs: number,
    private headers: Record<string, string>
  ) {}

  private apiUrl(action: string, extra: Record<string, string> = {}) {
    const u = new URL(this.cfg.baseUrl.replace(/\/$/, "") + "/player_api.php");
    u.searchParams.set("username", this.cfg.username);
    u.searchParams.set("password", this.cfg.password);
    u.searchParams.set("action", action);
    for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, v);
    return u.toString();
  }

  private async getJson<T>(url: string): Promise<T> {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { headers: this.headers, signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return (await res.json()) as T;
    } finally {
      clearTimeout(t);
    }
  }

  getLiveCategories() {
    return this.getJson<XtreamLiveCategory[]>(this.apiUrl("get_live_categories"));
  }
  getLiveStreams(categoryId?: string) {
    return this.getJson<XtreamLiveStream[]>(this.apiUrl("get_live_streams", categoryId ? { category_id: categoryId } : {}));
  }
  getVodCategories() {
    return this.getJson<XtreamVodCategory[]>(this.apiUrl("get_vod_categories"));
  }
  getVodStreams(categoryId?: string) {
    return this.getJson<XtreamVodStream[]>(this.apiUrl("get_vod_streams", categoryId ? { category_id: categoryId } : {}));
  }
  getSeriesCategories() {
    return this.getJson<XtreamVodCategory[]>(this.apiUrl("get_series_categories"));
  }
  getSeries(categoryId?: string) {
    return this.getJson<XtreamSeries[]>(this.apiUrl("get_series", categoryId ? { category_id: categoryId } : {}));
  }
  getSeriesInfo(seriesId: string) {
    return this.getJson<XtreamSeriesInfo>(this.apiUrl("get_series_info", { series_id: seriesId }));
  }

  // Typical URL patterns; provider-dependent but common:
  buildLiveUrl(streamId: string, ext: string = "m3u8") {
    const b = this.cfg.baseUrl.replace(/\/$/, "");
    return `${b}/live/${this.cfg.username}/${this.cfg.password}/${streamId}.${ext}`;
  }
  buildMovieUrl(vodId: string, ext: string = "mp4") {
    const b = this.cfg.baseUrl.replace(/\/$/, "");
    return `${b}/movie/${this.cfg.username}/${this.cfg.password}/${vodId}.${ext}`;
  }

  xmltvUrl() {
    const b = this.cfg.baseUrl.replace(/\/$/, "");
    return `${b}/xmltv.php?username=${encodeURIComponent(this.cfg.username)}&password=${encodeURIComponent(this.cfg.password)}`;
  }

  /**
   * Catch-up is provider-dependent. Some expose endpoints like:
   *  - timeshift.php?username=..&password=..&stream=..&start=..&duration=..
   * Keep this as a stub for your provider specifics.
   */
  catchupUrlStub(streamId: string, startUtc: string, durationMin: number) {
    const b = this.cfg.baseUrl.replace(/\/$/, "");
    return `${b}/timeshift.php?username=${encodeURIComponent(this.cfg.username)}&password=${encodeURIComponent(this.cfg.password)}&stream=${encodeURIComponent(streamId)}&start=${encodeURIComponent(startUtc)}&duration=${durationMin}`;
  }
}
