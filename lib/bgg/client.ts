/* eslint-disable no-console */
import { XMLParser } from "fast-xml-parser";
import type {
  BggId,
  BggThing,
  BggLink,
  BggSearchResult,
  BggCollectionItem,
  BggUser,
  BggPlay,
} from "./types";

const XML = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  isArray: (name: string) => {
    // These elements can appear 1..N times; always treat as array
    return ["item", "name", "link", "rank", "result", "results"].includes(name);
  },
});

type Fetcher = typeof fetch;

export interface BggClientOptions {
  xmlBase?: string;      // official XML API2
  jsonBase?: string;     // (underdocumented) JSON bits on bgg.com
  bggJsonBase?: string;  // unofficial wrapper
  fetch?: Fetcher;
  rateMs?: number;       // per-call delay to be polite
  maxRetries202?: number;
  cacheTtlMs?: number;
  token?: string;        // BGG API Bearer token
}

const DEFAULTS: Required<Pick<
  BggClientOptions,
  "xmlBase" | "jsonBase" | "bggJsonBase" | "fetch" | "rateMs" | "maxRetries202" | "cacheTtlMs" | "token"
>> = {
  xmlBase: "https://boardgamegeek.com/xmlapi2",
  jsonBase: "https://boardgamegeek.com/api",
  bggJsonBase: "https://bgg-json.azurewebsites.net",
  fetch,
  rateMs: 1100,          // be nice to BGG
  maxRetries202: 10,     // collection endpoints often queue
  cacheTtlMs: 60_000,    // 1 min
  token: "",             // will be overridden from env
};

type CacheEntry<T> = { expires: number; data: T };
const cache = new Map<string, CacheEntry<unknown>>();

function setCache<T>(key: string, data: T, ttl: number) {
  cache.set(key, { expires: Date.now() + ttl, data });
}
function getCache<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data as T;
  if (hit) cache.delete(key);
  return undefined;
}
function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

export class BggClient {
  private o: typeof DEFAULTS;

  constructor(opts: BggClientOptions = {}) {
    this.o = {
      ...DEFAULTS,
      ...opts,
      token: process.env.BGG_TOKEN || opts.token || DEFAULTS.token,
    };
  }

