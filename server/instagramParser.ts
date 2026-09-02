/**
 * Instagram Normalization and Parser Engine
 * Handles canonical username extraction, URL resolution, and Apify user item parsing.
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

export interface NormalizedIdentity {
  username: string;
  normalizedUsername: string;
  canonicalUrl: string;
  url: string;
  isValid: boolean;
}

export function normalizeInstagramIdentity(input?: string | null): NormalizedIdentity {
  if (!input || typeof input !== "string" || !input.trim()) {
    return {
      username: "",
      normalizedUsername: "",
      canonicalUrl: "",
      url: "",
      isValid: false,
    };
  }

  let cleaned = input.trim();

  // If protocol specified, check if it's instagram
  if (/^https?:\/\//i.test(cleaned)) {
    if (!/^(https?:\/\/)?(www\.|m\.)?(instagram\.com|instagr\.am)\//i.test(cleaned)) {
      return {
        username: "",
        normalizedUsername: "",
        canonicalUrl: "",
        url: "",
        isValid: false,
      };
    }
  }

  // Handle @handle format
  if (cleaned.startsWith("@")) {
    const rawUsername = cleaned.substring(1).split(/[/?#]/)[0].toLowerCase().trim();
    if (!rawUsername || !/^[a-zA-Z0-9._]{1,30}$/.test(rawUsername) || RESERVED_PATHS.has(rawUsername)) {
      return { username: "", normalizedUsername: "", canonicalUrl: "", url: "", isValid: false };
    }
    return {
      username: rawUsername,
      normalizedUsername: rawUsername,
      canonicalUrl: `https://instagram.com/${rawUsername}`,
      url: `https://instagram.com/${rawUsername}`,
      isValid: true,
    };
  }

  // Handle blacklisted other social domains
  if (/(google\.com|facebook\.com|tiktok\.com|linkedin\.com|youtube\.com|twitter\.com|x\.com)/i.test(cleaned)) {
    return { username: "", normalizedUsername: "", canonicalUrl: "", url: "", isValid: false };
  }

  // Remove protocol and subdomains
  cleaned = cleaned.replace(/^https?:\/\//i, "");
  cleaned = cleaned.replace(/^(www\.|m\.)/i, "");

  // Handle instagram.com/...
  if (cleaned.toLowerCase().startsWith("instagram.com/") || cleaned.toLowerCase().startsWith("instagr.am/")) {
    const pathPart = cleaned.replace(/^(instagram\.com|instagr\.am)\//i, "");
    const usernamePart = pathPart.split(/[/?#]/)[0].toLowerCase().trim();
    if (usernamePart && /^[a-zA-Z0-9._]{1,30}$/.test(usernamePart) && !RESERVED_PATHS.has(usernamePart)) {
      return {
        username: usernamePart,
        normalizedUsername: usernamePart,
        canonicalUrl: `https://instagram.com/${usernamePart}`,
        url: `https://instagram.com/${usernamePart}`,
        isValid: true,
      };
    }
    return { username: "", normalizedUsername: "", canonicalUrl: "", url: "", isValid: false };
  }

  // If contains slashes or parameters, invalid
  if (cleaned.includes("/") || cleaned.includes("?") || cleaned.includes("#")) {
    return { username: "", normalizedUsername: "", canonicalUrl: "", url: "", isValid: false };
  }

  // Pure username
  if (/^[a-zA-Z0-9._]{1,30}$/.test(cleaned) && !RESERVED_PATHS.has(cleaned.toLowerCase())) {
    const username = cleaned.toLowerCase();
    return {
      username,
      normalizedUsername: username,
      canonicalUrl: `https://instagram.com/${username}`,
      url: `https://instagram.com/${username}`,
      isValid: true,
    };
  }

  return { username: "", normalizedUsername: "", canonicalUrl: "", url: "", isValid: false };
}

export interface MappedApifyUser {
  rawUsername: string;
  normalizedUsername: string;
  canonicalUrl: string;
  fullName?: string;
  externalId?: string;
  followersCount?: number;
  biography?: string;
  publicEmail?: string;
  publicPhone?: string;
  isPrivate: boolean;
  isValid: boolean;
  hasError: boolean;
  rawItem: any;
}

/**
 * Resiliently maps item from Apify Instagram Search Scraper into structured user object
 */
export function mapApifyInstagramUser(item: any): MappedApifyUser {
  if (!item || typeof item !== "object") {
    return {
      rawUsername: "",
      normalizedUsername: "",
      canonicalUrl: "",
      isPrivate: false,
      isValid: false,
      hasError: true,
      rawItem: item,
    };
  }

  if (item.error) {
    return {
      rawUsername: String(item.username || ""),
      normalizedUsername: "",
      canonicalUrl: "",
      isPrivate: false,
      isValid: false,
      hasError: true,
      rawItem: item,
    };
  }

  const rawUsername = String(
    item.username ||
      item.ownerUsername ||
      item.user?.username ||
      item.profileName ||
      ""
  ).trim();

  const identity = normalizeInstagramIdentity(rawUsername);

  // Extract fullName
  const fullName = String(
    item.fullName || item.name || item.user?.full_name || item.user?.fullName || ""
  ).trim() || undefined;

  // Extract externalId
  const externalId = item.id || item.pk || item.user?.pk || item.user?.id ? String(item.id || item.pk || item.user?.pk || item.user?.id) : undefined;

  // Extract followers count
  let followersCount: number | undefined;
  if (typeof item.followersCount === "number") followersCount = item.followersCount;
  else if (typeof item.followers === "number") followersCount = item.followers;
  else if (typeof item.followers_count === "number") followersCount = item.followers_count;
  else if (typeof item.user?.follower_count === "number") followersCount = item.user.follower_count;
  else if (item.followersCount && !isNaN(Number(item.followersCount))) followersCount = Number(item.followersCount);

  // Extract biography
  const biography = String(
    item.biography || item.bio || item.user?.biography || item.user?.bio || ""
  ).trim() || undefined;

  // Extract public email
  const publicEmail = String(
    item.businessEmail ||
      item.email ||
      item.contactEmail ||
      item.public_email ||
      item.user?.public_email ||
      ""
  ).trim() || undefined;

  // Extract public phone
  const publicPhone = String(
    item.businessPhoneNumber ||
      item.phone ||
      item.contactPhoneNumber ||
      item.contact_phone_number ||
      item.user?.contact_phone_number ||
      ""
  ).trim() || undefined;

  // Extract privacy flag
  const isPrivate = Boolean(
    item.private ?? item.isPrivate ?? item.is_private ?? item.user?.is_private ?? false
  );

  return {
    rawUsername,
    normalizedUsername: identity.normalizedUsername,
    canonicalUrl: identity.canonicalUrl,
    fullName,
    externalId,
    followersCount,
    biography,
    publicEmail,
    publicPhone,
    isPrivate,
    isValid: identity.isValid,
    hasError: false,
    rawItem: item,
  };
}
