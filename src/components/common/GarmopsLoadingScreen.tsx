import GarmopsLogo from "@/components/common/GarmopsLogo";

const productionSteps = ["Cut", "Print", "Stitch", "QC"] as const;

interface GarmopsLoadingScreenProps {
  progress?: number;
  statusText?: string;
  description?: string;
}

export default function GarmopsLoadingScreen({
  progress,
  statusText = "Preparing workspace…",
  description = "Loading product specifications, orders and production details.",
}: GarmopsLoadingScreenProps = {}) {
  const normalizedProgress = typeof progress === "number"
    ? Math.min(100, Math.max(0, Math.round(progress)))
    : undefined;
  const isDeterminate = normalizedProgress !== undefined;

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label="Preparing your Garmops workspace"
      className="garmops-loader-shell techpack-canvas"
    >
      <div className="garmops-loader-card">
        <div className="garmops-loader-meta" aria-hidden="true">
          <span>GAR / WORKSPACE</span>
          <span>PRODUCTION SYSTEM · INDIA</span>
        </div>

        <div className="garmops-loader-board" aria-hidden="true">
          <span className="garmops-loader-corner" data-corner="top-left" />
          <span className="garmops-loader-corner" data-corner="top-right" />
          <span className="garmops-loader-corner" data-corner="bottom-left" />
          <span className="garmops-loader-corner" data-corner="bottom-right" />

          <div className="garmops-loader-measure garmops-loader-measure-x">
            <span>WIDTH</span>
          </div>
          <div className="garmops-loader-measure garmops-loader-measure-y">
            <span>LENGTH</span>
          </div>

          <svg
            className="garmops-loader-pattern"
            viewBox="0 0 240 200"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              className="garmops-loader-pattern-fill"
              d="M86 25 62 35 32 67 56 86 72 70v99h96V70l16 16 24-19-30-32-24-10c-7 21-61 21-68 0Z"
            />
            <path
              className="garmops-loader-pattern-line"
              d="M86 25 62 35 32 67 56 86 72 70v99h96V70l16 16 24-19-30-32-24-10c-7 21-61 21-68 0Z"
            />
            <path
              className="garmops-loader-seam"
              d="M72 70 62 35m106 35 10-35M72 151h96M96 29c3 9 13 14 24 14s21-5 24-14"
            />
            <path
              className="garmops-loader-centre-line"
              d="M120 44v125"
            />
            <circle className="garmops-loader-registration" cx="120" cy="106" r="3" />
          </svg>

          <div className="garmops-loader-scan" />
          <span className="garmops-loader-spec garmops-loader-spec-one">
            220 GSM
          </span>
          <span className="garmops-loader-spec garmops-loader-spec-two">
            TOL ± 0.5
          </span>
        </div>

        <div className="garmops-loader-copy">
          <div>
            <GarmopsLogo className="h-3 w-auto" />
            <p className="garmops-loader-title">Preparing your workspace</p>
            <p>{description}</p>
          </div>
          <ol className="garmops-loader-steps" aria-hidden="true">
            {productionSteps.map((step, index) => (
              <li key={step} style={{ "--loader-step": index } as React.CSSProperties}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div className="garmops-loader-progress-panel">
          <div className="garmops-loader-progress-status">
            <span>{statusText}</span>
            <span aria-hidden="true">
              {isDeterminate ? `${normalizedProgress}%` : "IN PROGRESS"}
            </span>
          </div>
          <div
            className="garmops-loader-progress"
            data-mode={isDeterminate ? "determinate" : "indeterminate"}
            role={isDeterminate ? "progressbar" : undefined}
            aria-label={isDeterminate ? "Workspace loading progress" : undefined}
            aria-valuemin={isDeterminate ? 0 : undefined}
            aria-valuemax={isDeterminate ? 100 : undefined}
            aria-valuenow={normalizedProgress}
          >
            <span
              style={isDeterminate
                ? { transform: `scaleX(${normalizedProgress / 100})` }
                : undefined}
            />
          </div>
        </div>
      </div>
      <span className="sr-only">{statusText} Please wait.</span>
    </section>
  );
}
