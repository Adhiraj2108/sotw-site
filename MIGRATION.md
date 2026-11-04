# Studio Off The Wall migration

Sources inspected on 4 November 2026 include the published sitemap and HTML and the main Framer project kjperOz1lvixyDuWmdsS through a read-only MCP session. The project and sitemap both identify two pages. No CMS collections or items exist.

| Route | Template and content | Design widths |
| --- | --- | --- |
| / | Studio identity and four image compositions, studio introduction, six outbound Project Wall links, two testimonials, services, exploration gallery and contact footer | 390, 740, 1100, 1440, 1920 |
| /contact | Studio identity, enquiry form and studio information | 390, 740, 1440 |

## Shared system

The editable library includes Global/Navigation, four Hero Image components, Primary, Text+Arrow Link, Website Link and Get in Touch buttons, two Testimonial Tags, Video Player, Pricing Card, Form Overlay and two general Button components. Asset presence alone does not establish that a component is published. Keep page data in this repository. Use Astro for server-rendered markup, CSS for layout and hover, and small browser scripts for the clock, navigation and form.

Nine palette tokens in project order are #000, #141414, #222, #777, #e8e8e8, #f7f7f7, #fff, #f8f8f6 and #2f23f2. Published faces include SF Mono, Geist, Lastik and Times New Roman Cyr. The home document includes five hero images, six project covers, four video sources, a studio mark and eight distinct gallery images. Retain image descriptions, aspect ratios, project link targets, social destinations and contact address.

## Behavior and indexing

Preserve hover variants, the responsive navigation, India time, video previews, contact field names, checkboxes, required fields and budget options. Both pages use the title Studio Off The Wall. Carry across each page's canonical, description, social cards, favicon and robots settings. Production canonicals use the apex domain.

## Implementation and handoff

Both public routes are statically generated. The layout owns metadata and navigation. Shared Astro components render the studio information, hero, project wall, exploration gallery and footer. Native browser scripts drive the live IST clock, pointer dragging, hover playback and email draft. The production bundle uses HLS and Lottie players on demand. No React integration is required.

Use `npm ci` to install the locked dependencies. Run `npm run dev` to edit locally or `npm run build` to generate the static hosting directory `dist/`. The route `/style-guide` displays the palette and type roles and carries a noindex directive. The sitemap lists the two public URLs.

The five hero images, six project covers, gallery artwork, four gallery videos, six Lottie animations and exported vector marks live in `public/media/`. Project Wall video previews retain their original Bunny HLS streams. The typography, social sharing image and favicon reference their published asset URLs. Font redistribution rights were not established.

## Contact delivery

The form opens an email draft addressed to hello@offthewall.studio, as selected during the migration. The subject includes the visitor’s name and the body includes their entered details and selected services. The visitor finishes sending in their mail application. The email link remains available as a second contact path.

## Verification

The representative homepage was implemented and compared before building the contact route. Production captures use Chrome at a viewport height of 900 pixels. The comparison pairs in `verification/` show the published page on the left and Astro on the right. Full-page captures follow a scroll pass to load deferred media.

The table reports first-viewport pixel agreement at a Pixelmatch threshold of 0.1. Page height gives a separate measure of below-the-fold layout drift. Animation frames and the live clock can differ between captures.

| Route | Width (px) | First viewport agreement | Published height (px) | Astro height (px) |
| --- | ---: | ---: | ---: | ---: |
| / | 390 | 98.01% | 6911 | 6886 |
| / | 740 | 98.58% | 5952 | 5924 |
| / | 1100 | 98.70% | 6652 | 6566 |
| / | 1440 | 99.05% | 7359 | 7355 |
| / | 1920 | 99.26% | 6985 | 6955 |
| /contact | 390 | 96.92% | 2694 | 2700 |
| /contact | 740 | 97.33% | 2487 | 2543 |
| /contact | 1100 | 98.20% | 2487 | 2522 |
| /contact | 1440 | 98.94% | 2642 | 2642 |
| /contact | 1920 | 98.69% | 2642 | 2642 |

Production browser checks exercised hero dragging, playback of all six project streams, rendering all six gallery animations, contact navigation, required-field validation, service selection and email draft handling. There were no browser exceptions in this run. The homepage had no horizontal overflow at 320, 390, 575, 740, 1000, 1100, 1440 or 1920 pixels. The final Astro build passed.

## Remaining differences

The mobile studio information bar keeps its location and social links on screen. The reference can offset that row beyond the left edge. Some text wrapping, vertical spacing, animation timing and drag physics differ. The largest measured page-height difference was 86 pixels on the 1100-pixel homepage. Email delivery depends on the visitor’s mail application. Framer hosting, editor-only components and analytics integrations are outside the local static build.
