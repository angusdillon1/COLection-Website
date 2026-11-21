/* Draws the video guides on the Help page from window.COL_TUTORIALS (js/tutorials-data.js). Nothing is loaded from YouTube or Vimeo
   until someone presses play, so the page stays fast and makes no outside requests on its own. */
(function () {
  var box = document.getElementById("tutorials");
  var list = window.COL_TUTORIALS;
  if (!box || !Array.isArray(list) || !list.length) return;

  var SAFE_ID = /^[A-Za-z0-9_-]{5,24}$/;
  var SAFE_NUM = /^[0-9]{4,14}$/;
  var SAFE_FILE = /^(?!.*\.\.)(?!\/)(?![a-z]+:)[A-Za-z0-9 _\-\/.()]+$/i;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function playIcon() {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    var p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M8 5.5v13l11-6.5z");
    s.appendChild(p);
    return s;
  }

  function embed(t) {
    if (typeof t.youtube === "string" && SAFE_ID.test(t.youtube)) {
      return "https://www.youtube-nocookie.com/embed/" + t.youtube + "?autoplay=1&rel=0";
    }
    if (typeof t.vimeo === "string" && SAFE_NUM.test(t.vimeo)) {
      return "https://player.vimeo.com/video/" + t.vimeo + "?autoplay=1&dnt=1";
    }
    return "";
  }

  function hasFile(t) { return typeof t.file === "string" && SAFE_FILE.test(t.file); }

  function media(t) {
    var wrap = el("div", "tut-media");
    var url = embed(t);
    if (url) {                                              // a click-to-play button; the player is only loaded when pressed
      var b = el("button", "tut-play");
      b.type = "button";
      b.setAttribute("aria-label", "Play the video: " + t.title);
      b.appendChild(playIcon());
      b.appendChild(el("span", "tut-play-label", "Play"));
      b.addEventListener("click", function () {
        var f = document.createElement("iframe");
        f.src = url;
        f.title = t.title;
        f.allow = "autoplay; fullscreen; picture-in-picture";
        f.setAttribute("allowfullscreen", "");
        f.referrerPolicy = "strict-origin-when-cross-origin";
        wrap.replaceChildren(f);
      });
      wrap.appendChild(b);
    } else if (hasFile(t)) {
      var v = document.createElement("video");
      v.controls = true;
      v.preload = "metadata";
      v.setAttribute("playsinline", "");
      if (typeof t.poster === "string" && SAFE_FILE.test(t.poster)) v.poster = t.poster;
      var src = document.createElement("source");
      src.src = t.file;
      v.appendChild(src);
      if (typeof t.captions === "string" && SAFE_FILE.test(t.captions)) {
        var tr = document.createElement("track");
        tr.kind = "captions"; tr.src = t.captions; tr.srclang = "en"; tr.label = "English"; tr.default = true;
        v.appendChild(tr);
      }
      v.setAttribute("aria-label", t.title);
      wrap.appendChild(v);
    } else {                                                // not made yet
      wrap.classList.add("soon");
      wrap.appendChild(playIcon());
      wrap.appendChild(el("span", "tut-badge", "Coming soon"));
    }
    return wrap;
  }

  box.replaceChildren();
  list.forEach(function (t) {
    if (!t || typeof t.title !== "string") return;
    var card = el("article", "tut");
    card.appendChild(media(t));
    var body = el("div", "tut-body");
    body.appendChild(el("h3", "", t.title));
    if (t.about) body.appendChild(el("p", "", String(t.about)));
    var meta = [t.level, t.length].filter(Boolean).join(" · ");
    if (meta) body.appendChild(el("p", "tut-meta", meta));
    card.appendChild(body);
    box.appendChild(card);
  });
})();
