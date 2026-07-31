import { retryInvoiceAction } from "@/app/staff/actions";

export default function InvoiceRetryButton({ invoiceId }: { invoiceId: string }) {
  return (
    <form action={retryInvoiceAction}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <button
        type="submit"
        className="rounded-[4px] border border-black/10 px-3 py-2 text-xs font-semibold hover:bg-black/5"
      >
        Retry Zoho sync
      </button>
    </form>
  );
}
