/**
 * Instagram URL and Username Normalizer
 */

const RESERVED_PATHS = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "explore",
  "accounts",
  "direct",
  "tv",
  "tags",
  "about",
  "legal",
  "developer",
  "api",
  "support",
  "press",
  "privacy",
  "terms",
  "directory",
  "help",
  "emails",
  "session",
  "download",
  "share",
  "login",
  "signup",
  "challenge",
  "settings",
  "profile",
  "locations",
]);

export interface NormalizedInstagramResult {
  normalizedUrl: string;
  normalizedUsername: string;
  username: string;
  canonicalUrl: string;
  url: string;
  isValid: boolean;
}

export function normalizeInstagramInput(input?: string | null): NormalizedInstagramResult {
  if (!input || !input.trim()) {
    return {
      normalizedUrl: "",
      normalizedUsername: "",
      username: "",
      canonicalUrl: "",
      url: "",
      isValid: false,
    };
  }

  let cleaned = input.trim();

  // If contains http/https protocol or domain slash but NOT instagram
  if (/^https?:\/\//i.test(cleaned)) {
    if (!/^(https?:\/\/)?(www\.|m\.)?(instagram\.com|instagr\.am)\//i.test(cleaned)) {
      return {
        normalizedUrl: "",
        normalizedUsername: "",
        username: "",
        canonicalUrl: "",
        url: "",
        isValid: false,
      };
    }
  }

  // If starts with @, extract username
  if (cleaned.startsWith("@")) {
    const rawUsername = cleaned.substring(1).split(/[/?#]/)[0].toLowerCase().trim();
    if (!rawUsername || !/^[a-zA-Z0-9._]{1,30}$/.test(rawUsername) || RESERVED_PATHS.has(rawUsername)) {
      return { normalizedUrl: "", normalizedUsername: "", username: "", canonicalUrl: "", url: "", isValid: false };
    }
    const canonical = `https://instagram.com/${rawUsername}`;
    return {
      normalizedUrl: canonical,
      normalizedUsername: rawUsername,
      username: rawUsername,
      canonicalUrl: canonical,
      url: canonical,
      isValid: true,
    };
  }

  // If contains a dot with common domain suffixes without being instagram
  if (/(google\.com|facebook\.com|tiktok\.com|linkedin\.com|youtube\.com|twitter\.com|x\.com)/i.test(cleaned)) {
    return {
      normalizedUrl: "",
      normalizedUsername: "",
      username: "",
      canonicalUrl: "",
      url: "",
      isValid: false,
    };
  }

  // Remove protocol if present
  cleaned = cleaned.replace(/^https?:\/\//i, "");
  cleaned = cleaned.replace(/^(www\.|m\.)/i, "");

  // Now cleaned might be "instagram.com/username?query=1" or "instagr.am/username"
  if (cleaned.toLowerCase().startsWith("instagram.com/") || cleaned.toLowerCase().startsWith("instagr.am/")) {
    const pathPart = cleaned.replace(/^(instagram\.com|instagr\.am)\//i, "");
    const usernamePart = pathPart.split(/[/?#]/)[0].toLowerCase().trim();
    if (usernamePart && /^[a-zA-Z0-9._]{1,30}$/.test(usernamePart) && !RESERVED_PATHS.has(usernamePart)) {
      const canonical = `https://instagram.com/${usernamePart}`;
      return {
        normalizedUrl: canonical,
        normalizedUsername: usernamePart,
        username: usernamePart,
        canonicalUrl: canonical,
        url: canonical,
        isValid: true,
      };
    }
    return {
      normalizedUrl: "",
      normalizedUsername: "",
      username: "",
      canonicalUrl: "",
      url: "",
      isValid: false,
    };
  }

  // If it has slashes or query params, it's not a pure username
  if (cleaned.includes("/") || cleaned.includes("?") || cleaned.includes("#")) {
    return {
      normalizedUrl: "",
      normalizedUsername: "",
      username: "",
      canonicalUrl: "",
      url: "",
      isValid: false,
    };
  }

  // If pure username passed without url
  if (/^[a-zA-Z0-9._]{1,30}$/.test(cleaned) && !RESERVED_PATHS.has(cleaned.toLowerCase())) {
    const username = cleaned.toLowerCase();
    const canonical = `https://instagram.com/${username}`;
    return {
      normalizedUrl: canonical,
      normalizedUsername: username,
      username: username,
      canonicalUrl: canonical,
      url: canonical,
      isValid: true,
    };
  }

  return {
    normalizedUrl: "",
    normalizedUsername: "",
    username: "",
    canonicalUrl: "",
    url: "",
    isValid: false,
  };
}

export const normalizeInstagramIdentity = normalizeInstagramInput;
