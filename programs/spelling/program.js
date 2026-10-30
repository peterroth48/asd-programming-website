/* Spelling (Literacy). The site says the word (it is never shown first). The student spells
   it on an on-screen keyboard (lowercase, with ch, sh, th, wh as single keys) and taps Done,
   or writes it on a whiteboard while staff tap ✓ / ✗. Whole word, first try only. */
(function () {
  "use strict";

  // Built-in word lists. Steps 2 and 3 are every word on the paper sheet, uncommon words and
  // names included (they're there for the phonics). Steps 1 and 4 had no sheet list.
  var STEPS = {
    "1": ["cat", "map", "sun", "pig", "bed", "hop", "cup", "dog", "hat", "net", "fox", "bug", "jam", "lid", "mud", "pen", "rug", "sit", "top", "van", "web", "zip"],
    "2": ["chip", "chin", "chap", "chug", "chad", "chef", "chat", "chop",
          "ship", "shop", "shin", "shut", "show", "shun", "shoe",
          "than", "then", "thin", "thug", "this", "thud", "they",
          "what", "when", "wham", "whit", "whiz", "whip", "whop"],
    "3": ["arch", "hech", "inch", "such", "much", "rich",
          "bash", "cash", "dash", "dish", "fish", "hush", "rash", "push", "lash", "bush", "wish",
          "bath", "both", "beth", "goth", "math", "moth", "rath", "path", "ruth", "seth"],
    "4": ["dishes", "wishes", "fishing", "bushes", "pushing", "bathtub", "nothing", "mother", "father", "panther", "lunches", "teacher", "nowhere", "anywhere", "somewhere"]
  };
  var DIGRAPHS = ["ch", "sh", "th", "wh"];
  var ROWS = {
    abc:    ["abcdefghi", "jklmnopqr", "stuvwxyz"],
    qwerty: ["qwertyuiop", "asdfghjkl", "zxcvbnm"]
  };
  var MAX_LETTERS = 14;
  var MAX_CORRECTIONS = 3;     // "Repeat until 1x independent (max 3x)"
  var MODEL_MS = 3500;         // how long the correct spelling shows for staff to model
  var PRAISE = ["Great job!", "You got it!", "Nice work!", "Awesome!", "That's right!"];

  var CSS =
    ".sp-hear { display: flex; align-items: center; gap: 12px; background: #2F6FDE; color: #fff; border: 0; border-radius: 18px; font-size: clamp(20px, 2.6vw, 26px); font-weight: 700; padding: 14px 28px; margin-bottom: 2.5vh; }" +
    ".sp-hear svg { width: 32px; height: 32px; }" +
    ".sp-answer { min-width: min(80vw, 420px); min-height: clamp(76px, 11vh, 104px); background: #fff; border: 3px solid #DDD8CE; border-radius: 22px; display: flex; align-items: center; justify-content: center; padding: 0 28px; margin-bottom: 3vh; font-size: clamp(44px, 7vw, 68px); font-weight: 600; letter-spacing: 0.08em; }" +
    ".sp-answer .caret { display: inline-block; width: 4px; height: 0.9em; background: #2F6FDE; margin-left: 4px; }" +
    ".sp-answer.right { border-color: #2E9E44; background: #E8F5EB; color: #1F7A33; }" +
    ".sp-answer.model { border-color: #22262B; }" +
    ".sp-answer.blank { visibility: hidden; }" +
    ".sp-kb { display: flex; flex-direction: column; align-items: center; gap: clamp(6px, 1vh, 10px); padding: 0 8px; }" +
    ".sp-kb .sp-row { display: flex; gap: clamp(5px, 0.8vw, 9px); }" +
    ".sp-key { width: clamp(52px, 8.4vw, 76px); height: clamp(52px, 8vh, 72px); border-radius: 14px; border: 2px solid #DDD8CE; background: #fff; color: #22262B; font-size: clamp(26px, 3.6vw, 34px); font-weight: 500; padding: 0; }" +
    ".sp-key.wide { width: clamp(108px, 16vw, 150px); }" +
    ".sp-key.del { font-size: clamp(18px, 2.2vw, 22px); font-weight: 600; }" +
    ".sp-key.done { background: #2F6FDE; border-color: #2F6FDE; color: #fff; font-size: clamp(20px, 2.4vw, 24px); font-weight: 700; }" +
    ".sp-key:active { background: #EAF1FD; }" +
    ".sp-key.done:active { background: #2559B5; }" +
    ".sp-kb.locked .sp-key { opacity: .45; }" +
    ".sp-write { font-size: clamp(28px, 4.4vw, 44px); font-weight: 700; text-align: center; margin: 1vh 20px 0; }" +
    ".sp-peek { position: absolute; left: 12px; bottom: 12px; border: 1px solid #DDD8CE; background: #FBFAF7; color: #5F656C; border-radius: 12px; font-size: 14px; padding: 10px 14px; z-index: 3; }" +
    ".sp-peek.showing { color: #22262B; font-size: 22px; font-weight: 700; }" +
    ".sp-burst { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: clamp(36px, 6vw, 60px); font-weight: 800; color: #2E9E44; background: #fff; padding: 18px 34px; border-radius: 24px; box-shadow: 0 10px 30px rgba(0,0,0,.15); display: flex; align-items: center; gap: 14px; white-space: nowrap; z-index: 4; }" +
    ".sp-burst svg { width: 54px; height: 54px; }" +
    ".sp-scorebar { position: absolute; bottom: 0; left: 0; right: 0; display: flex; justify-content: center; gap: 16px; padding: 16px; background: rgba(246,244,239,.95); border-top: 1px solid #DDD8CE; z-index: 3; }" +
    ".sp-scorebar .lbl { align-self: center; color: #5F656C; font-size: 14px; margin-right: 6px; }" +
    ".sp-scorebar button { min-width: 170px; padding: 16px 20px; border-radius: 14px; border: none; font-size: 19px; font-weight: 700; color: #fff; }";

  var SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="#2E9E44" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function wordsFor(s) {
    var own = s["words" + s.step];
    return own && own.length ? own : STEPS[s.step];
  }


  // Spread trials evenly across the words, then shuffle; avoid the same word twice in a row.
  function buildTargets(s) {
    var set = wordsFor(s), out = [];
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
    var board = s.answer === "board";
    root.innerHTML =
      "<style>" + CSS + "</style>" +
      '<button type="button" class="sp-hear">' + SPEAKER + "Hear again</button>" +
      '<div class="sp-answer"></div>' +
      (board ? '<p class="sp-write">Write it on your whiteboard.</p>' : '<div class="sp-kb"></div>');
    var $ = function (sel) { return root.querySelector(sel); };
    var answer = $(".sp-answer");
    var st = { targets: buildTargets(s), i: 0, corrections: 0, phase: "first", locked: false, typed: [] };

    // The word is never on screen before the answer, so with speech off staff need a way to see it.
    var hear = $(".sp-hear");
    if (s.voice) hear.onclick = function () { ctx.say(st.targets[st.i]); };
    else {
      hear.style.visibility = "hidden";
      var peek = ASD.el('<button type="button" class="sp-peek">Staff: hold to see the word</button>');
      var peekOn = function (e) { e.preventDefault(); peek.textContent = st.targets[st.i]; peek.classList.add("showing"); };
      var peekOff = function () { peek.textContent = "Staff: hold to see the word"; peek.classList.remove("showing"); };
      peek.addEventListener("pointerdown", peekOn);
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) { peek.addEventListener(ev, peekOff); });
      peek.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      root.appendChild(peek);
    }

    if (board) {
      var bar = ASD.el('<div class="sp-scorebar"><span class="lbl">Staff:</span>' +
        '<button type="button" style="background:#2E9E44">✓ Correct</button>' +
        '<button type="button" style="background:#C9541A">✗ Incorrect / no response</button></div>');
      var bs = bar.querySelectorAll("button");
      bs[0].onclick = function () { if (!st.locked) respond(true); };
      bs[1].onclick = function () { if (!st.locked) respond(false); };
      root.appendChild(bar);
      root.style.paddingBottom = "110px";   // room for the staff scoring bar
      if (!s.voice) $(".sp-peek").style.bottom = "110px";
    } else {
      var kb = $(".sp-kb");
      kb.innerHTML = ROWS[s.keys].map(function (r) {
        return '<div class="sp-row">' + r.split("").map(function (c) { return '<button type="button" class="sp-key" data-k="' + c + '">' + c + "</button>"; }).join("") + "</div>";
      }).join("") +
        '<div class="sp-row">' + DIGRAPHS.map(function (c) { return '<button type="button" class="sp-key wide" data-k="' + c + '">' + c + "</button>"; }).join("") + "</div>" +
        '<div class="sp-row"><button type="button" class="sp-key wide del" data-k="del" aria-label="Delete">⌫ Delete</button>' +
        '<button type="button" class="sp-key wide done" data-k="done">Done</button></div>';
      kb.addEventListener("click", function (e) {
        var b = e.target.closest("[data-k]");
        if (!b || st.locked) return;
        var k = b.dataset.k;
        if (k === "del") st.typed.pop();   // ch, sh, th, wh come off as one key, like they went on
        else if (k === "done") { if (st.typed.length) respond(st.typed.join("") === st.targets[st.i]); return; }
        else if (st.typed.join("").length + k.length <= MAX_LETTERS) st.typed.push(k);
        drawTyped();
      });
    }

    function drawTyped() {
      answer.className = "sp-answer";
      answer.innerHTML = ASD.esc(st.typed.join("")) + '<span class="caret"></span>';
    }
    function showWord(cls) {
      answer.className = "sp-answer " + cls;
      answer.textContent = st.targets[st.i];
    }

    function presentTrial() {
      var word = st.targets[st.i];
      st.locked = false;
      st.typed = [];
      ctx.progress(st.i, st.targets.length);
      if (board) answer.className = "sp-answer blank";
      else { drawTyped(); $(".sp-kb").classList.remove("locked"); }
      ctx.later(function () { ctx.say(word); }, 250);
    }

    function respond(correct) {
      var word = st.targets[st.i];
      st.locked = true;
      if (!board) $(".sp-kb").classList.add("locked");

      // Only the first try at each word goes on the data sheet.
      if (st.phase === "first") ctx.record(correct);

      if (s.session === "baseline") {
        // Baseline: no prompts, no reinforcement. Move straight on.
        ctx.later(nextTrial, 400);
        return;
      }

      if (correct) {
        showWord("right");
        ctx.chime();
        if (s.praise === "light") { ctx.later(nextTrial, 1200); return; }   // staff gives the praise
        var praise = ASD.pick(PRAISE);
        var burst = ASD.el('<div class="sp-burst">' + CHECK + ASD.esc(praise) + "</div>");
        root.appendChild(burst);
        ctx.say(praise + " " + word + "!");
        ctx.later(function () { burst.remove(); nextTrial(); }, 1700);
      } else {
        if (st.corrections >= MAX_CORRECTIONS) {
          // Reached the max of 3 model-and-repeat attempts: show the word once more and move on.
          modelAnswer(nextTrial);
          return;
        }
        st.corrections++;
        st.phase = "correction";
        modelAnswer(presentTrial);
      }
    }

    // Correction: show the correct spelling and say the word for staff to model, then the same word again.
    function modelAnswer(then) {
      var word = st.targets[st.i];
      showWord("model");
      ctx.say("This is how you spell " + word + ".");
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
  voice.label = "Say the word aloud";
  voice.hint = "Off: staff say the word (hold the corner button to see it)";

  function wordList(step) {
    return { key: "words" + step, type: "words", label: "Step " + step + " word list", default: [],
      hint: "One word per line, lowercase. Change it to fit the student. The word is never shown before the answer.",
      showIf: function (s) { return s.step === step; },
      builtin: function () { return STEPS[step]; },
      sum: 1.5, sumIf: function (s) { return s.step === step; } };
  }

  ASD.registerProgram({
    id: "spelling",
    name: "Spelling",
    category: "literacy",
    goal: "Student will independently spell words with 80% accuracy or greater over 3 consecutive sessions.",
    icon: '<svg viewBox="0 0 150 100" aria-hidden="true"><rect x="8" y="22" width="134" height="56" rx="14" fill="#fff" stroke="#E08A2E" stroke-width="5"/><text x="75" y="63" text-anchor="middle" font-family="-apple-system, sans-serif" font-size="34" font-weight="600" letter-spacing="3" fill="#22262B">ship</text></svg>',
    settings: [
      { key: "step", type: "choice", label: "Step", default: "1", sum: 1, options: [
        { v: "1", label: "Step 1", short: "Step 1 · CVC words", note: "CVC words" },
        { v: "2", label: "Step 2", short: "Step 2 · ch sh th wh at the start", note: "ch sh th wh at the start" },
        { v: "3", label: "Step 3", short: "Step 3 · ch sh th wh at the end", note: "at the end" },
        { v: "4", label: "Step 4", short: "Step 4 · ch sh th wh in the middle", note: "in the middle" }
      ] },
      wordList("1"), wordList("2"), wordList("3"), wordList("4"),
      { key: "answer", type: "choice", label: "Answer", default: "keyboard", sum: 2, options: [
        { v: "keyboard", label: "On-screen keyboard", short: "Keyboard", note: "the site scores it" },
        { v: "board", label: "Write on whiteboard", short: "Whiteboard", note: "staff tap ✓ / ✗" }
      ] },
      { key: "keys", type: "choice", label: "Keyboard order", default: "abc", options: [
        { v: "abc", label: "ABC order", note: "like the velcro letter board" },
        { v: "qwerty", label: "Keyboard order", note: "q w e r t y" }
      ] },
      ASD.std.session(),
      ASD.std.praise(),
      ASD.std.trials(10),
      voice
    ],
    run: run
  });
})();
