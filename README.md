# Voice Insight Template

An open-source, MIT-licensed reference pipeline for turning **recorded speech
into grounded LLM insight**: speech-to-text, deterministic metrics, structured
LLM inference, and a verification step that checks every model claim against
the transcript before it is shown.

The worked example is **call-centre quality review**. Upload a support call and
you get a transcript with the speakers separated, plus a short assessment —
what went well, what to coach — where **every observation carries the verbatim
quote that backs it**. Click a quote and the audio jumps to that moment.

It is meant to be read, run and forked. Swap the rubric and the prompt, and the
same pipeline can review sales calls, interviews, lectures or clinic visits.

> **Status:** learning template and proof of concept. Not hardened for
> production — see [Known limits](#known-limits).

---

## What you can learn from it

- **Provider-agnostic ASR.** A four-method interface wraps AssemblyAI, with
  language detection, diarization, per-word timings and confidence.
- **Measured vs judged.** Talk share, silence and interruptions are computed
  from the audio with no model involved, and are labelled separately from
  model opinions.
- **Structured LLM output.** A zod schema becomes a JSON Schema for the model's
  structured-output mode, with a rubric defined as data.
- **Treating the model as untrusted.** Every quote is located in the real
  transcript, at about the claimed time, from the claimed speaker. Anything
  that fails is dropped and counted.
- **Multilingual without pre-translation.** The model reads the call in the
  language it was spoken, and normalisation keeps Indic vowel signs intact.
- **Zero infrastructure.** No database, storage bucket, queue or webhook — just
  two API keys.

The full walkthrough is in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## Quick start

Requires Node.js 20.9 or later.

```bash
git clone https://github.com/nitingoswami-io/voice-insight-template.git
cd voice-insight-template
npm install
cp .env.example .env.local     # add your two API keys
npm run dev                    # http://localhost:3000
```

You need two keys, and both providers offer free credit:

| Variable | Used for | Get one |
|---|---|---|
| `ASSEMBLYAI_API_KEY` | Transcription, language detection, diarization | [assemblyai.com](https://www.assemblyai.com/dashboard) |
| `XAI_API_KEY` | LLM analysis | [console.x.ai](https://console.x.ai) |

No keys? Open `/demo` and click **View sample output** to explore the UI with a
built-in example. No API is called.

```bash
npm test          # runs offline, no keys needed
npm run typecheck
npm run lint
npm run build
```

---

## How it works

```
Browser
 ├─ POST /api/transcribe   audio bytes → AssemblyAI, returns a job id     ~2s
 ├─ GET  /api/status?id=   poll every 3s                                  30-60s
 └─ POST /api/insight      fetch transcript → metrics → LLM → verify      ~20s
```

| Stage | Where |
|---|---|
| Speech-to-text | `src/lib/providers/asr.ts`, `asr-assemblyai.ts` |
| Deterministic metrics | `src/lib/metrics.ts` |
| Rubric | `src/lib/quality-guide.ts` |
| Prompt and schema | `src/lib/analysis/prompt.ts`, `schema.ts` |
| Orchestration | `src/lib/analysis/run.ts` |
| Quote verification | `src/lib/verify.ts` |
| UI | `src/components/analyzer.tsx`, `src/components/charts/` |

**Stack:** Next.js 16 (App Router) · AssemblyAI · xAI `grok-4.5` through the
OpenAI-compatible API · zod · Tailwind CSS 4 · Vitest.

On real 10-minute calls, a run takes about 50 seconds and costs about US$0.05 in
API usage (~$0.03 transcription, ~$0.02 analysis).

### The part most worth reading: `src/lib/verify.ts`

Before any observation reaches the page, its quote must be found in the actual
transcript (fuzzy-matched), at roughly the claimed time (±5 s), and attributed
to the claimed speaker. Failures are **dropped and counted**, and the count is
shown under "Provenance". If nothing survives, no score is shown.

Two details:

- **Nearest-occurrence matching.** "Yes" may occur forty times in a call; the
  timestamp is what tells the one the model meant apart from an invented one.
- **`normalize()` strips Latin diacritics but keeps Indic combining marks.**
  The usual NFD-and-drop-all-marks trick would collapse का, कि and की to क —
  silently breaking verification on exactly the languages this handles.

---

## Adapting it

| You want to… | Change |
|---|---|
| Assess a different kind of conversation | `src/lib/quality-guide.ts` and `SYSTEM_PROMPT` in `src/lib/analysis/prompt.ts` |
| Use another speech-to-text service | Implement `AsrProvider` and switch the import in `src/app/api/*/route.ts` |
| Use another LLM | Set `XAI_BASE_URL` and `XAI_MODEL` for any OpenAI-compatible server (including self-hosted vLLM) |
| Handle longer files | Add object storage with signed client uploads |
| Keep history | Persist the `/api/insight` response in a database |

---

## Deploying your own copy

The app deploys to Vercel (or any Next.js host) with no extra configuration.
Add the environment variables in your host's dashboard:

| Variable | Required | Purpose |
|---|---|---|
| `ASSEMBLYAI_API_KEY` | yes | Transcription |
| `XAI_API_KEY` | yes | Analysis |
| `ACCESS_CODE` | recommended for public URLs | Puts a shared code in front of `/demo` and the API routes |
| `PUBLIC_MAX_MB` | no | Public mode: open to everyone, uploads capped at this size |
| `XAI_MODEL`, `XAI_BASE_URL` | no | Model and endpoint override |

**Set `ACCESS_CODE` before you share a public URL.** Without it, anyone who
finds the deployment can spend your API credit. The gate is off by default so a
fresh fork works on first deploy. Use a long random value, for example
`openssl rand -base64 24`.

| `ACCESS_CODE` | `PUBLIC_MAX_MB` | Result |
|---|---|---|
| unset | unset | Open to everyone, 4.5 MB uploads (local development) |
| set | unset | Private: `/demo` and the API need the code |
| set | set | Public demo: open to everyone, capped uploads; the code lifts the cap |
| unset | set | Open to everyone, capped uploads for all |

### Running a public demo with a spending limit

Each run spends real API credit, so a public demo needs a ceiling. Three layers,
from most to least important:

1. **Hard cap at the providers.** Use prepaid credit with auto-recharge turned
   off on AssemblyAI and xAI. This bounds the worst case whatever else fails.
2. **Per-visitor rate limit.** Add Vercel Firewall rules on `POST
   /api/transcribe` and `POST /api/insight` (for example 3 per IP per hour),
   plus a looser one on `GET /api/status`, which the browser polls every 3 s.
   Blocked requests are not billed. Counters are per region, so the effective
   limit is somewhat looser than configured. Roll the rules out in `log` mode
   first and check the firewall dashboard before enforcing.
3. **Shorter files.** Set `PUBLIC_MAX_MB` (for example `1.5`, a few minutes of
   compressed audio) so each run costs a cent or two. The server enforces it;
   the browser checks it too, so oversized files fail instantly.

"View sample output" on `/demo` costs nothing at all: no API is called.

On Vercel, environment-variable changes take effect on the next deployment. If
the repository is connected to Vercel, pushing to `main` already deploys
production — avoid also running `vercel deploy --prod`, because the two deploys
race for the production alias.

---

## Known limits

- **4.5 MB per file.** Audio passes through a serverless function, and Vercel
  caps request bodies there. That is roughly 9–18 minutes of mono MP3 at
  32–64 kbps; raw WAV will not fit. The page checks the size before uploading.
- **Nothing is saved.** Reloading the page loses the result.
- **Speaker roles are a guess.** Diarization returns A/B; the first speaker is
  assumed to be the agent. Stereo recordings remove the guess.
- **The access gate is a shared code**, not user authentication. The app has
  no rate limiting of its own; use the host's firewall (see above).
- **Model output varies between runs.** The same recording scored 78 and then 85
  on consecutive runs at temperature 0. Every quote verified both times, but the
  wording of coaching points changes.

---

## Contributing

Contributions that make the pipeline easier to understand or adapt are very
welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) © 2026 Nitin Goswami
