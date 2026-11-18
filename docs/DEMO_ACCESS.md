# Demo access: request a link by email

Every live demo on nitingoswami.io that spends paid API credit (OpenAI, xAI,
AssemblyAI, ElevenLabs, ...) follows this one pattern. Visitors can look around
freely; the first action that costs money asks for an email address and sends a
link that unlocks the demo for a few days. When the provider account runs out
of credit, the visitor sees the same dialog — never a raw `429 insufficient_quota`.

The canonical copy lives in the demo-doc skill (`references/demo-access.md`); this repo follows it.

## Rules

1. **Gate only metered calls.** Pages, sample data and read-only views stay public.
2. **Off unless configured.** No `DEMO_ACCESS_SECRET` → no gate, so forks and local
   runs work with no setup.
3. **Stateless.** A pass is a signed token; no database or session store.
4. **Never show a provider error to a visitor.** Map it to `demo_unavailable`.
5. **Always say why.** A visible notice tells visitors the demo runs on paid credit,
   how to get a link, and how to run it themselves with their own key.
6. **Always link home.** Masthead strip: `← nitingoswami.io`; footer: `More demos`.

## The pass (v1)

```
v1.<payload>.<signature>
payload   = base64url(JSON {"sub": email, "aud": demo_id, "iat": unix_s, "exp": unix_s})
signature = base64url(HMAC-SHA256(DEMO_ACCESS_SECRET, "v1." + payload))
```

Valid when the signature matches (constant-time compare), `exp` is in the future and
`aud` is this demo's id or `"*"`. Demos that share a secret can honour one
site-wide pass (`aud: "*"`). The payload is readable, not secret: the UI decodes it
to show "access active for you@example.com until 25 Nov".

## Endpoints

| Call | Purpose |
|---|---|
| `POST /access/request` (`/api/access/request` in Next) `{email, reason?, website?}` | Validate the email, sign a pass, email the link, copy the owner. Always `202 {ok:true}` for a well-formed email, so it reveals nothing. `website` is a honeypot: non-empty → accept and do nothing. |
| Magic link `GET <demo>/?pass=<token>` (or `/unlock?pass=`) | The page stores the pass (header-based demos) or the server sets an httpOnly cookie (same-origin demos), then removes `pass` from the URL. |

Sending the pass: same-origin Next apps use an httpOnly cookie; a browser app that
calls an API on another domain (Vercel → Railway) sends it as `X-Demo-Pass` and
keeps it in `localStorage`.

Limits on `/access/request`: 5 per IP per hour, 1 per email per 10 minutes
(extra requests are accepted silently). Metered endpoints keep their own per-IP and
global limits; a per-pass daily cap is optional where the server has one process.

## Error contract

Metered endpoints return a machine-readable `code` at the top level of the JSON
body, beside the message (`detail` in FastAPI, `error` in Next):

| Status | `code` | When | UI |
|---|---|---|---|
| 401 | `access_required` | No pass, bad signature, expired | Access dialog, "Get a link to the live demo" |
| 503 | `demo_unavailable` | Provider quota exhausted (`insufficient_quota`), invalid or revoked key | Access dialog, "The live demo is out of API credit"; owner emailed once an hour |
| 429 | `rate_limited` | Our own per-IP / global / per-pass limits | Inline message |

## Configuration (same names in every demo)

| Variable | Default | Purpose |
|---|---|---|
| `DEMO_ACCESS_SECRET` | unset (gate off) | HMAC key. `openssl rand -base64 32`. Rotate to revoke every pass. |
| `DEMO_ID` | repo name | Pass audience. |
| `DEMO_PASS_DAYS` | `7` | Pass lifetime. |
| `DEMO_PUBLIC_URL` | first allowed origin / request origin | Base of the magic link. |
| `RESEND_API_KEY` | unset | Sends email via Resend's REST API. Unset → the link is logged on the server (local testing). |
| `ACCESS_EMAIL_FROM` | `Demo desk <onboarding@resend.dev>` | Sender on a domain verified in Resend. |
| `ACCESS_NOTIFY_EMAIL` | unset | Owner copy of every request, and the out-of-credit alert. |

## UI kit (`demo-look`)

- `AccessNotice`: the disclaimer bar under the masthead. It shows "runs on paid X
  credit · Request access · Run it yourself", or "Access active for … until …" with
  a sign-out button.
- `AccessDialog`: the email dialog for both codes, with a "paste your link" fallback
  for opening the email on another device.
- `pass.ts`: `readPass` (decode, for display only) and `extractPass` (pull a token
  out of a pasted link).

The server side is per stack (Python `access.py`, TypeScript `demo-pass.ts`), but
both implement exactly the token format and error contract above.

## Owner checklist (going live)

1. Verify a sending domain in Resend; set `RESEND_API_KEY`, `ACCESS_EMAIL_FROM`,
   `ACCESS_NOTIFY_EMAIL`.
2. Set `DEMO_ACCESS_SECRET` (and `DEMO_PUBLIC_URL` where the API is on another host).
3. Keep a hard monthly budget on every provider account. The gate slows spending;
   only the provider's limit stops it.
4. Test: open the demo in a private window, trigger the dialog, follow the link.
