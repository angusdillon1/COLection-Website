/* The things to fill in. See README.md.
   API_BASE      the address of your licence server (the Cloudflare Worker), for example "https://colection-licences.yourname.workers.dev".
                 Leave it "" and the Pay button turns into "Request an invoice", which opens an email to CONTACT_EMAIL instead.
   CONTACT_EMAIL where questions and invoice requests go. Shown on the Contact page.
   SELLER        who the licence is sold by, shown on the Terms page. Your full name or business name, with your ABN if you have one,
                 for example "Angus Smith (ABN 12 345 678 901)". Fill this in BEFORE you take payments.
   REFUND_DAYS   how many days a buyer has to ask for a refund (shown on the Terms and Pricing pages).
   VERSION       the version on the Download page. Every download link is made from it, so for a new version upload the files to a
                 GitHub release tagged v<VERSION> (COLection-Setup-<VERSION>.exe and COLection-<VERSION>.zip) and change this one line.
   RELEASES      where those GitHub releases live. */
window.COL_SITE = {
  API_BASE: "",
  CONTACT_EMAIL: "colectionhelp@gmail.com",
  SELLER: "",
  REFUND_DAYS: 14,
  VERSION: "0.2.3",
  RELEASES: "https://github.com/angusdillon1/COLection/releases/download"
};
