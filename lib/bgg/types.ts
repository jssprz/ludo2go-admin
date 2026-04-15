export type BggId = number | string;

export interface BggLink {
  type: string;
  id: number;
  value: string;
  inbound?: boolean;
}

export interface BggThing {
  id: string;
  type: "boardgame" | "boardgameexpansion" | string;
  name: string;
  yearPublished?: number;
  minPlayers?: number;
  maxPlayers?: number;
  minAge?: number;
  minPlayTime?: number;
  maxPlayTime?: number;
  playingTime?: number;
  image?: string;
  thumbnail?: string;
  description?: string;
  /** All raw links from the BGG XML response */
  links?: BggLink[];
  /** Convenience: category names extracted from links */
  categories?: string[];
  /** Convenience: mechanic names extracted from links */
  mechanics?: string[];
  /** Convenience: designer names extracted from links */
  designers?: string[];
  /** Convenience: publisher names extracted from links */
  publishers?: string[];
  stats?: {
    usersRated?: number;
    average?: number;
    bayesAverage?: number;
    averageWeight?: number;
    ranks?: Array<{
      type: string;
      id: number;
      name: string;
      friendlyName: string;
      value: number | "Not Ranked";
      bayesAverage?: number;
    }>;
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
