// Bootstrap for the engine's pthread workers under Node. lila-stockfish-web
// ships web-only builds: each pthread is spawned as a Worker running
// sf16-7.js itself, which reads self.location.href — a browser global Node's
// worker_threads (via the web-worker shim) does not provide. Define it, then
// load the real engine module. Used only by tools/build-evals.mjs.
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const target = pathToFileURL(
  createRequire(import.meta.url).resolve("lila-stockfish-web/sf16-7.js")).href;
if (!globalThis.location) globalThis.location = { href: target };
await import(target);
