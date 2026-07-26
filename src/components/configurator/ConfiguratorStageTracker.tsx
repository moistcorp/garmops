"use client";

import { useEffect } from "react";
import { trackConfiguratorEvent } from "@/lib/configurator/analytics";
import type { ConfiguratorJourneyStep } from "./ConfiguratorJourney";

export function ConfiguratorStageTracker({ stage }: { stage: ConfiguratorJourneyStep }) {
  useEffect(() => {
    const startedAt = performance.now();
    trackConfiguratorEvent("stage_viewed", { stage });

    return () => {
      trackConfiguratorEvent("stage_completed", {
        stage,
        duration_seconds: Math.max(0, Math.round((performance.now() - startedAt) / 1000)),
      });
    };
  }, [stage]);

  return null;
}
