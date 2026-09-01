/**
 * Instagram URL and Username Normalizer
 */

export function normalizeInstagramInput(input?: string | null): {
  normalizedUrl: string;
  normalizedUsername: string;
  isValid: boolean;
} {
  if (!input || !input.trim()) {
    return {
      normalizedUrl: "",
      normalizedUsername: "",
      isValid: false,
    };
  }

  let cleaned = input.trim();

  // If starts with @, extract username
  if (cleaned.startsWith("@")) {
    const rawUsername = cleaned.substring(1).split(/[/?#]/)[0].toLowerCase().trim();
    if (!rawUsername || !/^[a-zA-Z0-9._]{1,30}$/.test(rawUsername)) {
      return { normalizedUrl: "", normalizedUsername: "", isValid: false };
    }
    return {
      normalizedUrl: `https://instagram.com/${rawUsername}`,
      normalizedUsername: rawUsername,
      isValid: true,
    };
  }

  // Remove protocol if present for regex or parse
  cleaned = cleaned.replace(/^https?:\/\//i, "");
  cleaned = cleaned.replace(/^(www\.|m\.)/i, "");

  // Now cleaned might be "instagram.com/username?query=1" or "instagr.am/username" or "username"
  if (cleaned.toLowerCase().startsWith("instagram.com/") || cleaned.toLowerCase().startsWith("instagr.am/")) {
    const pathPart = cleaned.replace(/^(instagram\.com|instagr\.am)\//i, "");
    const usernamePart = pathPart.split(/[/?#]/)[0].toLowerCase().trim();
    if (usernamePart && /^[a-zA-Z0-9._]{1,30}$/.test(usernamePart)) {
      return {
        normalizedUrl: `https://instagram.com/${usernamePart}`,
        normalizedUsername: usernamePart,
        isValid: true,
      };
    }
  }

  // If pure username passed without url
  if (/^[a-zA-Z0-9._]{1,30}$/.test(cleaned)) {
    const username = cleaned.toLowerCase();
    return {
      normalizedUrl: `https://instagram.com/${username}`,
      normalizedUsername: username,
      isValid: true,
    };
  }

  return {
    normalizedUrl: "",
    normalizedUsername: "",
    isValid: false,
  };
}
