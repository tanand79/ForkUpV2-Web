"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        If you see this after leaving the dev server running for a long time, restart it:
      </p>
      <pre className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-left text-xs">
        {`cd web\nnpm run dev:fresh`}
      </pre>
      <p className="max-w-md text-sm text-muted-foreground">
        Also make sure the API is running on port 3001:{" "}
        <code className="text-xs">npm run dev:api</code> from the repo root.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        Try again
      </button>
    </main>
  );
}
