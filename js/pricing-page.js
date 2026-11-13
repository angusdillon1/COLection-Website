/* The pricing calculator. The price comes from js/pricing.js, the same file the server uses to decide what to charge. */
(function () {
  var P = window.ColPricing, cfg = window.COL_SITE || {};
  var form = document.getElementById("buy");
  if (!form || !P) return;

  var $ = function (id) { return document.getElementById(id); };
  var slider = $("voters"), box = $("voters-number"), shown = $("voters-shown"), org = $("org"), email = $("email");
  var priceEl = $("price"), detail = $("price-detail"), note = $("price-note"), buy = $("buy-button"), msg = $("buy-message");
  var terms = [].slice.call(form.querySelectorAll('input[name="term"]'));
  var plans = [].slice.call(form.querySelectorAll('input[name="plan"]'));
  var MAX = P.CONFIG.max_online_voters, FREE = P.CONFIG.free_voters;
  var SIZES = [FREE].concat(P.sizes());                       /* the slider's stops: free first, then every size sold */
  var online = !!cfg.API_BASE;

  function picked(list, fallback) { var t = list.filter(function (r) { return r.checked; })[0]; return t ? t.value : fallback; }
  function term() { return picked(terms, "1"); }
  function plan() { return picked(plans, P.CONFIG.default_plan); }
  function money(n) { return "A$" + n.toLocaleString("en-AU"); }
  function people(n) { return n.toLocaleString("en-AU"); }

  /* the number of voters: the slider's stop, or whatever was typed in the box (which may be more than the slider goes to) */
  var typed = null;
  function readVoters() { return typed !== null ? typed : SIZES[Number(slider.value)]; }
  function stopFor(n) { for (var i = 0; i < SIZES.length; i++) if (SIZES[i] >= n) return i; return SIZES.length - 1; }

  function update() {
    var n = readVoters(), t = term(), pl = plan();
    var size = n <= FREE ? FREE : n > MAX ? n : P.tier(n);
    shown.textContent = n <= FREE ? "Up to " + FREE + " voters" : n > MAX ? "More than " + people(MAX) + " voters" : "Up to " + people(size) + " voters";
    slider.setAttribute("aria-valuetext", shown.textContent);
    if (document.activeElement !== box) box.value = n > MAX ? n : size;
    plans.forEach(function (r) {                               /* each plan card shows its own price for this size and length */
      var out = r.parentNode.querySelector("[data-plan-price]");
      if (out) out.textContent = n <= FREE ? "Free" : n > MAX ? "Quote" : money(P.price(n, t, r.value));
    });
    if (n <= FREE) {
      priceEl.textContent = "Free";
      detail.textContent = "Every feature, no time limit";
      note.textContent = "Up to " + FREE + " voters, COLection is free: no licence needed. Just download it.";
      buy.disabled = true; buy.textContent = "No licence needed"; buy.dataset.mode = "free";
      return;
    }
    if (n > MAX) {
      priceEl.textContent = "Ask us";
      detail.textContent = "More than " + people(MAX) + " voters";
      note.textContent = "For a group this size we work out a price with you.";
      buy.disabled = false; buy.textContent = "Ask for a quote"; buy.dataset.mode = "quote";
      return;
    }
    buy.dataset.mode = "buy";
    buy.disabled = false;
    var cost = P.price(n, t, pl);
    priceEl.textContent = money(cost);
    var years = t === "pass" ? null : Number(t);
    detail.textContent = P.planName(pl) + " plan, " +
      (t === "pass" ? P.CONFIG.pass.days + " days (one election)" : years + (years === 1 ? " year" : " years")) +
      ", up to " + people(size) + " voters" + (years > 1 ? " (" + money(Math.round(cost / years)) + " a year)" : "");
    note.textContent = "One payment, no subscription: it simply ends, and the program keeps working in free mode.";
    buy.textContent = online ? "Pay " + money(cost) + " and get my licence" : "Request an invoice for " + money(cost);
  }

  function show(text, bad) { msg.textContent = text; msg.className = "buy-message" + (bad ? " bad" : ""); }

  function mailto(subject, body) {
    return "mailto:" + encodeURIComponent(cfg.CONTACT_EMAIL || "") + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var n = readVoters(), t = term(), pl = plan();
    if (buy.dataset.mode === "quote") {
      window.location.href = mailto("COLection quote", "Organisation: " + org.value + "\nVoters: " + n + "\nPlan: " + P.planName(pl) + "\n");
      return;
    }
    if (buy.dataset.mode !== "buy" || P.check(n, t, pl)) return update();
    if (!org.value.trim()) { show("Please enter the name of your organisation: it is written on the licence.", true); org.focus(); return; }
    if (!email.checkValidity() || !email.value.trim()) { show("Please enter an email address to send the licence to.", true); email.focus(); return; }
    if (!$("agree").checked) { show("Please tick the box to say you have read the terms.", true); $("agree").focus(); return; }
    if (!online) {
      window.location.href = mailto("COLection licence: " + org.value.trim(),
        "Please send me an invoice.\n\nOrganisation: " + org.value.trim() + "\nPlan: " + P.planName(pl) + "\nVoters: up to " + P.tier(n) +
        "\nTerm: " + P.termName(t) + "\nPrice: " + money(P.price(n, t, pl)) + "\nSend the licence to: " + email.value.trim() + "\n");
      show("Your email program should have opened with the details filled in. Send it and I'll reply with an invoice.", false);
      return;
    }
    buy.disabled = true;
    show("Taking you to the secure payment page...", false);
    fetch(cfg.API_BASE.replace(/\/$/, "") + "/api/checkout", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ org: org.value, email: email.value, voters: P.tier(n), term: t, plan: pl })
    }).then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (r) {
        if (r.ok && r.data.url) { window.location.href = r.data.url; return; }
        throw new Error(r.data.error || "Something went wrong.");
      })
      .catch(function (err) {
        buy.disabled = false;
        show((err && err.message ? err.message : "Something went wrong.") + " Nothing was charged. You can try again or email " + (cfg.CONTACT_EMAIL || "us") + ".", true);
      });
  });

  slider.min = 0; slider.max = SIZES.length - 1; slider.step = 1;
  slider.addEventListener("input", function () { typed = null; update(); });
  box.addEventListener("input", function () {
    var raw = String(box.value).trim();
    if (!/^\d+$/.test(raw)) return;
    typed = Number(raw);
    slider.value = stopFor(Math.min(typed, MAX));
    update();
  });
  box.addEventListener("blur", function () { if (typed !== null && typed <= MAX) { typed = null; } update(); });
  terms.concat(plans).forEach(function (r) { r.addEventListener("change", function () { update(); }); });
  [org, email].forEach(function (el) { el.addEventListener("input", function () { show("", false); }); });

  var params = new URLSearchParams(window.location.search);
  if (params.get("cancelled")) show("The payment was cancelled and nothing was charged. You can pick up where you left off.", false);
  var asked = /^\d+$/.test(params.get("voters") || "") ? Number(params.get("voters")) : 250;      /* (a link can carry a size) */
  if (asked > MAX) typed = asked;
  slider.value = stopFor(Math.min(asked, MAX));
  if (["1", "2", "3", "pass"].indexOf(params.get("term")) >= 0) terms.forEach(function (r) { r.checked = r.value === params.get("term"); });
  if (Object.prototype.hasOwnProperty.call(P.CONFIG.plans, params.get("plan") || "")) plans.forEach(function (r) { r.checked = r.value === params.get("plan"); });
  update();

  /* the table of examples: one row for each common size, one column for each plan, at the length chosen in the table's own picker */
  var table = document.getElementById("examples"), tableTerm = document.getElementById("examples-term");
  function fillTable() {
    if (!table) return;
    var t = tableTerm ? tableTerm.value : "1";
    table.textContent = "";
    [100, 250, 500, 1000, 2500, 5000].forEach(function (v) {
      var row = document.createElement("tr"), th = document.createElement("th");
      th.scope = "row"; th.textContent = "Up to " + people(v);
      row.appendChild(th);
      Object.keys(P.CONFIG.plans).forEach(function (pl) {
        var td = document.createElement("td"); td.textContent = money(P.price(v, t, pl)); row.appendChild(td);
      });
      table.appendChild(row);
    });
  }
  if (tableTerm) tableTerm.addEventListener("change", fillTable);
  fillTable();
})();
