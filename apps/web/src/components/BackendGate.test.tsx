import { useState } from "react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClientError, type ApplicationsClient } from "../data/client";
import { ClientProvider } from "../data/ClientProvider";
import {
  BackendGate,
  createGateSignal,
  createQueryClient,
} from "./BackendGate";

function fakeClient(
  health: () => Promise<{ ok: boolean; storage: string }>,
): ApplicationsClient {
  return { health } as unknown as ApplicationsClient;
}

function setup(
  client: ApplicationsClient,
  dataSource: "memory" | "api",
  children = <p>app content</p>,
) {
  const signal = createGateSignal();
  const queryClient = createQueryClient(signal);
  render(
    <QueryClientProvider client={queryClient}>
      <ClientProvider client={client}>
        <BackendGate
          dataSource={dataSource}
          signal={signal}
          queryClient={queryClient}
        >
          {children}
        </BackendGate>
      </ClientProvider>
    </QueryClientProvider>,
  );
  return { queryClient };
}

describe("BackendGate", () => {
  it("renders children immediately in memory mode without calling health", () => {
    const health = vi.fn();
    setup(fakeClient(health), "memory");
    expect(screen.getByText("app content")).toBeInTheDocument();
    expect(health).not.toHaveBeenCalled();
  });

  it("shows Connecting then the children once health is ok", async () => {
    setup(
      fakeClient(() => Promise.resolve({ ok: true, storage: "mongo" })),
      "api",
    );
    expect(screen.getByText("Connecting…")).toBeInTheDocument();
    expect(await screen.findByText("app content")).toBeInTheDocument();
  });

  it("shows the panel when health rejects, and recovers on Retry", async () => {
    const user = userEvent.setup();
    let up = false;
    setup(
      fakeClient(() =>
        up
          ? Promise.resolve({ ok: true, storage: "mongo" })
          : Promise.reject(new ClientError(0, "NETWORK", "Network down")),
      ),
      "api",
    );
    expect(
      await screen.findByText("Can't reach the backend"),
    ).toBeInTheDocument();
    expect(screen.getByText("Network down")).toBeInTheDocument();
    expect(screen.queryByText("app content")).toBeNull();
    up = true;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("app content")).toBeInTheDocument();
  });

  it("names the storage when health reports ok: false", async () => {
    setup(
      fakeClient(() => Promise.resolve({ ok: false, storage: "mongo" })),
      "api",
    );
    expect(
      await screen.findByText("Can't reach the backend"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Backend is up but its storage (mongo) is unavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByText("app content")).toBeNull();
  });

  it("re-shows the panel when a query fails with a 503", async () => {
    function Probe() {
      const [on, setOn] = useState(false);
      useQuery({
        queryKey: ["probe"],
        enabled: on,
        queryFn: () =>
          Promise.reject(new ClientError(503, "STORAGE_UNAVAILABLE")),
      });
      return <button onClick={() => setOn(true)}>run query</button>;
    }
    const user = userEvent.setup();
    setup(
      fakeClient(() => Promise.resolve({ ok: true, storage: "mongo" })),
      "api",
      <Probe />,
    );
    await user.click(await screen.findByRole("button", { name: "run query" }));
    expect(
      await screen.findByText("Can't reach the backend"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "run query" })).toBeNull();
  });
});
