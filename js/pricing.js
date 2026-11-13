/* The price formula. It is the same as tools/price.py in the program's folder (tests on both sides check the same list of prices),
   and it is used twice: by the pricing page to show the price, and by the server to decide what to charge. The server never trusts
   a price sent from the page: it works the price out again from the plan, the number of voters and the term.
   To change a price, change the numbers below AND in tools/pricing.json, then run both test suites. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ColPricing = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var CONFIG = {
    currency: "aud",
    anchor_voters: 250,
    anchor_price: 250,
    exponent: 0.62,
    minimum: 40,
    round_to: 5,
    free_voters: 50,
    max_online_voters: 5000,
    steps: [[300, 10], [1000, 50], [5000, 250]],
    plans: {
      count: { name: "Count", factor: 0.45 },
      vote: { name: "Vote", factor: 0.75 },
      complete: { name: "Complete", factor: 1.0 }
    },
    default_plan: "complete",
    year_factors: { "1": 1.0, "2": 0.9, "3": 0.8 },
    pass: { days: 30, factor: 0.4 }
  };

  function hasPlan(plan) { return Object.prototype.hasOwnProperty.call(CONFIG.plans, plan); }

  function check(voters, term, plan) {
    if (plan !== undefined && plan !== null && !hasPlan(String(plan)))
      return "Choose the Count, Vote or Complete plan.";
    if (typeof voters !== "number" || !Number.isInteger(voters) || voters <= CONFIG.free_voters)
      return "A licence is for more than " + CONFIG.free_voters + " voters (up to that, the free version is enough).";
    if (voters > CONFIG.max_online_voters)
      return "For more than " + CONFIG.max_online_voters + " voters, please ask for a quote.";
    if (term !== "pass" && !Object.prototype.hasOwnProperty.call(CONFIG.year_factors, term))
      return "Choose 1, 2 or 3 years, or a " + CONFIG.pass.days + "-day pass.";
    return "";
  }

  /* The licence size that covers `voters`: rounded up to the slider's step (the number itself above the last step). */
  function tier(voters) {
    for (var i = 0; i < CONFIG.steps.length; i++)
      if (voters <= CONFIG.steps[i][0]) return Math.ceil(voters / CONFIG.steps[i][1]) * CONFIG.steps[i][1];
    return voters;
  }

  /* Every size the slider can stop at, smallest first. */
  function sizes() {
    var out = [], from = CONFIG.free_voters;
    CONFIG.steps.forEach(function (s) {
      for (var v = Math.floor(from / s[1]) * s[1] + s[1]; v <= s[0]; v += s[1]) out.push(v);
      from = s[0];
    });
    return out;
  }

  /* Whole dollars for `voters` voters, a term of "1", "2", "3" (years) or "pass", and a plan ("count", "vote" or "complete";
     left out, the usual one). Throws a plain sentence if not allowed. */
  function price(voters, term, plan) {
    term = String(term);
    plan = plan === undefined || plan === null ? CONFIG.default_plan : String(plan);
    var why = check(voters, term, plan);
    if (why) throw new RangeError(why);
    var base = Math.max(CONFIG.minimum,
      CONFIG.anchor_price * Math.pow(tier(voters) / CONFIG.anchor_voters, CONFIG.exponent) * CONFIG.plans[plan].factor);
    var total = term === "pass" ? base * CONFIG.pass.factor : base * Number(term) * CONFIG.year_factors[term];
    var step = CONFIG.round_to;
    return Math.max(step, Math.floor(total / step + 0.5) * step);
  }

  /* The licence's last day, as YYYY-MM-DD, for a licence issued on `issued` (a YYYY-MM-DD string). */
  function expiry(issued, term) {
    var p = issued.split("-").map(Number), d;
    if (String(term) === "pass") {
      d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + CONFIG.pass.days));
    } else {
      d = new Date(Date.UTC(p[0] + Number(term), p[1] - 1, p[2]));
      if (d.getUTCMonth() !== p[1] - 1) d = new Date(Date.UTC(p[0] + Number(term), p[1] - 1, 28));      // (29 February)
    }
    return d.toISOString().slice(0, 10);
  }

  function termName(term) {
    return String(term) === "pass" ? CONFIG.pass.days + "-day pass" : term + " year" + (String(term) === "1" ? "" : "s");
  }

  function planName(plan) { return hasPlan(plan) ? CONFIG.plans[plan].name : ""; }

  return { CONFIG: CONFIG, check: check, tier: tier, sizes: sizes, price: price, expiry: expiry, termName: termName, planName: planName };
});
