// Run with:  node --test tests/        (Node 20 or newer)
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { makeHandler, signLicence, verifyStripeSignature } from "../server/worker.mjs";

const vectors = JSON.parse(fs.readFileSync(fileURLToPath(new URL("./price_vectors.json", import.meta.url)), "utf8"));
const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
const seed = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32);
const SEED = Buffer.from(seed).toString("base64url");
const env = { SITE_URL: "https://site.test", SITE_ORIGIN: "https://site.test", STRIPE_SECRET_KEY: "sk_test", STRIPE_WEBHOOK_SECRET: "whsec_x",
  RESEND_API_KEY: "re_x", LICENCE_SIGNING_KEY: SEED, EMAIL_FROM: "a@b.c", CONTACT_EMAIL: "me@b.c" };

function sessionObject(over = {}) {
  return { id: "cs_test_abc1234567890", created: 1792000000, payment_status: "paid", amount_total: 15500, customer_email: "buyer@club.test",
    metadata: { org: "Carlton Netball Club", voters: "250", term: "1" }, ...over };
}
async function signedWebhook(event, secret = env.STRIPE_WEBHOOK_SECRET, t = 1792000100) {
  const raw = JSON.stringify(event);
  const mac = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return { raw, header: `t=${t},v1=${mac}` };
}

test("a licence from the server verifies with the matching public key, over the exact bytes", async () => {
  const text = await signLicence({ org: "X", plan: "club", voters: 100, issued: "2026-10-15", expires: "2027-10-15", id: "W-1" }, SEED);
  const [prefix, body, sig] = text.split(".");
  assert.equal(prefix, "COL1");
  assert.equal(sig.length, 86);
  assert.ok(crypto.verify(null, Buffer.from(body, "base64url"), publicKey, Buffer.from(sig, "base64url")));
  const d = JSON.parse(Buffer.from(body, "base64url"));
  assert.equal(d.kid, "web"); assert.equal(d.v, 1); assert.equal(d.voters, 100);
});

test("the stripe signature check accepts a real one and refuses tampering, wrong secrets and old timestamps", async () => {
  const { raw, header } = await signedWebhook({ a: 1 });
  assert.equal(await verifyStripeSignature(raw, header, env.STRIPE_WEBHOOK_SECRET, 1792000100), true);
  assert.equal(await verifyStripeSignature(raw + " ", header, env.STRIPE_WEBHOOK_SECRET, 1792000100), false);
  assert.equal(await verifyStripeSignature(raw, header, "other", 1792000100), false);
  assert.equal(await verifyStripeSignature(raw, header, env.STRIPE_WEBHOOK_SECRET, 1792000100 + 1000), false);
  assert.equal(await verifyStripeSignature(raw, "", env.STRIPE_WEBHOOK_SECRET, 1792000100), false);
});

test("checkout works the price out itself and ignores any price sent", async () => {
  let sent;
  const handle = makeHandler({ fetch: async (url, init) => { sent = { url, body: new URLSearchParams(init.body), auth: init.headers.authorization };
    return new Response(JSON.stringify({ url: "https://checkout.stripe.test/x" }), { status: 200 }); } });
  const res = await handle(new Request("https://api.test/api/checkout", { method: "POST",
    body: JSON.stringify({ org: " Carlton  Netball Club ", email: "buyer@club.test", voters: 250, term: "2", price: 1 }) }), env);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).url, "https://checkout.stripe.test/x");
  assert.equal(sent.body.get("line_items[0][price_data][unit_amount]"), String(450 * 100));       // (no plan sent: Complete)
  assert.equal(sent.body.get("metadata[plan]"), "complete");
  assert.equal(sent.body.get("line_items[0][price_data][currency]"), "aud");
  assert.equal(sent.body.get("metadata[org]"), "Carlton Netball Club");
  assert.equal(sent.auth, "Bearer sk_test");
  assert.match(sent.body.get("success_url"), /success\.html\?session_id=\{CHECKOUT_SESSION_ID\}$/);
});

test("checkout charges for the plan that was chosen", async () => {
  let sent;
  const handle = makeHandler({ fetch: async (url, init) => { sent = new URLSearchParams(init.body);
    return new Response(JSON.stringify({ url: "https://checkout.stripe.test/x" }), { status: 200 }); } });
  const res = await handle(new Request("https://api.test/api/checkout", { method: "POST",
    body: JSON.stringify({ org: "Carlton Netball Club", email: "buyer@club.test", voters: 250, term: "pass", plan: "count" }) }), env);
  assert.equal(res.status, 200);
  assert.equal(sent.get("line_items[0][price_data][unit_amount]"), String(45 * 100));
  assert.equal(sent.get("metadata[plan]"), "count");
  assert.match(sent.get("line_items[0][price_data][product_data][name]"), /Count plan/);
});

test("a session that says which plan was bought gets a licence for that plan", async () => {
  const mails = [];
  const handle = makeHandler({ now: () => 1792000100, fetch: async (url, init) => { mails.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); } });
  const event = { type: "checkout.session.completed", data: { object: sessionObject({ metadata: { org: "Carlton Netball Club", voters: "250", term: "1", plan: "vote" } }) } };
  const { raw, header } = await signedWebhook(event);
  const res = await handle(new Request("https://api.test/api/webhook", { method: "POST", body: raw, headers: { "stripe-signature": header } }), env);
  assert.equal(res.status, 200);
  const line = mails[0].text.split("\n").find((l) => l.startsWith("COL1."));
  assert.equal(JSON.parse(Buffer.from(line.split(".")[1], "base64url")).plan, "vote");
  assert.match(mails[0].text, /Vote plan/);
});

