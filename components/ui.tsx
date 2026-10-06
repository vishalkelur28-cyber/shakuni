import type { ReactNode } from "react";

/** Metric tile. Compact on phones (2-up grid), roomy on desktop. */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card min-w-0 p-4 sm:p-5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-gray-600">{hint}</p>}
    </div>
  );
}

type Tone = "info" | "warn" | "ok" | "danger";
// Literal class names so Tailwind's content scan keeps them; `callout-${tone}` would be purged.
const calloutClass: Record<Tone, string> = {
  info: "callout callout-info",
  warn: "callout callout-warn",
  ok: "callout callout-ok",
  danger: "callout callout-danger",
};
export function Callout({ tone = "info", children, role }: { tone?: Tone; children: ReactNode; role?: "alert" | "status" }) {
  return <div role={role} className={calloutClass[tone]}>{children}</div>;
}

export function Section({ title, hint, children, aside }: { title: string; hint?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="h2">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-gray-500">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="well flex flex-col items-center px-6 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-gray-500">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
