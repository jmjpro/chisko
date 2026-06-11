import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface WizardProps {
  step: number;
  /** Total number of steps, including the final results step. */
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  /** Whether the Next / Submit button is enabled on the current step. */
  canAdvance?: boolean;
  prevLabel: string;
  nextLabel: string;
  submitLabel: string;
  /** Optional short label shown below each progress dot. */
  stepLabels?: string[];
  children: React.ReactNode;
}

export default function Wizard({
  step,
  totalSteps,
  onPrev,
  onNext,
  onSubmit,
  canAdvance = true,
  prevLabel,
  nextLabel,
  submitLabel,
  stepLabels,
  children,
}: WizardProps) {
  const isResultsStep = step === totalSteps - 1;
  const isSubmitStep = step === totalSteps - 2;
  const progressPct = totalSteps > 1 ? (step / (totalSteps - 1)) * 100 : 100;

  return (
    <div>
      {/* Progress rail */}
      <div className="relative mb-8" aria-hidden="true">
        {/* Muted track — pinned to dot centre (6px = half of 12px dot) */}
        <div
          className="absolute inset-x-0 h-px bg-muted"
          style={{ top: "6px" }}
        />
        {/* Primary fill */}
        <div
          className="absolute start-0 h-px bg-primary transition-[width] duration-300"
          style={{ top: "6px", width: `${progressPct}%` }}
        />
        {/* Dots + optional labels */}
        <div className="relative flex justify-between">
          {Array.from({ length: totalSteps }, (_, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "block w-3 h-3 rounded-full",
                    done && "bg-primary",
                    current && "border-2 border-primary bg-background",
                    !done && !current && "bg-muted",
                  )}
                />
                {stepLabels?.[i] && (
                  <span
                    className={cn(
                      "text-xs whitespace-nowrap",
                      current
                        ? "text-primary font-semibold"
                        : "text-muted-foreground",
                    )}
                  >
                    {stepLabels[i]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      {children}

      {/* Navigation — hidden on the results step */}
      {!isResultsStep && (
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button variant="outline" onClick={onPrev}>
              {prevLabel}
            </Button>
          )}
          {isSubmitStep ? (
            <Button onClick={onSubmit} disabled={!canAdvance}>
              {submitLabel}
            </Button>
          ) : (
            <Button onClick={onNext} disabled={!canAdvance}>
              {nextLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
