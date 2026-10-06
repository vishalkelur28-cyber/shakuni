import type { ReactNode } from "react";
import { FLOW_STEPS, type StepId } from "../lib/workspace/flow";

/** Page title block. For workflow pages it shows progress dots so users always know where they are. */
export default function PageHeader({
  eyebrow, title, description, step, aside,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  step?: StepId;
  aside?: ReactNode;
}) {
  const s = FLOW_STEPS.find((x) => x.id === step);
  return (
    <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <span className="kicker text-accent">{eyebrow}</span>
          {s && (
            <span className="flex items-center gap-2" aria-label={`Step ${s.n} of ${FLOW_STEPS.length}`}>
              <span className="flex gap-1" aria-hidden>
                {FLOW_STEPS.map((x) => <span key={x.id} className={`h-1 w-4 rounded-full ${x.n <= s.n ? "bg-accent" : "bg-white/10"}`} />)}
              </span>
              <span className="text-xs text-gray-500">Step {s.n} of {FLOW_STEPS.length}</span>
            </span>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-3 text-sm leading-6 text-gray-400 sm:text-base sm:leading-7">{description}</p>}
      </div>
      {aside}
    </header>
  );
}