  /** Low-level GET with politeness, 202-retry, and optional cache */
  private async get(url: string, useCache = true): Promise<Response> {
    const key = `GET ${url}`;
    if (useCache) {
      const cached = getCache<Response>(key);
      if (cached) return cached.clone();
    }

    const headers: Record<string, string> = {};
    if (this.o.token) {
      headers["Authorization"] = `Bearer ${this.o.token}`;
    }

    await sleep(this.o.rateMs);
    let resp = await this.o.fetch(url, { method: "GET", headers });

    // 202 means "queued" on XML endpoints (esp. /collection). Retry.
    let tries = 0;
    while (resp.status === 202 && tries < this.o.maxRetries202) {
      await sleep(Math.max(this.o.rateMs, 2000));
      resp = await this.o.fetch(url, { method: "GET", headers });
      tries++;
    }

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`BGG GET ${url} -> ${resp.status} ${resp.statusText} ${body}`);
    }

    if (useCache) setCache(key, resp.clone(), this.o.cacheTtlMs);
    return resp;
  }

  // ---------- XML API2 (documented & stable) ----------
  // Docs: https://boardgamegeek.com/wiki/page/BGG_XML_API2

  /** Search by name */
  async search(query: string, exact = false): Promise<BggSearchResult[]> {
    const url = `${this.o.xmlBase}/search?query=${encodeURIComponent(query)}&type=boardgame,boardgameexpansion${exact ? "&exact=1" : ""}`;
    const xml = await (await this.get(url)).text();
    const root = XML.parse(xml);
    const items = root?.items?.item ?? [];
    const arr = Array.isArray(items) ? items : [items];
    return arr.map((it: any) => ({
      id: String(it.id),
      type: it.type,
      name: (Array.isArray(it.name) ? it.name[0] : it.name)?.value ?? "",
      yearPublished: it.yearpublished?.value ? Number(it.yearpublished.value) : undefined,
    }));
  }

  /** Fetch one or more “things” (boardgames/expansions) */
  async thing(ids: BggId | BggId[], { stats = true, versions = false } = {}): Promise<BggThing[]> {
    const idParam = (Array.isArray(ids) ? ids : [ids]).join(",");
    const url = `${this.o.xmlBase}/thing?id=${idParam}${stats ? "&stats=1" : ""}${versions ? "&versions=1" : ""}`;
    const xml = await (await this.get(url)).text();
    const root = XML.parse(xml);
    const items = root?.items?.item ?? [];
    const arr = Array.isArray(items) ? items : [items];

    return arr.map((it: any) => {
      const primary = (Array.isArray(it.name) ? it.name.find((n:any)=>n.type==="primary") : it.name);
      const ratings = it.statistics?.ratings;
      const rawLinks: any[] = Array.isArray(it.link) ? it.link : (it.link ? [it.link] : []);
      const links: BggLink[] = rawLinks.map((l: any) => ({
        type: l.type as string,
        id: Number(l.id),
        value: l.value as string,
        ...(l.inbound === "true" ? { inbound: true } : {}),
      }));
      return {
        id: String(it.id),
        type: it.type,
        name: primary?.value ?? "",
        yearPublished: it.yearpublished?.value ? Number(it.yearpublished.value) : undefined,
        minPlayers: it.minplayers?.value ? Number(it.minplayers.value) : undefined,
        maxPlayers: it.maxplayers?.value ? Number(it.maxplayers.value) : undefined,
        minAge: it.minage?.value ? Number(it.minage.value) : undefined,
        minPlayTime: it.minplaytime?.value ? Number(it.minplaytime.value) : undefined,
        maxPlayTime: it.maxplaytime?.value ? Number(it.maxplaytime.value) : undefined,
        playingTime: it.playingtime?.value ? Number(it.playingtime.value) : undefined,
        image: it.image,
        thumbnail: it.thumbnail,
        description: it.description,
        links,
        categories: links.filter(l=>l.type==="boardgamecategory").map(l=>l.value),
        mechanics: links.filter(l=>l.type==="boardgamemechanic").map(l=>l.value),
        designers: links.filter(l=>l.type==="boardgamedesigner").map(l=>l.value),
        publishers: links.filter(l=>l.type==="boardgamepublisher").map(l=>l.value),
        stats: ratings ? {
          usersRated: ratings.usersrated?.value ? Number(ratings.usersrated.value) : undefined,
          average: ratings.average?.value ? Number(ratings.average.value) : undefined,
          bayesAverage: ratings.bayesaverage?.value ? Number(ratings.bayesaverage.value) : undefined,
          averageWeight: ratings.averageweight?.value ? Number(ratings.averageweight.value) : undefined,
          ranks: (ratings.ranks?.rank ?? []).map((r:any)=>({
            type: r.type as string,
            id: Number(r.id),
            name: r.name as string,
            friendlyName: r.friendlyname as string,
            value: r.value === "Not Ranked" ? ("Not Ranked" as const) : Number(r.value),
            bayesAverage: r.bayesaverage && r.bayesaverage !== "Not Ranked" ? Number(r.bayesaverage) : undefined,
          })),
        } : undefined,
      } as BggThing;
    });
  }

  /** Hotness list */
  async hot(type: "boardgame" | "boardgameexpansion" | "boardgameperson" | "boardgamecompany" = "boardgame") {
    const url = `${this.o.xmlBase}/hot?type=${type}`;
    const xml = await (await this.get(url)).text();
    const root = XML.parse(xml);
    const items = root?.items?.item ?? [];
    const arr = Array.isArray(items) ? items : [items];
    return arr.map((it:any)=>({
      id: String(it.id),
      name: (Array.isArray(it.name) ? it.name[0] : it.name)?.value ?? "",
      yearPublished: it.yearpublished?.value ? Number(it.yearpublished.value) : undefined,
      thumbnail: it.thumbnail,
    }));
  }

  /** Public collection (owned etc.). Often 202 at first; we retry. */
  async collection(username: string, params: { own?: 0|1; wishlist?: 0|1 } = {}): Promise<BggCollectionItem[]> {
    const qs = new URLSearchParams({ username, ...(params.own ? { own: String(params.own) } : {}), ...(params.wishlist ? { wishlist: String(params.wishlist) } : {}) });
    const url = `${this.o.xmlBase}/collection?${qs.toString()}`;
    const xml = await (await this.get(url)).text();
    const root = XML.parse(xml);
    const items = root?.items?.item ?? [];
    const arr = Array.isArray(items) ? items : [items].filter(Boolean);
    return arr.map((it:any)=>({
      id: String(it.objectid),
      name: (Array.isArray(it.name) ? it.name[0] : it.name)?.value ?? "",
      yearPublished: it.yearpublished?.value ? Number(it.yearpublished.value) : undefined,
      image: it.image,
      thumbnail: it.thumbnail,
      status: {
        own: it.status?.own === "1",
        prevowned: it.status?.prevowned === "1",
        fortrade: it.status?.fortrade === "1",
        want: it.status?.want === "1",
        wanttoplay: it.status?.wanttoplay === "1",
        wanttobuy: it.status?.wanttobuy === "1",
        wishlist: it.status?.wishlist === "1",
        preordered: it.status?.preordered === "1",
      },
    }));
  }

  // ---------- JSON bits on bgg.com (underdocumented; may change) ----------
  // Intro/wiki acknowledges a JSON API but without full docs. Use carefully.
  // https://boardgamegeek.com/wiki/page/BGG_JSON_API
  async usersCurrent(): Promise<BggUser> {
    const url = `${this.o.jsonBase}/users/current`;
    return this.get(url).then(r => r.json());
  }
  async userById(id: number | string): Promise<BggUser> {
    const url = `${this.o.jsonBase}/users/${id}`;
    return this.get(url).then(r => r.json());
  }

  // ---------- Unofficial wrapper (bgg-json.azurewebsites.net) ----------
  // Community wrapper that returns JSON for common things.
  async wrapperThing(id: BggId) {
    const url = `${this.o.bggJsonBase}/thing/${id}`;
    return this.get(url).then(r => r.json()); // shape defined by wrapper
  }
  async wrapperCollection(username: string, grouped = false) {
    const url = `${this.o.bggJsonBase}/collection/${encodeURIComponent(username)}${grouped ? "?grouped=true" : ""}`;
    return this.get(url).then(r => r.json());
  }
  async wrapperPlays(username: string) : Promise<BggPlay[]> {
    const url = `${this.o.bggJsonBase}/plays/${encodeURIComponent(username)}`;
    return this.get(url).then(r => r.json());
  }
  async wrapperHot() {
    const url = `${this.o.bggJsonBase}/hot`;
    return this.get(url).then(r => r.json());
  }
}

export const bgg = new BggClient({
  token: process.env.BGG_TOKEN ?? "",
});