test("checkout refuses bad requests without calling stripe", async () => {
  const handle = makeHandler({ fetch: async () => { throw new Error("must not be called"); } });
  const ask = (b) => handle(new Request("https://api.test/api/checkout", { method: "POST", body: JSON.stringify(b) }), env);
  for (const bad of [{ org: "", email: "a@b.co", voters: 100, term: "1" }, { org: "X", email: "nope", voters: 100, term: "1" },
    { org: "X", email: "a@b.co", voters: 50, term: "1" }, { org: "X", email: "a@b.co", voters: 5001, term: "1" },
    { org: "X", email: "a@b.co", voters: 100, term: "7" }, { org: "X", email: "a@b.co", voters: 100.5, term: "1" },
    { org: "X", email: "a@b.co", voters: "abc", term: "1" }, { org: "X", email: "a@b.co", voters: 100, term: "1", plan: "gold" }]) {
    const res = await ask(bad);
    assert.equal(res.status, 400, JSON.stringify(bad));
    assert.ok((await res.json()).error);
  }
  assert.equal((await handle(new Request("https://api.test/api/checkout", { method: "POST", body: "not json" }), env)).status, 400);
});

test("a paid webhook emails the licence once per call, and the licence is the same each time", async () => {
  const mails = [];
  const handle = makeHandler({ now: () => 1792000100, fetch: async (url, init) => { mails.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); } });
  const event = { type: "checkout.session.completed", data: { object: sessionObject() } };
  const { raw, header } = await signedWebhook(event);
  const call = () => handle(new Request("https://api.test/api/webhook", { method: "POST", body: raw, headers: { "stripe-signature": header } }), env);
  assert.equal((await call()).status, 200);
  assert.equal((await call()).status, 200);
  assert.equal(mails.length, 2);
  const line = (m) => m.text.split("\n").find((l) => l.startsWith("COL1."));
  assert.equal(line(mails[0]), line(mails[1]));
  assert.deepEqual(mails[0].to, ["buyer@club.test"]);
  const body = JSON.parse(Buffer.from(line(mails[0]).split(".")[1], "base64url"));
  assert.equal(body.org, "Carlton Netball Club"); assert.equal(body.voters, 250); assert.equal(body.plan, "club");
  assert.equal(body.issued, "2026-10-15"); assert.equal(body.expires, "2027-10-15"); assert.match(body.id, /^W-[0-9A-F]{8}$/);
});

test("webhooks with a bad signature, an unpaid session or another event type send nothing", async () => {
  const handle = makeHandler({ now: () => 1792000100, fetch: async () => { throw new Error("must not be called"); } });
  const post = (raw, header) => handle(new Request("https://api.test/api/webhook", { method: "POST", body: raw, headers: { "stripe-signature": header } }), env);
  const good = await signedWebhook({ type: "checkout.session.completed", data: { object: sessionObject() } });
  assert.equal((await post(good.raw, good.header.replace(/v1=./, "v1=0"))).status, 400);
  const unpaid = await signedWebhook({ type: "checkout.session.completed", data: { object: sessionObject({ payment_status: "unpaid" }) } });
  assert.equal((await post(unpaid.raw, unpaid.header)).status, 200);
  const other = await signedWebhook({ type: "charge.refunded", data: { object: {} } });
  assert.equal((await post(other.raw, other.header)).status, 200);
});

test("if the email fails the webhook says so, so stripe tries again", async () => {
  const handle = makeHandler({ now: () => 1792000100, fetch: async () => new Response("{}", { status: 500 }) });
  const { raw, header } = await signedWebhook({ type: "checkout.session.completed", data: { object: sessionObject() } });
  const res = await handle(new Request("https://api.test/api/webhook", { method: "POST", body: raw, headers: { "stripe-signature": header } }), env);
  assert.equal(res.status, 500);
});

test("the thank-you page can fetch the licence for a paid session only", async () => {
  let paid = true;
  const handle = makeHandler({ fetch: async () => new Response(JSON.stringify(sessionObject({ payment_status: paid ? "paid" : "unpaid" })), { status: 200 }) });
  const ask = (id) => handle(new Request(`https://api.test/api/licence?session_id=${id}`), env);
  const ok = await ask("cs_test_abc1234567890");
  assert.equal(ok.status, 200);
  const data = await ok.json();
  assert.ok(data.licence.startsWith("COL1.")); assert.equal(data.term, "1 year"); assert.equal(data.org, "Carlton Netball Club");
  assert.equal((await ask("../../etc")).status, 400);
  paid = false;
  assert.equal((await ask("cs_test_abc1234567890")).status, 402);
});

test("a licence the server signs would be refused if its details were out of range", async () => {
  const handle = makeHandler({ fetch: async () => new Response(JSON.stringify(sessionObject({ metadata: { org: "X", voters: "9", term: "1" } })), { status: 200 }) });
  const res = await handle(new Request("https://api.test/api/licence?session_id=cs_test_abc1234567890"), env);
  assert.equal(res.status, 500);
});
