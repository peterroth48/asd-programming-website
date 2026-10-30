/* Color ID (Literacy). Receptive: "Point to ___" with 3 choices. Expressive: "What color
   is this?" and staff tap ✓ / ✗. Only the first response per trial is scored. */
(function () {
  "use strict";

  var COLORS = {
    red:    "#E53935",
    blue:   "#1E63D6",
    green:  "#2E9E44",
    yellow: "#FFD600",
    purple: "#7B3FB5",
    orange: "#FB8C00",
    black:  "#151515",
    brown:  "#7B4A2A",
    pink:   "#F48FB1"
  };
  var STEPS = {
    "1":   ["red", "blue", "green", "yellow"],
    "2":   ["purple", "orange", "black", "brown", "pink"],
    "all": ["red", "blue", "green", "yellow", "purple", "orange", "black", "brown", "pink"]
  };
  var MAX_CORRECTIONS = 3;     // "Repeat until 1x independent (max 3x)"
  var RECEPTIVE_CHOICES = 3;   // "Show three colors"
  var PRAISE = ["Great job!", "You got it!", "Nice work!", "Awesome!", "That's right!"];

  var CSS =
    ".cid-prompt { font-size: clamp(30px, 5vw, 52px); font-weight: 700; text-align: center; margin: 0 20px 5vh; min-height: 1.3em; display: flex; align-items: center; gap: 16px; }" +
    ".cid-speak { width: 60px; height: 60px; border-radius: 50%; border: 2px solid #DDD8CE; background: #fff; display: inline-flex; align-items: center; justify-content: center; flex: none; padding: 0; }" +
    ".cid-speak svg { width: 30px; height: 30px; }" +
    ".cid-choices { display: flex; gap: clamp(16px, 4vw, 48px); justify-content: center; align-items: center; flex-wrap: wrap; padding: 0 16px; }" +
    ".cid-swatch { width: clamp(150px, 24vw, 250px); height: clamp(150px, 24vw, 250px); border-radius: 28px; border: 4px solid rgba(0,0,0,.12); box-shadow: 0 6px 18px rgba(0,0,0,.10); padding: 0; }" +
    ".cid-swatch.big { width: min(40vw, 42vh); height: min(40vw, 42vh); border-radius: 36px; }" +
    ".cid-swatch.dim { opacity: .18; }" +
    ".cid-swatch.hilite { box-shadow: 0 0 0 8px #fff, 0 0 0 14px #22262B; }" +
    ".cid-swatch.right { box-shadow: 0 0 0 8px #fff, 0 0 0 14px #2E9E44; }" +
    ".cid-model { font-size: clamp(30px, 5vw, 48px); font-weight: 800; margin-top: 3vh; min-height: 1.3em; text-align: center; }" +
    ".cid-burst { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: clamp(36px, 6vw, 60px); font-weight: 800; color: #2E9E44; background: #fff; padding: 18px 34px; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,.15); display: flex; align-items: center; gap: 14px; white-space: nowrap; z-index: 4; }" +
    ".cid-burst svg { width: 54px; height: 54px; }" +
    ".cid-scorebar { position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: center; gap: 16px; padding: 16px; background: rgba(246,244,239,.95); border-top: 1px solid #DDD8CE; z-index: 3; }" +
    ".cid-scorebar .lbl { align-self: center; color: #5F656C; font-size: 14px; margin-right: 6px; }" +
    ".cid-scorebar button { min-width: 170px; padding: 16px 20px; border-radius: 14px; border: none; font-size: 19px; font-weight: 700; color: #fff; }";

  var SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="#22262B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="#2E9E44" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function chips(s) {
    return '<div class="chips">' + STEPS[s.step].map(function (c) {
      return '<span class="chip"><i style="background:' + COLORS[c] + '"></i>' + ASD.cap(c) + "</span>";
    }).join("") + "</div>";
  }

  // Spread targets evenly across the step's colors, then shuffle; avoid the same color twice in a row.
  function buildTargets(s) {
    var set = STEPS[s.step], out = [];
    while (out.length < s.trials) out = out.concat(ASD.shuffle(set));
    out = out.slice(0, s.trials);
    for (var i = 1; i < out.length; i++) {
      if (out[i] === out[i - 1]) {
        for (var j = i + 1; j < out.length; j++) {
          if (out[j] !== out[i - 1] && (j + 1 >= out.length || out[j + 1] !== out[i])) { var t = out[i]; out[i] = out[j]; out[j] = t; break; }
        }
      }
    }
    return out;
  }

  function run(ctx) {
    var s = ctx.settings;
    var root = ctx.stage;
    root.innerHTML =
      "<style>" + CSS + "</style>" +
      '<div class="cid-prompt"><span class="cid-text"></span><button type="button" class="cid-speak" aria-label="Say it again">' + SPEAKER + "</button></div>" +
      '<div class="cid-choices"></div>' +
      '<div class="cid-model"></div>';
    var $ = function (sel) { return root.querySelector(sel); };
    var scorebar = null;
    if (s.version === "expressive") {
      scorebar = ASD.el('<div class="cid-scorebar"><span class="lbl">Staff:</span>' +
        '<button type="button" style="background:#2E9E44">✓ Correct</button>' +
        '<button type="button" style="background:#C9541A">✗ Incorrect / no response</button></div>');
      var bs = scorebar.querySelectorAll("button");
      bs[0].onclick = function () { if (!st.locked) respond(true); };
      bs[1].onclick = function () { if (!st.locked) respond(false); };
      root.appendChild(scorebar);
      root.style.paddingBottom = "110px";   // room for the staff scoring bar
    }

    var st = { targets: buildTargets(s), i: 0, corrections: 0, phase: "first", locked: false };

    function promptFor(target) { return s.version === "receptive" ? "Point to " + target + "." : "What color is this?"; }
    $(".cid-speak").onclick = function () { ctx.say(promptFor(st.targets[st.i])); };
    $(".cid-speak").style.display = s.voice ? "" : "none";

    function presentTrial() {
      var target = st.targets[st.i];
      st.locked = false;
      ctx.progress(st.i, st.targets.length);
      $(".cid-model").textContent = "";
      $(".cid-text").textContent = s.text ? promptFor(target) : "";

      var box = $(".cid-choices"); box.innerHTML = "";
      if (s.version === "receptive") {
        var others = ASD.shuffle(STEPS[s.step].filter(function (c) { return c !== target; })).slice(0, RECEPTIVE_CHOICES - 1);
        ASD.shuffle(others.concat([target])).forEach(function (c) {
          var b = document.createElement("button");
          b.type = "button"; b.className = "cid-swatch"; b.style.background = COLORS[c]; b.dataset.c = c;
          b.setAttribute("aria-label", c);
          b.onclick = function () { if (!st.locked) respond(c === st.targets[st.i], b); };
          box.appendChild(b);
        });
      } else {
        var d = document.createElement("div");
        d.className = "cid-swatch big"; d.style.background = COLORS[target];
        box.appendChild(d);
      }
      ctx.later(function () { ctx.say(promptFor(target)); }, 250);
    }

    function respond(correct, btn) {
      var target = st.targets[st.i];
      st.locked = true;

      // Only the first response to each trial goes on the data sheet.
      if (st.phase === "first") ctx.record(correct);

      if (s.session === "baseline") {
        // Baseline: no prompts, no reinforcement. Move straight on.
        ctx.later(nextTrial, 400);
        return;
      }

      if (correct) {
        if (btn) btn.classList.add("right");
        else root.querySelectorAll(".cid-swatch").forEach(function (x) { x.classList.add("right"); });
        ctx.chime();
        if (s.praise === "light") { ctx.later(nextTrial, 1200); return; }   // staff gives the praise
        var praise = ASD.pick(PRAISE);
        var burst = ASD.el('<div class="cid-burst">' + CHECK + ASD.esc(praise) + "</div>");
        root.appendChild(burst);
        ctx.say(praise + " " + ASD.cap(target) + "!");
        ctx.later(function () { burst.remove(); nextTrial(); }, 1700);
      } else {
        if (st.corrections >= MAX_CORRECTIONS) {
          // Reached the max of 3 model-and-repeat attempts: show the answer once more and move on.
          modelAnswer(target, nextTrial);
          return;
        }
        st.corrections++;
        st.phase = "correction";
        modelAnswer(target, presentTrial);
      }
    }

    // Correction: model the correct answer, then re-present.
    function modelAnswer(target, then) {
      if (s.version === "receptive") {
        root.querySelectorAll(".cid-swatch").forEach(function (x) {
          x.classList.toggle("dim", x.dataset.c !== target);
          x.classList.toggle("hilite", x.dataset.c === target);
        });
      }
      $(".cid-model").textContent = ASD.cap(target);
      ctx.say("This is " + target + ".");
      ctx.later(then, 2600);
    }

    function nextTrial() {
      st.i++; st.corrections = 0; st.phase = "first";
      if (st.i >= st.targets.length) { ctx.finish(); return; }
      presentTrial();
    }

    presentTrial();
  }

  ASD.registerProgram({
    id: "color-id",
    name: "Color ID",
    category: "literacy",
    goal: "Student will independently identify colors with 80% accuracy or greater over 3 consecutive sessions.",
    icon: '<svg viewBox="0 0 150 100" aria-hidden="true"><circle cx="40" cy="50" r="32" fill="#D93A2B"/><circle cx="75" cy="50" r="32" fill="#2F6FDE" opacity="0.95"/><circle cx="110" cy="50" r="32" fill="#F2C230" opacity="0.95"/></svg>',
    settings: [
      ASD.std.version("\"Point to ___\" · 3 choices", "\"What color is this?\" · staff scores"),
      { key: "step", type: "choice", label: "Step", default: "1", sum: 1, after: chips, options: [
        { v: "1", label: "Step 1", note: "4 colors" },
        { v: "2", label: "Step 2", note: "5 colors" },
        { v: "all", label: "All 9", short: "All 9 colors", note: "review" }
      ] },
      ASD.std.session(),
      ASD.std.praise(),
      ASD.std.trials(10),
      ASD.std.voice(),
      ASD.std.text("Turn off for students who might read the color word")
    ],
    run: run
  });
})();
