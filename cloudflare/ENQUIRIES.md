# Enquiry backend

## Current status

The submission Worker and private storage are deployed. Email delivery is **not enabled yet**: there is no verified sending domain in the connected Cloudflare account, and the email-management endpoints are outside the current connection's permissions. The `MAIL_FROM` binding is empty and there is no `EMAIL` binding. Every receipt remains notification `pending` until sending is configured. Tests cover sending and retry behavior with a simulated email binding; live inbox delivery remains to be verified.

## Submission and storage

Endpoint: `https://sotw-enquiries.rae-social-agency.workers.dev/submit`

Records are private JSON objects under `submissions/<UUID>.json` in the **sotw-enquiries** R2 bucket, Cloudflare account `c59e71abfb131f5a984a17c911fcf794`. View/download them through Cloudflare Dashboard → R2 → sotw-enquiries → submissions. The Worker exposes no reading or listing API and is separate from the public media Worker. Objects remain until removed by the account owner.

Each record contains the normalized form fields, receipt UUID, UTC creation time, and notification status. IP addresses are used by the rate limiter but are not stored in enquiry records. Status is pending, sending (with a five-minute lease), or sent with provider message ID. Successful notification indicates acceptance by the email provider, rather than confirmed inbox delivery.

Both browser and server use `src/lib/enquiry.js` for required fields, maximum lengths, email/website format and service/budget allowlists. Website URLs without a scheme are normalized to HTTPS. At least one service and an explicit budget selection are required. Submission UUIDs and conditional R2 writes prevent duplicate records on retries. Origin restrictions, a honeypot, request size limits and a rate limiter (five requests per minute per IP per Cloudflare location) provide basic abuse controls.

## Enable email notifications

1. Configure a sending domain in Cloudflare Email Service and verify its DNS records. Sending domain onboarding requires that domain to use Cloudflare DNS. Do not change existing mail routing/MX records as a shortcut.
2. Verify `hello@offthewall.studio` as a destination if required by the account's sending mode.
3. Add `{ "type": "send_email", "name": "EMAIL", "destination_address": "hello@offthewall.studio" }` to the deployment metadata's bindings.
4. Set `MAIL_FROM` to a verified sender such as `notifications@offthewall.studio`. Keep the destination fixed in code. The visitor's email is Reply-To, never the sender.
5. Redeploy the Worker and send one labelled test enquiry; confirm the record changes to sent and the notification arrives in the inbox.

The Worker sends notifications after storing enquiries. Email failures retain the enquiry and retry with exponential backoff (up to one hour); a cron runs every five minutes. Concurrent notification attempts use conditional R2 writes to acquire a lease. Delivery is at least once: if sending succeeds but saving the sent status fails, a retry can send a duplicate. Existing pending enquiries will be processed after email configuration is enabled.

## Deployment and development

Deploy via multipart Cloudflare Workers API upload with `cloudflare/enquiries-worker-metadata.json` and these modules, retaining their paths:

- `cloudflare/enquiries-worker.js`
- `src/lib/enquiry.js`

Enable workers.dev for `sotw-enquiries` and configure the cron `*/5 * * * *`. Add any additional actual deployment origin to `ALLOWED_ORIGINS` before using it; do not use wildcard origins. The defaults allow both production domain variants and localhost/127.0.0.1 on port 4321. `PUBLIC_ENQUIRY_ENDPOINT` can override the endpoint at Astro build time.

Run `node --test tests/enquiries.test.js` and `npm run build`. The Astro website was deployed on 10 November 2026 and the updated contact page is now live at https://offthewall.studio/contact.
