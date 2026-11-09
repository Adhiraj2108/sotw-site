# Enquiry backend

## Current status

The submission Worker, private R2 storage, and Resend email notifications are deployed. The Worker uses the existing `RESEND_API_KEY` Cloudflare secret; the key is never sent to the browser or committed to the repository. `MAIL_FROM` is `forms@notify.offthewall.studio`, the recipient is fixed to `hello@offthewall.studio`, and Reply-To is the validated visitor email.

A labelled enquiry submitted through the live contact form on 10 November 2026 was saved as `submissions/54ec788f-5752-4cc3-a5c8-d296a0f20b2e.json`. Its notification status is `sent`, and the matching notification was confirmed in the Gmail inbox with the correct From, To, Reply-To and signing domain. The test record and email are retained as verification evidence.

## Submission and storage

Endpoint: `https://sotw-enquiries.rae-social-agency.workers.dev/submit`

Records are private JSON objects under `submissions/<UUID>.json` in the **sotw-enquiries** R2 bucket, Cloudflare account `c59e71abfb131f5a984a17c911fcf794`. View/download them through Cloudflare Dashboard → R2 → sotw-enquiries → submissions. The Worker exposes no reading or listing API and is separate from the public media Worker. Objects remain until removed by the account owner.

Each record contains the normalized form fields, receipt UUID, UTC creation time, and notification status. IP addresses are used by the rate limiter but are not stored in enquiry records. Status is pending, sending (with a five-minute lease), or sent with provider message ID. Successful notification indicates acceptance by the email provider, rather than confirmed inbox delivery.

Both browser and server use `src/lib/enquiry.js` for required fields, maximum lengths, email/website format and service/budget allowlists. Website URLs without a scheme are normalized to HTTPS. At least one service and an explicit budget selection are required. Submission UUIDs and conditional R2 writes prevent duplicate records on retries. Origin restrictions, a honeypot, request size limits and a rate limiter (five requests per minute per IP per Cloudflare location) provide basic abuse controls.

## Email notifications

The Worker calls `POST https://api.resend.com/emails` only after saving the enquiry to R2. It sends both plain text and escaped HTML, sets Reply-To to the visitor, and records Resend's message ID after an accepted response. HTTP errors, timeouts, or missing message IDs keep the enquiry pending for retry. Provider error bodies and API keys are not logged.

Resend must have `notify.offthewall.studio` verified for sending. Keep its sending DNS records alongside the existing Google Workspace mail configuration. No Cloudflare Email Sending binding or paid upgrade is needed.

Configure `RESEND_API_KEY` as a Cloudflare Worker secret on **sotw-enquiries**, not on the website Worker. Deployment metadata retains existing `secret_text` bindings with `keep_bindings`. Never add the actual key to metadata or frontend environment variables.

Email failures retain the enquiry and retry with exponential backoff (up to one hour); a cron runs every five minutes. Concurrent notification attempts use conditional R2 writes to acquire a lease. Requests include the stable `Idempotency-Key: enquiry/<UUID>` header, which Resend deduplicates for 24 hours. Delivery remains at least once beyond that provider window if saving the sent status fails after an accepted send. Existing pending enquiries are processed once configuration is available.

## Deployment and development

Deploy via multipart Cloudflare Workers API upload with `cloudflare/enquiries-worker-metadata.json` and these modules, retaining their paths:

- `cloudflare/enquiries-worker.js`
- `src/lib/enquiry.js`

Enable workers.dev for `sotw-enquiries` and configure the cron `*/5 * * * *`. Add any additional actual deployment origin to `ALLOWED_ORIGINS` before using it; do not use wildcard origins. The defaults allow both production domain variants and localhost/127.0.0.1 on port 4321. `PUBLIC_ENQUIRY_ENDPOINT` can override the endpoint at Astro build time.

Run `node --test tests/enquiries.test.js` and `npm run build`. The Astro website was deployed on 10 November 2026 and the updated contact page is now live at https://offthewall.studio/contact.
