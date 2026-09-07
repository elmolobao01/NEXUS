import { requireAuthenticatedUser } from "./auth-guard";

export default async function AdminLayout({ children }) {
  await requireAuthenticatedUser(["PLENIUM_ROOT", "PLENIUM_ADMIN"]);
  return children;
}
