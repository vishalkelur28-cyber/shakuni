"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { FLOW_STEPS, REFERENCE_PAGES, TOOL_PAGES, stepForPath, type StepId } from "../lib/workspace/flow";
import { WorkspaceProvider, useWorkspace } from "../lib/workspace/store";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <Frame>{children}</Frame>
    </WorkspaceProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const step = stepForPath(pathname);
  const ref = [...TOOL_PAGES, ...REFERENCE_PAGES].find((r) => r.href === pathname);
  const here = step ? `Step ${step.n} of ${FLOW_STEPS.length} · ${step.title}` : ref ? ref.title : "Overview";

  useEffect(() => setOpen(false), [pathname]);

  // Drawer behaviour: Escape closes, page behind does not scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-black">Skip to content</a>

      <div className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-white/[.08] bg-bg/90 px-4 backdrop-blur lg:hidden">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-sm font-semibold"><Logo />Shakuni</Link>
        <span className="min-w-0 flex-1 truncate text-right text-xs text-gray-500">{here}</span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="sidebar"
          className="btn btn-ghost btn-sm shrink-0"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {open && <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="fixed inset-0 top-14 z-10 bg-black/60 lg:hidden" />}

      <aside
        id="sidebar"
        className={`${open ? "block" : "hidden"} fixed inset-y-0 left-0 top-14 z-20 w-[280px] max-w-[85vw] overflow-y-auto border-r border-white/[.08] bg-panel lg:sticky lg:top-0 lg:z-auto lg:block lg:h-screen lg:w-auto lg:max-w-none`}
      >
        <Sidebar pathname={pathname} />
      </aside>

      <main id="content" className="min-w-0 px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
        <div className="mx-auto max-w-6xl">
          {children}
          <StepFooter pathname={pathname} />
        </div>
      </main>
    </div>
  );
}

function Logo() {
  return (
    <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent">
      <svg viewBox="0 0 32 32" className="h-4 w-4"><path d="M16 5l9 11-9 11-9-11z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /><circle cx="16" cy="16" r="2.5" fill="currentColor" /></svg>
    </span>
  );
}

function useDone(): Record<StepId, boolean> {
  const { state } = useWorkspace();
  return {
    intake: Boolean(state.program),
    analysis: state.analyses.length > 0,
    github: Boolean(state.github),
    registry: false,
    research: false,
    readiness: false,
  };
}

function Sidebar({ pathname }: { pathname: string }) {
  const done = useDone();
  const { reset } = useWorkspace();
  const inputs = (["intake", "analysis", "github"] as const).filter((k) => done[k]).length;

  return (
    <nav aria-label="Primary" className="flex min-h-full flex-col px-3 py-5">
      <Link href="/" className="hidden items-center gap-3 px-3 lg:flex">
        <Logo />
        <span>
          <span className="block text-sm font-semibold leading-tight">Shakuni</span>
          <span className="block text-[11px] text-gray-500">Authorized Security Research</span>
        </span>
      </Link>

      <div className="mt-6 px-3">
        <div className="flex items-center justify-between">
          <p className="kicker">Research workflow</p>
          <p className="text-[11px] text-gray-500">{inputs}/3 inputs</p>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={inputs} aria-label="Workspace inputs completed">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(inputs / 3) * 100}%` }} />
        </div>
      </div>

      <ol className="mt-3 space-y-0.5">
        {FLOW_STEPS.map((s) => {
          const active = pathname === s.href;
          return (
            <li key={s.id}>
              <Link
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active ? "bg-white/[.08] text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${done[s.id] ? "bg-green-500/20 text-green-300" : active ? "bg-accent text-black" : "border border-white/15 text-gray-500"}`}>
                  {done[s.id] ? "✓" : s.n}
                </span>
                {s.title}
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="kicker mt-7 px-3">Tools</p>
      <ul className="mt-2 space-y-0.5">
        {TOOL_PAGES.map((r) => {
          const active = pathname === r.href;
          return (
            <li key={r.href}>
              <Link
                href={r.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${active ? "bg-white/[.08] text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
              >
                <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/15 font-mono text-[10px] text-gray-400">&gt;_</span>
                {r.title}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="kicker mt-7 px-3">Reference</p>
      <ul className="mt-2 space-y-0.5">
        {REFERENCE_PAGES.map((r) => {
          const active = pathname === r.href;
          return (
            <li key={r.href}>
              <Link
                href={r.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-xl px-3 py-2 pl-11 text-sm transition ${active ? "bg-white/[.08] text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}
              >
                {r.title}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto space-y-2 px-1 pt-8">
        <div className="callout callout-ok !px-3 !py-2 text-[11px] leading-5">
          <span className="font-semibold">Safety gates on</span><br />Mainnet blocked · Human approval required
        </div>
        {inputs > 0 && (
          <button type="button" onClick={() => { if (window.confirm("Clear the imported program, analysis and GitHub data from this browser?")) reset(); }} className="w-full rounded-lg px-3 py-2 text-left text-xs text-gray-500 hover:text-gray-300">
            Clear workspace data
          </button>
        )}
      </div>
    </nav>
  );
}

function StepFooter({ pathname }: { pathname: string }) {
  const step = stepForPath(pathname);
  if (!step) return null;
  const prev = FLOW_STEPS[step.n - 2];
  const next = FLOW_STEPS[step.n];

  return (
    <nav aria-label="Workflow steps" className="mt-14 grid grid-cols-2 gap-3 border-t border-white/[.08] pt-6">
      {prev ? (
        <Link href={prev.href} className="card px-4 py-3 text-sm transition hover:bg-raised">
          <span className="kicker block">← Previous</span>
          <span className="mt-0.5 block truncate">{prev.title}</span>
        </Link>
      ) : <span />}
      {next ? (
        <Link href={next.href} className="rounded-2xl bg-white px-4 py-3 text-right text-sm font-semibold text-black transition hover:bg-gray-200">
          <span className="block text-[11px] font-medium uppercase tracking-[.14em] text-gray-500">Next →</span>
          <span className="mt-0.5 block truncate">{next.title}</span>
        </Link>
      ) : (
        <Link href="/" className="card px-4 py-3 text-right text-sm transition hover:bg-raised">
          <span className="kicker block">Finished</span>
          <span className="mt-0.5 block truncate">Back to overview</span>
        </Link>
      )}
    </nav>
  );
}
