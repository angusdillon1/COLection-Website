/* Small things every page shares: the header's line once you scroll, the recordings on the home page (they play only while on
   screen, and not at all for people who ask for less motion), the line through the four steps, the quick price, the download
   links and the contact address (both from js/site-config.js). */
(function () {
  "use strict";
  var cfg = window.COL_SITE || {};
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };
  function clamp(x) { return Math.max(0, Math.min(1, x)); }

  /* the header gets a line under it once the page has moved */
  var top = document.getElementById("top");
  function onScroll() { if (top) top.classList.toggle("scrolled", window.scrollY > 8); }

  /* the recordings: the laptop and the phone start together (they are the same length) and pause when off screen */
  var videos = $$("video[data-auto]");
  if (videos.length && !still && "IntersectionObserver" in window) {
    var showing = false;
    var io = new IntersectionObserver(function (entries) {
      var any = entries.some(function (e) { return e.isIntersecting; });
      if (any && !showing) {
        showing = true;
        videos.forEach(function (v) { try { v.currentTime = 0; } catch (e) { /* not loaded yet */ } var p = v.play(); if (p && p.catch) p.catch(function () {}); });
      } else if (!any && showing) {
        showing = false;
        videos.forEach(function (v) { v.pause(); });
      }
    }, { threshold: 0.25 });
    io.observe(videos[0].closest("figure") || videos[0]);
  }

  /* the four steps: the line between the numbers fills as you scroll past them */
  var steps = $("[data-steps]");
  var marks = steps ? $$("li", steps) : [];
  function fillSteps() {
    if (!steps) return;
    var r = steps.getBoundingClientRect(), vh = window.innerHeight;
    var p = still ? 1 : clamp((vh * 0.75 - r.top) / (r.height * 0.6 + vh * 0.25));
    steps.style.setProperty("--fill", p.toFixed(3));
    marks.forEach(function (li, i) { li.classList.toggle("on", p >= i / Math.max(1, marks.length - 1) - 0.02); });
  }

  /* the laptop's screen tips up to face you as you scroll down to it */
  var devices = $("[data-devices]"), screen = devices ? $(".screen", devices) : null;
  function tilt() {
    if (!screen || still) return;
    var r = devices.getBoundingClientRect(), vh = window.innerHeight;
    var p = clamp((vh * 0.85 - r.top) / (vh * 0.6));
    screen.style.setProperty("--tilt", (14 * (1 - p)).toFixed(2));
  }

  /* sliders show how far along they are (WebKit has no "filled" part of its own) */
  function paintRanges() {
    $$('input[type="range"]').forEach(function (s) {
      var min = Number(s.min) || 0, max = Number(s.max) || 100, v = Number(s.value);
      s.style.setProperty("--pct", (max > min ? (v - min) / (max - min) * 100 : 0) + "%");
    });
  }
  document.addEventListener("input", function () { requestAnimationFrame(paintRanges); });

  /* the quick price on the home page: a 30-day pass with everything, for the size on the slider */
  var quick = $("[data-quick]");
  if (quick && window.ColPricing) {
    var P = window.ColPricing, SIZES = [50, 100, 150, 250, 350, 500, 750, 1000, 1500, 2500, 5000];
    var slider = $("input", quick), out = $("[data-quick-price]", quick), what = $("[data-quick-what]", quick), link = $("[data-quick-link]", quick);
    slider.max = SIZES.length - 1;
    var showQuick = function () {
      var n = SIZES[Number(slider.value)];
      if (n <= P.CONFIG.free_voters) {
        out.textContent = "Free";
        what.textContent = "Up to " + n + " voters, every feature, no time limit.";
        link.href = "download.html";
        link.textContent = "Download it";
      } else {
        out.textContent = "A$" + P.price(n, "pass", "complete").toLocaleString("en-AU");
        what.textContent = "Up to " + n.toLocaleString("en-AU") + " voters, one election (30 days), everything included.";
        link.href = "pricing.html?voters=" + n + "&term=pass&plan=complete";
        link.textContent = "See every option";
      }
      slider.setAttribute("aria-valuetext", n <= 50 ? "Up to 50 voters, free" : "Up to " + n + " voters");
    };
    slider.addEventListener("input", showQuick);
    showQuick();
  }

  /* downloads: every link is made from the version in site-config.js */
  if (cfg.VERSION && cfg.RELEASES) {
    var base = cfg.RELEASES.replace(/\/$/, "") + "/v" + cfg.VERSION + "/";
    var exe = document.getElementById("dl-installer"), zip = document.getElementById("dl-zip");
    if (exe) exe.href = base + "COLection-Setup-" + cfg.VERSION + ".exe";
    if (zip) zip.href = base + "COLection-" + cfg.VERSION + ".zip";
    $$("[data-version]").forEach(function (el) { el.textContent = cfg.VERSION; });
  }
  if (cfg.REFUND_DAYS) $$("[data-refund-days]").forEach(function (el) { el.textContent = cfg.REFUND_DAYS; });

  /* the contact page: the address, a copy button, and emails that start with the right subject */
  var email = cfg.CONTACT_EMAIL || "";
  $$("[data-email]").forEach(function (el) { if (email) el.textContent = email; });
  $$("[data-mail]").forEach(function (a) { a.href = "mailto:" + email + "?subject=" + encodeURIComponent(a.getAttribute("data-mail")); });
  var copyBtn = $("[data-copy-email]"), copied = $("[data-copied]");
  if (copyBtn) copyBtn.addEventListener("click", function () {
    function say(ok) {
      if (copied) copied.textContent = ok ? "Copied." : "Select the address and copy it.";
      copyBtn.textContent = ok ? "Copied" : "Copy";
      setTimeout(function () { copyBtn.textContent = "Copy"; }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(email).then(function () { say(true); }, function () { say(false); });
    else say(false);
  });

  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; onScroll(); fillSteps(); tilt(); });
  }, { passive: true });
  window.addEventListener("resize", function () { fillSteps(); tilt(); });
  onScroll(); fillSteps(); tilt(); paintRanges();
})();
