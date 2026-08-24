import Image from "next/image";
import { Check, Clock3, TriangleAlert } from "lucide-react";
import type { CSSProperties } from "react";
import GarmopsLogo from "@/components/common/GarmopsLogo";

const productionSteps = ["Cut", "Print", "Stitch", "QC"] as const;

type LoaderStageState = "queued" | "loading" | "complete" | "error";

interface LoadingProduct {
  name: string;
  image: string;
  gsm?: number;
  material?: string;
}

interface GarmopsLoadingScreenProps {
  progress?: number;
  statusText?: string;
  title?: string;
  description?: string;
  product?: LoadingProduct;
  hasErrors?: boolean;
  stages?: readonly {
    label: string;
    state: LoaderStageState;
  }[];
}

const stageStateLabels: Record<LoaderStageState, string> = {
  queued: "Queued",
  loading: "Loading",
  complete: "Ready",
  error: "Limited",
};

function StageIcon({ state }: { state: LoaderStageState }) {
  if (state === "complete") return <Check aria-hidden="true" />;
  if (state === "error") return <TriangleAlert aria-hidden="true" />;
  if (state === "loading") {
    return <span className="garmops-loader-step-pulse" aria-hidden="true" />;
  }
  return <Clock3 aria-hidden="true" />;
}

export default function GarmopsLoadingScreen({
  progress,
  statusText = "Preparing workspace…",
  title,
  description = "Loading product specifications, orders and production details.",
  product,
  hasErrors = false,
  stages,
}: GarmopsLoadingScreenProps = {}) {
  const normalizedProgress = typeof progress === "number"
    ? Math.min(100, Math.max(0, Math.round(progress)))
    : undefined;
  const isDeterminate = normalizedProgress !== undefined;
  const loadingTitle = title ??
    (product ? `Preparing ${product.name}` : "Preparing your workspace");
  const revealInset = isDeterminate ? 100 - normalizedProgress : 100;
  const scanProgress = isDeterminate ? normalizedProgress / 100 : 0;
  const resolvedStages = stages ?? productionSteps.map((label) => ({
    label,
    state: "loading" as const,
  }));

  return (
    <section
      role="region"
      aria-label={loadingTitle}
      aria-busy={normalizedProgress !== 100}
      className="garmops-loader-shell techpack-canvas"
      data-garmops-loader="true"
    >
      <div className="garmops-loader-card">
        <div className="garmops-loader-meta" aria-hidden="true">
          <span>GAR / {product ? "SELECTED PRODUCT" : "WORKSPACE"}</span>
          <span>PRODUCTION SYSTEM · INDIA</span>
        </div>

        <div
          className="garmops-loader-board"
          data-mode={isDeterminate ? "determinate" : "indeterminate"}
          data-product={product ? "true" : "false"}
          aria-hidden="true"
        >
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

          {product ? (
            <div className="garmops-loader-product-visual">
              <div className="garmops-loader-product-image" data-layer="base">
                <Image
                  src={product.image}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 480px) 78vw, 330px"
                />
              </div>
              <div
                className="garmops-loader-product-image"
                data-layer="reveal"
                style={{ clipPath: `inset(0 0 ${revealInset}% 0)` }}
              >
                <Image
                  src={product.image}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 480px) 78vw, 330px"
                />
              </div>
            </div>
          ) : (
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
                style={isDeterminate
                  ? { strokeDashoffset: 690 * (1 - normalizedProgress / 100) }
                  : undefined}
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
          )}

          {isDeterminate ? (
            <div
              className="garmops-loader-scan"
              style={{
                transform: `translateY(calc(${scanProgress} * clamp(180px, 30vw, 260px)))`,
              }}
            />
          ) : null}
          {product?.gsm ? (
            <span className="garmops-loader-spec garmops-loader-spec-one">
              {product.gsm} GSM
            </span>
          ) : null}
          {product?.material ? (
            <span className="garmops-loader-spec garmops-loader-spec-two">
              {product.material}
            </span>
          ) : null}
        </div>

        <div className="garmops-loader-copy">
          <div>
            <GarmopsLogo className="h-3 w-auto" />
            <h1 className="garmops-loader-title">
              {loadingTitle}
            </h1>
            <p>{description}</p>
            {product ? (
              <p className="garmops-loader-product-facts">
                {[product.gsm ? `${product.gsm} GSM` : null, product.material]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
          <ol className="garmops-loader-steps" aria-label="Loading stages">
            {resolvedStages.map((stage, index) => (
              <li
                key={stage.label}
                data-state={stage.state}
                aria-label={`${stage.label}: ${stageStateLabels[stage.state]}`}
                style={{ "--loader-step": index } as CSSProperties}
              >
                <span className="garmops-loader-step-head" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <StageIcon state={stage.state} />
                </span>
                <span className="garmops-loader-step-label" aria-hidden="true">
                  {stage.label}
                </span>
                <span className="garmops-loader-step-state" aria-hidden="true">
                  {stageStateLabels[stage.state]}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="garmops-loader-progress-panel" data-tone={hasErrors ? "warning" : "default"}>
          <div className="garmops-loader-progress-status">
            <span>{statusText}</span>
            <span aria-hidden="true">
              {isDeterminate ? `${normalizedProgress}%` : "IN PROGRESS"}
            </span>
          </div>
          <div
            className="garmops-loader-progress"
            data-mode={isDeterminate ? "determinate" : "indeterminate"}
            role="progressbar"
            aria-label={product
              ? `${product.name} workspace loading progress`
              : "Workspace loading progress"}
            aria-valuemin={isDeterminate ? 0 : undefined}
            aria-valuemax={isDeterminate ? 100 : undefined}
            aria-valuenow={normalizedProgress}
            aria-valuetext={statusText}
          >
            <span
              style={isDeterminate
                ? { transform: `scaleX(${normalizedProgress / 100})` }
                : undefined}
            />
          </div>
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusText}
      </span>
    </section>
  );
}
