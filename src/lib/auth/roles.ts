export type AppRole = "buyer" | "organizer" | "scanner" | "admin";

const ROLE_PRIORITY: AppRole[] = ["admin", "organizer", "scanner", "buyer"];

const ROLE_ROUTES: Record<AppRole, string> = {
  buyer: "/buyer",
  organizer: "/organizer/dashboard",
  scanner: "/scanner/scan",
  admin: "/admin/dashboard",
};

export function normalizeRoles(input: string[] | null | undefined): AppRole[] {
  if (!input || input.length === 0) {
    return ["buyer"];
  }

  const valid = input.filter((role): role is AppRole =>
    ["buyer", "organizer", "scanner", "admin"].includes(role),
  );

  return valid.length > 0 ? valid : ["buyer"];
}

export function pickPrimaryRole(roles: string[] | null | undefined): AppRole {
  const normalized = normalizeRoles(roles);

  for (const role of ROLE_PRIORITY) {
    if (normalized.includes(role)) {
      return role;
    }
  }

  return "buyer";
}

export function getRouteForRole(role: AppRole): string {
  return ROLE_ROUTES[role];
}
