import { useCallback, useEffect, useState, type ReactNode } from "react";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { ClientError } from "../data/client";
import { useClient } from "../data/ClientProvider";

export interface GateSignal {
  trigger(message: string): void;
  subscribe(listener: (message: string) => void): () => void;
}

/** Tiny per-App notifier: query errors call trigger(), the gate subscribes. */
export function createGateSignal(): GateSignal {
  const listeners = new Set<(message: string) => void>();
  return {
    trigger: (message) => listeners.forEach((l) => l(message)),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** QueryClient whose query errors with status 0/503 send the app back to the gate panel. */
export function createQueryClient(signal: GateSignal): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
    queryCache: new QueryCache({
      onError: (error) => {
        if (
          error instanceof ClientError &&
          (error.status === 0 || error.status === 503)
        ) {
          signal.trigger(error.message);
        }
      },
    }),
  });
}

type State =
  { kind: "checking" } | { kind: "ok" } | { kind: "failed"; message: string };

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function BackendGate({
  dataSource,
  signal,
  queryClient,
  children,
}: {
  dataSource: "memory" | "api";
  signal?: GateSignal;
  queryClient?: QueryClient;
  children: ReactNode;
}) {
  const client = useClient();
  const [state, setState] = useState<State>(
    dataSource === "api" ? { kind: "checking" } : { kind: "ok" },
  );

  const check = useCallback(
    async (isCurrent: () => boolean = () => true, recovering = false) => {
      setState({ kind: "checking" });
      let next: State;
      try {
        const h = await client.health();
        next = h.ok
          ? { kind: "ok" }
          : {
              kind: "failed",
              message: `Backend is up but its storage (${h.storage}) is unavailable`,
            };
      } catch (e) {
        next = { kind: "failed", message: describeError(e) };
      }
      if (!isCurrent()) return;
      setState(next);
      if (next.kind === "ok" && recovering)
        void queryClient?.invalidateQueries();
    },
    [client, queryClient],
  );

  useEffect(() => {
    if (dataSource !== "api") return;
    let current = true;
    void check(() => current);
    return () => {
      current = false;
    };
  }, [dataSource, check]);

  useEffect(() => {
    if (dataSource !== "api" || !signal) return;
    return signal.subscribe((message) => setState({ kind: "failed", message }));
  }, [dataSource, signal]);

  if (dataSource === "memory" || state.kind === "ok") return <>{children}</>;

  if (state.kind === "checking") {
    return (
      <div
        role="status"
        className="flex min-h-screen items-center justify-center text-slate-600"
      >
        Connecting…
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <h1 className="text-xl font-semibold text-slate-900">
        Can't reach the backend
      </h1>
      <p className="text-slate-700">{state.message}</p>
      <button
        type="button"
        onClick={() => void check(undefined, true)}
        className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white hover:bg-blue-800"
      >
        Retry
      </button>
    </div>
  );
}
