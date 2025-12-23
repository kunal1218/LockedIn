const toCollegeName = (slug: string) => {
  const cleaned = slug.replace(/[-_]+/g, " ").trim();
  if (!cleaned) {
    return "";
  }

  const compact = cleaned.replace(/\s+/g, "");
  if (compact.length <= 4) {
    return compact.toUpperCase();
  }

  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const deriveCollegeFromDomain = (domain: string): string | null => {
  const parts = domain.toLowerCase().split(".").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const tld = parts[parts.length - 1];
  const secondLevel = parts[parts.length - 2];
  let slug = "";

  if (tld === "edu" && parts.length >= 2) {
    slug = parts[parts.length - 2];
  } else if (secondLevel === "edu" && tld.length === 2 && parts.length >= 3) {
    slug = parts[parts.length - 3];
  } else if (secondLevel === "ac" && tld.length === 2 && parts.length >= 3) {
    slug = parts[parts.length - 3];
  } else {
    return null;
  }

  const name = toCollegeName(slug);
  return name || null;
};

export const deriveCollegeFromEmail = (email: string): string | null => {
  const domain = email.split("@")[1] ?? "";
  if (!domain) {
    return null;
  }

  return deriveCollegeFromDomain(domain);
};
