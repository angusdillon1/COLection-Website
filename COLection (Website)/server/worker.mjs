/* COLection licence server: a Cloudflare Worker. It does three things and keeps no database:

     POST /api/checkout    the pricing page sends {org, email, voters, term, plan}; this works out the price itself, asks Stripe for a
                           payment page and returns its address.
     POST /api/webhook     Stripe calls this when a payment succeeds; this signs a licence and emails it to the buyer.
     GET  /api/licence     the "thank you" page asks for the licence by Stripe session id, in case the email is slow.

   A licence is worked out only from the paid Stripe session (its id, date and details), so asking twice gives the same licence and
   nothing has to be stored. The signing key is a secret setting, never in the page. See README.md for the settings. */
import pricing from "../js/pricing.js";

const SEED_TO_PKCS8 = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
const enc = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(text) {
  const s = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function hex(bytes) { return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join(""); }

/* ---------- licences ---------- */
async function sha256Hex(text) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(text))); }

/* The signed text of a licence, in the format the program checks (scripts/logic/licence.py). */
async function signLicence(details, seedText, kid = "web") {
  const seed = unb64url(seedText.trim());
  if (seed.length !== 32) throw new Error("LICENCE_SIGNING_KEY must be the 32-byte private key from tools/make_keys.py web");
  const pkcs8 = new Uint8Array(SEED_TO_PKCS8.length + 32);
  pkcs8.set(SEED_TO_PKCS8); pkcs8.set(seed, SEED_TO_PKCS8.length);
  const key = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
  const body = enc.encode(JSON.stringify({ v: 1, kid, ...details }));                  // (the program checks these exact bytes)
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, key, body));
  return `COL1.${b64url(body)}.${b64url(signature)}`;
}

function cleanOrg(text) {
  return String(text || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}
function cleanEmail(text) {
  const e = String(text || "").trim();
  return e.length <= 120 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e) ? e : "";
}
function melbourneDate(unixSeconds) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Melbourne", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(unixSeconds * 1000));
}

/* The licence a paid Stripe session is owed. Always the same for the same session. */
async function licenceForSession(session, env) {
  const m = session.metadata || {};
  const voters = Number(m.voters), term = String(m.term);
  const plan = m.plan ? String(m.plan) : null;                 // (a payment made before there were plans has none: it covers everything)
  const why = pricing.check(voters, term, plan);
  if (why) throw new Error("The session's details are not valid: " + why);
  const issued = melbourneDate(session.created);
  const id = "W-" + (await sha256Hex(session.id)).slice(0, 8).toUpperCase();
  const details = {
    org: cleanOrg(m.org) || "this organisation",
    plan: plan || (voters <= 250 ? "club" : "organisation"),
    voters,
    issued,
    expires: pricing.expiry(issued, term),
    id,
  };
  return { id, details, text: await signLicence(details, env.LICENCE_SIGNING_KEY, "web") };
}

/* ---------- Stripe ---------- */
function form(params) {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) out.append(k, String(v));
  return out;
}

