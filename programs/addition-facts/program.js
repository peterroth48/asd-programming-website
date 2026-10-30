/* Addition Facts (Math). One big fact card ("4 + 2 = ?") above a pad of number buttons.
   The student taps the answer and the site scores it. Only the first tap per trial is scored. */
(function () {
  "use strict";

  // Each step adds these numbers to a first number of 0 to 9. No turnarounds (4 + 2, never 2 + 4).
  var STEPS = {
    "1": [1], "2": [2], "3": [1, 2], "4": [3], "5": [1, 2, 3],
    "6": [4], "7": [1, 2, 3, 4], "8": [5], "9": [0]
  };
  var MAX_CORRECTIONS = 3;     // "Repeat until 1x independent (max 3x)"
  var MODEL_MS = 3500;         // how long the full fact shows for staff to model
  var PRAISE = ["Great job!", "You got it!", "Nice work!", "Awesome!", "That's right!"];

  var CSS =
    ".af-card { background: #fff; border: 3px solid #DDD8CE; border-radius: 32px; padding: 2vh 48px; display: flex; align-items: center; gap: 20px; margin-bottom: 4vh; }" +
    ".af-fact { font-size: clamp(64px, 11vw, 120px); font-weight: 700; line-height: 1.15; font-variant-numeric: tabular-nums; white-space: nowrap; }" +
    ".af-fact .ans { display: inline-block; min-width: 1.2em; text-align: center; color: #9AA3AD; }" +
    ".af-card.right { border-color: #2E9E44; background: #E8F5EB; }" +
    ".af-card.right .ans, .af-card.model .ans { color: #2E9E44; }" +
    ".af-speak { width: 60px; height: 60px; border-radius: 50%; border: 2px solid #DDD8CE; background: #fff; display: inline-flex; align-items: center; justify-content: center; flex: none; padding: 0; }" +
    ".af-speak svg { width: 30px; height: 30px; }" +
    ".af-pad { display: grid; gap: clamp(8px, 1.4vw, 14px); padding: 0 16px; }" +
    ".af-pad.n11 { grid-template-columns: repeat(6, clamp(72px, 11vw, 104px)); }" +
    ".af-pad.n21 { grid-template-columns: repeat(7, clamp(64px, 10vw, 96px)); }" +
    ".af-num { height: clamp(64px, 9vh, 92px); border-radius: 18px; border: 3px solid #DDD8CE; background: #fff; color: #22262B; font-size: clamp(30px, 4.4vw, 42px); font-weight: 700; padding: 0; font-variant-numeric: tabular-nums; }" +
    ".af-num.right { border-color: #2E9E44; background: #E8F5EB; color: #1F7A33; }" +
    ".af-num.dim { opacity: .3; }" +
    ".af-burst { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: clamp(36px, 6vw, 60px); font-weight: 800; color: #2E9E44; background: #fff; padding: 18px 34px; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,.15); display: flex; align-items: center; gap: 14px; white-space: nowrap; z-index: 4; }" +
    ".af-burst svg { width: 54px; height: 54px; }";

  var SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="#22262B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="#2E9E44" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function factsFor(step) {
    var out = [];
    STEPS[step].forEach(function (b) { for (var a = 0; a <= 9; a++) out.push({ a: a, b: b }); });
    return out;
  }
  // 0 to 10 when no answer goes past 10 (steps 1 and 9), otherwise 0 to 20.
  function padMax(step) {
    return factsFor(step).every(function (f) { return f.a + f.b <= 10; }) ? 10 : 20;
  }

  function stepInfo(s) {
    var adds = STEPS[s.step];
    var lo = adds[0], hi = adds[adds.length - 1];
    var range = adds.length === 1 ? "0 + " + lo + " to 9 + " + lo : "+" + lo + " to +" + hi + " mixed";
    return '<div class="chips"><span class="chip" style="padding-left:10px">' + range + "</span>" +
      '<span class="chip" style="padding-left:10px">Number pad 0 to ' + padMax(s.step) + "</span></div>";
  }

  // Spread trials evenly across the step's facts, then shuffle; avoid the same fact twice in a row.
  function buildTargets(s) {
    var set = factsFor(s.step), out = [];
    while (out.length < s.trials) out = out.concat(ASD.shuffle(set));
    out = out.slice(0, s.trials);
    var same = function (x, y) { return x.a === y.a && x.b === y.b; };
    for (var i = 1; i < out.length; i++) {
      if (same(out[i], out[i - 1])) {
        for (var j = i + 1; j < out.length; j++) {
          if (!same(out[j], out[i - 1]) && (j + 1 >= out.length || !same(out[j + 1], out[i]))) { var t = out[i]; out[i] = out[j]; out[j] = t; break; }
        }
      }
    }
    return out;
  }

  function run(ctx) {
    var s = ctx.settings;
    var root = ctx.stage;
    var max = padMax(s.step);
    root.innerHTML =
      "<style>" + CSS + "</style>" +
      '<div class="af-card"><div class="af-fact"></div><button type="button" class="af-speak" aria-label="Say it again">' + SPEAKER + "</button></div>" +
      '<div class="af-pad n' + (max + 1) + '"></div>';
    var $ = function (sel) { return root.querySelector(sel); };
    var card = $(".af-card");

    var st = { targets: buildTargets(s), i: 0, corrections: 0, phase: "first", locked: false };

    var pad = $(".af-pad");
    for (var n = 0; n <= max; n++) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "af-num"; b.textContent = n; b.dataset.n = n;
      pad.appendChild(b);
    }
    pad.addEventListener("click", function (e) {
      var b = e.target.closest(".af-num");
      if (!b || st.locked) return;
      var f = st.targets[st.i];
      respond(Number(b.dataset.n) === f.a + f.b, b);
    });

    function spoken(f) { return "What is " + f.a + " plus " + f.b + "?"; }
    $(".af-speak").onclick = function () { ctx.say(spoken(st.targets[st.i])); };
    $(".af-speak").style.display = s.voice ? "" : "none";

    function showFact(f, answer) {
      $(".af-fact").innerHTML = f.a + " + " + f.b + ' = <span class="ans">' + (answer === undefined ? "?" : answer) + "</span>";
    }

    function presentTrial() {
      var f = st.targets[st.i];
      st.locked = false;
      ctx.progress(st.i, st.targets.length);
      card.classList.remove("right", "model");
      root.querySelectorAll(".af-num").forEach(function (x) { x.classList.remove("right", "dim"); });
      showFact(f);
      ctx.later(function () { ctx.say(spoken(f)); }, 250);
    }

    function respond(correct, btn) {
      var f = st.targets[st.i];
      st.locked = true;

      // Only the first response to each trial goes on the data sheet.
      if (st.phase === "first") ctx.record(correct);

      if (s.session === "baseline") {
        // Baseline: no prompts, no reinforcement. Move straight on.
        ctx.later(nextTrial, 400);
        return;
      }

      if (correct) {
        btn.classList.add("right");
        card.classList.add("right");
        showFact(f, f.a + f.b);
        ctx.chime();
        if (s.praise === "light") { ctx.later(nextTrial, 1200); return; }   // staff gives the praise
        var praise = ASD.pick(PRAISE);
        var burst = ASD.el('<div class="af-burst">' + CHECK + ASD.esc(praise) + "</div>");
        root.appendChild(burst);
        ctx.say(praise + " " + f.a + " plus " + f.b + " is " + (f.a + f.b) + "!");
        ctx.later(function () { burst.remove(); nextTrial(); }, 1700);
      } else {
        if (st.corrections >= MAX_CORRECTIONS) {
          // Reached the max of 3 model-and-repeat attempts: show the answer once more and move on.
          modelAnswer(f, nextTrial);
          return;
        }
        st.corrections++;
        st.phase = "correction";
        modelAnswer(f, presentTrial);
      }
    }

    // Correction: show the full fact (4 + 2 = 6) for staff to model, then re-present.
    function modelAnswer(f, then) {
      var sum = f.a + f.b;
      showFact(f, sum);
      card.classList.add("model");
      root.querySelectorAll(".af-num").forEach(function (x) {
        x.classList.toggle("dim", Number(x.dataset.n) !== sum);
        x.classList.toggle("right", Number(x.dataset.n) === sum);
      });
      ctx.say(f.a + " plus " + f.b + " is " + sum + ".");
      ctx.later(then, MODEL_MS);
    }

    function nextTrial() {
      st.i++; st.corrections = 0; st.phase = "first";
      if (st.i >= st.targets.length) { ctx.finish(); return; }
      presentTrial();
    }

    presentTrial();
  }

  var voice = ASD.std.voice();
  voice.label = "Read the fact aloud";
  voice.hint = "Off: the student says the fact, as on paper";
  voice.default = false;

  ASD.registerProgram({
    id: "addition-facts",
    name: "Addition Facts",
    category: "math",
    goal: "Student will independently answer addition facts within 10 (first number 0 to 9) with 80% accuracy or greater over 3 consecutive sessions.",
    icon: '<svg viewBox="0 0 150 100" aria-hidden="true"><rect x="8" y="14" width="134" height="72" rx="16" fill="#fff" stroke="#2F6FDE" stroke-width="5"/><text x="75" y="64" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="40" font-weight="700" fill="#22262B">2 + 1</text></svg>',
    settings: [
      { key: "step", type: "choice", label: "Step", default: "1", sum: 1, after: stepInfo, options: [
        { v: "1", label: "Step 1", short: "Step 1 · +1", note: "+1" },
        { v: "2", label: "Step 2", short: "Step 2 · +2", note: "+2" },
        { v: "3", label: "Step 3", short: "Step 3 · mix +1, +2", note: "mix +1, +2" },
        { v: "4", label: "Step 4", short: "Step 4 · +3", note: "+3" },
        { v: "5", label: "Step 5", short: "Step 5 · mix +1 to +3", note: "mix +1 to +3" },
        { v: "6", label: "Step 6", short: "Step 6 · +4", note: "+4" },
        { v: "7", label: "Step 7", short: "Step 7 · mix +1 to +4", note: "mix +1 to +4" },
        { v: "8", label: "Step 8", short: "Step 8 · +5", note: "+5" },
        { v: "9", label: "Step 9", short: "Step 9 · +0", note: "+0" }
      ] },
      ASD.std.session(),
      ASD.std.praise(),
      ASD.std.trials(10),
      voice
    ],
    run: run
  });
})();
