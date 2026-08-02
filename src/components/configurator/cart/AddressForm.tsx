"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, LoaderCircle, MapPin } from "lucide-react";

export interface Address {
  country: string;
  addressLine1: string;
  addressLine2?: string;
  zip: string;
  city: string;
  state?: string;
}

export interface AddressFormProps {
  value: Address;
  onChange: (address: Address) => void;
  idPrefix?: string;
  showCountry?: boolean;
  compact?: boolean;
}

export interface AddressMissingField {
  key: keyof Pick<Address, "country" | "addressLine1" | "zip" | "city" | "state">;
  label: string;
}

const COUNTRIES = ["India"];

export const INDIA_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const INDIA_PIN_RE = /^[1-9][0-9]{5}$/;
const INDIA_MOBILE_RE = /^[6-9][0-9]{9}$/;

const GST_STATE_CODES: Record<string, string[]> = {
  "01": ["jammu and kashmir", "jammu kashmir", "jk"],
  "02": ["himachal pradesh", "hp"],
  "03": ["punjab", "pb"],
  "04": ["chandigarh", "ch"],
  "05": ["uttarakhand", "ut"],
  "06": ["haryana", "hr"],
  "07": ["delhi", "dl", "new delhi"],
  "08": ["rajasthan", "rj"],
  "09": ["uttar pradesh", "up"],
  "10": ["bihar", "br"],
  "11": ["sikkim", "sk"],
  "12": ["arunachal pradesh", "ar"],
  "13": ["nagaland", "nl"],
  "14": ["manipur", "mn"],
  "15": ["mizoram", "mz"],
  "16": ["tripura", "tr"],
  "17": ["meghalaya", "ml"],
  "18": ["assam", "as"],
  "19": ["west bengal", "wb"],
  "20": ["jharkhand", "jh"],
  "21": ["odisha", "orissa", "od"],
  "22": ["chhattisgarh", "ct", "cg"],
  "23": ["madhya pradesh", "mp"],
  "24": ["gujarat", "gj"],
  "25": ["daman and diu", "dd"],
  "26": [
    "dadra and nagar haveli",
    "dn",
    "dadra and nagar haveli and daman and diu",
    "dnhdd",
  ],
  "27": ["maharashtra", "mh"],
  "29": ["karnataka", "ka"],
  "30": ["goa", "ga"],
  "31": ["lakshadweep", "ld"],
  "32": ["kerala", "kl"],
  "33": ["tamil nadu", "tn"],
  "34": ["puducherry", "pondicherry", "py"],
  "35": ["andaman and nicobar islands", "andaman nicobar", "an"],
  "36": ["telangana", "ts", "tg"],
  "37": ["andhra pradesh", "ap"],
  "38": ["ladakh", "la"],
  "97": ["other territory", "other"],
};

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeIndianPhone(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function isPinCodeValid(zip: string): boolean {
  return INDIA_PIN_RE.test(zip.trim());
}

export function isIndianPhoneValid(phone: string): boolean {
  return INDIA_MOBILE_RE.test(normalizeIndianPhone(phone));
}

export function isEmailValid(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

function normalizeStateName(state: string): string {
  return state
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getGstinStateCode(gstin: string): string | undefined {
  const trimmed = gstin.trim().toUpperCase();
  return GSTIN_RE.test(trimmed) ? trimmed.slice(0, 2) : undefined;
}

export function doesGstinMatchState(gstin: string, state?: string): boolean {
  const stateCode = getGstinStateCode(gstin);
  if (!stateCode) return false;
  const normalizedState = normalizeStateName(state ?? "");
  return Boolean(normalizedState && GST_STATE_CODES[stateCode]?.includes(normalizedState));
}

export function isGstinValid(gstin?: string): boolean {
  const trimmed = gstin?.trim() ?? "";
  if (!trimmed) return true;
  return GSTIN_RE.test(trimmed.toUpperCase());
}

export function getAddressMissingFields(address: Address): AddressMissingField[] {
  const missing: AddressMissingField[] = [];
  if (!address.country.trim()) missing.push({ key: "country", label: "country" });
  if (!address.addressLine1.trim()) missing.push({ key: "addressLine1", label: "address" });
  if (!isPinCodeValid(address.zip)) missing.push({ key: "zip", label: "PIN code" });
  if (!address.city.trim()) missing.push({ key: "city", label: "city" });
  if (!address.state?.trim()) missing.push({ key: "state", label: "state" });
  return missing;
}

export function isAddressValid(address: Address): boolean {
  return getAddressMissingFields(address).length === 0;
}

type LookupStatus = "idle" | "loading" | "success" | "not-found" | "error";

export function AddressForm({
  value,
  onChange,
  idPrefix,
  showCountry = true,
  compact = false,
}: AddressFormProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>("idle");
  const [lookupNonce, setLookupNonce] = useState(0);
  const [editingLocation, setEditingLocation] = useState(false);
  const generatedId = useId();
  const formId = idPrefix ?? generatedId;
  const id = (field: string) => `${formId}-${field}`;
  const latestValue = useRef(value);
  const latestOnChange = useRef(onChange);
  const lastLookedUpPin = useRef("");

  useEffect(() => {
    latestValue.current = value;
    latestOnChange.current = onChange;
  }, [onChange, value]);

  useEffect(() => {
    const pin = value.zip.trim();
    if (!isPinCodeValid(pin)) {
      lastLookedUpPin.current = "";
      return;
    }
    if (lastLookedUpPin.current === pin) return;
    lastLookedUpPin.current = pin;

    const controller = new AbortController();
    window.queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setLookupStatus("loading");

      void fetch(`/api/pincode/${encodeURIComponent(pin)}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })
        .then(async (response) => {
          const data = (await response.json()) as {
            city?: string;
            state?: string;
            error?: string;
          };
          if (!response.ok || !data.city || !data.state) {
            setLookupStatus(response.status === 404 ? "not-found" : "error");
            return;
          }
          const current = latestValue.current;
          latestOnChange.current({
            ...current,
            city: data.city,
            state: data.state,
          });
          setLookupStatus("success");
          setEditingLocation(false);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setLookupStatus("error");
        });
    });

    return () => controller.abort();
  }, [value.zip, lookupNonce]);

  const visibleLookupStatus = isPinCodeValid(value.zip)
    ? lookupStatus
    : "idle";

  const set = <K extends keyof Address>(key: K, val: Address[K]) => {
    onChange({ ...value, [key]: val });
  };

  const markTouched = (key: string) =>
    setTouched((current) => ({ ...current, [key]: true }));
  const showError = (key: string, invalid: boolean) => touched[key] && invalid;
  const inputClass =
    "techpack-control w-full rounded-[4px] border px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-primary)]/40 focus:!border-[var(--color-accent)] focus:outline-none";
  const labelClass = "mb-1 block text-xs font-medium text-[var(--text-primary)]/70";

  return (
    <div className="space-y-4">
      {showCountry && (
        <div>
          <label htmlFor={id("country")} className={labelClass}>Country</label>
          <select
            id={id("country")}
            autoComplete="country-name"
            className={inputClass}
            value={value.country}
            onChange={(event) => set("country", event.target.value)}
            onBlur={() => markTouched("country")}
          >
            <option value="">Select country</option>
            {COUNTRIES.map((country) => <option key={country} value={country}>{country}</option>)}
          </select>
          {showError("country", !value.country.trim()) && <p className="mt-1 text-xs text-red-600">Required</p>}
        </div>
      )}

      <div>
        <label htmlFor={id("addressLine1")} className={labelClass}>
          {compact ? "Delivery address" : "Address line 1"}
        </label>
        <input
          id={id("addressLine1")}
          autoComplete="address-line1"
          className={inputClass}
          value={value.addressLine1}
          onChange={(event) => set("addressLine1", event.target.value)}
          onBlur={() => markTouched("addressLine1")}
          placeholder={compact ? "Building, street, area and landmark" : "Building, street and area"}
        />
        {showError("addressLine1", !value.addressLine1.trim()) && <p className="mt-1 text-xs text-red-600">Required</p>}
      </div>

      {!compact && (
        <div>
          <label htmlFor={id("addressLine2")} className={labelClass}>Address line 2 (optional)</label>
          <input
            id={id("addressLine2")}
            autoComplete="address-line2"
            className={inputClass}
            value={value.addressLine2 ?? ""}
            onChange={(event) => set("addressLine2", event.target.value)}
            placeholder="Landmark, floor or unit"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={id("zip")} className={labelClass}>PIN code</label>
          <div className="relative">
            <input
              id={id("zip")}
              autoComplete="postal-code"
              className={`${inputClass} pr-9`}
              inputMode="numeric"
              maxLength={6}
              pattern="[1-9][0-9]{5}"
              placeholder="110001"
              value={value.zip}
              onChange={(event) => {
                const zip = digitsOnly(event.target.value).slice(0, 6);
                setEditingLocation(false);
                setLookupStatus("idle");
                onChange({
                  ...value,
                  zip,
                  city: "",
                  state: "",
                });
              }}
              onBlur={() => markTouched("zip")}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-primary)]/35">
              {visibleLookupStatus === "loading" ? (
                <LoaderCircle size={15} className="animate-spin" aria-label="Looking up PIN code" />
              ) : visibleLookupStatus === "success" ? (
                <CheckCircle2 size={15} className="text-[var(--color-accent-dark)]" aria-label="PIN code found" />
              ) : (
                <MapPin size={15} aria-hidden="true" />
              )}
            </span>
          </div>
          {showError("zip", !isPinCodeValid(value.zip)) && (
            <p className="mt-1 text-xs text-red-600">Enter a valid 6-digit PIN code</p>
          )}
          {visibleLookupStatus === "loading" && <p className="mt-1 text-xs text-[var(--text-primary)]/50">Finding city and state…</p>}
          {visibleLookupStatus === "success" && <p className="mt-1 text-xs text-[var(--color-accent-dark)]">City and state filled from PIN code.</p>}
          {(visibleLookupStatus === "not-found" || visibleLookupStatus === "error") && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-amber-700">
              <span>We could not auto-fill this PIN code. Enter city and state manually.</span>
              <button type="button" onClick={() => { lastLookedUpPin.current = ""; setLookupNonce((value) => value + 1); }} className="font-semibold underline underline-offset-2">Retry lookup</button>
            </div>
          )}
        </div>
        {(!compact || editingLocation || visibleLookupStatus === "not-found" || visibleLookupStatus === "error") && <div>
          <label htmlFor={id("city")} className={labelClass}>City / district</label>
          <input
            id={id("city")}
            autoComplete="address-level2"
            className={inputClass}
            value={value.city}
            onChange={(event) => set("city", event.target.value)}
            onBlur={() => markTouched("city")}
          />
          {showError("city", !value.city.trim()) && <p className="mt-1 text-xs text-red-600">Required</p>}
        </div>}
      </div>

      {compact && visibleLookupStatus === "success" && !editingLocation && (
        <div className="flex items-center justify-between gap-3 rounded-[4px] border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-3 py-2.5">
          <p className="text-sm text-[var(--text-primary)]/75">
            <span className="font-medium text-[var(--text-primary)]">{value.city}</span>
            {value.state ? `, ${value.state}` : ""}
          </p>
          <button
            type="button"
            className="text-xs font-semibold text-[var(--color-accent-dark)] underline underline-offset-2"
            onClick={() => setEditingLocation(true)}
          >
            Edit
          </button>
        </div>
      )}

      {(!compact || editingLocation || visibleLookupStatus === "not-found" || visibleLookupStatus === "error") && <div>
        <label htmlFor={id("state")} className={labelClass}>State or union territory</label>
        <select
          id={id("state")}
          autoComplete="address-level1"
          className={inputClass}
          value={value.state ?? ""}
          onChange={(event) => set("state", event.target.value)}
          onBlur={() => markTouched("state")}
        >
          <option value="">Select state</option>
          {INDIA_STATES.map((state) => <option key={state} value={state}>{state}</option>)}
        </select>
        {showError("state", !value.state?.trim()) && <p className="mt-1 text-xs text-red-600">Required</p>}
      </div>}
    </div>
  );
}
