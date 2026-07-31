// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Analyzer } from "@/components/analyzer";
import { SAMPLE_INSIGHT, SAMPLE_UTTERANCES } from "@/lib/sample";
import { normalize } from "@/lib/verify";

afterEach(cleanup);

const showSample = () =>
  userEvent.click(screen.getByRole("button", { name: /view sample output/i }));

describe("Analyzer", () => {
  it("starts with nothing but the uploader — no placeholder results", () => {
    render(<Analyzer />);
    expect(screen.getByRole("button", { name: /choose audio/i })).toBeInTheDocument();
    expect(screen.queryByText(/insight/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyse/i })).toBeDisabled();
  });

  it("renders the whole result surface from the sample", async () => {
    render(<Analyzer />);
    await showSample();

    expect(screen.getByText("Insight")).toBeInTheDocument();
    expect(screen.getByText("Measured")).toBeInTheDocument();
    expect(screen.getByText("Provenance")).toBeInTheDocument();
    expect(screen.getByText("Transcript")).toBeInTheDocument();

    expect(screen.getByText("68")).toBeInTheDocument();
    expect(screen.getByText("unresolved")).toBeInTheDocument();
    expect(screen.getByText(SAMPLE_INSIGHT.summary)).toBeInTheDocument();
  });

  it("labels sample output continuously, not once", async () => {
    render(<Analyzer />);
    await showSample();

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/no audio was analysed/i);
    expect(banner).toHaveTextContent(/no model was called/i);
  });

  it("shows each observation with the quote that backs it", async () => {
    render(<Analyzer />);
    await showSample();

    for (const item of [...SAMPLE_INSIGHT.strengths, ...SAMPLE_INSIGHT.coaching]) {
      expect(screen.getByText(item.point)).toBeInTheDocument();
      expect(
        screen.getByText(`“${item.quote.quoteOriginal}”`),
      ).toBeInTheDocument();
    }
  });

  it("badges the observation whose audio was unclear", async () => {
    render(<Analyzer />);
    await showSample();
    // The dead-air coaching point sits on a 0.52-confidence span.
    expect(screen.getByText(/low audio confidence/i)).toBeInTheDocument();
  });

  it("reports what the verifier discarded, on demand", async () => {
    render(<Analyzer />);
    await showSample();

    // The meter reports the keep rate; the prose says what was thrown away.
    expect(
      screen.getByRole("img", { name: /quotes confirmed against the transcript: 4 of 5/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 claim could not be confirmed/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/quote not found/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /show discarded/i }));
    expect(screen.getByText(/quote not found/i)).toBeInTheDocument();
  });

  it("highlights the matching transcript line when a quote is clicked", async () => {
    render(<Analyzer />);
    await showSample();

    const quote = SAMPLE_INSIGHT.strengths[0].quote;
    await userEvent.click(screen.getByText(`“${quote.quoteOriginal}”`));

    const line = screen
      .getAllByRole("listitem")
      .find((li) => li.className.includes("evidence-active"));
    expect(line).toBeDefined();
    expect(within(line!).getByText(/Teen din\?/)).toBeInTheDocument();
  });

  it("marks the agent's turns distinctly from the customer's", async () => {
    render(<Analyzer />);
    await showSample();
    expect(screen.getAllByText("Agent").length).toBeGreaterThan(1);
    expect(screen.getAllByText(/Speaker B/).length).toBeGreaterThan(1);
  });

  it("keeps the sample honest: every quote really is in the transcript", () => {
    // A sample that broke the product's own premise would be worse than none.
    const haystack = normalize(SAMPLE_UTTERANCES.map((u) => u.text).join(" "));
    for (const item of [...SAMPLE_INSIGHT.strengths, ...SAMPLE_INSIGHT.coaching]) {
      expect(haystack).toContain(normalize(item.quote.quoteOriginal));
    }
  });
});
