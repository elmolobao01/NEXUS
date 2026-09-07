import { requireAuthenticatedUser } from "./auth-guard";

export default async function AdminLayout({ children }) {
  await requireAuthenticatedUser(["NEXUS_ROOT", "NEXUS_ADMIN"]);
  return children;
}
