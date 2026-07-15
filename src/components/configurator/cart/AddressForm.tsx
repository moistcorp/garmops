"use client";

import { useState } from "react";

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  country: string;
  addressLine1: string;
  addressLine2?: string;
  zip: string;
  city: string;
  state?: string;
  email: string;
  phone: string;
  poNumber?: string;
  orderNotes?: string;
  receiveEmails: boolean;
}

export interface AddressFormProps {
  value: Address;
  onChange: (address: Address) => void;
  title?: string;
  showCompany?: boolean;
  showState?: boolean;
  showPO?: boolean;
  showNotes?: boolean;
}

const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "Germany",
  "France",
  "Australia",
  "Canada",
  "United Arab Emirates",
  "Singapore",
  "Japan",
  "Netherlands",
  "Italy",
  "Spain",
  "New Zealand",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAddressValid(a: Address): boolean {
  return Boolean(
    a.firstName.trim() &&
      a.lastName.trim() &&
      a.country.trim() &&
      a.addressLine1.trim() &&
      a.zip.trim() &&
      a.city.trim() &&
      EMAIL_RE.test(a.email.trim()) &&
      a.phone.trim()
  );
}

export function AddressForm({
  value,
  onChange,
  title,
  showCompany = true,
  showState = true,
  showPO = true,
  showNotes = true,
}: AddressFormProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const set = <K extends keyof Address>(key: K, val: Address[K]) => {
    onChange({ ...value, [key]: val });
  };

  const markTouched = (key: string) => setTouched((t) => ({ ...t, [key]: true }));

  const showError = (key: string, invalid: boolean) => touched[key] && invalid;

  const inputClass =
    "w-full border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-sm text-[#111111] placeholder:text-[#111111]/40 focus:outline-none focus:border-[#111111]";

  const labelClass = "text-xs font-medium text-[#111111]/70 mb-1 block";

  return (
    <div className="space-y-4">
      {title && (
        <h3 className="text-sm font-semibold tracking-wide text-[#111111] uppercase">
          {title}
        </h3>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>First name</label>
          <input
            className={inputClass}
            value={value.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            onBlur={() => markTouched("firstName")}
          />
          {showError("firstName", !value.firstName.trim()) && (
            <p className="text-xs text-red-600 mt-1">Required</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Last name</label>
          <input
            className={inputClass}
            value={value.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            onBlur={() => markTouched("lastName")}
          />
          {showError("lastName", !value.lastName.trim()) && (
            <p className="text-xs text-red-600 mt-1">Required</p>
          )}
        </div>
      </div>

      {showCompany && (
        <div>
          <label className={labelClass}>Company</label>
          <input
            className={inputClass}
            value={value.company ?? ""}
            onChange={(e) => set("company", e.target.value)}
          />
        </div>
      )}

      <div>
        <label className={labelClass}>Country</label>
        <select
          className={inputClass}
          value={value.country}
          onChange={(e) => set("country", e.target.value)}
          onBlur={() => markTouched("country")}
        >
          <option value="">Select country</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {showError("country", !value.country.trim()) && (
          <p className="text-xs text-red-600 mt-1">Required</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Address line 1</label>
        <input
          className={inputClass}
          value={value.addressLine1}
          onChange={(e) => set("addressLine1", e.target.value)}
          onBlur={() => markTouched("addressLine1")}
        />
        {showError("addressLine1", !value.addressLine1.trim()) && (
          <p className="text-xs text-red-600 mt-1">Required</p>
        )}
      </div>

      <div>
        <label className={labelClass}>Address line 2 (optional)</label>
        <input
          className={inputClass}
          value={value.addressLine2 ?? ""}
          onChange={(e) => set("addressLine2", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Zip</label>
          <input
            className={inputClass}
            value={value.zip}
            onChange={(e) => set("zip", e.target.value)}
            onBlur={() => markTouched("zip")}
          />
          {showError("zip", !value.zip.trim()) && (
            <p className="text-xs text-red-600 mt-1">Required</p>
          )}
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input
            className={inputClass}
            value={value.city}
            onChange={(e) => set("city", e.target.value)}
            onBlur={() => markTouched("city")}
          />
          {showError("city", !value.city.trim()) && (
            <p className="text-xs text-red-600 mt-1">Required</p>
          )}
        </div>
      </div>

      {showState && (
        <div>
          <label className={labelClass}>State (optional)</label>
          <input
            className={inputClass}
            value={value.state ?? ""}
            onChange={(e) => set("state", e.target.value)}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Email</label>
          <input
            className={inputClass}
            type="email"
            value={value.email}
            onChange={(e) => set("email", e.target.value)}
            onBlur={() => markTouched("email")}
          />
          {showError("email", !EMAIL_RE.test(value.email.trim())) && (
            <p className="text-xs text-red-600 mt-1">Enter a valid email</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input
            className={inputClass}
            value={value.phone}
            onChange={(e) => set("phone", e.target.value)}
            onBlur={() => markTouched("phone")}
          />
          {showError("phone", !value.phone.trim()) && (
            <p className="text-xs text-red-600 mt-1">Required</p>
          )}
        </div>
      </div>

      {showPO && (
        <div>
          <label className={labelClass}>PO Number (optional)</label>
          <input
            className={inputClass}
            value={value.poNumber ?? ""}
            onChange={(e) => set("poNumber", e.target.value)}
          />
        </div>
      )}

      {showNotes && (
        <div>
          <label className={labelClass}>Order notes (optional)</label>
          <textarea
            className={inputClass}
            rows={3}
            value={value.orderNotes ?? ""}
            onChange={(e) => set("orderNotes", e.target.value)}
          />
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-[#111111]/80">
        <input
          type="checkbox"
          checked={value.receiveEmails}
          onChange={(e) => set("receiveEmails", e.target.checked)}
        />
        Receive emails with news and updates
      </label>
    </div>
  );
}