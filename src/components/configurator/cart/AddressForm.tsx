"use client";

import { useId, useState } from "react";

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  gstin?: string;
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
  showContact?: boolean;
  showMarketing?: boolean;
}

export interface AddressValidationOptions {
  requireContact?: boolean;
}

const COUNTRIES = ["India"];

const INDIA_STATES = [
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

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizedIndianPhone(value: string): string {
  const digits = digitsOnly(value);
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function isPinCodeValid(zip: string): boolean {
  return INDIA_PIN_RE.test(zip.trim());
}

function isIndianPhoneValid(phone: string): boolean {
  return INDIA_MOBILE_RE.test(normalizedIndianPhone(phone));
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

function doesGstinMatchState(gstin: string, state?: string): boolean {
  const stateCode = getGstinStateCode(gstin);
  if (!stateCode) return false;
  const normalizedState = normalizeStateName(state ?? "");
  return Boolean(normalizedState && GST_STATE_CODES[stateCode]?.includes(normalizedState));
}

function isGstinValid(gstin?: string): boolean {
  const trimmed = gstin?.trim() ?? "";
  if (!trimmed) return true;
  return GSTIN_RE.test(trimmed.toUpperCase());
}

export function isAddressValid(
  address: Address,
  { requireContact = true }: AddressValidationOptions = {}
): boolean {
  const gstin = address.gstin?.trim() ?? "";
  const contactValid =
    !requireContact ||
    (EMAIL_RE.test(address.email.trim()) && isIndianPhoneValid(address.phone));

  return Boolean(
    address.firstName.trim() &&
      address.lastName.trim() &&
      address.country.trim() &&
      address.addressLine1.trim() &&
      isPinCodeValid(address.zip) &&
      address.city.trim() &&
      address.state?.trim() &&
      contactValid &&
      isGstinValid(gstin) &&
      (!gstin || doesGstinMatchState(gstin, address.state))
  );
}

export function AddressForm({
  value,
  onChange,
  title,
  showCompany = true,
  showState = true,
  showPO = false,
  showNotes = false,
  showContact = true,
  showMarketing = false,
}: AddressFormProps) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const formId = useId();
  const id = (field: string) => `${formId}-${field}`;

  const set = <K extends keyof Address>(key: K, val: Address[K]) => {
    onChange({ ...value, [key]: val });
  };

  const markTouched = (key: string) => setTouched((current) => ({ ...current, [key]: true }));
  const showError = (key: string, invalid: boolean) => touched[key] && invalid;
  const inputClass =
    "w-full rounded-md border border-[#E5E5E5] bg-[#F7F7F7] px-3 py-2 text-sm text-[#111111] placeholder:text-[#111111]/40 focus:border-[var(--color-teal)] focus:outline-none";
  const labelClass = "mb-1 block text-xs font-medium text-[#111111]/70";

  const gstin = value.gstin?.trim() ?? "";
  const gstinHasValue = Boolean(gstin);
  const gstinFormatValid = !gstinHasValue || GSTIN_RE.test(gstin.toUpperCase());
  const gstinStateMatches = !gstinHasValue || doesGstinMatchState(gstin, value.state);
  const stateMissing = !value.state?.trim();
  const stateInvalidForGstin = gstinHasValue && gstinFormatValid && !gstinStateMatches;

  return (
    <div className="space-y-4">
      {title && (
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-[#111111] uppercase">{title}</h3>
          {showContact && (
            <p className="mt-1 text-xs text-[#111111]/55">
              Use the details of the person coordinating this merchandise project.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={id("firstName")} className={labelClass}>First name</label>
          <input
            id={id("firstName")}
            autoComplete="given-name"
            className={inputClass}
            value={value.firstName}
            onChange={(event) => set("firstName", event.target.value)}
            onBlur={() => markTouched("firstName")}
          />
          {showError("firstName", !value.firstName.trim()) && <p className="mt-1 text-xs text-red-600">Required</p>}
        </div>
        <div>
          <label htmlFor={id("lastName")} className={labelClass}>Last name</label>
          <input
            id={id("lastName")}
            autoComplete="family-name"
            className={inputClass}
            value={value.lastName}
            onChange={(event) => set("lastName", event.target.value)}
            onBlur={() => markTouched("lastName")}
          />
          {showError("lastName", !value.lastName.trim()) && <p className="mt-1 text-xs text-red-600">Required</p>}
        </div>
      </div>

      {showCompany && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id("company")} className={labelClass}>Company</label>
            <input
              id={id("company")}
              autoComplete="organization"
              className={inputClass}
              value={value.company ?? ""}
              onChange={(event) => set("company", event.target.value)}
            />
          </div>
          <div>
            <label htmlFor={id("gstin")} className={labelClass}>GSTIN (optional)</label>
            <input
              id={id("gstin")}
              className={inputClass}
              value={value.gstin ?? ""}
              maxLength={15}
              autoCapitalize="characters"
              placeholder="27ABCDE1234F1Z5"
              onChange={(event) => set("gstin", event.target.value.toUpperCase())}
              onBlur={() => markTouched("gstin")}
            />
            {showError("gstin", gstinHasValue && !gstinFormatValid) && (
              <p className="mt-1 text-xs text-red-600">Enter a valid 15-character GSTIN</p>
            )}
            {stateInvalidForGstin && !stateMissing && (
              <p className="mt-1 text-xs text-red-600">GSTIN state code must match the address state.</p>
            )}
          </div>
        </div>
      )}

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
        <p className="mt-1 text-xs text-[#111111]/50">Checkout is currently available for India orders in INR.</p>
      </div>

      <div>
        <label htmlFor={id("addressLine1")} className={labelClass}>Address line 1</label>
        <input
          id={id("addressLine1")}
          autoComplete="address-line1"
          className={inputClass}
          value={value.addressLine1}
          onChange={(event) => set("addressLine1", event.target.value)}
          onBlur={() => markTouched("addressLine1")}
        />
        {showError("addressLine1", !value.addressLine1.trim()) && <p className="mt-1 text-xs text-red-600">Required</p>}
      </div>

      <div>
        <label htmlFor={id("addressLine2")} className={labelClass}>Address line 2 (optional)</label>
        <input
          id={id("addressLine2")}
          autoComplete="address-line2"
          className={inputClass}
          value={value.addressLine2 ?? ""}
          onChange={(event) => set("addressLine2", event.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={id("zip")} className={labelClass}>PIN Code</label>
          <input
            id={id("zip")}
            autoComplete="postal-code"
            className={inputClass}
            inputMode="numeric"
            maxLength={6}
            pattern="[1-9][0-9]{5}"
            placeholder="110001"
            value={value.zip}
            onChange={(event) => set("zip", digitsOnly(event.target.value).slice(0, 6))}
            onBlur={() => markTouched("zip")}
          />
          {showError("zip", !isPinCodeValid(value.zip.trim())) && (
            <p className="mt-1 text-xs text-red-600">Enter a valid 6-digit PIN code</p>
          )}
        </div>
        <div>
          <label htmlFor={id("city")} className={labelClass}>City</label>
          <input
            id={id("city")}
            autoComplete="address-level2"
            className={inputClass}
            value={value.city}
            onChange={(event) => set("city", event.target.value)}
            onBlur={() => markTouched("city")}
          />
          {showError("city", !value.city.trim()) && <p className="mt-1 text-xs text-red-600">Required</p>}
        </div>
      </div>

      {showState && (
        <div>
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
          {showError("state", stateMissing) && <p className="mt-1 text-xs text-red-600">Required</p>}
          {showError("state", stateInvalidForGstin && !stateMissing) && (
            <p className="mt-1 text-xs text-red-600">State must match the GSTIN state code</p>
          )}
        </div>
      )}

      {showContact && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={id("email")} className={labelClass}>Work email</label>
            <input
              id={id("email")}
              autoComplete="email"
              className={inputClass}
              type="email"
              value={value.email}
              onChange={(event) => set("email", event.target.value)}
              onBlur={() => markTouched("email")}
            />
            {showError("email", !EMAIL_RE.test(value.email.trim())) && <p className="mt-1 text-xs text-red-600">Enter a valid email</p>}
          </div>
          <div>
            <label htmlFor={id("phone")} className={labelClass}>Phone</label>
            <input
              id={id("phone")}
              className={inputClass}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="98765 43210"
              value={value.phone}
              onChange={(event) => set("phone", event.target.value)}
              onBlur={() => markTouched("phone")}
            />
            {showError("phone", !isIndianPhoneValid(value.phone.trim())) && (
              <p className="mt-1 text-xs text-red-600">Enter a valid 10-digit Indian mobile number</p>
            )}
          </div>
        </div>
      )}

      {showPO && (
        <div>
          <label htmlFor={id("poNumber")} className={labelClass}>PO number (optional)</label>
          <input id={id("poNumber")} className={inputClass} value={value.poNumber ?? ""} onChange={(event) => set("poNumber", event.target.value)} />
        </div>
      )}

      {showNotes && (
        <div>
          <label htmlFor={id("orderNotes")} className={labelClass}>Order notes (optional)</label>
          <textarea id={id("orderNotes")} className={inputClass} rows={3} value={value.orderNotes ?? ""} onChange={(event) => set("orderNotes", event.target.value)} />
        </div>
      )}

      {showMarketing && (
        <label className="flex items-center gap-2 text-xs text-[#111111]/80">
          <input type="checkbox" checked={value.receiveEmails} onChange={(event) => set("receiveEmails", event.target.checked)} />
          Receive occasional Garmops product and service updates
        </label>
      )}
    </div>
  );
}
