// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SentimentSegment, Utterance } from "@/lib/providers/asr";
import { TalkShare } from "@/components/charts/talk-share";
import { CallTimeline } from "@/components/charts/call-timeline";
import { HeroScore, Meter } from "@/components/charts/stat";
import { CategoryScores } from "@/components/charts/category-scores";

afterEach(cleanup);

const utterances: Utterance[] = [
  { speaker: "A", text: "hello", startMs: 0, endMs: 4000, confidence: 0.9 },
  { speaker: "B", text: "hi there", startMs: 5000, endMs: 9000, confidence: 0.9 },
  { speaker: "A", text: "goodbye", startMs: 12000, endMs: 16000, confidence: 0.9 },
];

describe("TalkShare", () => {
  it("labels both shares directly, so no value depends on hover", () => {
    render(<TalkShare agentMs={60000} customerMs={40000} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("names both series in the legend, so identity is never colour alone", () => {
    render(<TalkShare agentMs={60000} customerMs={40000} />);
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("Customer")).toBeInTheDocument();
  });

  it("omits an in-bar label that would not fit rather than clipping it", () => {
    // 4% of the bar cannot hold "4%" with padding.
    render(<TalkShare agentMs={96000} customerMs={4000} />);
    expect(screen.getByText("96%")).toBeInTheDocument();
    expect(screen.queryByText("4%")).not.toBeInTheDocument();
  });

  it("says so plainly when there is no speech rather than drawing an empty bar", () => {
    render(<TalkShare agentMs={0} customerMs={0} />);
    expect(screen.getByText(/no speech detected/i)).toBeInTheDocument();
  });
});

describe("CallTimeline", () => {
  it("renders one mark per turn with an accessible summary", () => {
    render(
      <CallTimeline
        utterances={utterances}
        durationMs={16000}
        agentSpeakerLabel="A"
      />,
    );
    expect(
      screen.getByRole("img", { name: /3 turns over 0:16/i }),
    ).toBeInTheDocument();
  });

  it("labels silence in the legend — absence is shown as absence", () => {
    render(
      <CallTimeline
        utterances={utterances}
        durationMs={16000}
        agentSpeakerLabel="A"
      />,
    );
    expect(screen.getByText("Silence")).toBeInTheDocument();
  });

  it("seeks when clicked, so the summary doubles as a transport control", async () => {
    const onSeek = vi.fn();
    const { container } = render(
      <CallTimeline
        utterances={utterances}
        durationMs={16000}
        agentSpeakerLabel="A"
        onSeek={onSeek}
      />,
    );

    // jsdom reports zero-size rects; give the clickable strip a real width so
    // the position maths is actually exercised.
    const strip = container.querySelector(".cursor-pointer") as HTMLElement;
    strip.getBoundingClientRect = () =>
      ({ left: 0, width: 400 }) as DOMRect;

    await userEvent.click(strip);
    expect(onSeek).toHaveBeenCalledTimes(1);
    const [ms] = onSeek.mock.calls[0];
    expect(ms).toBeGreaterThanOrEqual(0);
    expect(ms).toBeLessThanOrEqual(16000);
  });

  it("ignores a click on a zero-width strip instead of seeking to NaN", async () => {
    const onSeek = vi.fn();
    render(
      <CallTimeline
        utterances={utterances}
        durationMs={16000}
        agentSpeakerLabel="A"
        onSeek={onSeek}
      />,
    );
    // jsdom's default rect is all zeros — exactly the degenerate case.
    await userEvent.click(screen.getByRole("img", { name: /turns over/i }));
    expect(onSeek).not.toHaveBeenCalled();
  });

  it("offers no seek affordance when there is no audio to seek", () => {
    render(
      <CallTimeline
        utterances={utterances}
        durationMs={16000}
        agentSpeakerLabel="A"
      />,
    );
    expect(screen.queryByText(/click to jump/i)).not.toBeInTheDocument();
  });

  it("falls back to the last utterance when duration is unknown", () => {
    render(
      <CallTimeline
        utterances={utterances}
        durationMs={null}
        agentSpeakerLabel="A"
      />,
    );
    expect(screen.getByRole("img", { name: /0:16/i })).toBeInTheDocument();
  });
});

describe("HeroScore", () => {
  it("shows the number when there is one", () => {
    render(<HeroScore score={78} />);
    expect(screen.getByText("78")).toBeInTheDocument();
  });

  it("says 'not scored' rather than rendering a zero", () => {
    render(<HeroScore score={null} />);
    expect(screen.getByText(/not scored/i)).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

describe("Meter", () => {
  it("exposes the ratio as text, not colour alone", () => {
    render(<Meter label="Confirmed" value={4} total={5} />);
    expect(screen.getByRole("img", { name: /confirmed: 4 of 5/i })).toBeInTheDocument();
  });

  it("does not divide by zero when nothing was checked", () => {
    render(<Meter label="Confirmed" value={0} total={0} />);
    expect(screen.getByRole("img", { name: /confirmed: 0 of 0/i })).toBeInTheDocument();
  });
});

describe("CategoryScores", () => {
  const categories = [
    { key: "opening", score: 88, note: "Named herself." },
    { key: "close", score: 42, note: "No confirmation." },
    { key: "register", score: null, note: "Call was in English throughout." },
  ];
  const points = [
    {
      point: "Greeted well",
      category: "opening",
      quote: {
        quoteOriginal: "good afternoon",
        quoteEnglish: "good afternoon",
        startMs: 0,
        endMs: 1000,
        speaker: "A",
      },
    },
  ];

  it("sorts worst-last so the weakest category is easy to find", () => {
    render(<CategoryScores categories={categories} points={[]} />);
    const bars = screen.getAllByRole("img");
    expect(bars[0]).toHaveAccessibleName(/opening: 88/i);
    expect(bars[1]).toHaveAccessibleName(/close: 42/i);
  });

  it("lists an unobservable category separately rather than drawing a zero bar", () => {
    render(<CategoryScores categories={categories} points={[]} />);
    expect(screen.getByText(/excluded rather than scored zero/i)).toBeInTheDocument();
    expect(screen.getByText(/— Politeness register/)).toBeInTheDocument();
    // A null category must never appear as a scored bar.
    expect(
      screen.queryByRole("img", { name: /politeness register: 0/i }),
    ).not.toBeInTheDocument();
  });

  it("offers a category's own evidence when it has some", async () => {
    const onSelect = vi.fn();
    render(
      <CategoryScores
        categories={categories}
        points={points}
        onSelectCategory={onSelect}
      />,
    );
    expect(screen.getByText(/1 quote/)).toBeInTheDocument();
    await userEvent.click(screen.getByText(/Opening/));
    expect(onSelect).toHaveBeenCalledWith("opening");
  });

  it("does not offer a filter for a category with no surviving evidence", async () => {
    const onSelect = vi.fn();
    render(
      <CategoryScores
        categories={categories}
        points={points}
        onSelectCategory={onSelect}
      />,
    );
    await userEvent.click(screen.getByText(/Close/));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("CallTimeline layers", () => {
  const sentimentSegments: SentimentSegment[] = [
    { startMs: 0, endMs: 4000, sentiment: "POSITIVE", speaker: "A" },
    { startMs: 5000, endMs: 9000, sentiment: "NEGATIVE", speaker: "B" },
    { startMs: 12000, endMs: 16000, sentiment: "NEUTRAL", speaker: "A" },
  ];

  it("encodes sentiment by position, not colour alone", () => {
    render(
      <CallTimeline
        utterances={utterances}
        sentimentSegments={sentimentSegments}
        durationMs={16000}
        agentSpeakerLabel="A"
      />,
    );
    expect(
      screen.getByRole("img", {
        name: /above the line positive, below the line negative/i,
      }),
    ).toBeInTheDocument();
  });

  it("omits the sentiment band entirely when the provider did not classify", () => {
    render(
      <CallTimeline
        utterances={utterances}
        durationMs={16000}
        agentSpeakerLabel="A"
      />,
    );
    expect(
      screen.queryByRole("img", { name: /above the line positive/i }),
    ).not.toBeInTheDocument();
  });

  it("marks findings on the axis and seeks when one is clicked", async () => {
    const onSelectQuote = vi.fn();
    const strength = {
      point: "Greeted well",
      category: "opening",
      quote: {
        quoteOriginal: "hello",
        quoteEnglish: "hello",
        startMs: 1000,
        endMs: 2000,
        speaker: "A",
      },
    };
    render(
      <CallTimeline
        utterances={utterances}
        durationMs={16000}
        agentSpeakerLabel="A"
        strengths={[strength]}
        onSelectQuote={onSelectQuote}
      />,
    );
    const marker = screen.getByRole("button", { name: /Strength at 0:01/i });
    await userEvent.click(marker);
    expect(onSelectQuote).toHaveBeenCalledWith(strength.quote);
  });
});
