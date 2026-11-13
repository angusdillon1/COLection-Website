// Run with:  node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pricing = require("../js/pricing.js");
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "price_vectors.json"), "utf8"));

test("the website's prices equal the program's price tool, for every shared example", () => {
  for (const v of data.vectors) assert.equal(pricing.price(v.voters, v.term, v.plan), v.price, JSON.stringify(v));
});
test("the website's settings equal tools/pricing.json", () => {
  assert.deepEqual(pricing.CONFIG, data.config);
});
test("limits are explained in plain words", () => {
  assert.throws(() => pricing.price(50, "1"), /free version/);
  assert.equal(pricing.tier(51), 60); assert.equal(pricing.tier(251), 260); assert.equal(pricing.tier(301), 350);
  assert.equal(pricing.tier(1001), 1250); assert.equal(pricing.tier(5000), 5000); assert.equal(pricing.tier(6000), 6000);
  assert.throws(() => pricing.price(100, "1", "gold"), /plan/);
  assert.throws(() => pricing.price(5001, "1"), /quote/);
  assert.throws(() => pricing.price(100, "9"), /Choose/);
  assert.throws(() => pricing.price(100.5, "1"), /free version|more than/);
});
test("expiry dates", () => {
  assert.equal(pricing.expiry("2026-10-15", "1"), "2027-10-15");
  assert.equal(pricing.expiry("2026-10-15", "3"), "2029-10-15");
  assert.equal(pricing.expiry("2028-02-29", "1"), "2029-02-28");
  assert.equal(pricing.expiry("2026-10-15", "pass"), "2026-11-14");
});

test("the plans: Complete costs the most, Count the least, and the target price holds", () => {
  for (const v of [60, 250, 1000, 5000]) for (const t of ["pass", "1", "2", "3"]) {
    const [c, vo, co] = ["count", "vote", "complete"].map((p) => pricing.price(v, t, p));
    assert.ok(c <= vo && vo <= co, `${v} ${t}`);
  }
  assert.equal(pricing.price(250, "pass", "complete"), 100);
  assert.equal(pricing.price(250, "pass"), 100);                       // (no plan given: Complete)
  assert.equal(pricing.planName("vote"), "Vote");
});
test("the slider's stops run from just above the free size to the most the site sells", () => {
  const sizes = pricing.sizes();
  assert.equal(sizes[0], 60); assert.equal(sizes[sizes.length - 1], 5000);
  assert.ok(sizes.includes(250) && sizes.includes(300) && sizes.includes(350) && sizes.includes(1250));
  for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] > sizes[i - 1]);
  for (const v of sizes) assert.equal(pricing.tier(v), v);
});
