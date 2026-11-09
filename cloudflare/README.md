# Asset hosting

The studio's public media is stored in the `sotw-assets` R2 bucket in Cloudflare account `c59e71abfb131f5a984a17c911fcf794`.

Public origin: https://sotw-assets.rae-social-agency.workers.dev

`assets-worker.js` streams bucket objects through a read-only Worker. It supports GET, HEAD, browser CORS for fonts and Lottie JSON, ETag validation, and byte ranges for video. Responses use a one-day browser cache. `assets-worker-metadata.json` records the deployment settings; upload the script as the multipart module named `worker.js` through the Cloudflare Workers API. This does not deploy the Astro website itself.

`asset-manifest.json` records every uploaded object's key, size and SHA-256, plus the original external URLs. Six project videos retain all original HLS playlists and renditions with relative segment paths. Local media originals remain in `public/media` as working copies.

For future media updates, upload the changed file to the same object key in R2 and update its manifest checksum. Use a new filename when an update must appear immediately for visitors with a cached copy. Keep the site's Cloudflare URLs in sync with new filenames. Never add public upload handling to the delivery Worker. The initial migration used a separate authenticated uploader, removed after verification.

No custom domain was available in this account at migration time. A custom asset hostname can be connected later, followed by replacing the public origin in `src`.

## Website deployment and custom domain — 10 November 2026

The Astro website is deployed as Worker `sotw-website` with Workers Static Assets. The custom domains `offthewall.studio` and `www.offthewall.studio` route to it; `www` permanently redirects to the apex domain, preserving paths and queries. The homepage and `/contact` were verified after cutover. All seven existing Google Workspace MX/TXT records were preserved. `domain-dns-before-cutover.json` is the public DNS snapshot taken before replacing the Framer A/CNAME records.

`website-worker.js` and `website-worker-metadata.json` describe the delivery Worker. The compatibility date uses 2026-11-09 because Cloudflare's UTC date at deployment was still 9 November. Future deployments must upload a new static asset manifest and include the resulting completion token in `assets.jwt` instead of `keep_assets`; module-only changes may retain the existing assets. Upload generated `dist` files excluding `dist/media` (already delivered by R2). The alternate deployment URL is https://sotw-website.rae-social-agency.workers.dev.

The production contact form now saves enquiries through the deployed backend. Resend notifications are enabled and live Gmail delivery has been verified; see `ENQUIRIES.md`.

## Automatic deployment from GitHub

The production build configuration targets `Adhiraj2108/sotw-site`, branch `main`, root `/`:

- Build command: `npm test && npm run build`
- Deploy command: `npm run deploy`
- Preview branch deployments: disabled

`scripts/deploy-site.mjs` uses the Cloudflare Workers API and the build's `CLOUDFLARE_API_TOKEN` to register the static asset manifest, upload changed assets, and deploy to the existing `sotw-website` Worker. The account ID defaults to this project's account and may be supplied as `CLOUDFLARE_ACCOUNT_ID`. Credentials belong only in Cloudflare build settings or CI secrets. The existing custom-domain routing remains attached to the Worker.

Use Node.js 22 or newer. Run `npm run deploy -- --dry-run` after building to inspect the deployment without credentials or network access. This command deploys the website bundle; R2-hosted media and the separate enquiry backend retain their own deployment procedures described above and in `ENQUIRIES.md`.

The native Cloudflare GitHub integration was connected on 10 November 2026 using the existing Workers Builds token. Production pushes to `main` are enabled; the configured build and deploy commands above are visible in the Worker's Settings → Builds panel. Check the Worker's Deployments tab for build logs and outcomes.
