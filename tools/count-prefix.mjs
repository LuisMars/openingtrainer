#!/usr/bin/env node
// Literal move-order counts under chosen opening prefixes, per rating band.
// tools/count-replies.mjs stops at the first reply the repertoire does not
// answer (research/METHOD.md, "The probe tree's blind spot"), so it can say how
// often a gap is met but not what follows it. This tool reads the same dump and
// counts, for every prefix of each game that starts with one of the given roots
// (up to ply 16), the next move played, split into the three bands of
// METHOD.md (average of WhiteElo and BlackElo: <= 1499.5, <= 1899.5, above).
// It matches SAN text, not positions: transpositions are NOT merged, so a count
// here is a floor for the position and is read that way. Used to choose the
// opponent's moves in the W6 content batch (research/W6-content-batch.md).
//
//   node tools/count-prefix.mjs --out <file.json> "d4 e5" "e4 g6 Bc4" ...
// Output: { "<prefix>": [[nextSan, [u1500, 1500-1899, 1900+]], ...] }, entries
// seen fewer than 3 times dropped.
// literal move-order prefix counts under chosen roots, per rating band (avg Elo like METHOD.md)
import { createReadStream, writeFileSync, openSync, readSync, closeSync, statSync } from "node:fs";
import { PassThrough } from "node:stream";
import { createInterface } from "node:readline";
import { createZstdDecompress } from "node:zlib";
const oi = process.argv.indexOf("--out");
const OUT = oi > 0 ? process.argv[oi + 1] : "prefix.json";
const ROOTS = process.argv.slice(2).filter((a, i, v) => a !== "--out" && v[i - 1] !== "--out").map(s => s.split(" "));
const MAXPLY = 16;
const T = new Map();
const add = (pre, nxt, b) => { let m = T.get(pre); if (!m) T.set(pre, m = new Map()); const c = m.get(nxt) || [0,0,0]; c[b]++; m.set(nxt, c); };
let we, be, n = 0;
const rl = createInterface({ input: zstdStream(new URL("../data-src/games/lichess_db_standard_rated_2014-01.pgn.zst", import.meta.url).pathname), crlfDelay: Infinity });
for await (const line of rl) {
  if (line.startsWith("[WhiteElo ")) we = +line.split('"')[1];
  else if (line.startsWith("[BlackElo ")) be = +line.split('"')[1];
  else if (line.startsWith("1.")) {
    n++;
    if (!(we > 0 && be > 0)) continue;
    const a = (we + be) / 2, b = a <= 1499.5 ? 0 : a <= 1899.5 ? 1 : 2;
    const toks = line.replace(/\{[^}]*\}/g, "").split(/\s+/).filter(t => t && !/^\d+\.+$/.test(t) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t)).map(t => t.replace(/^\d+\.+/, "").replace(/[!?]+$/, ""));
    for (const r of ROOTS) {
      if (r.every((m, i) => toks[i] === m)) {
        for (let i = r.length; i < Math.min(MAXPLY, toks.length); i++) add(toks.slice(0, i).join(" "), toks[i], b);
        add(toks.slice(0, Math.min(MAXPLY, toks.length)).join(" "), "$", b);
      }
    }
  }
}
const out = {};
for (const [k, m] of T) { const e = [...m].map(([s, c]) => [s, c]).filter(([, c]) => c[0] + c[1] + c[2] >= 3); if (e.length) out[k] = e.sort((x, y) => y[1][1] - x[1][1]); }
writeFileSync(OUT, JSON.stringify(out));
console.log("games", n, "prefixes", Object.keys(out).length);

function zstdStream(file) {
  const o = new PassThrough();
  (async () => {
    const size = statSync(file).size, head = Buffer.alloc(8);
    let off = 0;
    const fd = openSync(file, "r");
    try {
      while (off < size - 8) {
        readSync(fd, head, 0, 8, off);
        const magic = head.readUInt32LE(0);
        if (magic >= 0x184d2a50 && magic <= 0x184d2a5f) { off += 8 + head.readUInt32LE(4); continue; }
        const dec = createZstdDecompress(), src = createReadStream(file, { start: off });
        let done = false;
        dec.on("error", (e) => { if (!done) o.destroy(e); });
        const resume = () => dec.resume();
        dec.on("data", (c) => { if (!o.write(c)) dec.pause(); });
        o.on("drain", resume);
        src.pipe(dec);
        await new Promise((res) => dec.once("end", res));
        done = true;
        off += dec.bytesWritten;
        o.off("drain", resume);
        src.destroy(); dec.destroy();
      }
    } finally { closeSync(fd); o.end(); }
  })().catch((e) => o.destroy(e));
  return o;
}
