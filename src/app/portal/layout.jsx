import { requireAuthenticatedUser } from "./auth-guard";

export default async function PortalLayout({ children }) {
  await requireAuthenticatedUser([
    "CLIENT_ADMIN",
    "MANAGER",
    "SUPERVISOR",
    "OPERATOR",
    "VIEWER",
  ]);
  return children;
}
