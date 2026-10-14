// Copies files the web (PWA) build serves from public/ but that come from
// node_modules: the QR decoder used on browsers without a built-in one.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const pub = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(pub, { recursive: true });
copyFileSync(require.resolve("zxing-wasm/reader/zxing_reader.wasm"), join(pub, "zxing_reader.wasm"));
