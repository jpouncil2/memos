export const ROUTES = {
  ROOT: "/",
  LIBRARY: "/library",
  ATTACHMENTS: "/attachments",
  INBOX: "/inbox",
  ARCHIVED: "/archived",
  BOARDS: "/boards",
  SETTING: "/setting",
  EXPLORE: "/explore",
  AUTH: "/auth",
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
