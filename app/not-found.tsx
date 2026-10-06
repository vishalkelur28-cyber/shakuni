import Link from "next/link";
import { FLOW_STEPS } from "../lib/workspace/flow";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="kicker text-accent">404</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">That page does not exist</h1>
      <p className="mt-3 text-sm leading-6 text-gray-400">The link may be old or mistyped. Pick up the workflow from the start or jump to a step.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="btn btn-primary">Back to overview</Link>
        {FLOW_STEPS.slice(0, 3).map((s) => <Link key={s.id} href={s.href} className="btn btn-ghost">{s.title}</Link>)}
      </div>
    </div>
  );
}
