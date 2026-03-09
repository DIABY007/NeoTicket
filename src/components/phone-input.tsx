"use client";

import { useId } from "react";

const BURKINA_PREFIX = "+226";
const EXPECTED_DIGITS = 8;

type PhoneInputProps = {
  value: string;
  onChange: (digits: string) => void;
  /** Light theme (default) or dark theme */
  variant?: "light" | "dark";
  placeholder?: string;
  required?: boolean;
  id?: string;
  name?: string;
  autoComplete?: string;
  "aria-describedby"?: string;
};

export function PhoneInput({
  value,
  onChange,
  variant = "light",
  placeholder = "70123456",
  required,
  id: externalId,
  name,
  autoComplete,
  "aria-describedby": ariaDescribedBy,
}: PhoneInputProps) {
  const generatedId = useId();
  const inputId = externalId ?? generatedId;
  const digitCount = value.replace(/\D/g, "").length;
  const isDark = variant === "dark";

  return (
    <div
      className={`flex items-center overflow-hidden rounded-xl border transition ${
        isDark
          ? "border-white/15 bg-neutral-800"
          : "border-black/10 bg-white focus-within:border-neo-teal/40 focus-within:ring-2 focus-within:ring-neo-teal/10"
      }`}
    >
      <span
        className={`select-none whitespace-nowrap border-r px-3 text-sm font-medium ${
          isDark
            ? "border-white/10 bg-white/5 text-white/60"
            : "border-black/10 bg-black/5 text-black/60"
        }`}
      >
        {BURKINA_PREFIX}
      </span>
      <input
        id={inputId}
        name={name}
        type="tel"
        inputMode="numeric"
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        maxLength={EXPECTED_DIGITS}
        required={required}
        onChange={(e) => {
          onChange(e.target.value.replace(/\D/g, "").slice(0, EXPECTED_DIGITS));
        }}
        className={`w-full bg-transparent px-3 py-3 text-base outline-none ${
          isDark
            ? "text-white placeholder:text-white/30"
            : "text-black placeholder:text-black/40"
        }`}
        aria-describedby={ariaDescribedBy}
      />
      <span
        className={`whitespace-nowrap pr-3 text-xs tabular-nums ${
          digitCount === EXPECTED_DIGITS
            ? isDark
              ? "text-emerald-400"
              : "text-neo-teal"
            : isDark
              ? "text-white/40"
              : "text-black/40"
        }`}
      >
        {digitCount}/{EXPECTED_DIGITS}
      </span>
    </div>
  );
}
