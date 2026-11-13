# COLection website

A small static site: no build step, no server, no dependencies.

```
colection-site/
  index.html           the overview (the scroll story)
  counting.html        how counting works: the interactive count, the rules, the checks
  help.html            install steps, questions, what to know before you use it
  how-it-works.html    the screens and the three tools, one step at a time
  pricing.html         size picker, tier table and Buy button (js/pricing.js, js/pricing-page.js)
  success.html         the thank-you page that shows the licence (js/success.js)
  terms.html           DRAFT terms: fill in the [brackets] and have them checked
  server/              the licence server (Cloudflare Worker) and its README: how payments become licences
  tests/               `npm test` (needs Node)
  js/site-config.js    the two settings to fill in: API_BASE and CONTACT_EMAIL
  changelog.html       what's new in each version (add a new <article class="release"> at the top for each release)
  css/style.css        all the styling; colours and fonts are at the top, in :root (a dark version follows the visitor's computer)
  js/site.js           the scroll effects: the rings, the pinned steps, the growing report, the top bar
  js/count-demo.js     the example count (edit the made-up ballots here)
  images/              screenshots and the logo
  downloads/           put the program's zip in here
```

## Open it in VS Code

1. File > Open Folder, and choose `colection-site`.
2. Install the **Live Server** extension (Ritwick Dey), right-click `index.html` and choose **Open with Live Server**.
3. Edit and save: the browser updates by itself.

(Or just double-click `index.html`. Everything works from a file except nothing here needs a server.)

## Things to do before it goes public

- [ ] Put the installer (`COLection-Setup-0.2.3.exe`) and the zip (`COLection-0.2.3.zip`) in `downloads/`, or on a GitHub Release (single files over 100 MB can't go on GitHub Pages), and check the two links in `index.html` (search for `TODO`).
- [ ] Fill in `SELLER` (your name or business, and ABN) in `js/site-config.js` for the Terms page, and have the Terms and the refund wording checked before taking payments.
- [ ] Video guides: edit `js/tutorials-data.js` (see the notes at the top of it); video files go in `videos/`.
- [ ] Add a way to contact you (for example a "Report a problem" link in the footer).
- [ ] Check you are allowed to name any college or show its logo. The screenshots use a made-up "Example College" with made-up names.
- [ ] Replace the screenshots with your own if you like. All of them (app-*.png) show the current program, made on Linux, so fonts differ slightly from Windows. Keep the file names, or edit the `<img>` tags.
- [ ] Check the claims in "What to know before you use it" still match the program.
- [ ] When you release a new version, change the version number (search `0.2.3` (the current number) in every .html file) and add an entry to `changelog.html`.

## Publish it for free

**GitHub Pages**: make a repository, upload the contents of this folder, then Settings > Pages > deploy from the main branch. You get `https://yourname.github.io/reponame/`. Put the program zip in a GitHub Release and link the Download button to it.
**Netlify or Cloudflare Pages**: drag this folder onto their dashboard.

## Fonts

The page loads Inter from Google Fonts. If you want it to work with no outside requests at all, download the fonts and host them in a `fonts/` folder, then replace the `<link>` tags in `index.html` with `@font-face` rules.


## Taking payments

Until `API_BASE` in `js/site-config.js` is filled in, the pricing page's button says "Request an invoice" and opens an email to you with the order filled in: you can sell by hand with `python tools/price.py` and `python tools/issue_licence.py`. To make it automatic, follow `server/README.md`.
