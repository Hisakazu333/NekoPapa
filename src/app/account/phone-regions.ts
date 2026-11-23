/**
 * Calling-code regions for account sign-in. The user picks "+xxx"; the
 * number field holds the national part. Region names come from
 * Intl.DisplayNames, so they follow the interface language.
 */
import { PHONE_REGION_CODES } from "./phone-region-codes";

export interface PhoneRegion {
  /** ISO 3166-1 alpha-2; unique even when regions share a calling code (+1, +7, +44). */
  id: string;
  dialCode: string;
}

export const DEFAULT_PHONE_REGION = "CN";

/** Shown first in the picker; everything else follows in name order. */
export const COMMON_PHONE_REGIONS: readonly string[] = Object.freeze(["CN", "HK", "MO", "TW", "US", "JP", "KR", "SG", "GB"]);

export const PHONE_REGIONS: readonly PhoneRegion[] = Object.freeze(
  PHONE_REGION_CODES.map(([id, dialCode]) => Object.freeze({ id, dialCode })),
);

export function phoneRegion(id: string): PhoneRegion {
  return PHONE_REGIONS.find((region) => region.id === id)
    ?? PHONE_REGIONS.find((region) => region.id === DEFAULT_PHONE_REGION)!;
}

const displayNames = new Map<string, Intl.DisplayNames | null>();

/** Localized region name ("英国" / "United Kingdom"); the ISO code when the runtime has none. */
export function phoneRegionName(id: string, locale: string): string {
  if (!displayNames.has(locale)) {
    try { displayNames.set(locale, new Intl.DisplayNames([locale], { type: "region" })); }
    catch { displayNames.set(locale, null); }
  }
  try { return displayNames.get(locale)?.of(id) ?? id; } catch { return id; }
}

/** Common regions first, then every region sorted by its localized name. */
export function sortedPhoneRegions(locale: string): { common: PhoneRegion[]; all: PhoneRegion[] } {
  const collator = new Intl.Collator(locale);
  const all = [...PHONE_REGIONS].sort((a, b) => collator.compare(phoneRegionName(a.id, locale), phoneRegionName(b.id, locale)));
  return { common: COMMON_PHONE_REGIONS.map(phoneRegion), all };
}

/** Text a search can match: local and English names, ISO code and "+code". */
export function phoneRegionSearchText(region: PhoneRegion, locale: string): string {
  return [phoneRegionName(region.id, locale), phoneRegionName(region.id, "en"), region.id, `+${region.dialCode}`].join(" ");
}

export function phoneRegionMatches(region: PhoneRegion, locale: string, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase(locale).replace(/^\+/, "");
  if (!needle) return true;
  if (/^\d+$/.test(needle)) return region.dialCode.startsWith(needle);
  return phoneRegionSearchText(region, locale).toLocaleLowerCase(locale).includes(needle);
}

/** Which region a shared calling code means when the user has not chosen one of its regions. */
const PRIMARY_REGION_FOR_CODE: Readonly<Record<string, string>> = Object.freeze({
  "1": "US", "7": "RU", "39": "IT", "44": "GB", "47": "NO", "61": "AU",
  "212": "MA", "262": "RE", "358": "FI", "590": "GP", "599": "CW",
});

/**
 * Reads a typed or pasted "+44 7700…" / "0044 7700…" and returns the region it
 * names with the rest as the national number. Calling codes are prefix-free,
 * so at most one code matches. A shared code (+1) keeps the user's current
 * region when it already uses that code. Plain local numbers are left alone.
 */
export function detectPhoneRegion(value: string, currentId: string): { regionId: string; national: string } | undefined {
  const match = /^\s*(?:\+|00)\s*([\d\s().-]*)$/.exec(value);
  if (!match) return;
  const digits = match[1].replace(/\D/g, "");
  for (const length of [1, 2, 3]) {
    const code = digits.slice(0, length);
    const regions = PHONE_REGIONS.filter((region) => region.dialCode === code);
    if (!regions.length || digits.length <= length) continue;
    const current = phoneRegion(currentId);
    const regionId = current.dialCode === code ? current.id : PRIMARY_REGION_FOR_CODE[code] ?? regions[0].id;
    return { regionId, national: digits.slice(length) };
  }
}

/** Regions listed with their calling code but drawn with a neutral icon instead of a flag. */
const REGIONS_WITHOUT_FLAG: ReadonlySet<string> = new Set(["TW"]);

export function phoneRegionShowsFlag(id: string): boolean {
  return !REGIONS_WITHOUT_FLAG.has(id.toUpperCase());
}

/** Digits of the national number; spaces, dashes, dots and brackets people type are dropped. */
function nationalDigits(regionId: string, value: string): string | undefined {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (!/^\d+$/.test(compact)) return;
  // A leading trunk "0" (UK 07…, JP 090…) is not part of the international
  // number. Italy, San Marino and Vatican keep it after the calling code.
  return ["IT", "SM", "VA"].includes(regionId) ? compact : compact.replace(/^0/, "");
}

/**
 * The number as the account service receives it, or undefined when invalid.
 * Mainland numbers keep the service's existing 11-digit form; every other
 * region is sent in E.164 ("+447700900123"): 15 digits at most.
 */
export function accountPhoneNumber(regionId: string, value: string): string | undefined {
  const region = phoneRegion(regionId);
  const digits = nationalDigits(region.id, value);
  if (!digits) return;
  if (region.id === "CN") return /^1\d{10}$/.test(digits) ? digits : undefined;
  if (digits.length < 4 || region.dialCode.length + digits.length > 15) return;
  return `+${region.dialCode}${digits}`;
}
