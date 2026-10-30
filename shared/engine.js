/* Shared program engine: the program registry, settings (one declaration per program
   drives the setup screen, the builder and the menu summaries), speech, sounds,
   and the press-and-hold staff button. */
(function () {
  "use strict";

  var ASD = window.ASD = window.ASD || {};

  /* ---------- Categories ---------- */
  ASD.CATEGORIES = {
    math:     { label: "Math",        color: "#2F6FDE", text: "#1F4FA8" },
    literacy: { label: "Literacy",    color: "#E08A2E", text: "#A8560F" },
    life:     { label: "Life Skills", color: "#2E9E44", text: "#1F7A33" }
  };

  /* ---------- Program registry ---------- */
  var programs = {}, order = [];
  ASD.registerProgram = function (p) {
    if (!ASD.CATEGORIES[p.category]) throw new Error(p.id + ": unknown category " + p.category);
    programs[p.id] = p;
    order.push(p.id);
  };
  ASD.program = function (id) { return programs[id] || null; };
  ASD.allPrograms = function () { return order.map(function (id) { return programs[id]; }); };

  /* ---------- Standard settings (shared program conventions) ---------- */
  // Each setting: { key, type: "choice" | "number" | "toggle", label, default, ... }
  //   choice: options [{ v, label, note }]; number: min, max, unit; toggle: hint.
  //   sum: position in the one-line summary (omit to leave it out); sumIf(settings).
  ASD.std = {
    version: function (receptiveNote, expressiveNote) {
      return { key: "version", type: "choice", label: "Version", default: "receptive", sum: 2, options: [
        { v: "receptive", label: "Receptive", note: receptiveNote },
        { v: "expressive", label: "Expressive", note: expressiveNote }
      ] };
    },
    session: function () {
      return { key: "session", type: "choice", label: "Session", default: "teach", sum: 3, options: [
        { v: "teach", label: "Teaching", note: "praise + correction" },
        { v: "baseline", label: "Baseline", note: "no prompts · no reinforcement" }
      ] };
    },
    praise: function () {
      return { key: "praise", type: "choice", label: "Praise", default: "full", sum: 5,
        sumIf: function (s) { return s.session !== "baseline"; },
        options: [
          { v: "full", label: "Computer praises", note: "ding · green · \"Great job!\"" },
          { v: "light", label: "Staff praises", note: "ding + green only" }
        ] };
    },
    trials: function (dflt) {
      return { key: "trials", type: "number", label: "Number of trials", default: dflt || 10, min: 1, max: 30, unit: "trials", sum: 4 };
    },
    voice: function () {
      return { key: "voice", type: "toggle", label: "Read prompts aloud", hint: "Uses the iPad's voice", default: true };
    },
    text: function (hint) {
      return { key: "text", type: "toggle", label: "Show prompt as text", hint: hint, default: true };
    }
  };

  ASD.defaults = function (program) {
    var s = {};
    program.settings.forEach(function (d) { s[d.key] = d.default; });
    return s;
  };
  // Fills in anything missing or no longer valid (e.g. a playlist saved before a setting existed).
  ASD.normalize = function (program, given) {
    var s = ASD.defaults(program);
    given = given || {};
    program.settings.forEach(function (d) {
      var v = given[d.key];
      if (v === undefined) return;
      if (d.type === "choice" && d.options.some(function (o) { return o.v === v; })) s[d.key] = v;
      if (d.type === "number" && typeof v === "number" && isFinite(v)) s[d.key] = Math.min(d.max, Math.max(d.min, Math.round(v)));
      if (d.type === "toggle" && typeof v === "boolean") s[d.key] = v;
    });
    return s;
  };
  ASD.sameSettings = function (a, b) {
    return Object.keys(a).every(function (k) { return a[k] === b[k]; }) && Object.keys(b).every(function (k) { return a[k] === b[k]; });
  };

  function optionOf(d, v) {
    for (var i = 0; i < d.options.length; i++) if (d.options[i].v === v) return d.options[i];
    return null;
  }
  ASD.summary = function (program, s) {
    return program.settings
      .filter(function (d) { return d.sum && (!d.sumIf || d.sumIf(s)); })
      .sort(function (a, b) { return a.sum - b.sum; })
      .map(function (d) {
        if (d.type === "choice") { var o = optionOf(d, s[d.key]); return o ? (o.short || o.label) : ""; }
        if (d.type === "number") return s[d.key] + " " + d.unit;
        return "";
      })
      .filter(Boolean).join(" · ");
  };

  /* ---------- Small DOM helpers ---------- */
  ASD.esc = function (t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  };
  ASD.el = function (html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };

  /* ---------- Settings form (setup screen and builder) ---------- */
  // Renders a program's settings into `box`, editing `s` in place; calls onChange after each edit.
  ASD.renderSettings = function (box, program, s, onChange) {
    box.innerHTML = "";
    var rowsGroup = null;
    program.settings.forEach(function (d) {
      if (d.type === "choice") {
        rowsGroup = null;
        var g = ASD.el('<div class="group"><h2 class="label">' + ASD.esc(d.label) + '</h2><div class="seg"></div><div class="after"></div></div>');
        var seg = g.querySelector(".seg"), after = g.querySelector(".after");
        d.options.forEach(function (o) {
          var b = ASD.el('<button type="button">' + ASD.esc(o.label) + (o.note ? "<small>" + ASD.esc(o.note) + "</small>" : "") + "</button>");
          b.classList.toggle("sel", s[d.key] === o.v);
          b.onclick = function () {
            s[d.key] = o.v;
            seg.querySelectorAll("button").forEach(function (x) { x.classList.remove("sel"); });
            b.classList.add("sel");
            if (d.after) after.innerHTML = d.after(s);
            onChange && onChange();
          };
          seg.appendChild(b);
        });
        if (d.after) after.innerHTML = d.after(s);
        box.appendChild(g);
        return;
      }
      if (!rowsGroup) { rowsGroup = ASD.el('<div class="group" style="padding-top:8px;padding-bottom:8px"></div>'); box.appendChild(rowsGroup); }
      var row;
      if (d.type === "number") {
        row = ASD.el('<div class="row"><div>' + ASD.esc(d.label) + '</div><div class="stepper">' +
          '<button type="button" aria-label="Fewer">−</button><span></span><button type="button" aria-label="More">+</button></div></div>');
        var bs = row.querySelectorAll("button"), out = row.querySelector("span");
        out.textContent = s[d.key];
        bs[0].onclick = function () { s[d.key] = Math.max(d.min, s[d.key] - 1); out.textContent = s[d.key]; onChange && onChange(); };
        bs[1].onclick = function () { s[d.key] = Math.min(d.max, s[d.key] + 1); out.textContent = s[d.key]; onChange && onChange(); };
      } else {
        row = ASD.el('<div class="row"><div>' + ASD.esc(d.label) + (d.hint ? '<span class="hint">' + ASD.esc(d.hint) + "</span>" : "") +
          '</div><button type="button" class="toggle" role="switch"></button></div>');
        var t = row.querySelector(".toggle");
        t.setAttribute("aria-label", d.label);
        var paint = function () { t.classList.toggle("sel", !!s[d.key]); t.setAttribute("aria-checked", s[d.key] ? "true" : "false"); };
        paint();
        t.onclick = function () { s[d.key] = !s[d.key]; paint(); onChange && onChange(); };
      }
      rowsGroup.appendChild(row);
    });
  };

  /* ---------- Speech and sounds ---------- */
  var muted = false;   // staff panel "Sounds" switch, page memory only
  ASD.sounds = {
    get on() { return !muted; },
    set on(v) { muted = !v; }
  };

  ASD.say = function (text) {
    try {
      var s = window.speechSynthesis; if (!s) return;
      s.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 0.85; u.pitch = 1.05; u.lang = "en-US";
      s.speak(u);
    } catch (e) {}
  };
  ASD.hush = function () { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} };

  var actx = null;
  // Call from a tap (Start buttons) so the iPad allows sound later.
  ASD.unlockAudio = function () {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.resume) actx.resume();
      // A silent utterance unlocks speech on iPad Safari.
      if (window.speechSynthesis && !ASD._spoke) { ASD._spoke = true; window.speechSynthesis.speak(new SpeechSynthesisUtterance("")); }
    } catch (e) {}
  };
  // Gentle two-note chime.
  ASD.chime = function () {
    if (muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var now = actx.currentTime;
      [659.25, 880].forEach(function (f, i) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, now + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.25, now + i * 0.12 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.5);
        o.connect(g); g.connect(actx.destination);
        o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.55);
      });
    } catch (e) {}
  };

  /* ---------- Press-and-hold (staff button) ---------- */
  // A quick tap does nothing; holding about 1 second calls onHold.
  ASD.holdButton = function (btn, onHold, ms) {
    var timer = null;
    function start(e) {
      e.preventDefault();
      clear();
      btn.classList.add("holding");
      timer = setTimeout(function () { timer = null; btn.classList.remove("holding"); onHold(); }, ms || 1000);
    }
    function clear() { if (timer) clearTimeout(timer); timer = null; btn.classList.remove("holding"); }
    btn.addEventListener("pointerdown", start);
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { btn.addEventListener(ev, clear); });
    btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    btn.addEventListener("click", function (e) { e.preventDefault(); });
  };

  ASD.shuffle = function (a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  };
  ASD.pick = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  ASD.cap = function (w) { return w.charAt(0).toUpperCase() + w.slice(1); };
})();
