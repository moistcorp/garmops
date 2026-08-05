"use client";

import { useActionState } from "react";

import {
  saveBillingAddressAction,
  saveShippingAddressAction,
  updateCompanyDetailsAction,
} from "@/app/account/company-actions";
import { INDIA_STATES } from "@/components/configurator/cart/AddressForm";
import TechpackSectionHeading from "@/components/portal/TechpackSectionHeading";
import { INITIAL_STAFF_ACTION_STATE } from "@/lib/staff/actionState";

export type CompanyAddress = Readonly<{
  id: string;
  label: string | null;
  contact_name: string | null;
  phone: string | null;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postal_code: string;
  is_default_billing: boolean;
  is_default_shipping: boolean;
}>;

const inputClass =
  "techpack-control mt-1.5 w-full rounded-[4px] border px-3 py-2.5 text-sm outline-none transition focus:!border-[var(--color-accent)] disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-black/45";
const labelClass = "block text-xs font-medium text-black/55";
const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-[4px] bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-dark)] disabled:cursor-wait disabled:opacity-50";

function Message({
  state,
}: {
  state: typeof INITIAL_STAFF_ACTION_STATE;
}) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      key={state.resetToken}
      role="status"
      data-tone={state.status === "error" ? "error" : "success"}
      className="techpack-notice px-3 py-2 text-sm"
    >
      {state.message}
    </p>
  );
}

function AddressFields({
  address,
  disabled,
  labelRequired = false,
}: {
  address?: CompanyAddress;
  disabled: boolean;
  labelRequired?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClass}>
        Address label{labelRequired ? " *" : ""}
        <input
          className={inputClass}
          name="label"
          defaultValue={address?.label ?? ""}
          placeholder={labelRequired ? "Head office, warehouse…" : "Billing address"}
          required={labelRequired}
          maxLength={80}
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        Contact name
        <input
          className={inputClass}
          name="contactName"
          defaultValue={address?.contact_name ?? ""}
          autoComplete="name"
          maxLength={160}
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        Phone
        <input
          className={inputClass}
          name="phone"
          type="tel"
          defaultValue={address?.phone ?? ""}
          autoComplete="tel"
          placeholder="9876543210"
          disabled={disabled}
        />
      </label>
      <label className={`${labelClass} sm:col-span-2`}>
        Address line 1 *
        <input
          className={inputClass}
          name="line1"
          defaultValue={address?.line1 ?? ""}
          autoComplete="address-line1"
          required
          maxLength={200}
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        Address line 2
        <input
          className={inputClass}
          name="line2"
          defaultValue={address?.line2 ?? ""}
          autoComplete="address-line2"
          maxLength={200}
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        Landmark
        <input
          className={inputClass}
          name="landmark"
          defaultValue={address?.landmark ?? ""}
          maxLength={160}
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        PIN code *
        <input
          className={inputClass}
          name="postalCode"
          defaultValue={address?.postal_code ?? ""}
          autoComplete="postal-code"
          inputMode="numeric"
          pattern="[1-9][0-9]{5}"
          maxLength={6}
          required
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        City *
        <input
          className={inputClass}
          name="city"
          defaultValue={address?.city ?? ""}
          autoComplete="address-level2"
          required
          maxLength={100}
          disabled={disabled}
        />
      </label>
      <label className={labelClass}>
        State *
        <select
          className={inputClass}
          name="state"
          defaultValue={address?.state ?? ""}
          autoComplete="address-level1"
          required
          disabled={disabled}
        >
          <option value="" disabled>
            Select state
          </option>
          {INDIA_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Country
        <input className={inputClass} value="India" disabled readOnly />
      </label>
    </div>
  );
}

function CompanyForm({
  companyName,
  gstin,
  editable,
}: {
  companyName: string;
  gstin: string | null;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateCompanyDetailsAction,
    INITIAL_STAFF_ACTION_STATE,
  );
  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Company name <span className="font-normal text-black/40">(optional for personal accounts)</span>
          <input
            className={inputClass}
            name="companyName"
            defaultValue={companyName}
            autoComplete="organization"
            maxLength={200}
            disabled={!editable}
          />
        </label>
        <label className={labelClass}>
          GSTIN
          <input
            className={`${inputClass} uppercase`}
            name="gstin"
            defaultValue={gstin ?? ""}
            placeholder="29ABCDE1234F1Z5"
            maxLength={15}
            pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z]Z[0-9A-Za-z]"
            disabled={!editable}
          />
        </label>
      </div>
      {editable ? (
        <div className="flex flex-wrap items-center gap-4">
          <button className={buttonClass} type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save billing identity"}
          </button>
          <Message state={state} />
        </div>
      ) : (
        <p className="text-xs text-black/45">Only the company owner can edit these details.</p>
      )}
    </form>
  );
}

