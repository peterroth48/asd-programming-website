/* Playlist store client. The only outside request the site makes is to the school's
   own Apps Script web app (see apps-script/). A playlist holds only a code, who picks,
   and an ordered list of programs with their settings. Never names, scores, or history.

   The staff passcode is kept in page memory for this visit only. */
(function () {
  "use strict";

  var ASD = window.ASD = window.ASD || {};
  var url = (window.ASD_CONFIG && window.ASD_CONFIG.storeUrl) || "";
  var passcode = null;   // page memory only
  var cache = {};        // playlists opened this visit, page memory only

  // Codes: one letter (no I, O or K) plus a number 1-99.
  var LETTERS = "ABCDEFGHJLMNPQRSTUVWXYZ".split("");
  var CODE_RE = /^[ABCDEFGHJLMNPQRSTUVWXYZ][1-9][0-9]?$/;

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function randomCode() {
    return LETTERS[Math.floor(Math.random() * LETTERS.length)] + (1 + Math.floor(Math.random() * 99));
  }

  /* ---------- Demo mode: in page memory, gone on reload ---------- */
  var demo = {
    B7: { code: "B7", picks: "student", programs: [
      { id: "color-id", settings: { version: "receptive", step: "1", session: "teach", praise: "full", trials: 10, voice: true, text: true } },
      { id: "addition-facts", settings: { step: "3", session: "teach", praise: "full", trials: 10, voice: false } }
    ] },
    R4: { code: "R4", picks: "staff", programs: [
      { id: "color-id", settings: { version: "receptive", step: "1", session: "teach", praise: "full", trials: 10, voice: true, text: true } },
      { id: "color-id", settings: { version: "expressive", step: "2", session: "baseline", praise: "full", trials: 8, voice: true, text: true } },
      { id: "addition-facts", settings: { step: "6", session: "teach", praise: "full", trials: 10, voice: false } }
    ] }
  };
  function demoCall(req) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var needsPass = req.action === "save" || req.action === "check";
        if (needsPass && req.passcode !== "demo") return resolve({ ok: false, error: "passcode" });
        if (req.action === "get") {
          return resolve(demo[req.code] ? { ok: true, playlist: clone(demo[req.code]) } : { ok: false, error: "not_found" });
        }
        if (req.action === "newcode") {
          var c; do { c = randomCode(); } while (demo[c]);
          return resolve({ ok: true, code: c });
        }
        if (req.action === "check") return resolve({ ok: true });
        if (req.action === "save") {
          var p = req.playlist;
          if (req.isNew && demo[p.code]) return resolve({ ok: false, error: "taken" });
          demo[p.code] = clone(p);
          return resolve({ ok: true });
        }
        resolve({ ok: false, error: "bad_request" });
      }, 250);
    });
  }

  /* ---------- Apps Script ---------- */
  function call(req) {
    if (!url) return demoCall(req);
    var p;
    if (req.action === "get" || req.action === "newcode") {
      var q = "?action=" + encodeURIComponent(req.action) + (req.code ? "&code=" + encodeURIComponent(req.code) : "");
      p = fetch(url + q, { method: "GET", redirect: "follow", cache: "no-store", credentials: "omit" });
    } else {
      // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight.
      p = fetch(url, {
        method: "POST", redirect: "follow", cache: "no-store", credentials: "omit",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(req)
      });
    }
    return p.then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: "network" }; });
  }

  ASD.store = {
    demo: !url,
    LETTERS: LETTERS,
    validCode: function (c) { return CODE_RE.test(c); },
    hasPasscode: function () { return passcode !== null; },
    forgetPasscode: function () { passcode = null; },

    get: function (code) {
      return call({ action: "get", code: code }).then(function (res) {
        if (res.ok) cache[code] = res.playlist;
        return res;
      });
    },
    cached: function (code) { return cache[code] ? clone(cache[code]) : null; },
    newCode: function () { return call({ action: "newcode" }); },

    // Checks a passcode with the server and keeps it for this visit if it's right.
    checkPasscode: function (pc) {
      return call({ action: "check", passcode: pc }).then(function (res) {
        if (res.ok) passcode = pc;
        return res;
      });
    },
    save: function (playlist, isNew) {
      return call({ action: "save", passcode: passcode, playlist: playlist, isNew: !!isNew }).then(function (res) {
        if (res.ok) cache[playlist.code] = clone(playlist);
        if (res.error === "passcode") passcode = null;
        return res;
      });
    }
  };
})();
