# COLection website

A static site: no build step, no server, no outside requests (the font is in `fonts/`).

```
index.html           the home page
pricing.html         the size slider, plans and the Pay / Request an invoice button (js/pricing.js, js/pricing-page.js)
download.html        the download button and install steps
contact.html         the email address and the common reasons to write
help.html            questions, video guides, and what to know before you start
changelog.html       what's new (add a new <article class="release"> at the top for each version)
terms.html           DRAFT terms: have them checked before taking payments
success.html         the thank-you page that shows the licence after paying (js/success.js)
how-it-works.html    old addresses: they now send people to the home page
counting.html          "
js/site-config.js    THE SETTINGS: contact email, version for the download links, seller, refund days, licence server
css/site.css         all the styling; colours are at the top (light, then dark)
js/site.js           the header line, the two recordings, the four steps, the quick price, the download links
js/count.js          "See how it was won" on the home page (the made-up ballots are at the top of it)
images/              screenshots of the real program, the logo and the favicon
videos/              desk-live.mp4 and phone-ballot.mp4 (the home page); put Help videos here too
fonts/               Schibsted Grotesk (free to use: see the licence file)
server/              the licence server (Cloudflare Worker) and its README
tests/               `npm test` (needs Node): checks the prices match the program
```

## Open it in VS Code

1. File > Open Folder, and choose this folder.
2. Install the **Live Server** extension, right-click `index.html` and choose **Open with Live Server**.
3. Edit and save: the browser updates by itself.

## A new version of the program

1. Upload `COLection-Setup-X.Y.Z.exe` and `COLection-X.Y.Z.zip` to a GitHub Release tagged `vX.Y.Z`.
2. Change `VERSION` in `js/site-config.js`. Every download link follows it.
3. Add an entry to `changelog.html`.

## Before it goes public

- [ ] Check `VERSION` in `js/site-config.js` is the version you've actually released (it's 0.2.3, the last one on GitHub).
- [ ] Fill in `SELLER` in `js/site-config.js`, and have the Terms and refund wording checked before taking payments.
- [ ] Video guides: edit `js/tutorials-data.js` (notes at the top of it).
- [ ] The screenshots and recordings use a made-up "Example College" with made-up names.

## Publish it for free

**GitHub Pages**: upload the contents of this folder to a repository, then Settings > Pages > deploy from the main branch.
**Netlify or Cloudflare Pages**: drag this folder onto their dashboard.

## Taking payments

Until `API_BASE` in `js/site-config.js` is filled in, the pricing page's button says "Request an invoice" and opens an email to you with the order filled in. To make it automatic, follow `server/README.md`.

## How the page moves

- The laptop and phone on the home page are real recordings. They play only while on screen, and not at all for visitors who've asked their computer for less motion (they see a still picture).
- "See how it was won" stays in place while you scroll and moves the count on one round at a time. With less motion asked for, it's an ordinary section with arrow buttons.