function BillingAddressForm({
  address,
  editable,
}: {
  address?: CompanyAddress;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveBillingAddressAction,
    INITIAL_STAFF_ACTION_STATE,
  );
  return (
    <form action={action} className="space-y-5">
      <AddressFields address={address} disabled={!editable} />
      <label className="flex items-start gap-3 text-sm text-black/60">
        <input
          className="mt-0.5 size-4"
          type="checkbox"
          name="useAsShipping"
          defaultChecked={address?.is_default_shipping ?? false}
          disabled={!editable}
        />
        Also use this as the default shipping address
      </label>
      {editable ? (
        <div className="flex flex-wrap items-center gap-4">
          <button className={buttonClass} type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save billing address"}
          </button>
          <Message state={state} />
        </div>
      ) : null}
    </form>
  );
}

function ShippingAddressForm({
  address,
  editable,
  adding = false,
}: {
  address?: CompanyAddress;
  editable: boolean;
  adding?: boolean;
}) {
  const [state, action, pending] = useActionState(
    saveShippingAddressAction,
    INITIAL_STAFF_ACTION_STATE,
  );
  return (
    <form action={action} className="space-y-5">
      {address ? <input type="hidden" name="addressId" value={address.id} /> : null}
      <AddressFields address={address} disabled={!editable} labelRequired />
      <label className="flex items-start gap-3 text-sm text-black/60">
        <input
          className="mt-0.5 size-4"
          type="checkbox"
          name="useAsShipping"
          defaultChecked={address?.is_default_shipping ?? false}
          disabled={!editable}
        />
        Use as default shipping address
      </label>
      {editable ? (
        <div className="flex flex-wrap items-center gap-4">
          <button className={buttonClass} type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : adding
                ? "Add shipping address"
                : "Update shipping address"}
          </button>
          <Message state={state} />
        </div>
      ) : null}
    </form>
  );
}

export default function CompanyDetailsForms({
  companyName,
  gstin,
  billingAddress,
  shippingAddresses,
  canEditCompany,
  canEditAddresses,
}: {
  companyName: string;
  gstin: string | null;
  billingAddress?: CompanyAddress;
  shippingAddresses: CompanyAddress[];
  canEditCompany: boolean;
  canEditAddresses: boolean;
}) {
  return (
    <div className="space-y-5">
      <section className="techpack-surface rounded-[4px] border p-6">
        <TechpackSectionHeading
          index="01"
          title="Company identity"
          description="Personal customers may leave the company name blank. A legal business name is required only when a GSTIN is added."
        />
        <div className="mt-6">
          <CompanyForm companyName={companyName} gstin={gstin} editable={canEditCompany} />
        </div>
      </section>

      <section className="techpack-surface rounded-[4px] border p-6">
        <TechpackSectionHeading
          index="02"
          title="Billing address"
          description="This address is reused for billing and copied into each submitted order."
        />
        <div className="mt-6">
          <BillingAddressForm address={billingAddress} editable={canEditAddresses} />
        </div>
      </section>

      <section className="space-y-4">
        <TechpackSectionHeading
          index="03"
          title="Shipping addresses"
          description="Save delivery locations and choose the default used at checkout."
        />
        {shippingAddresses.map((address) => (
          <details
            key={address.id}
            className="techpack-surface rounded-[4px] border p-5"
          >
            <summary className="cursor-pointer list-none font-semibold">
              <span>{address.label ?? "Shipping address"}</span>
              {address.is_default_shipping ? (
                <span className="techpack-stamp ml-2" data-tone="accent">
                  Default
                </span>
              ) : null}
              <span className="mt-1 block text-xs font-normal text-black/45">
                {address.line1}, {address.city} {address.postal_code}
              </span>
            </summary>
            <div className="mt-5 border-t border-black/8 pt-5">
              <ShippingAddressForm address={address} editable={canEditAddresses} />
            </div>
          </details>
        ))}
        {canEditAddresses ? (
          <details className="techpack-panel rounded-[4px] border border-dashed p-5">
            <summary className="cursor-pointer list-none font-semibold text-[var(--color-accent)]">
              Add another shipping address
            </summary>
            <div className="mt-5 border-t border-black/8 pt-5">
              <ShippingAddressForm editable adding />
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}
