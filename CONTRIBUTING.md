# Contributing

Thanks for taking a look. This is a learning template, so contributions that
make the pipeline **easier to understand or easier to adapt** are the most
valuable: clearer docs, another ASR or LLM provider behind the existing
interfaces, a new example rubric, better tests, or bug fixes.

## Getting set up

Requires Node.js 20.9 or later.

1. [Fork the repository](https://github.com/nitingoswami-io/voice-insight-template/fork)
   to your own GitHub account.
2. Clone your fork, add the original as `upstream`, and create a branch:

```bash
git clone https://github.com/<your-username>/voice-insight-template.git
cd voice-insight-template
git remote add upstream https://github.com/nitingoswami-io/voice-insight-template.git
git checkout -b my-change
npm install
cp .env.example .env.local   # only needed to run the live pipeline
npm run dev
```

The test suite needs no API keys and no network.

Keep your branch current with `git pull upstream main`, then push to your fork
and open a pull request against `main`.

## Before opening a pull request

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

CI runs the same four commands on every pull request.

## Guidelines

- **Keep it small and readable.** Someone should be able to read a file and
  understand one stage of the pipeline. Prefer a clear comment explaining *why*
  over a clever abstraction.
- **Don't weaken verification.** Changes to `src/lib/verify.ts` should come with
  tests showing that fabricated quotes, wrong timestamps and wrong speakers are
  still rejected.
- **Keep measured and judged apart.** Numbers computed from the audio should not
  come from the model, and the UI should keep the two labelled.
- **No new infrastructure by default.** The template runs with two API keys and
  nothing else. If a feature needs a database or storage, make it optional and
  document it.
- **Never commit secrets.** `.env*` files are ignored, except `.env.example`.

## A note on Next.js

This project uses Next.js 16, which differs from older versions in places. If
you are unsure about an API, check the docs bundled at
`node_modules/next/dist/docs/` before relying on memory or older tutorials.

## Reporting bugs and asking questions

Open an issue using one of the templates. For questions about how something
works, or ideas for adapting the pipeline, GitHub Discussions is a better fit.

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
