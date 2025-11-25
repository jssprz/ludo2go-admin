export type BggId = number | string;

export interface BggThing {
  id: string;
  type: "boardgame" | "boardgameexpansion" | string;
  name: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  minPlayTime?: number;
  maxPlayTime?: number;
  playingTime?: number;
  image?: string;
  thumbnail?: string;
  description?: string;
  categories?: string[];
  mechanics?: string[];
  designers?: string[];
  publishers?: string[];
  stats?: {
    usersRated?: number;
    average?: number;
    bayesAverage?: number;
    ranks?: Array<{ id: string; name: string; value: number | "Not Ranked" }>;
  };
}

export interface BggSearchResult {
  id: string;
  name: string;
  yearPublished?: number;
  type: string;
}

export interface BggCollectionItem {
  id: string;
  name: string;
  yearPublished?: number;
  image?: string;
  thumbnail?: string;
  status: {
    own: boolean;
    prevowned: boolean;
    fortrade: boolean;
    want: boolean;
    wanttoplay: boolean;
    wanttobuy: boolean;
    wishlist: boolean;
    preordered: boolean;
  };
}

export interface BggUser {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  country?: string;
  state?: string;
  city?: string;
  // This shape is intentionally loose; JSON endpoints are underdocumented.
  [k: string]: unknown;
}

export interface BggPlay {
  id: string;
  date: string;
  quantity: number;
  length?: number;
  incomplete?: boolean;
  nowinstats?: boolean;
  game: { id: string; name: string };
  comments?: string;
}
