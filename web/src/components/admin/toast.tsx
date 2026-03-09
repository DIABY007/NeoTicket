"use client";

import { useEffect, useState } from "react";

export type ToastType = "success" | "error";

type ToastItem = { id: number; message: string; type: ToastType };

let pushToast: (message: string, type: ToastType) => void = () => {};

export function showToast(message: string, type: ToastType = "success") {
  pushToast(message, type);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushToast = (message, type) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    };
    return () => {
      pushToast = () => {};
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-toast-in rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
            t.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
