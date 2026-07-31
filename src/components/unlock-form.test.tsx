// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnlockForm } from "@/components/unlock-form";

const assign = vi.fn();

beforeEach(() => {
  assign.mockReset();
  // jsdom won't navigate; capture the call instead.
  Object.defineProperty(window, "location", {
    value: { assign, href: "http://localhost/unlock" },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function ok() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
  );
}

async function submit(code: string) {
  await userEvent.type(screen.getByLabelText(/access code/i), code);
  await userEvent.click(screen.getByRole("button", { name: /unlock/i }));
}

describe("UnlockForm", () => {
  it("leaves the page with a hard navigation once the code is accepted", async () => {
    /*
     * The regression this exists for: router.replace() resolves from Next's
     * client Router Cache, which already holds the middleware redirect back to
     * /unlock. The form appeared to do nothing at all — the reported symptom
     * was "the dialog box doesn't disappear".
     */
    ok();
    render(<UnlockForm next="/demo" />);
    await submit("right-code");
    expect(assign).toHaveBeenCalledWith("/demo");
  });

  it("honours the destination it was given", async () => {
    ok();
    render(<UnlockForm next="/demo?x=1" />);
    await submit("right-code");
    expect(assign).toHaveBeenCalledWith("/demo?x=1");
  });

  it("shows the server's reason for a rejected code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "That code is not right." }), {
            status: 401,
          }),
      ),
    );
    render(<UnlockForm next="/demo" />);
    await submit("wrong");
    expect(await screen.findByText(/that code is not right/i)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("renders an object-shaped error instead of failing silently", async () => {
    /*
     * Vercel's deployment protection answers with `error: {code, message}`.
     * Passing that object straight to React rendered nothing, so the form sat
     * there with no message and no navigation — indistinguishable from a hang.
     */
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: { code: "401", message: "Protected deployment" } }),
            { status: 401 },
          ),
      ),
    );
    render(<UnlockForm next="/demo" />);
    await submit("anything");
    expect(await screen.findByText(/protected deployment/i)).toBeInTheDocument();
  });

  it("re-enables the button after a failure so the code can be retried", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "no" }), { status: 401 })),
    );
    render(<UnlockForm next="/demo" />);
    await submit("wrong");
    expect(screen.getByRole("button", { name: /unlock/i })).toBeEnabled();
  });

  it("reports a network failure rather than sitting silent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    render(<UnlockForm next="/demo" />);
    await submit("right-code");
    expect(await screen.findByText(/could not reach the server/i)).toBeInTheDocument();
  });
});
