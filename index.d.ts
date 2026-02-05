/** Channel object (full schema) */
export interface Channel {
  name: string;
  keywords: string | null;
  retransmits: string | null;
  shortName: string | null;
  isFree: boolean;
  logo: string | null;
  website: string | null;
  /** 0–10, relative to same country+category. 0=no audience, 5=medium (default), 10=high. Omit when 5. */
  priority?: number;
}

/** Categories map to arrays of channel objects */
export type ChannelsByCategory = Record<string, Channel[]>;

/** Channel with country (from search/generate) */
export type ChannelWithCountry = Channel & { country: string };

/** Channel with country and category (from generate) */
export type ChannelWithMeta = Channel & { country: string; category: string };

/**
 * Get channels (full schema with categories).
 * Uses dynamic import — loads only the requested country into memory.
 * @param countryCode - ISO country code (e.g. 'br', 'us')
 * @returns Categories with channel objects, or null if not found
 */
export function getChannels(countryCode: string): Promise<ChannelsByCategory | null>;

/**
 * List available country codes.
 * @returns Sorted list of country codes
 */
export function listCountries(): Promise<string[]>;

export interface SearchOptions {
  countries?: string[] | null;
  categories?: string[] | null;
  /** 'parents' = only originals, 'affiliates' = only retransmitters, 'all' = both (default) */
  retransmits?: 'all' | 'parents' | 'affiliates';
  limit?: number;
}

export function search(
  keywords: string,
  opts?: SearchOptions
): Promise<ChannelWithCountry[]>;

export interface GenerateOptions {
  countries: string[];
  categories?: string[] | null;
  /** 'parents' = only originals, 'affiliates' = only retransmitters, 'all' = both (default) */
  retransmits?: 'all' | 'parents' | 'affiliates';
  /** When true, first country is user's main: include ALL its channels, supplement only categories below minPerCategory from others */
  mainCountryFull?: boolean;
  limit?: number;
  minPerCategory?: number;
  /** Se true, retorna apenas canais gratuitos (isFree === true) */
  freeOnly?: boolean;
}

export function generate(opts?: GenerateOptions): Promise<ChannelWithMeta[]>;
