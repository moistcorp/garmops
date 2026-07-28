"use client";

import { CircleHelp } from "lucide-react";

interface WhatsAppAssistantBarProps {
  configId: string;
  productName?: string;
}

// Business WhatsApp number (wa.me format: country code + number, digits only).
const WHATSAPP_BUSINESS_NUMBER = "918800711169";

export function WhatsAppAssistantBar({ configId, productName }: WhatsAppAssistantBarProps) {
  const messageText = productName
    ? `Hi, I have a question about my ${productName} config (${configId})`
    : `Hi, I have a question about config ${configId}`;

  const whatsappHref = `https://wa.me/${WHATSAPP_BUSINESS_NUMBER}?text=${encodeURIComponent(
    messageText
  )}`;

  return (
    <div className="flex justify-center">
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get help on WhatsApp"
        className="configurator-glass-control inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold text-[#111111]/70 hover:!border-[var(--color-teal)]/45 hover:!bg-white/60 hover:text-[var(--color-teal)]"
      >
        <CircleHelp size={15} strokeWidth={2.2} aria-hidden="true" />
        <span>Help</span>
      </a>
    </div>
  );
}
