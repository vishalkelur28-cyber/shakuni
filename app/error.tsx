"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="kicker text-red-300">Something went wrong</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">This page hit an error</h1>
      <p className="mt-3 text-sm leading-6 text-gray-400">Your workspace data is stored in this browser and is not lost. Try again; if it keeps failing, reload the page.</p>
      {error.digest && <p className="mt-2 font-mono text-xs text-gray-600">ref {error.digest}</p>}
      <button type="button" onClick={reset} className="btn btn-primary mt-6">Try again</button>
    </div>
  );
}
