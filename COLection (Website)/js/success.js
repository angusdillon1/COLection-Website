/* The thank-you page: asks the licence server for the licence that belongs to this payment and shows it. */
(function () {
  var cfg = window.COL_SITE || {}, $ = function (id) { return document.getElementById(id); };
  var status = $("status"), card = $("licence-card"), text = $("l-text");
  var help = $("help-mail");
  if (help) help.href = "mailto:" + (cfg.CONTACT_EMAIL || "");
  var id = new URLSearchParams(window.location.search).get("session_id");

  function fail(message) { status.textContent = message; }
  if (!id || !cfg.API_BASE) { fail("Your licence has been emailed to you. If it hasn't arrived in a few minutes, check your spam folder or contact us."); return; }

  function nice(iso) {
    var p = iso.split("-").map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2])).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  }
  var tries = 0;
  function fetchLicence() {
    tries++;
    fetch(cfg.API_BASE.replace(/\/$/, "") + "/api/licence?session_id=" + encodeURIComponent(id))
      .then(function (res) { return res.json().then(function (d) { return { status: res.status, data: d }; }); })
      .then(function (r) {
        if (r.status === 402 && tries < 6) { status.textContent = "Waiting for the payment to be confirmed..."; setTimeout(fetchLicence, 3000); return; }
        if (r.status !== 200) throw new Error(r.data.error || "");
        var d = r.data;
        $("l-org").textContent = d.org;
        $("l-term").textContent = d.term;
        $("l-voters").textContent = "Up to " + d.voters.toLocaleString("en-AU") + " voters";
        $("l-expires").textContent = nice(d.expires);
        $("l-id").textContent = d.id;
        text.value = d.licence;
        $("save").href = "data:text/plain;charset=utf-8," + encodeURIComponent(d.licence + "\n");
        card.hidden = false;
        status.textContent = "Payment received. Here is your licence for " + d.org + ".";
      })
      .catch(function () { fail("Your payment went through, and your licence is on its way by email. If it doesn't arrive in a few minutes, contact us."); });
  }
  fetchLicence();

  $("copy").addEventListener("click", function () {
    var msg = $("copy-message");
    function done(ok) { msg.textContent = ok ? "Copied. Now paste it into COLection." : "Couldn't copy automatically: select the text and copy it."; }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text.value).then(function () { done(true); }, function () { text.select(); done(false); });
    else { text.select(); done(false); }
  });
})();
