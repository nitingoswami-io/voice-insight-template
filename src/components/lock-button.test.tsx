// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LockButton } from "@/components/lock-button";

const assign = vi.fn();

beforeEach(() => {
  assign.mockReset();
  Object.defineProperty(window, "location", {
    value: { assign },
    writable: true,
    configurable: true,
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LockButton", () => {
  it("clears the cookie and leaves the protected area", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LockButton />);
    await userEvent.click(screen.getByRole("button", { name: /lock demo/i }));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/access");
    expect(init.method).toBe("DELETE");
    expect(assign).toHaveBeenCalledWith("/");
  });

  it("still leaves if clearing the cookie fails, rather than stranding the user", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    render(<LockButton />);
    await userEvent.click(screen.getByRole("button", { name: /lock demo/i }));
    expect(assign).toHaveBeenCalledWith("/");
  });
});
