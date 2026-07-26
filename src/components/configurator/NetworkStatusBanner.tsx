"use client";

import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function NetworkStatusBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div role="status" aria-live="polite" className="flex items-center justify-center gap-2 bg-[#FFF3D6] px-4 py-2 text-xs font-medium text-[#6E4D08]">
      <WifiOff size={14} aria-hidden="true" />
      You are offline. Your current browser draft is safe, but uploads, PIN lookup, PDF generation and payment may need a connection.
    </div>
  );
}
