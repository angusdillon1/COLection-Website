/* "See how it was won" on the home page: a small preferential count, one round at a time.
   It counts the made-up ballots below the way COLection counts one seat: each ballot counts for its highest choice still in the
   count; if nobody has more than half of the votes still counting, the candidate with the fewest is out and their ballots move
   to each voter's next choice. Scrolling moves the count on (the section stays in place while you do); the arrow buttons do too.
   For people who ask for less motion it is an ordinary section, moved on with the buttons.

   To change the example, edit CANDIDATES and BALLOTS. Each BALLOTS line is [how many ballots, [choices, best first]]. */
(function () {
  "use strict";
  var box = document.querySelector("[data-count]");
  if (!box) return;

  var CANDIDATES = { M: "Maya Chen", T: "Tom Okafor", P: "Priya Nair", J: "Jack Dunne", S: "Sofia Reyes" };
  var BALLOTS = [
    [30, ["M", "P", "T"]], [12, ["M", "T"]], [20, ["M"]],
    [25, ["T", "P"]], [15, ["T", "M"]], [15, ["T"]],
    [24, ["P", "T"]], [14, ["P", "M"]], [8, ["P"]],
    [12, ["J", "T"]], [9, ["J", "P"]], [3, ["J", "M"]],
    [8, ["S", "P", "T"]], [3, ["S", "J", "M"]], [2, ["S", "M"]]
  ];
  var ids = Object.keys(CANDIDATES);
  var TOTAL = BALLOTS.reduce(function (n, b) { return n + b[0]; }, 0);

  /* ---------- the count ---------- */
  function top(choices, live) { for (var i = 0; i < choices.length; i++) if (live[choices[i]]) return choices[i]; return null; }
  var rounds = [], live = {};
  ids.forEach(function (c) { live[c] = true; });
  for (var guard = 0; guard < ids.length; guard++) {
    var tally = {}, counting = 0;
    ids.forEach(function (c) { tally[c] = 0; });
    BALLOTS.forEach(function (b) { var c = top(b[1], live); if (c) { tally[c] += b[0]; counting += b[0]; } });
    var order = ids.filter(function (c) { return live[c]; }).sort(function (a, b) { return tally[b] - tally[a]; });
    var need = Math.floor(counting / 2) + 1;
    var round = { tally: tally, live: Object.assign({}, live), counting: counting, need: need, lead: order[0], winner: null, out: null };
    rounds.push(round);
    if (tally[order[0]] >= need || order.length === 1) { round.winner = order[0]; break; }
    round.out = order[order.length - 1];
    live[round.out] = false;
  }

  function first(name) { return CANDIDATES[name]; }
  function words(k) {
    var r = rounds[k], prev = rounds[k - 1];
    var s = "";
    if (k === 0) s = TOTAL + " ballots, so " + r.need + " votes are needed to win. ";
    else {
      var moved = prev.tally[prev.out], gone = prev.counting - r.counting;
      s = first(prev.out) + "'s " + moved + " votes move to each voter's next choice" + (gone ? ", and " + gone + " ballots have no choices left. " : ". ");
    }
    if (r.winner) {
      s += first(r.winner) + " wins with " + r.tally[r.winner] + " of the " + r.counting + " votes still in the count.";
      if (rounds[0].lead !== r.winner) s += " " + first(rounds[0].lead) + " led until the last round.";
    } else {
      s += (k === 0 ? first(r.lead) + " leads, but nobody has enough. " : "Still nobody has " + r.need + ". ") + first(r.out) + " has the fewest, so is out.";
    }
    return s;
  }

  /* ---------- drawing ---------- */
  var list = box.querySelector("[data-rows]"), say = box.querySelector("[data-round-say]"), no = box.querySelector("[data-round-no]");
  var stillEl = box.querySelector("[data-still]"), dots = box.querySelector("[data-dots]");
  var prevBtn = box.querySelector("[data-prev]"), nextBtn = box.querySelector("[data-next]");
  var SCALE = Math.max.apply(null, rounds.map(function (r) { return Math.max(r.need, Math.max.apply(null, ids.map(function (c) { return r.tally[c]; }))); })) * 1.12;
  var rows = {};
  ids.slice().sort(function (a, b) { return rounds[0].tally[b] - rounds[0].tally[a]; }).forEach(function (c) {
    var li = document.createElement("li");
    li.innerHTML = '<span class="who"></span><span class="track"><span class="fill"></span><span class="gain"></span></span><span class="votes num"></span>';
    li.querySelector(".who").textContent = CANDIDATES[c];
    list.appendChild(li);
    rows[c] = li;
  });
  var line = document.createElement("div");
  line.className = "need";
  line.setAttribute("aria-hidden", "true");
  line.innerHTML = "<span></span>";
  list.appendChild(line);
  rounds.forEach(function () { dots.appendChild(document.createElement("i")); });

  var shown = -1;
  function show(k) {
    k = Math.max(0, Math.min(rounds.length - 1, k));
    if (k === shown) return;
    shown = k;
    var r = rounds[k], prev = rounds[k - 1];
    ids.forEach(function (c) {
      var li = rows[c], v = r.tally[c], isLive = r.live[c];
      li.querySelector(".fill").style.width = (isLive ? v / SCALE * 100 : 0) + "%";
      li.querySelector(".votes").textContent = isLive ? v : "";
      var gain = li.querySelector(".gain"), up = prev && isLive ? v - prev.tally[c] : 0;
      gain.textContent = up > 0 ? "+" + up : "";
      gain.style.left = (v / SCALE * 100) + "%";
      gain.classList.toggle("show", up > 0);
      li.classList.toggle("out", !isLive);
      li.classList.toggle("ahead", isLive && c === r.lead && !r.winner);
      li.classList.toggle("won", c === r.winner);
    });
    placeLine();
    no.textContent = "Round " + (k + 1) + " of " + rounds.length;
    say.textContent = words(k);
    stillEl.textContent = r.counting + " votes still in the count";
    [].forEach.call(dots.children, function (d, i) { d.classList.toggle("on", i === k); });
    prevBtn.disabled = k === 0;
    nextBtn.disabled = k === rounds.length - 1;
  }
  function placeLine() {
    var track = list.querySelector(".track");
    if (!track || shown < 0) return;
    var r = rounds[shown];
    var left = track.offsetLeft + track.offsetWidth * (r.need / SCALE);
    line.style.left = left + "px";
    line.firstChild.textContent = r.need + " to win";
  }

  /* ---------- moving it on: by scrolling, or with the buttons ---------- */
  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var track = box.querySelector(".count-track");
  var driven = !still;
  if (driven) box.classList.add("driven");
  function fromScroll() {
    if (!driven) return;
    var r = track.getBoundingClientRect(), room = r.height - window.innerHeight;
    if (room <= 0) return;
    var p = Math.max(0, Math.min(0.9999, -r.top / room));
    show(Math.floor(p * rounds.length));
  }
  function go(k) {
    k = Math.max(0, Math.min(rounds.length - 1, k));
    if (!driven) return show(k);
    var r = track.getBoundingClientRect(), room = r.height - window.innerHeight;
    window.scrollTo({ top: window.scrollY + r.top + room * (k + 0.5) / rounds.length, behavior: "smooth" });
  }
  prevBtn.addEventListener("click", function () { go(shown - 1); });
  nextBtn.addEventListener("click", function () { go(shown + 1); });
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; fromScroll(); });
  }, { passive: true });
  window.addEventListener("resize", function () { placeLine(); fromScroll(); });
  show(0);
  fromScroll();
})();
