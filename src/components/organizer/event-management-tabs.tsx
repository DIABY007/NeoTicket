"use client";

import { useState } from "react";

import { EditEventForm } from "@/components/organizer/edit-event-form";
import { MarketingPanel } from "@/components/organizer/marketing-panel";

type Tab = "edit" | "marketing";

export function EventManagementTabs({ eventId }: { eventId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("edit");

  return (
    <div>
      <div className="flex gap-1 rounded-xl border border-black/10 bg-[#f5f5f3] p-1">
        <button
          type="button"
          onClick={() => setActiveTab("edit")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            activeTab === "edit"
              ? "bg-white text-black shadow-sm"
              : "text-black/60 hover:text-black/80"
          }`}
        >
          Evenement
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("marketing")}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
            activeTab === "marketing"
              ? "bg-white text-black shadow-sm"
              : "text-black/60 hover:text-black/80"
          }`}
        >
          Marketing
        </button>
      </div>

      <div className="mt-4">
        {activeTab === "edit" ? (
          <EditEventForm eventId={eventId} />
        ) : (
          <MarketingPanel eventId={eventId} />
        )}
      </div>
    </div>
  );
}
