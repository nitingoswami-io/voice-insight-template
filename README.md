# Call Quality — prototype

Upload a support call recording. Get a transcript with speakers separated and a
short read of the call — what the customer wanted, what went well, what to coach
— where **every observation carries the quote that backs it**. Click a quote and
the audio jumps to it.

One page. Two API keys. No database, no storage bucket, nothing to provision.

---

## Running it

```bash
npm install
cp .env.example .env.local     # add two keys
npm run dev
```

Keys: [AssemblyAI](https://www.assemblyai.com/dashboard) (transcription) and
[xAI](https://console.x.ai) (analysis). Both have free credit.

Deploy: push to Vercel, set the same two env vars. That's it.

```bash
npm test        # 32 tests, no network or credentials needed
npm run build
```

---

## How it works

```
Browser
 ├─ POST /api/transcribe   audio bytes → AssemblyAI, returns a job id     ~2s
 ├─ GET  /api/status?id=   poll every 3s                                  30-60s
 └─ POST /api/insight      fetch transcript → Grok → verify quotes        ~20s
```

Two deliberate choices keep this free of infrastructure:

**No storage service.** Audio is relayed through the API route to AssemblyAI's
own upload endpoint, which holds it long enough to transcribe. For playback the
browser uses `URL.createObjectURL(file)` on the file it already has — so
click-to-seek works with nothing stored anywhere.

**No database.** The browser holds the transcript id between polls, so the
server is stateless. Nothing needs persisting for a single session.

**No webhook.** Polling instead of a callback means no public URL, no shared
secret, and no ngrok tunnel in development. Every request stays short, so
serverless duration limits never come into play.

**Stack:** Next.js 16 on Vercel · AssemblyAI (99 languages, diarization,
per-word confidence) · xAI `grok-4.5` with JSON-schema structured outputs.

---

## The part worth reading: `src/lib/verify.ts`

The model's output is treated as untrusted. Before any observation reaches the
page, its quote must be located in the actual transcript, at roughly the claimed
time, attributed to the claimed speaker. Anything that fails is **dropped and
counted**, and the count is shown on the page under "Provenance".

It matters for a demo more than it sounds: the first thing anyone does with a
tool like this is spot-check one quote. Quotes are also snapped to the
transcript's own timings, so the player always lands on the real moment rather
than where the model guessed.

Two details in there:

- **Nearest-occurrence matching.** "Yes" may occur forty times in a call; the
  timestamp is the only thing distinguishing the one the model meant from a
  fabrication.
- **`normalize()` strips Latin diacritics but preserves Indic combining marks.**
  The usual NFD-and-drop-all-marks trick would collapse का, कि and की to क —
  silently defeating the verifier on exactly the languages this is for.

### Multilingual: no pre-translation

The transcript goes to Grok in the language it was spoken. Translating first
would destroy what's being assessed — Hindi's आप/तू, Spanish's usted/tú, the
moment a frustrated customer switches out of English — and would move the quotes
we verify into a machine translation rather than what was actually said. English
glosses appear only under each quote, where they came back alongside the
observation.

---

## Deploying

Live at **https://lisn10.vercel.app**.

The GitHub repository is connected to Vercel, so **pushing to `main` deploys to
production** and any other branch gets a preview URL.

> **Do not also run `vercel deploy --prod`.** Both paths are live, and a manual
> deploy races the Git-triggered one for the production alias — whichever
> finishes last wins, which makes it look as though configuration changed by
> itself. Push, and let the integration deploy.

Six environment variables, set in the Vercel dashboard rather than the repo:

| Variable | Purpose |
|---|---|
| `ACCESS_CODE` | Unlocks `/demo` and the paid API routes |
| `ASSEMBLYAI_API_KEY` | Transcription, language detection, diarization |
| `XAI_API_KEY` | Analysis |
| `BREVO_API_KEY` | Contact-form delivery |
| `CONTACT_TO_EMAIL` | Where enquiries land |
| `CONTACT_FROM_EMAIL` | Sender — must be verified in Brevo |

Changing one takes effect on the next deployment, not immediately. To rotate a
value, prefer `vercel env rm <NAME> production` followed by `vercel env add`:
`--force` on an existing variable has not been reliable here.

Per-deployment URLs (`lisn10-<hash>-…vercel.app`) sit behind Vercel's own
deployment protection and return 401 to anyone outside the team. Share the
`lisn10.vercel.app` alias, never a deployment URL.

---

## Tests

`src/lib/verify.test.ts` asserts that a fabricated quote, a real quote at a
fabricated timestamp, and a real quote attributed to the wrong speaker are all
discarded — plus that Devanagari and Tamil vowel signs survive normalisation and
Hinglish code-switched evidence verifies.

`src/lib/analysis/run.test.ts` runs the same guard through the whole chain with
the model mocked: a response mixing one grounded observation with one invented
one must yield only the grounded one.

---

## Limits, stated plainly

- **4.5 MB per file.** Audio flows through a serverless function, and Vercel caps
  request bodies there. That's roughly 9–18 minutes of mono MP3 at 32–64 kbps;
  raw WAV exports will not fit. The page checks size before uploading and says
  so. Lifting this means adding object storage with a signed upload URL.
- **Nothing is saved.** Reloading the page loses the result. Single session by
  design.
- **Speaker roles are a guess.** Diarization returns A/B, not agent/customer; the
  first speaker is assumed to be the agent.
- **No auth, no multi-tenancy, no history.** It is a prototype.
- **Never run end-to-end against live APIs in this build.** The pipeline is
  covered by tests with the model mocked, and every error path was exercised,
  but no real recording has been through it.
- Roughly $0.05 for a 10-minute call (~$0.03 transcription + ~$0.02 analysis).
