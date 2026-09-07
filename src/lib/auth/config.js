export const AUTH_COOKIE = "nexus_session";
export const PROFILE_COOKIE = "nexus_profile";
export const ORG_COOKIE = "nexus_organization";

export const PROFILE_ROUTES = {
  NEXUS_ROOT: "/admin",
  NEXUS_ADMIN: "/admin",
  CLIENT_ADMIN: "/portal",
  MANAGER: "/portal",
  SUPERVISOR: "/portal",
  OPERATOR: "/portal",
  VIEWER: "/portal",
};

export function getRedirectForProfile(profile) {
  return PROFILE_ROUTES[profile] || "/portal";
}

export function getCookieMaxAge(remember) {
  return remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
}
