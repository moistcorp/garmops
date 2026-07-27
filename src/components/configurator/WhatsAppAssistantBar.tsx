"use client";

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
        className="configurator-glass-control rounded-full border px-4 py-2 text-xs font-medium text-[#111111]/75 hover:!border-[var(--color-teal)]/45 hover:!bg-white/60 hover:text-[var(--color-teal)] lg:px-5 lg:py-2.5 lg:text-sm"
      >
        Ask me anything...
      </a>
    </div>
  );
}