async function verifyStripeSignature(rawBody, header, secret, nowSeconds, toleranceSeconds = 300) {
  const parts = Object.fromEntries((header || "").split(",").map((p) => p.trim().split("=")).filter((p) => p.length === 2));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(nowSeconds - t) > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = hex(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`)));
  if (mac.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < mac.length; i++) diff |= mac.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

/* ---------- the email ---------- */
function emailFor(session, licence, env) {
  const d = licence.details;
  const term = pricing.termName(session.metadata.term);
  const planName = pricing.planName(d.plan);
  const text = [
    `Thank you for buying COLection for ${d.org}.`,
    ``,
    `Your licence (${planName ? planName + " plan, " : ""}${term}, up to ${d.voters} voters, valid until ${d.expires}):`,
    ``,
    licence.text,
    ``,
    `To use it: open COLection, choose Settings > Licence, paste the whole line above (it starts with COL1) and press "Use this licence". `,
    `It works without internet. Keep this email: the same line works if you reinstall.`,
    ``,
    `Licence number: ${d.id}. If anything is wrong, just reply to this email.`,
  ].join("\n");
  return { from: env.EMAIL_FROM, to: [session.customer_details?.email || session.customer_email], reply_to: env.CONTACT_EMAIL,
           subject: `Your COLection licence for ${d.org}`, text };
}

/* ---------- the handler ---------- */
function reply(status, data, env, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type": "application/json", "access-control-allow-origin": env.SITE_ORIGIN || "*",
    "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET, POST, OPTIONS", vary: "Origin", ...extra } });
}

function makeHandler({ fetch: doFetch = (...a) => fetch(...a), now = () => Math.floor(Date.now() / 1000) } = {}) {
  async function stripe(env, path, init = {}) {
    const res = await doFetch(`https://api.stripe.com/v1/${path}`, { ...init, headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, ...(init.headers || {}) } });
    const data = await res.json();
    if (!res.ok) throw new Error(`Stripe: ${data?.error?.message || res.status}`);
    return data;
  }

  async function checkout(request, env) {
    let input;
    try { input = await request.json(); } catch { return reply(400, { error: "That request wasn't understood." }, env); }
    const voters = Number(input.voters), term = String(input.term);
    const plan = input.plan === undefined || input.plan === null ? pricing.CONFIG.default_plan : String(input.plan);
    const org = cleanOrg(input.org), email = cleanEmail(input.email);
    if (!org) return reply(400, { error: "Please enter the name of your organisation: it goes on the licence." }, env);
    if (!email) return reply(400, { error: "Please enter an email address to send the licence to." }, env);
    const why = pricing.check(voters, term, plan);
    if (why) return reply(400, { error: why }, env);
    const dollars = pricing.price(voters, term, plan);                             // (never the price the page showed)
    const session = await stripe(env, "checkout/sessions", { method: "POST", body: form({
      mode: "payment",
      customer_email: email,
      "line_items[0][quantity]": 1,
      "line_items[0][price_data][currency]": pricing.CONFIG.currency,
      "line_items[0][price_data][unit_amount]": dollars * 100,
      "line_items[0][price_data][product_data][name]": `COLection licence: ${pricing.planName(plan)} plan, ${pricing.termName(term)}, up to ${voters} voters`,
      "line_items[0][price_data][product_data][description]": `For ${org}`,
      "metadata[org]": org, "metadata[voters]": voters, "metadata[term]": term, "metadata[plan]": plan,
      "payment_intent_data[description]": `COLection licence for ${org}`,
      "payment_intent_data[metadata][org]": org,
      success_url: `${env.SITE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.SITE_URL}/pricing.html?cancelled=1`,
    }) });
    return reply(200, { url: session.url }, env);
  }

  async function webhook(request, env) {
    const raw = await request.text();
    if (!(await verifyStripeSignature(raw, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET, now()))) {
      return reply(400, { error: "bad signature" }, env);
    }
    const event = JSON.parse(raw);
    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return reply(200, { ignored: event.type }, env);
    const session = event.data.object;
    if (session.payment_status !== "paid") return reply(200, { ignored: "not paid yet" }, env);
    const licence = await licenceForSession(session, env);
    const mail = emailFor(session, licence, env);
    const res = await doFetch("https://api.resend.com/emails", { method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify(mail) });
    if (!res.ok) return reply(500, { error: "email failed" }, env);                // (Stripe tries again; the licence is the same each time)
    console.log(JSON.stringify({ licence: licence.id, ...licence.details, session: session.id, amount: session.amount_total }));
    return reply(200, { sent: licence.id }, env);
  }

  async function lookup(url, env) {
    const id = url.searchParams.get("session_id") || "";
    if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(id)) return reply(400, { error: "That isn't a payment reference." }, env);
    const session = await stripe(env, `checkout/sessions/${id}`);
    if (session.payment_status !== "paid") return reply(402, { error: "This payment hasn't gone through yet." }, env);
    const licence = await licenceForSession(session, env);
    return reply(200, { licence: licence.text, ...licence.details, term: pricing.termName(session.metadata.term),
                        plan_name: pricing.planName(licence.details.plan) }, env);
  }

  return async function handle(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return reply(204, null, env);
    try {
      if (url.pathname === "/api/checkout" && request.method === "POST") return await checkout(request, env);
      if (url.pathname === "/api/webhook" && request.method === "POST") return await webhook(request, env);
      if (url.pathname === "/api/licence" && request.method === "GET") return await lookup(url, env);
      if (url.pathname === "/api/health") return reply(200, { ok: true }, env);
      return reply(404, { error: "not found" }, env);
    } catch (err) {
      console.log("error", err && err.message);
      return reply(500, { error: "Something went wrong on our side. If you were charged, your licence will be emailed; or contact us." }, env);
    }
  };
}

export { makeHandler, signLicence, licenceForSession, verifyStripeSignature, cleanOrg, cleanEmail };
export default { fetch: (request, env) => makeHandler()(request, env) };
