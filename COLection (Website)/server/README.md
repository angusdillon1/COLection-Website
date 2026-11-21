# The licence server

A tiny Cloudflare Worker (`worker.mjs`). It takes the payment and emails the licence, with no database and no computer of yours running.

```
Buyer picks size + term on pricing.html
   -> POST /api/checkout   server works out the price itself, asks Stripe for a payment page
   -> buyer pays on Stripe's page
   -> Stripe calls POST /api/webhook   server signs a licence with the WEB key and emails it (Resend)
   -> buyer lands on success.html, which asks GET /api/licence and shows the same licence
```

The licence is worked out only from the paid Stripe session, so asking twice gives the identical licence and nothing needs storing.

## Setting it up (about an hour, once)

1. **Keys.** In the program folder: `python tools/make_keys.py` (your offline master key, if you haven't) and `python tools/make_keys.py web`.
   The web key's private half is saved to `~/colection-licence-web.key`; its public half is now in `scripts/logic/licence_key.py`. **Ship a new build of the program** so it trusts the web key. (If the web key ever leaks: remove it from `licence_key.py`, ship an update, make a new web key. Master-key licences keep working.)
2. **Accounts.** Stripe (activate it with your ABN and bank details), Cloudflare (free), Resend (free tier; verify the domain you will email from).
3. **Settings.** Edit `wrangler.toml` (`SITE_URL`, `SITE_ORIGIN`, `EMAIL_FROM`, `CONTACT_EMAIL`). Then, in this folder:
   ```
   npx wrangler secret put STRIPE_SECRET_KEY        # Stripe > Developers > API keys (start with the test one: sk_test_...)
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put LICENCE_SIGNING_KEY      # paste the contents of ~/colection-licence-web.key
   npx wrangler deploy                              # prints the address, e.g. https://colection-licences.NAME.workers.dev
   ```
4. **Webhook.** Stripe > Developers > Webhooks > add an endpoint: `<worker address>/api/webhook`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy its signing secret (`whsec_...`) and run `npx wrangler secret put STRIPE_WEBHOOK_SECRET`.
5. **Website.** Put the worker address in `js/site-config.js` (`API_BASE`) and your email (`CONTACT_EMAIL`). Fill the seller details in `terms.html`.
6. **Test** with Stripe's test key and card `4242 4242 4242 4242`: buy, check the email, paste the licence into the program. Only then swap in the live keys (`sk_live_...`, and a live webhook secret).

## Refunds
Refund in Stripe's dashboard. To stop the licence working, add its number (the `W-XXXXXXXX` in the email and in the worker's log) to `REVOKED_IDS` in `scripts/logic/licence_key.py` and ship an update.

## Changing prices
Change the numbers in `tools/pricing.json` **and** at the top of `js/pricing.js`, then run `python -m pytest tests/test_price.py` (in the program folder; regenerate `tests/data/price_vectors.json`) and `npm test` here. The tests fail if the two disagree.

## Tests
`npm test` (Node 20+): pricing parity, Stripe signature checking, checkout, webhook, email retry, licence lookup, and that a licence signed here verifies with the right key. `npm run vector` regenerates `tests/licence_vector.json`, which the program's own tests read to prove its Python accepts what this JavaScript signs.
