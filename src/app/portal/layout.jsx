import { requireAuthenticatedUser } from "./auth-guard";

export default async function PortalLayout({ children }) {
  await requireAuthenticatedUser([
    "PLENIUM_ROOT",
    "PLENIUM_ADMIN",
    "CLIENT_ADMIN",
    "MANAGER",
    "SUPERVISOR",
    "OPERATOR",
    "VIEWER",
  ]);
  return children;
}
