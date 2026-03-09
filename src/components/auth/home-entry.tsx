"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoginPhoneForm } from "@/components/auth/login-phone-form";
import { useAuth } from "@/components/auth/auth-provider";
import { getRouteForRole } from "@/lib/auth/roles";

export function HomeEntry() {
  const router = useRouter();
  const { user, activeRole, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || !user || !activeRole) {
      return;
    }

    router.replace(getRouteForRole(activeRole));
  }, [isLoading, user, activeRole, router]);

  if (isLoading) {
    return <p className="text-sm text-black/60">Chargement...</p>;
  }

  if (user) {
    return <p className="text-sm text-black/60">Redirection...</p>;
  }

  return <LoginPhoneForm />;
}
