/**
 * Site-level feature flags.
 *
 * Deliberately a plain constant rather than an environment variable: this is a
 * build-time decision about what the site offers, and it should be reviewable in
 * a diff rather than differ silently between environments.
 */

/**
 * Whether the contact page and its form are reachable.
 *
 * Controls the nav link, the footer link, the closing call-to-action, the
 * `/contact` route and the `POST /api/contact` endpoint together — so turning it
 * off leaves no page without a way to make contact, and no endpoint quietly
 * accepting personal data that nothing will read.
 *
 * Keep this in step with the delivery channel: with it on but `BREVO_API_KEY`
 * and `CONTACT_TO_EMAIL` unset, the form is visible and correctly refuses every
 * submission, which is honest but not much use to a prospect.
 */
export const CONTACT_ENABLED = true;
