import { requireAuthenticatedUser } from "./auth-guard";

export default async function PortalLayout({ children }) {
  await requireAuthenticatedUser([
    "NEXUS_ROOT",
    "NEXUS_ADMIN",
    "CLIENT_ADMIN",
    "MANAGER",
    "SUPERVISOR",
    "OPERATOR",
    "VIEWER",
  ]);
  return children;
}
