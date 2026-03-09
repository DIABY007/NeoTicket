"use client";

import { useState } from "react";

import { CreateEventForm } from "@/components/organizer/create-event-form";
import { OrganizerEventsOverview } from "@/components/organizer/events-overview";
import { ScannerManagement } from "@/components/organizer/scanner-management";

export function OrganizerDashboardContent({
  includeCreateForm = true,
  platformDiscountPercent = 0,
}: {
  includeCreateForm?: boolean;
  platformDiscountPercent?: number;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="grid gap-6">
      <OrganizerEventsOverview
        refreshKey={refreshKey}
        onActionComplete={() => {
          setRefreshKey((value) => value + 1);
        }}
      />
      <ScannerManagement />
      {includeCreateForm ? (
        <CreateEventForm
          platformDiscountPercent={platformDiscountPercent}
          onCreated={() => {
            setRefreshKey((value) => value + 1);
          }}
        />
      ) : null}
    </div>
  );
}
