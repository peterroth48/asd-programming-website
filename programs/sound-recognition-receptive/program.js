/* Sound Recognition - Receptive (Literacy). Two pictures share one card (rose | rainbow); the
   iPad says both words and asks whether they have the same beginning (or ending) sound. The
   student taps Same or Different and the site scores it. Only the first tap per trial is scored.
   Pictures are built-in emoji for now, until a picture source is chosen. */
(function () {
  "use strict";

  // Words grouped by sound. Each word: [emoji, word, letters to bold]. The bold letters are the
  // sound's spelling at the start (beginning) or end (ending) of the word; 1 if left out.
  // Whole words only (never single sounds), so iPad speech is fine. No blends at the start.
  var BEGIN = {
    b:  [["🐝", "bee"], ["🚌", "bus"], ["🍌", "banana"], ["🐻", "bear"], ["🛏️", "bed"], ["📖", "book"], ["🔔", "bell"]],
    k:  [["🐱", "cat"], ["🚗", "car"], ["🎂", "cake"], ["🐮", "cow"], ["🔑", "key"], ["🪁", "kite"], ["🌽", "corn"]],
    d:  [["🐶", "dog"], ["🦆", "duck"], ["🚪", "door"], ["🐬", "dolphin"], ["🍩", "donut"]],
    f:  [["🐟", "fish"], ["🦊", "fox"], ["🔥", "fire"], ["🦶", "foot"]],
    g:  [["🐐", "goat"], ["🎁", "gift"], ["🎸", "guitar"]],
    h:  [["🎩", "hat"], ["🐴", "horse"], ["🏠", "house"], ["❤️", "heart"], ["✋", "hand"], ["🔨", "hammer"]],
    l:  [["🦁", "lion"], ["🍁", "leaf"], ["🍋", "lemon"], ["🔒", "lock"], ["👄", "lips"]],
    m:  [["🌙", "moon"], ["🐒", "monkey"], ["🐭", "mouse"], ["🥛", "milk"], ["🗺️", "map"], ["🍄", "mushroom"]],
    p:  [["🐷", "pig"], ["🍕", "pizza"], ["🍐", "pear"], ["🐧", "penguin"], ["🥧", "pie"], ["🍿", "popcorn"]],
    r:  [["🌹", "rose"], ["🌈", "rainbow"], ["🐰", "rabbit"], ["💍", "ring"], ["🤖", "robot"], ["🚀", "rocket"]],
    s:  [["☀️", "sun"], ["🧦", "sock"], ["🧼", "soap"], ["🥪", "sandwich"]],
    t:  [["🐯", "tiger"], ["🐢", "turtle"], ["🦷", "tooth"], ["⛺", "tent"], ["🌮", "taco"], ["🍅", "tomato"]],
    w:  [["⌚", "watch"], ["🍉", "watermelon"], ["🐺", "wolf"], ["🪱", "worm"], ["🕸️", "web"]],
    sh: [["🚢", "ship", 2], ["👟", "shoe", 2], ["🦈", "shark", 2], ["🐑", "sheep", 2], ["🐚", "shell", 2]],
    ch: [["🧀", "cheese", 2], ["🪑", "chair", 2], ["🐔", "chicken", 2], ["🍒", "cherries", 2]]
  };
  var END = {
    t:  [["🐱", "cat"], ["🎩", "hat"], ["⛵", "boat"], ["🐐", "goat"], ["🦶", "foot"], ["🚀", "rocket"], ["🥕", "carrot"]],
    g:  [["🐷", "pig"], ["🐶", "dog"], ["🐛", "bug"], ["🥚", "egg", 2], ["🐸", "frog"], ["🚩", "flag"]],
    n:  [["☀️", "sun"], ["🌙", "moon"], ["🦁", "lion"], ["🐧", "penguin"], ["🚆", "train"], ["👑", "crown"]],
    k:  [["🦆", "duck", 2], ["📖", "book"], ["🧦", "sock", 2], ["🔒", "lock", 2], ["🥛", "milk"], ["🚚", "truck", 2]],
    p:  [["🗺️", "map"], ["🚢", "ship"], ["🐑", "sheep"], ["🧼", "soap"], ["🧢", "cap"]],
    m:  [["🥁", "drum"], ["🪱", "worm"], ["🧹", "broom"]],
    l:  [["🔔", "bell", 2], ["🐚", "shell", 2], ["🐌", "snail"], ["🦉", "owl"], ["✏️", "pencil"]],
    r:  [["🚗", "car"], ["⭐", "star"], ["🚪", "door"], ["🪑", "chair"], ["🐻", "bear"], ["🍐", "pear"]],
    s:  [["🚌", "bus"], ["👗", "dress", 2], ["🐙", "octopus"], ["🌵", "cactus"]]
  };
  var STEPS = {
    "5": { words: BEGIN, where: "beginning", verb: "start" },
    "6": { words: END, where: "ending", verb: "end" }
  };
  var MAX_CORRECTIONS = 3;     // "Repeat until 1x independent (max 3x)"
  var MODEL_MS = 4200;         // long enough for the iPad to say the whole sentence
  var PRAISE = ["Great job!", "You got it!", "Nice work!", "That's right!"];

  var CSS =
    ".sr-hear { display: flex; align-items: center; gap: 12px; background: #2F6FDE; color: #fff; border: 0; border-radius: 20px; font-size: clamp(22px, 3vw, 28px); font-weight: 700; padding: 14px 28px; min-height: 64px; margin-bottom: 3vh; }" +
    ".sr-hear svg { width: 32px; height: 32px; }" +
    ".sr-pair { display: flex; align-items: stretch; background: #fff; border: 3px solid #DDD8CE; border-radius: 32px; padding: 2.4vh 16px; }" +
    ".sr-pic { width: clamp(180px, 26vw, 260px); display: flex; flex-direction: column; align-items: center; justify-content: center; }" +
    ".sr-pic + .sr-pic { border-left: 3px dashed #DDD8CE; }" +
    ".sr-emoji { font-size: clamp(96px, 14vw, 150px); line-height: 1.1; }" +
    ".sr-word { font-size: clamp(30px, 4vw, 40px); min-height: 1.4em; margin-top: 6px; color: #3E444A; }" +
    ".sr-word b { color: #22262B; font-weight: 800; text-decoration: underline; text-decoration-thickness: 3px; text-underline-offset: 5px; }" +
    ".sr-say { font-size: clamp(24px, 3.4vw, 34px); font-weight: 700; text-align: center; margin: 3vh 20px; min-height: 1.3em; }" +
    ".sr-answers { display: flex; gap: clamp(24px, 5vw, 56px); }" +
    ".sr-btn { width: clamp(220px, 28vw, 290px); border: 4px solid #2F6FDE; background: #EAF1FC; border-radius: 28px; padding: 18px 0 14px; display: flex; flex-direction: column; align-items: center; gap: 8px; color: #22262B; box-shadow: 0 5px 0 #2F6FDE; }" +
    ".sr-btn .sym { display: flex; gap: 10px; }" +
    ".sr-btn .sq, .sr-btn .ci { width: 38px; height: 38px; display: block; }" +
    ".sr-btn .sq { background: #D33A2C; }" +
    ".sr-btn .ci { background: #2E9E44; border-radius: 50%; }" +
    ".sr-btn b { font-size: clamp(36px, 4.6vw, 46px); line-height: 1.1; }" +
    ".sr-btn small { font-size: 20px; color: #5F656C; }" +
    ".sr-btn.right { border-color: #2E9E44; background: #E8F5EB; box-shadow: 0 5px 0 #2E9E44; }" +
    ".sr-btn.hilite { box-shadow: 0 0 0 6px #fff, 0 0 0 12px #22262B; }" +
    ".sr-btn.dim { opacity: .3; }" +
    ".sr-pair.right { border-color: #2E9E44; background: #F3FAF4; }";

  var SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';

  function words(group) {
    return group.map(function (w) { return { emoji: w[0], word: w[1], n: w[2] || 1 }; });
  }

  function stepInfo(s) {
    var set = STEPS[s.step];
    return '<div class="chips"><span class="chip" style="padding-left:10px">Same or different ' + set.where + ' sound</span>' +
      '<span class="chip" style="padding-left:10px">' + Object.keys(set.words).length + " sounds</span>" +
      '<span class="chip" style="padding-left:10px">Half the pairs are the same</span></div>';
  }

  // Half the trials are same-sound pairs, half different, shuffled with no more than 3 of the
  // same answer in a row. No word shows up in two trials in a row.
  function buildTargets(s) {
    var groups = STEPS[s.step].words, keys = Object.keys(groups);
    var answers = [];
    for (var i = 0; i < s.trials; i++) answers.push(i % 2 === 0);
    answers = ASD.shuffle(answers);
    for (var tries = 0; tries < 50 && hasLongRun(answers); tries++) answers = ASD.shuffle(answers);

    var out = [], last = [];
    answers.forEach(function (same) {
      var pair;
      for (var t = 0; t < 20; t++) {
        if (same) {
          var g = words(groups[ASD.pick(keys)]);
          pair = ASD.shuffle(g).slice(0, 2);
        } else {
          var two = ASD.shuffle(keys).slice(0, 2);
          pair = [ASD.pick(words(groups[two[0]])), ASD.pick(words(groups[two[1]]))];
        }
        if (last.indexOf(pair[0].word) < 0 && last.indexOf(pair[1].word) < 0) break;
      }
      out.push({ a: pair[0], b: pair[1], same: same });
      last = [pair[0].word, pair[1].word];
    });
    return out;
  }
  function hasLongRun(a) {
    for (var i = 3; i < a.length; i++) if (a[i] === a[i - 1] && a[i] === a[i - 2] && a[i] === a[i - 3]) return true;
    return false;
  }

  function run(ctx) {
    var s = ctx.settings;
    var root = ctx.stage;
    var step = STEPS[s.step];
    root.innerHTML =
      "<style>" + CSS + "</style>" +
      '<button type="button" class="sr-hear">' + SPEAKER + "Hear again</button>" +
      '<div class="sr-pair"><div class="sr-pic"><span class="sr-emoji"></span><span class="sr-word"></span></div>' +
      '<div class="sr-pic"><span class="sr-emoji"></span><span class="sr-word"></span></div></div>' +
      '<p class="sr-say"></p>' +
      '<div class="sr-answers">' +
      '<button type="button" class="sr-btn" data-same="1"><span class="sym"><i class="sq"></i><i class="sq"></i></span><b>Same</b><small>Yes</small></button>' +
      '<button type="button" class="sr-btn" data-same="0"><span class="sym"><i class="sq"></i><i class="ci"></i></span><b>Different</b><small>No</small></button>' +
      "</div>";
    var $ = function (sel) { return root.querySelector(sel); };
    var pair = $(".sr-pair"), say = $(".sr-say");
    var emojis = root.querySelectorAll(".sr-emoji"), labels = root.querySelectorAll(".sr-word");

    var st = { targets: buildTargets(s), i: 0, corrections: 0, phase: "first", locked: false };

    function question() { return "Same " + step.where + " sound, or different?"; }
    function spoken(t) {
      return ASD.cap(t.a.word) + ". " + ASD.cap(t.b.word) + ". Do these words have the same " + step.where + " sound?";
    }
    // "Rose and rainbow start with the same sound." / "Sun and moon start with different sounds."
    function explain(t) {
      return ASD.cap(t.a.word) + " and " + t.b.word + " " + step.verb + (t.same ? " with the same sound." : " with different sounds.");
    }
    function marked(w) {
      var at = s.step === "6" ? w.word.length - w.n : 0;
      return ASD.esc(w.word.slice(0, at)) + "<b>" + ASD.esc(w.word.slice(at, at + w.n)) + "</b>" + ASD.esc(w.word.slice(at + w.n));
    }
    function showWords(t) { labels[0].innerHTML = marked(t.a); labels[1].innerHTML = marked(t.b); }

    $(".sr-hear").onclick = function () { ctx.say(spoken(st.targets[st.i])); };
    $(".sr-hear").style.display = s.voice ? "" : "none";

    root.querySelectorAll(".sr-btn").forEach(function (b) {
      b.onclick = function () {
        if (st.locked) return;
        respond((b.dataset.same === "1") === st.targets[st.i].same, b);
      };
    });

    function presentTrial() {
      var t = st.targets[st.i];
      st.locked = false;
      ctx.progress(st.i, st.targets.length);
      pair.classList.remove("right");
      root.querySelectorAll(".sr-btn").forEach(function (x) { x.classList.remove("right", "hilite", "dim"); });
      emojis[0].textContent = t.a.emoji; emojis[1].textContent = t.b.emoji;
      emojis[0].setAttribute("aria-label", t.a.word); emojis[1].setAttribute("aria-label", t.b.word);
      labels[0].innerHTML = ""; labels[1].innerHTML = "";
      say.textContent = s.text ? question() : "";
      ctx.later(function () { ctx.say(spoken(t)); }, 250);
    }

    function respond(correct, btn) {
      var t = st.targets[st.i];
      st.locked = true;

      // Only the first response to each trial goes on the data sheet.
      if (st.phase === "first") ctx.record(correct);

      if (s.session === "baseline") {
        // Baseline: no prompts, no reinforcement. Move straight on.
        ctx.later(nextTrial, 400);
        return;
      }

      if (correct) {
        // Go over it: the words appear with the sound in bold, and the site says why.
        btn.classList.add("right");
        pair.classList.add("right");
        showWords(t);
        ctx.chime();
        if (s.praise === "light") {   // staff gives the praise
          say.textContent = explain(t);
          ctx.later(nextTrial, 2600);
          return;
        }
        var praise = ASD.pick(PRAISE);
        say.textContent = praise + " " + explain(t);
        ctx.say(praise + " " + explain(t));
        ctx.later(nextTrial, MODEL_MS + 600);
      } else {
        if (st.corrections >= MAX_CORRECTIONS) {
          // Reached the max of 3 model-and-repeat attempts: model once more and move on.
          modelAnswer(t, nextTrial);
          return;
        }
        st.corrections++;
        st.phase = "correction";
        modelAnswer(t, presentTrial);
      }
    }

    // Correction: show the words with the sound in bold, point to the right answer and say it,
    // then show the same pair again.
    function modelAnswer(t, then) {
      showWords(t);
      root.querySelectorAll(".sr-btn").forEach(function (x) {
        var isRight = (x.dataset.same === "1") === t.same;
        x.classList.toggle("hilite", isRight);
        x.classList.toggle("dim", !isRight);
      });
      say.textContent = explain(t);
      ctx.say(explain(t));
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
  voice.label = "Say the words aloud";
  voice.hint = "Off: staff say the two words and the question";

  ASD.registerProgram({
    id: "sound-recognition-receptive",
    name: "Sound Recognition - Receptive",
    category: "literacy",
    goal: "Student will independently tell whether two words have the same or different beginning (or ending) sound with 80% accuracy or greater over 3 consecutive sessions.",
    icon: '<svg viewBox="0 0 150 100" aria-hidden="true"><rect x="8" y="10" width="134" height="80" rx="16" fill="#fff" stroke="#E08A2E" stroke-width="5"/><line x1="75" y1="22" x2="75" y2="78" stroke="#DDD8CE" stroke-width="3" stroke-dasharray="6 5"/><text x="41" y="66" text-anchor="middle" font-size="40">🌹</text><text x="109" y="66" text-anchor="middle" font-size="40">🌈</text></svg>',
    settings: [
      { key: "step", type: "choice", label: "Step", default: "5", sum: 1, after: stepInfo, options: [
        { v: "5", label: "Step 5", short: "Step 5 · beginning sounds", note: "beginning sounds" },
        { v: "6", label: "Step 6", short: "Step 6 · ending sounds", note: "ending sounds" }
      ] },
      ASD.std.session(),
      ASD.std.praise(),
      ASD.std.trials(10),
      voice,
      ASD.std.text("Shows \"Same beginning sound, or different?\" on the screen")
    ],
    run: run
  });
})();
