/* Site shell: home (code entry), playlist menus, Get ready, setup, activity with the staff
   panel, end screen, and the playlist builder. One page, so the staff passcode and the
   session score stay in page memory and nothing is written to the iPad. */
(function () {
  "use strict";

  var ASD = window.ASD;
  var store = ASD.store;
  var esc = ASD.esc, el = ASD.el;
  var app = document.getElementById("app");

  /* ---------- Icons ---------- */
  var CHEV = '<svg class="chev" viewBox="0 0 14 24" aria-hidden="true"><path d="M2 2 L12 12 L2 22" fill="none" stroke="#8A8F96" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var LEFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4 L7 12 L15 20" fill="none" stroke="#22262B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var RIGHT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4 L17 12 L9 20" fill="none" stroke="#22262B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var DONE_ART = '<svg class="end-art" viewBox="0 0 160 160" aria-hidden="true"><circle cx="80" cy="80" r="74" fill="#E5F4E4" stroke="#2E9E44" stroke-width="6"/><path d="M48 82 L70 104 L114 58" fill="none" stroke="#2E9E44" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- Screen plumbing ---------- */
  var stopCurrent = null;   // stops a running program's timers and speech

  function show(node) {
    if (stopCurrent) { stopCurrent(); stopCurrent = null; }
    app.innerHTML = "";
    app.appendChild(node);
    window.scrollTo(0, 0);
  }
  function setUrl(q) {
    try { history.replaceState(null, "", location.pathname + (q || "")); } catch (e) {}
  }
  function demoBanner() {
    return store.demo ? '<div class="demo-banner">Demo mode: sample playlists B7 and R4 (plus A1, every program), passcode "demo". Changes last until the page reloads.</div>' : "";
  }
  function legend() {
    return '<div class="legend">' + Object.keys(ASD.CATEGORIES).map(function (k) {
      var c = ASD.CATEGORIES[k];
      return '<span><i style="background:' + c.color + '"></i>' + esc(c.label) + "</span>";
    }).join("") + "</div>";
  }
  // A program card for staff screens: colored left end, icon, name, category word, summary.
  function programCard(prog, settings, tag, extra) {
    var cat = ASD.CATEGORIES[prog.category];
    return el("<" + tag + ' type="button" class="pcard">' +
      '<span class="cat-end" aria-hidden="true" style="background:' + cat.color + '"></span>' +
      (extra && extra.before || "") +
      '<span class="icon">' + prog.icon + "</span>" +
      '<span class="txt"><span class="name"><b>' + esc(prog.name) + '</b><span class="cat" style="color:' + cat.text + '">' + esc(cat.label) + "</span></span>" +
      '<span class="summary">' + esc(settings ? ASD.summary(prog, settings) : prog.goal || "") + "</span></span>" +
      (extra && extra.after || "") + "</" + tag + ">");
  }

  /* ---------- Modal ---------- */
  function modal(html) {
    var wrap = el('<div class="modal-wrap"><div class="modal" role="dialog" aria-modal="true">' + html + "</div></div>");
    app.appendChild(wrap);
    return { node: wrap.firstChild, close: function () { wrap.remove(); } };
  }
  // Resolves true once this visit has a working staff passcode.
  function askPasscode(why) {
    if (store.hasPasscode()) return Promise.resolve(true);
    return new Promise(function (resolve) {
      var m = modal('<h2>Staff passcode</h2><p>' + esc(why) + ' You only enter it once per visit.</p>' +
        '<input class="field" type="password" autocomplete="off" autocapitalize="off" aria-label="Staff passcode">' +
        '<div class="msg err" hidden></div>' +
        '<div class="acts"><button type="button" class="btn">Cancel</button><button type="button" class="btn primary">OK</button></div>');
      var input = m.node.querySelector("input"), err = m.node.querySelector(".msg"), bs = m.node.querySelectorAll(".acts button");
      function submit() {
        if (!input.value) return;
        bs[1].disabled = true; bs[1].textContent = "Checking…";
        store.checkPasscode(input.value).then(function (res) {
          bs[1].disabled = false; bs[1].textContent = "OK";
          if (res.ok) { m.close(); resolve(true); return; }
          err.hidden = false;
          err.textContent = res.error === "network" ? "Couldn't reach the playlist list. Check the Wi-Fi and try again." : "That passcode didn't work. Try again.";
          input.value = ""; input.focus();
        });
      }
      bs[0].onclick = function () { m.close(); resolve(false); };
      bs[1].onclick = submit;
      input.onkeydown = function (e) { if (e.key === "Enter") submit(); };
      setTimeout(function () { input.focus(); }, 50);
    });
  }
  function confirmBox(title, text, yes, no) {
    return new Promise(function (resolve) {
      var m = modal("<h2>" + esc(title) + "</h2><p>" + esc(text) + '</p><div class="acts"><button type="button" class="btn">' + esc(no) +
        '</button><button type="button" class="btn primary">' + esc(yes) + "</button></div>");
      var bs = m.node.querySelectorAll("button");
      bs[0].onclick = function () { m.close(); resolve(false); };
      bs[1].onclick = function () { m.close(); resolve(true); };
    });
  }

  /* ---------- Code entry (home and builder) ---------- */
  function codeEntry(onGo) {
    var letter = "", digits = "";
    var node = el('<div style="display:flex;flex-direction:column;align-items:center">' +
      '<div class="code-box" aria-live="polite"></div>' +
      '<div class="msg err" style="margin-top:14px" hidden></div>' +
      '<div class="pads">' +
        '<div class="pad"><span class="label">1 · Letter</span><div class="letters"></div></div>' +
        '<div class="pad"><span class="label">2 · Number</span><div class="numbers"></div></div>' +
      "</div></div>");
    var box = node.querySelector(".code-box"), err = node.querySelector(".msg");
    var lettersBox = node.querySelector(".letters"), numbersBox = node.querySelector(".numbers");
    store.LETTERS.forEach(function (l) {
      var b = el('<button type="button" class="key">' + l + "</button>");
      b.onclick = function () { letter = l; paint(); };
      lettersBox.appendChild(b);
    });
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "del", "0", "go"].forEach(function (k) {
      var b = el('<button type="button" class="key' + (k === "go" ? " go" : "") + '">' +
        (k === "del" ? "⌫" : k === "go" ? "Go" : k) + "</button>");
      if (k === "del") b.setAttribute("aria-label", "Delete");
      b.dataset.k = k;
      b.onclick = function () {
        if (k === "go") { if (store.validCode(letter + digits)) onGo(letter + digits, api); return; }
        if (k === "del") { if (digits) digits = digits.slice(0, -1); else letter = ""; }
        else if (letter && digits.length < 2 && !(digits === "" && k === "0")) digits += k;
        paint();
      };
      numbersBox.appendChild(b);
    });
    function paint() {
      err.hidden = true;
      box.innerHTML = (letter || digits ? "<span>" + letter + "</span><span>" + digits + "</span>" : "") + '<span class="caret"></span>';
      lettersBox.querySelectorAll(".key").forEach(function (b) { b.classList.toggle("sel", b.textContent === letter); });
      numbersBox.querySelectorAll(".key").forEach(function (b) {
        var k = b.dataset.k;
        if (k === "go") b.disabled = !store.validCode(letter + digits);
        else if (k !== "del") b.disabled = !letter || digits.length >= 2 || (digits === "" && k === "0");
      });
    }
    var api = {
      node: node,
      error: function (t) { err.textContent = t; err.hidden = false; },
      busy: function (on) { numbersBox.querySelector(".go").textContent = on ? "…" : "Go"; }
    };
    paint();
    return api;
  }

  /* =========================================================
     Home
     ========================================================= */
  function home() {
    setUrl("");
    current = null;
    var s = el('<section class="screen home">' +
      "<h1>ASD Programs</h1>" +
      '<p class="sub">Enter a playlist code: a letter, then a number</p>' +
      '<div class="entry"></div>' +
      '<button type="button" class="link" style="margin-top:20px;font-size:17px">Teachers: make or edit a playlist</button>' +
      '<div class="home-foot">' + demoBanner() +
        '<p class="note" style="margin-top:10px">Nothing about a student is stored on this site. No names, no scores, no history.</p></div>' +
      "</section>");
    var entry = codeEntry(function (code, ui) {
      ui.busy(true);
      store.get(code).then(function (res) {
        ui.busy(false);
        if (res.ok) { openPlaylist(res.playlist); return; }
        ui.error(res.error === "not_found" ? "No playlist called " + code + ". Check the code and try again." :
          "Couldn't reach the playlist list. Check the Wi-Fi and try again.");
      });
    });
    s.querySelector(".entry").appendChild(entry.node);
    s.querySelector(".link").onclick = function () { builderStart(); };
    show(s);
  }

  function loading(text) {
    show(el('<section class="screen" style="align-items:center;justify-content:center"><p class="sub" style="font-size:22px">' + esc(text) + "</p></section>"));
  }
  function loadError(code, res, retry) {
    var s = el('<section class="screen" style="align-items:center;justify-content:center;gap:20px;padding:24px;text-align:center">' +
      "<h1>" + (res.error === "not_found" ? "No playlist called " + esc(code) : "Couldn't open " + esc(code)) + "</h1>" +
      '<p class="sub">' + (res.error === "not_found" ? "Check the code with the staff binder." : "Couldn't reach the playlist list. Check the Wi-Fi and try again.") + "</p>" +
      '<div style="display:flex;gap:12px"><button type="button" class="btn">Home</button><button type="button" class="btn primary">Try again</button></div></section>');
    var bs = s.querySelectorAll("button");
    bs[0].onclick = home;
    bs[1].onclick = retry;
    show(s);
  }
  function openCode(code) {
    loading("Opening " + code + "…");
    store.get(code).then(function (res) {
      if (res.ok) openPlaylist(res.playlist);
      else loadError(code, res, function () { openCode(code); });
    });
  }

  /* =========================================================
     Playlist: menu, Get ready, setup, activity, end
     ========================================================= */
  var current = null;   // { playlist, items: [{ prog, settings, index }], page }

  function openPlaylist(playlist) {
    loadPlaylist(playlist);
    setUrl("?p=" + encodeURIComponent(playlist.code));
    menu();
  }
  function loadPlaylist(playlist) {
    var items = [];
    playlist.programs.forEach(function (p, i) {
      var prog = ASD.program(p.id);
      if (prog) items.push({ prog: prog, settings: ASD.normalize(prog, p.settings), index: i });
    });
    current = { playlist: playlist, items: items, page: 0, missing: playlist.programs.length - items.length };
  }
  function backToMenuLabel() { return "Back to the " + current.playlist.code + " menu"; }

  function menu() {
    if (current.playlist.picks === "staff") staffMenu(); else studentMenu();
  }

  /* ----- Student picks: up to 6 picture cards per screen, fixed order ----- */
  function studentMenu() {
    var per = 6, items = current.items;
    var pages = Math.max(1, Math.ceil(items.length / per));
    if (current.page >= pages) current.page = 0;
    var shown = items.slice(current.page * per, current.page * per + per);
    var s = el('<section class="screen">' +
      '<div class="topbar"><span class="tag">' + esc(current.playlist.code) + "</span>" + staffButtonHtml() + "</div>" +
      '<div class="stage"><div class="menu-grid n' + shown.length + '"></div>' +
      (pages > 1 ? '<div class="pager"><button type="button" aria-label="Previous">' + LEFT + '</button><div class="dots"></div><button type="button" aria-label="Next">' + RIGHT + "</button></div>" : "") +
      (items.length ? "" : '<p class="sub">This playlist has no programs yet.</p>') +
      "</div></section>");
    var grid = s.querySelector(".menu-grid");
    shown.forEach(function (it) {
      var c = el('<button type="button" class="scard">' + it.prog.icon + "<span>" + esc(it.prog.name) + "</span></button>");
      c.onclick = function () { ASD.unlockAudio(); getReady(it); };
      grid.appendChild(c);
    });
    if (pages > 1) {
      var pb = s.querySelectorAll(".pager > button"), dots = s.querySelector(".dots");
      for (var i = 0; i < pages; i++) dots.appendChild(el('<i class="' + (i === current.page ? "now" : "") + '"></i>'));
      pb[0].disabled = current.page === 0;
      pb[1].disabled = current.page === pages - 1;
      pb[0].onclick = function () { current.page--; studentMenu(); };
      pb[1].onclick = function () { current.page++; studentMenu(); };
    }
    wireStaffButton(s, {});
    show(s);
  }

  /* ----- Staff picks: list of program cards with a settings summary ----- */
  function staffMenu() {
    var n = current.items.length, builtIn = !!current.playlist.builtIn;
    var s = el('<section class="screen scroll"><div class="page">' +
      '<div class="head"><div><h1 style="font-size:40px;line-height:46px">' + esc(current.playlist.code) + "</h1>" +
      '<p class="sub">' + (builtIn ? "Every program on the site" : "Staff picks") + " · " + n + " program" + (n === 1 ? "" : "s") + " · tap one to check its settings</p></div>" +
      '<div style="display:flex;flex-direction:column;align-items:flex-end"><button type="button" class="link" data-a="home">Change playlist</button>' +
      (builtIn ? "" : '<button type="button" class="link" data-a="edit">Edit this playlist</button>') + "</div></div>" +
      demoBanner() +
      (builtIn ? '<p class="note" style="text-align:left;margin:0 0 12px">' + esc(current.playlist.code) + " always holds every program, starting at its default settings. New programs join it on their own. Setting changes are just for today.</p>" : "") +
      legend() + '<div class="list" style="display:flex;flex-direction:column;gap:14px"></div>' +
      (current.missing ? '<p class="note">' + current.missing + " program(s) in this playlist aren't on this site any more and are hidden.</p>" : "") +
      (n ? "" : '<p class="sub">This playlist has no programs yet.</p>') +
      "</div></section>");
    var list = s.querySelector(".list");
    current.items.forEach(function (it) {
      var c = programCard(it.prog, it.settings, "button", { after: CHEV });
      c.onclick = function () { setup(it); };
      list.appendChild(c);
    });
    s.querySelector('[data-a="home"]').onclick = home;
    if (!builtIn) s.querySelector('[data-a="edit"]').onclick = function () { builderOpen(current.playlist.code); };
    show(s);
  }

  /* ----- Get ready (student picks) ----- */
  function getReady(it) {
    var s = el('<section class="screen">' +
      '<div class="topbar"><button type="button" class="ghost" data-a="back">Back</button>' + staffButtonHtml() + "</div>" +
      '<div class="stage ready">' + it.prog.icon + "<h1>" + esc(it.prog.name) + '</h1><button type="button" class="ready-start">Start</button></div></section>');
    s.querySelector('[data-a="back"]').onclick = menu;
    s.querySelector(".ready-start").onclick = function () { ASD.unlockAudio(); runProgram(it, it.settings); };
    wireStaffButton(s, { item: it });
    show(s);
    if (it.settings.voice) ASD.say(it.prog.name);
  }

  /* ----- Setup, prefilled from the playlist ----- */
  function setup(it) {
    var saved = it.settings;
    var work = JSON.parse(JSON.stringify(saved));
    var builtIn = !!current.playlist.builtIn;
    var today = builtIn;   // A1 is never saved, so changes are always just for today
    var code = current.playlist.code;
    var s = el('<section class="screen scroll"><div class="page">' +
      '<div class="head"><div><h1>' + esc(it.prog.name) + '</h1><p class="sub">Settings from ' + esc(code) + ". Change anything before you start.</p></div>" +
      '<button type="button" class="link" data-a="back">Back to ' + esc(code) + "</button></div>" +
      '<p class="sub" style="margin-top:-8px">' + esc(it.prog.goal || "") + "</p>" +
      '<div class="settings"></div>' +
      (builtIn ? "" : '<div class="group"><div class="row"><div>Just for today<span class="hint">On: changes are not saved to ' + esc(code) + '</span></div>' +
      '<button type="button" class="toggle" role="switch" aria-label="Just for today" aria-checked="false"></button></div></div>') +
      '<button type="button" class="btn primary wide big-start">Start</button>' +
      '<p class="note save-note"></p>' +
      '<div class="msg err" hidden></div>' +
      "</div></section>");
    var noteEl = s.querySelector(".save-note"), err = s.querySelector(".msg"), startBtn = s.querySelector(".big-start");
    var todayBtn = s.querySelector(".toggle");
    function changed() { return !ASD.sameSettings(work, saved); }
    function paintNote() {
      err.hidden = true;
      if (builtIn) noteEl.textContent = changed() ? "Just for today. " + code + " always starts at the default settings." : "Default settings.";
      else if (!changed()) noteEl.textContent = "No changes. " + code + " stays as it is.";
      else if (today) noteEl.textContent = "Just for today. " + code + " keeps its saved settings.";
      else noteEl.textContent = "Start saves these settings to " + code + (store.hasPasscode() ? "." : " (asks for the staff passcode once).");
    }
    ASD.renderSettings(s.querySelector(".settings"), it.prog, work, paintNote);
    if (todayBtn) todayBtn.onclick = function () {
      today = !today;
      todayBtn.classList.toggle("sel", today);
      todayBtn.setAttribute("aria-checked", today ? "true" : "false");
      paintNote();
    };
    s.querySelector('[data-a="back"]').onclick = function () { current.playlist.picks === "staff" ? menu() : getReady(it); };
    startBtn.onclick = function () {
      ASD.unlockAudio();
      if (!changed()) { runProgram(it, saved); return; }
      if (today) { runProgram(it, work); return; }
      askPasscode("Saving a change to " + code + " needs the staff passcode.").then(function (ok) {
        if (!ok) return;
        var updated = JSON.parse(JSON.stringify(current.playlist));
        updated.programs[it.index].settings = work;
        startBtn.disabled = true; startBtn.textContent = "Saving…";
        store.save(updated).then(function (res) {
          startBtn.disabled = false; startBtn.textContent = "Start";
          if (res.ok) {
            current.playlist = updated;
            it.settings = ASD.normalize(it.prog, work);
            runProgram(it, it.settings);
            return;
          }
          err.hidden = false;
          err.textContent = res.error === "passcode" ? "The passcode didn't work. Tap Start to try again." :
            "Couldn't save to " + code + ". Check the Wi-Fi, or turn on Just for today to start without saving.";
        });
      });
    };
    paintNote();
    show(s);
  }

  /* ----- Activity ----- */
  // opts.preview: run from the builder (Try). Ends back in the builder.
  function runProgram(it, settings, opts) {
    opts = opts || {};
    var marks = [];   // session score: page memory only, wiped on Reset, menu, reload
    var timers = [];
    var s = el('<section class="screen">' +
      '<div class="topbar"><span class="tag">' + esc(opts.preview ? "Try it" : current.playlist.code) + '</span><div class="progress"></div>' + staffButtonHtml() + "</div>" +
      '<div class="stage"></div></section>');
    var stage = s.querySelector(".stage"), prog = s.querySelector(".progress");

    function stop() { timers.forEach(clearTimeout); timers = []; ASD.hush(); }
    var ctx = {
      settings: JSON.parse(JSON.stringify(settings)),
      stage: stage,
      later: function (fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; },
      say: function (t) { if (settings.voice !== false) ASD.say(t); },
      chime: function () { if (settings.session !== "baseline") ASD.chime(); },
      record: function (correct) { marks.push(correct ? "+" : "-"); },
      progress: function (i, n) {
        var h = "";
        for (var k = 0; k < n; k++) h += '<i class="' + (k < i ? "done" : k === i ? "now" : "") + '"></i>';
        prog.innerHTML = h;
        prog.setAttribute("aria-label", "Trial " + (i + 1) + " of " + n);
        ctx.trial = { i: i, n: n };
      },
      finish: function () { stop(); end(it, settings, marks, opts); }
    };
    function start() {
      stop(); marks = []; stage.innerHTML = ""; prog.innerHTML = "";
      it.prog.run(ctx);
    }
    wireStaffButton(s, {
      item: it, running: true, preview: opts.preview,
      marks: function () { return marks; },
      context: function () {
        var t = ctx.trial ? " · trial " + (ctx.trial.i + 1) + " of " + ctx.trial.n : "";
        return it.prog.name + " · " + ASD.summary(it.prog, settings) + t;
      },
      reset: start,
      endNow: function () { ctx.finish(); },
      exit: opts.preview ? opts.back : null
    });
    show(s);
    stopCurrent = stop;
    start();
  }

  /* ----- End screen ----- */
  function scoreText(marks) {
    var n = marks.length, c = marks.filter(function (m) { return m === "+"; }).length;
    return { n: n, c: c, pct: n ? Math.round(100 * c / n) : 0 };
  }
  function marksHtml(marks) {
    return '<div class="marks">' + marks.map(function (m) { return m === "+" ? '<span class="p">+</span>' : '<span class="m">−</span>'; }).join("") + "</div>";
  }
  function end(it, settings, marks, opts) {
    var sc = scoreText(marks);
    var baseline = settings.session === "baseline";
    var s = el('<section class="screen end">' +
      '<div class="stage" style="gap:24px">' + DONE_ART + "<h1>All done!</h1></div>" +
      '<div class="staff-strip">' +
        '<span class="score"><span class="label">For staff</span><b>' + (sc.n ? sc.pct + "%" : "–") + "</b><span>" + sc.c + " of " + sc.n + " first responses</span></span>" +
        "<p>" + esc(it.prog.name + " · " + ASD.summary(it.prog, settings)) + ". Write this on today's data sheet. " +
        (sc.n && sc.pct >= 80 ? "Meets 80% today. " : "") +
        "Mastery is 80% or more for 3 sessions in a row, then move to the next step. The score disappears when you leave this screen.</p>" +
        '<button type="button" class="btn primary">' + esc(opts.preview ? "Back to the builder" : backToMenuLabel()) + "</button>" +
        '<div style="flex-basis:100%">' + marksHtml(marks) + "</div>" +
      "</div></section>");
    s.querySelector(".btn").onclick = function () { opts.preview ? opts.back() : menu(); };
    show(s);
    if (!baseline) { ASD.chime(); if (settings.voice) ASD.say("All done!"); }
  }

  /* ----- Staff button + panel ----- */
  function staffButtonHtml() {
    return '<button type="button" class="ghost staff-btn" aria-label="Staff (press and hold)">Staff</button>';
  }
  function wireStaffButton(screen, opt) {
    var btn = screen.querySelector(".staff-btn");
    if (btn) ASD.holdButton(btn, function () { staffPanel(screen, opt); });
  }
  function staffPanel(screen, opt) {
    var code = current ? current.playlist.code : "";
    var html = '<div class="panel" role="dialog" aria-label="Staff panel">' +
      '<div class="head" style="margin:0;align-items:center"><h1>Staff</h1><button type="button" class="link" data-a="close">Close</button></div>';
    if (opt.running) {
      var sc = scoreText(opt.marks());
      html += '<div class="scorebox"><span class="label">This session only</span>' +
        '<span class="pct"><b>' + (sc.n ? sc.pct + "%" : "–") + "</b><span>" + sc.c + " of " + sc.n + " first responses</span></span>" +
        marksHtml(opt.marks()) + '<span class="ctx">' + esc(opt.context()) + "</span></div>";
    }
    html += '<div class="row" style="padding:4px 0"><div>Sounds<span class="hint">Chimes and dings</span></div>' +
      '<button type="button" class="toggle' + (ASD.sounds.on ? " sel" : "") + '" role="switch" aria-label="Sounds" data-a="sounds"></button></div>';
    if (opt.running) {
      html += '<button type="button" class="btn wide" data-a="reset">Reset score and start over</button>' +
        '<button type="button" class="btn wide" data-a="end">End this program now</button>';
    }
    if (opt.preview) {
      html += '<button type="button" class="btn wide" data-a="exit">Back to the builder</button>';
    } else {
      if (opt.item && current.playlist.picks !== "staff") html += '<button type="button" class="btn wide" data-a="settings">Check settings</button>';
      if (opt.running || opt.item) html += '<button type="button" class="btn wide" data-a="menu">' + esc(backToMenuLabel()) + "</button>";
      html += '<div class="spacer"></div>' +
        (current.playlist.builtIn ? "" : '<button type="button" class="link" data-a="edit" style="text-align:center">Edit this playlist (' + esc(code) + ")</button>") +
        '<button type="button" class="link" data-a="home" style="text-align:center">Open a different playlist</button>';
    }
    html += "</div>";
    var scrim = el('<button type="button" class="scrim" aria-label="Close staff panel"></button>');
    var panel = el(html);
    screen.appendChild(scrim);
    screen.appendChild(panel);
    function close() { scrim.remove(); panel.remove(); }
    scrim.onclick = close;
    panel.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]"); if (!b) return;
      var a = b.dataset.a;
      if (a === "close") close();
      if (a === "sounds") { ASD.sounds.on = !ASD.sounds.on; b.classList.toggle("sel", ASD.sounds.on); }
      if (a === "reset") { close(); opt.reset(); }
      if (a === "end") { close(); opt.endNow(); }
      if (a === "exit") opt.exit();
      if (a === "settings") setup(opt.item);
      if (a === "menu") menu();
      if (a === "edit") builderOpen(code);
      if (a === "home") home();
    });
  }

  /* =========================================================
     Playlist builder (teachers)
     ========================================================= */
  // ed: { playlist, isNew, dirty, from }  (from: playlist code to go back to, if opened from one)
  var ed = null;

  function builderStart() {
    setUrl("?build");
    var s = el('<section class="screen scroll"><div class="page">' +
      '<div class="head"><div><h1>Playlist builder</h1><p class="sub">Make or edit a playlist. Saving updates it on every iPad.</p></div>' +
      '<button type="button" class="link" data-a="home">Home</button></div>' + demoBanner() +
      '<button type="button" class="btn primary big-start" data-a="new">Make a new playlist</button>' +
      '<div class="group" style="display:flex;flex-direction:column;align-items:center"><h2 class="label" style="align-self:flex-start">Or edit a playlist: enter its code</h2><div class="entry"></div></div>' +
      "</div></section>");
    var entry = codeEntry(function (code, ui) {
      ui.busy(true);
      store.get(code).then(function (res) {
        ui.busy(false);
        if (res.ok) editor({ playlist: res.playlist, isNew: false, dirty: false, from: null });
        else ui.error(res.error === "not_found" ? "No playlist called " + code + "." : "Couldn't reach the playlist list. Check the Wi-Fi and try again.");
      });
    });
    s.querySelector(".entry").appendChild(entry.node);
    s.querySelector('[data-a="home"]').onclick = home;
    var nb = s.querySelector('[data-a="new"]');
    nb.onclick = function () {
      nb.disabled = true; nb.textContent = "Picking a code…";
      store.newCode().then(function (res) {
        nb.disabled = false; nb.textContent = "Make a new playlist";
        if (!res.ok) { entry.error("Couldn't reach the playlist list. Check the Wi-Fi and try again."); return; }
        editor({ playlist: { code: res.code, picks: "student", programs: [] }, isNew: true, dirty: true, from: null });
      });
    };
    show(s);
  }
  // A1 isn't stored, so there's nothing to edit.
  function builtInNote(code, from) {
    setUrl("?build=" + encodeURIComponent(code));
    var s = el('<section class="screen scroll"><div class="page">' +
      '<div class="head"><div><h1>Playlist builder</h1></div>' +
      '<button type="button" class="link" data-a="leave">' + (from ? "Back to the " + esc(from) + " menu" : "Home") + "</button></div>" +
      '<div class="group"><h2 class="label">' + esc(code) + " can't be edited</h2>" +
      "<p>" + esc(code) + " is built into the site. It always holds every program, starting at its default settings, " +
      "and new programs join it on their own. To set steps for a student, make a new playlist.</p></div>" +
      '<button type="button" class="btn primary" data-a="new">Open the playlist builder</button>' +
      "</div></section>");
    s.querySelector('[data-a="leave"]').onclick = function () { from ? openCode(from) : home(); };
    s.querySelector('[data-a="new"]').onclick = builderStart;
    show(s);
  }
  function builderOpen(code) {
    var cached = store.cached(code);
    if (cached) { editor({ playlist: cached, isNew: false, dirty: false, from: code }); return; }
    loading("Opening " + code + "…");
    store.get(code).then(function (res) {
      if (res.ok) editor({ playlist: res.playlist, isNew: false, dirty: false, from: code });
      else loadError(code, res, function () { builderOpen(code); });
    });
  }

  function editor(state) {
    if (state && state.playlist.builtIn) { builtInNote(state.playlist.code, state.from); return; }
    if (state) ed = state;
    var pl = ed.playlist;
    setUrl("?build=" + encodeURIComponent(pl.code));
    var s = el('<section class="screen scroll"><div class="page">' +
      '<div class="head"><div><h1>Playlist builder</h1><p class="sub">' + (ed.isNew ? "New playlist. " : "") + "Saving updates it on every iPad.</p></div>" +
      '<button type="button" class="link" data-a="leave">' + (ed.from ? "Back to the " + esc(ed.from) + " menu" : "Home") + "</button></div>" +
      demoBanner() +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px">' +
        '<div class="group"><h2 class="label">Code</h2><div style="display:flex;align-items:center;gap:14px"><span class="code-big">' + esc(pl.code) + "</span>" +
        '<span class="note" style="text-align:left">Picked at random by the site, so it can\'t match a name, grade, or room. Write it in the staff binder.</span></div></div>' +
        '<div class="group"><h2 class="label">Who picks the program</h2><div class="seg" data-a="picks">' +
          '<button type="button" data-v="student">Student picks<small>picture cards</small></button>' +
          '<button type="button" data-v="staff">Staff picks<small>list with settings</small></button></div></div>' +
      "</div>" +
      '<h2 class="label" style="margin-top:12px">Programs in ' + esc(pl.code) + ", in menu order</h2>" + legend() +
      '<div class="list" style="display:flex;flex-direction:column;gap:12px"></div>' +
      '<button type="button" class="add-btn" data-a="add">+ Add program</button>' +
      '<div class="group save-bar" style="margin-top:8px">' +
        (store.hasPasscode() ? '<span class="grow note" style="text-align:left">Staff passcode entered for this visit.</span>' :
          '<span class="grow"><label class="label" for="bpass">Staff passcode</label><input id="bpass" class="field" type="password" autocomplete="off" autocapitalize="off"></span>') +
        '<button type="button" class="btn primary" data-a="save">Save ' + esc(pl.code) + "</button>" +
        '<button type="button" class="btn" data-a="qr">Print QR card</button>' +
      "</div>" +
      '<div class="status"></div>' +
      "</div></section>");

    s.querySelectorAll('[data-a="picks"] button').forEach(function (b) {
      b.classList.toggle("sel", b.dataset.v === pl.picks);
      b.onclick = function () {
        pl.picks = b.dataset.v; ed.dirty = true;
        s.querySelectorAll('[data-a="picks"] button').forEach(function (x) { x.classList.toggle("sel", x === b); });
        paintStatus();
      };
    });

    var list = s.querySelector(".list");
    pl.programs.forEach(function (p, i) {
      var prog = ASD.program(p.id);
      if (!prog) {
        var gone = el('<div class="group" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><span class="sub" style="margin:0">A program that\'s no longer on the site (' + esc(p.id) + ')</span><button type="button" class="btn small">Remove</button></div>');
        gone.querySelector("button").onclick = function () { pl.programs.splice(i, 1); ed.dirty = true; editor(); };
        list.appendChild(gone);
        return;
      }
      var c = programCard(prog, ASD.normalize(prog, p.settings), "div", {
        before: '<span class="reorder"><button type="button" aria-label="Move up" data-m="-1">▲</button><button type="button" aria-label="Move down" data-m="1">▼</button></span>',
        after: '<span class="acts"><button type="button" class="btn small" data-b="edit">Edit</button><button type="button" class="btn small" data-b="remove">Remove</button></span>'
      });
      var mv = c.querySelectorAll(".reorder button");
      mv[0].disabled = i === 0;
      mv[1].disabled = i === pl.programs.length - 1;
      mv.forEach(function (b) {
        b.onclick = function () {
          var j = i + Number(b.dataset.m);
          var t = pl.programs[i]; pl.programs[i] = pl.programs[j]; pl.programs[j] = t;
          ed.dirty = true; editor();
        };
      });
      c.querySelector('[data-b="edit"]').onclick = function () { programSettings(prog, p.settings, i); };
      c.querySelector('[data-b="remove"]').onclick = function () { pl.programs.splice(i, 1); ed.dirty = true; editor(); };
      list.appendChild(c);
    });
    if (!pl.programs.length) list.appendChild(el('<p class="sub" style="margin:0">No programs yet. Add one below.</p>'));

    var statusEl = s.querySelector(".status");
    function paintStatus(msg, kind) {
      if (msg) { statusEl.innerHTML = '<div class="msg ' + kind + '">' + esc(msg) + "</div>"; return; }
      statusEl.innerHTML = ed.dirty ? '<p class="note">Not saved yet.</p>' : "";
    }
    paintStatus(ed.flash && ed.flash[0], ed.flash && ed.flash[1]);
    ed.flash = null;

    s.querySelector('[data-a="add"]').onclick = addProgramList;
    s.querySelector('[data-a="qr"]').onclick = function () {
      if (ed.isNew) { paintStatus("Save " + pl.code + " first, then print its card.", "err"); return; }
      qrCard(pl.code);
    };
    s.querySelector('[data-a="leave"]').onclick = function () {
      var go = function () {
        var from = ed.from; ed = null;
        if (from) { store.cached(from) ? openPlaylist(store.cached(from)) : openCode(from); } else home();
      };
      if (!ed.dirty) { go(); return; }
      confirmBox("Leave without saving?", "Your changes to " + pl.code + " will be lost.", "Leave", "Stay").then(function (yes) { if (yes) go(); });
    };

    var saveBtn = s.querySelector('[data-a="save"]');
    saveBtn.onclick = function () {
      if (!pl.programs.length) { paintStatus("Add at least one program before saving.", "err"); return; }
      var input = s.querySelector("#bpass");
      var ready = store.hasPasscode() ? Promise.resolve({ ok: true }) :
        input && input.value ? store.checkPasscode(input.value) : Promise.resolve({ ok: false, error: "empty" });
      saveBtn.disabled = true; saveBtn.textContent = "Saving…";
      ready.then(function (res) {
        if (!res.ok) return res;
        return store.save(cleanPlaylist(pl), ed.isNew);
      }).then(function (res) {
        saveBtn.disabled = false; saveBtn.textContent = "Save " + pl.code;
        if (res.ok) {
          ed.isNew = false; ed.dirty = false;
          if (current && current.playlist.code === pl.code) loadPlaylist(store.cached(pl.code));
          ed.flash = ["Saved. Every iPad that opens " + pl.code + " now gets this version.", "ok"];
          editor();
          return;
        }
        if (res.error === "taken") {
          // Someone else saved this code first; pick another one.
          var old = pl.code;
          store.newCode().then(function (r2) {
            if (r2.ok) { pl.code = r2.code; ed.flash = [old + " was just taken, so this playlist is now " + pl.code + ". Tap Save again.", "err"]; editor(); }
            else paintStatus("Couldn't reach the playlist list. Check the Wi-Fi and try again.", "err");
          });
          return;
        }
        var msg = res.error === "empty" ? "Enter the staff passcode to save." :
          res.error === "passcode" ? "That passcode didn't work. Try again." :
          "Couldn't save. Check the Wi-Fi and try again.";
        // A passcode that stopped working is forgotten; redraw so the field comes back.
        if (res.error === "passcode" && !input) { ed.flash = [msg, "err"]; editor(); return; }
        paintStatus(msg, "err");
      });
    };
    show(s);
  }
  // Keep only what a playlist may hold: code, who picks, programs and their settings.
  function cleanPlaylist(pl) {
    return {
      code: pl.code,
      picks: pl.picks === "staff" ? "staff" : "student",
      programs: pl.programs.map(function (p) {
        var prog = ASD.program(p.id);
        return { id: p.id, settings: prog ? ASD.normalize(prog, p.settings) : p.settings };
      })
    };
  }

  function addProgramList() {
    var s = el('<section class="screen scroll"><div class="page">' +
      '<div class="head"><div><h1>Add a program</h1><p class="sub">All programs on the site. Pick one to choose its settings.</p></div>' +
      '<button type="button" class="link" data-a="back">Back to ' + esc(ed.playlist.code) + "</button></div>" + legend() +
      '<div class="list" style="display:flex;flex-direction:column;gap:12px"></div></div></section>');
    var list = s.querySelector(".list");
    ASD.allPrograms().forEach(function (prog) {
      var c = programCard(prog, null, "button", { after: CHEV });
      c.onclick = function () { programSettings(prog, ASD.defaults(prog), -1); };
      list.appendChild(c);
    });
    s.querySelector('[data-a="back"]').onclick = function () { editor(); };
    show(s);
  }

  // index -1 adds a new program to the playlist; otherwise edits that one.
  function programSettings(prog, given, index) {
    var work = ASD.normalize(prog, given);
    var adding = index < 0;
    var s = el('<section class="screen scroll"><div class="page">' +
      '<div class="head"><div><h1>' + esc(prog.name) + '</h1><p class="sub">' + esc(prog.goal || "") + "</p></div>" +
      '<button type="button" class="link" data-a="back">Back to ' + esc(ed.playlist.code) + "</button></div>" +
      '<div class="settings"></div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap"><button type="button" class="btn" data-a="try" style="flex:1 1 160px">Try it</button>' +
      '<button type="button" class="btn primary big-start" data-a="done" style="flex:3 1 300px">' + (adding ? "Add to " + esc(ed.playlist.code) : "Done") + "</button></div>" +
      '<p class="note">Try it runs the program with these settings. Nothing is saved.</p>' +
      "</div></section>");
    ASD.renderSettings(s.querySelector(".settings"), prog, work);
    s.querySelector('[data-a="back"]').onclick = function () { adding ? addProgramList() : editor(); };
    s.querySelector('[data-a="done"]').onclick = function () {
      if (adding) ed.playlist.programs.push({ id: prog.id, settings: work });
      else ed.playlist.programs[index].settings = work;
      ed.dirty = true;
      editor();
    };
    s.querySelector('[data-a="try"]').onclick = function () {
      ASD.unlockAudio();
      tryProgram(prog, work, function () { programSettings(prog, work, index); });
    };
    show(s);
  }

  function tryProgram(prog, settings, back) {
    runProgram({ prog: prog, settings: settings, index: -1 }, settings, { preview: true, back: back });
  }

  /* ----- QR card ----- */
  function qrCard(code) {
    var link = location.origin + location.pathname + "?p=" + encodeURIComponent(code);
    var svg;
    try { svg = ASD.qrSvg(link); } catch (e) { svg = '<p class="sub">Couldn\'t draw the QR code.</p>'; }
    var s = el('<section class="screen qr-card scroll">' +
      '<div class="qr">' + svg + "</div>" +
      '<div class="code-big">' + esc(code) + "</div>" +
      "<p>Scan with the iPad camera to open playlist " + esc(code) + ". Then tap Share, then Add to Home Screen, to make a shortcut.</p>" +
      '<p style="font-size:14px">' + esc(link) + "</p>" +
      '<div class="no-print" style="display:flex;gap:12px;margin-top:8px"><button type="button" class="btn" data-a="back">Back</button><button type="button" class="btn primary" data-a="print">Print</button></div>' +
      "</section>");
    s.querySelector('[data-a="back"]').onclick = function () { editor(); };
    s.querySelector('[data-a="print"]').onclick = function () { window.print(); };
    show(s);
  }

  /* =========================================================
     Start: ?p=B7 opens a playlist (home-screen shortcuts, QR cards),
     ?build or ?build=B7 opens the builder, ?try=color-id-receptive previews one program.
     ========================================================= */
  var q = {};
  location.search.replace(/^\?/, "").split("&").forEach(function (kv) {
    if (!kv) return;
    var i = kv.indexOf("=");
    q[decodeURIComponent(i < 0 ? kv : kv.slice(0, i))] = i < 0 ? "" : decodeURIComponent(kv.slice(i + 1));
  });
  var pcode = (q.p || "").toUpperCase();
  if (pcode && store.validCode(pcode)) openCode(pcode);
  else if (q.build !== undefined) {
    var bcode = q.build.toUpperCase();
    if (store.validCode(bcode)) {
      loading("Opening " + bcode + "…");
      store.get(bcode).then(function (res) {
        if (res.ok) editor({ playlist: res.playlist, isNew: false, dirty: false, from: null });
        else loadError(bcode, res, builderStart);
      });
    } else builderStart();
  } else if (q.try && ASD.program(q["try"])) {
    var tp = ASD.program(q["try"]);
    setUrl("");
    // Starts on a tap so the iPad allows speech and sound.
    var s0 = el('<section class="screen"><div class="topbar"><button type="button" class="ghost">Home</button></div>' +
      '<div class="stage ready">' + tp.icon + "<h1>" + esc(tp.name) + '</h1><button type="button" class="ready-start">Try it</button>' +
      '<p class="note">Default settings. Nothing is saved.</p></div></section>');
    s0.querySelector(".ghost").onclick = home;
    s0.querySelector(".ready-start").onclick = function () { ASD.unlockAudio(); tryProgram(tp, ASD.defaults(tp), home); };
    show(s0);
  } else home();
})();
