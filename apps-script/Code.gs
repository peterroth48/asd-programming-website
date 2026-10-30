/**
 * ASD Programs: playlist store.
 *
 * A Google Apps Script web app bound to a Google Sheet. It holds playlists only:
 * a code, who picks, and an ordered list of programs with their settings.
 * Never names, scores, or history. See SETUP.md for deploy steps.
 *
 * Reading a playlist needs nothing. Saving needs the staff passcode, which lives in
 * Project Settings > Script properties as STAFF_PASSCODE (never in this file).
 *
 * Requests:
 *   GET  ?action=get&code=B7     -> { ok, playlist } or { ok:false, error:"not_found" }
 *   GET  ?action=newcode         -> { ok, code }   a random code not in use yet
 *   POST {action:"check", passcode}                    -> { ok }
 *   POST {action:"save", passcode, playlist, isNew}    -> { ok } or error "taken" / "passcode"
 */

var SHEET_NAME = 'Playlists';
var LETTERS = 'ABCDEFGHJLMNPQRSTUVWXYZ';          // no I, O or K
var CODE_RE = /^[ABCDEFGHJLMNPQRSTUVWXYZ][1-9][0-9]?$/;
var ID_RE = /^[a-z0-9-]{1,40}$/;
var KEY_RE = /^[a-zA-Z0-9_]{1,30}$/;
var MAX_PROGRAMS = 40;
var MAX_SETTINGS = 30;
var MAX_WORDS = 60;                               // word lists (Spelling)
var WORD_RE = /^[a-z]{1,20}$/;

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'get') return json(getPlaylist(String(p.code || '').toUpperCase()));
    if (p.action === 'newcode') return json(newCode());
    return json({ ok: true, service: 'ASD Programs playlists' });
  } catch (err) {
    return json({ ok: false, error: 'server' });
  }
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'bad_request' }); }
  try {
    if (!passcodeOk(req.passcode)) {
      Utilities.sleep(1500);   // slows down guessing
      return json({ ok: false, error: 'passcode' });
    }
    if (req.action === 'check') return json({ ok: true });
    if (req.action === 'save') return json(savePlaylist(req.playlist, !!req.isNew));
    return json({ ok: false, error: 'bad_request' });
  } catch (err) {
    return json({ ok: false, error: 'server' });
  }
}

/* ---------- Playlists ---------- */

function getPlaylist(code) {
  if (!CODE_RE.test(code)) return { ok: false, error: 'not_found' };
  var row = findRow(code);
  if (!row) return { ok: false, error: 'not_found' };
  return { ok: true, playlist: JSON.parse(row.json) };
}

function newCode() {
  var used = {};
  allCodes().forEach(function (c) { used[c] = true; });
  for (var tries = 0; tries < 500; tries++) {
    var c = LETTERS.charAt(Math.floor(Math.random() * LETTERS.length)) + (1 + Math.floor(Math.random() * 99));
    if (!used[c]) return { ok: true, code: c };
  }
  return { ok: false, error: 'full' };
}

function savePlaylist(given, isNew) {
  var playlist = clean(given);
  if (!playlist) return { ok: false, error: 'bad_request' };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = getSheet();
    var row = findRow(playlist.code);
    var text = JSON.stringify(playlist);
    var now = new Date();
    if (row) {
      if (isNew) return { ok: false, error: 'taken' };
      sheet.getRange(row.index, 2, 1, 2).setValues([[text, now]]);
    } else {
      sheet.appendRow([playlist.code, text, now]);
    }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// Keeps only what a playlist may hold. Settings values must be short words, numbers,
// true/false, or a word list (up to 60 lowercase words of letters only, for programs
// like Spelling). Nothing else can be stored.
function clean(p) {
  if (!p || typeof p !== 'object') return null;
  var code = String(p.code || '').toUpperCase();
  if (!CODE_RE.test(code)) return null;
  if (!Array.isArray(p.programs) || p.programs.length > MAX_PROGRAMS) return null;
  var programs = [];
  for (var i = 0; i < p.programs.length; i++) {
    var item = p.programs[i] || {};
    if (!ID_RE.test(String(item.id || ''))) return null;
    var settings = {}, keys = Object.keys(item.settings || {});
    if (keys.length > MAX_SETTINGS) return null;
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k], v = item.settings[key];
      if (!KEY_RE.test(key)) return null;
      if (typeof v === 'string') { if (!/^[a-z0-9-]{1,20}$/i.test(v)) return null; }
      else if (typeof v === 'number') { if (!isFinite(v) || Math.abs(v) > 1000) return null; }
      else if (Array.isArray(v)) {
        if (v.length > MAX_WORDS) return null;
        for (var w = 0; w < v.length; w++) if (typeof v[w] !== 'string' || !WORD_RE.test(v[w])) return null;
        v = v.slice();
      }
      else if (typeof v !== 'boolean') return null;
      settings[key] = v;
    }
    programs.push({ id: String(item.id), settings: settings });
  }
  return { code: code, picks: p.picks === 'staff' ? 'staff' : 'student', programs: programs };
}

/* ---------- Sheet ---------- */

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['code', 'playlist', 'updated']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRow(code) {
  var sheet = getSheet();
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var values = sheet.getRange(2, 1, last - 1, 2).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).toUpperCase() === code) return { index: i + 2, json: values[i][1] };
  }
  return null;
}

function allCodes() {
  var sheet = getSheet();
  var last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return String(r[0]).toUpperCase(); });
}

/* ---------- Helpers ---------- */

function passcodeOk(given) {
  var real = PropertiesService.getScriptProperties().getProperty('STAFF_PASSCODE');
  return !!real && typeof given === 'string' && given === real;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Run this once from the editor (Run > setup) to create the sheet tab.
function setup() {
  getSheet();
}
