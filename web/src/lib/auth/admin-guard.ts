import { redirect } from "next/navigation";

import { getSessionFromRequestCookies } from "@/lib/auth/server-session";
import { normalizeRoles } from "@/lib/auth/roles";

export async function requireAdminServerSession() {
  const session = await getSessionFromRequestCookies();

  if (!session) {
    redirect("/");
  }

  const roles = normalizeRoles(session.roles);
  if (!roles.includes("admin")) {
    redirect("/");
  }

  return session;
}
