/* Small self-contained QR code maker (byte mode, error correction level M, versions 1-10),
   for the playlist QR cards. Follows the QR Code spec (ISO/IEC 18004). No outside requests. */
(function () {
  "use strict";

  var ASD = window.ASD = window.ASD || {};

  // Level M, versions 1-10: error correction codewords per block, and number of blocks.
  var ECC_PER_BLOCK = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
  var NUM_BLOCKS    = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
  var ECL_BITS_M = 0;

  function rawModules(ver) {
    var r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var na = Math.floor(ver / 7) + 2;
      r -= (25 * na - 10) * na - 55;
      if (ver >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(ver) { return Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ver] * NUM_BLOCKS[ver]; }
  function alignPositions(ver) {
    if (ver === 1) return [];
    var na = Math.floor(ver / 7) + 2, size = ver * 4 + 17;
    var step = Math.floor((ver * 8 + na * 3 + 5) / (na * 4 - 4)) * 2;
    var out = [6];
    for (var pos = size - 7; out.length < na; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  /* Reed-Solomon over GF(256), polynomial 0x11D */
  function gmul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z;
  }
  function rsDivisor(deg) {
    var r = []; for (var i = 0; i < deg; i++) r.push(0);
    r[deg - 1] = 1;
    var root = 1;
    for (i = 0; i < deg; i++) {
      for (var j = 0; j < deg; j++) { r[j] = gmul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; }
      root = gmul(root, 0x02);
    }
    return r;
  }
  function rsRemainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ r.shift(); r.push(0);
      div.forEach(function (c, i) { r[i] ^= gmul(c, f); });
    });
    return r;
  }

  function utf8(text) {
    var out = [], s = unescape(encodeURIComponent(text));
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  ASD.qrMatrix = function (text) {
    var bytes = utf8(text), ver;
    for (ver = 1; ver <= 10; ver++) {
      var cap = dataCodewords(ver) * 8, need = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
      if (need <= cap) break;
    }
    if (ver > 10) throw new Error("Text too long for QR card");
    var size = ver * 4 + 17;

    // Data bits
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var capBits = dataCodewords(ver) * 8;
    put(0, Math.min(4, capBits - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = [];
    for (var i = 0; i < bits.length; i += 8) { var v = 0; for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v); }

    // Split into blocks, add error correction, interleave
    var nb = NUM_BLOCKS[ver], eccLen = ECC_PER_BLOCK[ver], raw = Math.floor(rawModules(ver) / 8);
    var numShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    var div = rsDivisor(eccLen), blocks = [], k = 0;
    for (i = 0; i < nb; i++) {
      var dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
      k += dat.length;
      var ecc = rsRemainder(dat, div);
      if (i < numShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var words = [];
    for (i = 0; i < blocks[0].length; i++) {
      for (j = 0; j < blocks.length; j++) {
        if (i !== shortLen - eccLen || j >= numShort) words.push(blocks[j][i]);
      }
    }

    // Function patterns
    var m = [], fn = [];
    for (i = 0; i < size; i++) { m.push([]); fn.push([]); for (j = 0; j < size; j++) { m[i].push(false); fn[i].push(false); } }
    function setF(x, y, dark) { m[y][x] = dark; fn[y][x] = true; }
    for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = c[0] + dx, yy = c[1] + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, d !== 2 && d !== 4);
      }
    });
    var ap = alignPositions(ver), last = ap.length - 1;
    for (i = 0; i < ap.length; i++) for (j = 0; j < ap.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (var dy2 = -2; dy2 <= 2; dy2++) for (var dx2 = -2; dx2 <= 2; dx2++) setF(ap[i] + dx2, ap[j] + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
    }
    function drawFormat(mask) {
      var d = (ECL_BITS_M << 3) | mask, rem = d;
      for (var t = 0; t < 10; t++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var b = ((d << 10) | rem) ^ 0x5412;
      var bit = function (n) { return ((b >>> n) & 1) !== 0; };
      for (var q = 0; q <= 5; q++) setF(8, q, bit(q));
      setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
      for (q = 9; q < 15; q++) setF(14 - q, 8, bit(q));
      for (q = 0; q < 8; q++) setF(size - 1 - q, 8, bit(q));
      for (q = 8; q < 15; q++) setF(8, size - 15 + q, bit(q));
      setF(8, size - 8, true);
    }
    drawFormat(0);   // reserve the format areas
    if (ver >= 7) {
      var rem = ver;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (ver << 12) | rem;
      for (i = 0; i < 18; i++) {
        var bt = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, bb = Math.floor(i / 3);
        setF(a, bb, bt); setF(bb, a, bt);
      }
    }

    // Codewords, in the zigzag order
    var n = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && n < words.length * 8) { m[y][x] = ((words[n >>> 3] >>> (7 - (n & 7))) & 1) !== 0; n++; }
      }
    }

    // Try each mask, keep the one with the lowest penalty
    function maskBit(mask, x, y) {
      switch (mask) {
        case 0: return (x + y) % 2 === 0;
        case 1: return y % 2 === 0;
        case 2: return x % 3 === 0;
        case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
        case 5: return x * y % 2 + x * y % 3 === 0;
        case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
        default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
      }
    }
    function applyMask(mask) {
      for (var yy = 0; yy < size; yy++) for (var xx = 0; xx < size; xx++) if (!fn[yy][xx] && maskBit(mask, xx, yy)) m[yy][xx] = !m[yy][xx];
    }
    function penalty() {
      var p = 0, dark = 0, yy, xx, run, line;
      var lines = [];
      for (yy = 0; yy < size; yy++) { line = []; for (xx = 0; xx < size; xx++) line.push(m[yy][xx]); lines.push(line); }
      for (xx = 0; xx < size; xx++) { line = []; for (yy = 0; yy < size; yy++) line.push(m[yy][xx]); lines.push(line); }
      lines.forEach(function (l) {
        run = 1;
        for (var t = 1; t <= l.length; t++) {
          if (t < l.length && l[t] === l[t - 1]) run++;
          else { if (run >= 5) p += run - 2; run = 1; }
        }
        var str = l.map(function (c) { return c ? "1" : "0"; }).join("");
        var re = /(?=(10111010000|00001011101))/g;
        while (re.exec(str)) { p += 40; re.lastIndex++; }
      });
      for (yy = 0; yy < size - 1; yy++) for (xx = 0; xx < size - 1; xx++) {
        var c = m[yy][xx];
        if (c === m[yy][xx + 1] && c === m[yy + 1][xx] && c === m[yy + 1][xx + 1]) p += 3;
      }
      for (yy = 0; yy < size; yy++) for (xx = 0; xx < size; xx++) if (m[yy][xx]) dark++;
      p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      applyMask(mk); drawFormat(mk);
      var pp = penalty();
      if (pp < bestP) { bestP = pp; best = mk; }
      applyMask(mk);   // undo (XOR)
    }
    applyMask(best); drawFormat(best);
    return m;
  };

  // QR code as an SVG string, with the standard 4-module quiet zone.
  ASD.qrSvg = function (text) {
    var m = ASD.qrMatrix(text), size = m.length, border = 4, d = "";
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (m[y][x]) d += "M" + (x + border) + "," + (y + border) + "h1v1h-1z";
    var full = size + border * 2;
    return '<svg viewBox="0 0 ' + full + " " + full + '" role="img" aria-label="QR code" shape-rendering="crispEdges">' +
      '<rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  };
})();
