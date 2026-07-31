/**
 * What "good" means on a support call.
 *
 * One list drives three things: the prompt the model reads, the schema it must
 * answer against, and the bar chart on screen. Editing a description here
 * changes what gets assessed — no other file needs to know.
 */

export type QualityCategory = {
  /** Stable key. The model echoes it back, so renaming one orphans old results. */
  key: string;
  label: string;
  description: string;
};

export const CATEGORIES: QualityCategory[] = [
  {
    key: "opening",
    label: "Opening",
    description:
      "Greeted the customer, gave their name, and identified the company early.",
  },
  {
    key: "discovery",
    label: "Discovery",
    description:
      "Understood the actual problem before proposing a fix, rather than assuming from the first line.",
  },
  {
    key: "listening",
    label: "Listening",
    description:
      "Avoided making the customer repeat themselves, and did not talk over them.",
  },
  {
    key: "empathy",
    label: "Empathy",
    description:
      "Acknowledged the customer's situation in their own words. A scripted line with no relation to what was just said does not count.",
  },
  {
    key: "register",
    label: "Politeness register",
    description:
      "Used the right level of formality for the language spoken — for example आप rather than तू in Hindi, usted rather than tú in Spanish where the relationship calls for it — and held it under pressure.",
  },
  {
    key: "ownership",
    label: "Ownership",
    description:
      "Drove toward resolution rather than deflecting to another team, a policy, or the customer.",
  },
  {
    key: "accuracy",
    label: "Accuracy",
    description:
      "Said things that were internally consistent, and avoided guessing at policy or timelines.",
  },
  {
    key: "hold",
    label: "Hold & transfer",
    description:
      "Asked before holding, gave a reason, and thanked the customer on return.",
  },
  {
    key: "close",
    label: "Close",
    description:
      "Left the customer knowing what happens next, who does it, and by when.",
  },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function categoryLabel(key: string): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

/** The category list as the model sees it. */
export const QUALITY_GUIDE = CATEGORIES.map(
  (c) => `- ${c.key} — ${c.label}: ${c.description}`,
).join("\n");
