/**
 * PWA 用アイコンを生成する。
 *
 * 画像処理ライブラリを足さずに済むよう、Node 標準の zlib だけで PNG を書き出す。
 * 図柄は四角（男性）と円（女性）を線で結び、子へ落とすジェノグラムの縮図。
 *
 *   node scripts/generate-icons.mjs
 */
import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUTPUT_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "icons",
);

const BACKGROUND = [0x16, 0x38, 0x2f];
const INK = [0xfb, 0xfa, 0xf6];
const SUPERSAMPLE = 4;

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

function encodePng(size, rgb) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // color type: truecolor
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 3 + 1);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < size; x += 1) {
      const source = (y * size + x) * 3;
      const target = rowStart + 1 + x * 3;
      raw[target] = rgb[source];
      raw[target + 1] = rgb[source + 1];
      raw[target + 2] = rgb[source + 2];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** 単位座標 (0..1) で図形を描き、スーパーサンプリングして返す。 */
function render(size, scale) {
  const big = size * SUPERSAMPLE;
  const pixels = new Uint8Array(big * big * 3);
  for (let index = 0; index < big * big; index += 1) {
    pixels[index * 3] = BACKGROUND[0];
    pixels[index * 3 + 1] = BACKGROUND[1];
    pixels[index * 3 + 2] = BACKGROUND[2];
  }

  const at = (ux, uy) => ({
    x: (0.5 + (ux - 0.5) * scale) * big,
    y: (0.5 + (uy - 0.5) * scale) * big,
  });
  const unit = (value) => value * scale * big;

  const paint = (x, y, color) => {
    const index = (y * big + x) * 3;
    pixels[index] = color[0];
    pixels[index + 1] = color[1];
    pixels[index + 2] = color[2];
  };

  /** 塗りは線を隠すマスクとして使う（線がノードの内側を貫通しないように） */
  const rect = (ux, uy, half, thickness, color) => {
    const center = at(ux, uy);
    const outer = unit(half);
    const inner = thickness === null ? -1 : outer - unit(thickness);
    for (let y = Math.floor(center.y - outer); y <= center.y + outer; y += 1)
      for (
        let x = Math.floor(center.x - outer);
        x <= center.x + outer;
        x += 1
      ) {
        if (x < 0 || y < 0 || x >= big || y >= big) continue;
        const dx = Math.abs(x - center.x);
        const dy = Math.abs(y - center.y);
        if (dx <= outer && dy <= outer && !(dx <= inner && dy <= inner))
          paint(x, y, color);
      }
  };

  const circle = (ux, uy, radius, thickness, color) => {
    const center = at(ux, uy);
    const outer = unit(radius);
    const inner = thickness === null ? -1 : outer - unit(thickness);
    for (let y = Math.floor(center.y - outer); y <= center.y + outer; y += 1)
      for (
        let x = Math.floor(center.x - outer);
        x <= center.x + outer;
        x += 1
      ) {
        if (x < 0 || y < 0 || x >= big || y >= big) continue;
        const distance = Math.hypot(x - center.x, y - center.y);
        if (distance <= outer && distance >= inner) paint(x, y, color);
      }
  };

  const strokeRect = (ux, uy, half, thickness) => {
    rect(ux, uy, half, null, BACKGROUND);
    rect(ux, uy, half, thickness, INK);
  };

  const strokeCircle = (ux, uy, radius, thickness) => {
    circle(ux, uy, radius, null, BACKGROUND);
    circle(ux, uy, radius, thickness, INK);
  };

  const line = (ax, ay, bx, by, thickness) => {
    const start = at(ax, ay);
    const end = at(bx, by);
    const half = unit(thickness) / 2;
    const minX = Math.floor(Math.min(start.x, end.x) - half);
    const maxX = Math.ceil(Math.max(start.x, end.x) + half);
    const minY = Math.floor(Math.min(start.y, end.y) - half);
    const maxY = Math.ceil(Math.max(start.y, end.y) + half);
    for (let y = minY; y <= maxY; y += 1)
      for (let x = minX; x <= maxX; x += 1)
        if (x >= 0 && y >= 0 && x < big && y < big) paint(x, y, INK);
  };

  const NODE = 0.13;
  const STROKE = 0.035;
  line(0.28, 0.32, 0.72, 0.32, STROKE);
  line(0.5, 0.32, 0.5, 0.68, STROKE);
  strokeRect(0.28, 0.32, NODE, STROKE);
  strokeCircle(0.72, 0.32, NODE, STROKE);
  strokeCircle(0.5, 0.72, NODE * 0.85, STROKE);

  // スーパーサンプルを平均して縮小する（簡易アンチエイリアス）
  const out = new Uint8Array(size * size * 3);
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0];
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1)
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const index =
            ((y * SUPERSAMPLE + sy) * big + (x * SUPERSAMPLE + sx)) * 3;
          totals[0] += pixels[index];
          totals[1] += pixels[index + 1];
          totals[2] += pixels[index + 2];
        }
      const samples = SUPERSAMPLE * SUPERSAMPLE;
      const target = (y * size + x) * 3;
      out[target] = Math.round(totals[0] / samples);
      out[target + 1] = Math.round(totals[1] / samples);
      out[target + 2] = Math.round(totals[2] / samples);
    }
  return out;
}

// maskable はセーフゾーン（中央80%）に収める必要があるため図柄を縮める
const TARGETS = [
  ["icon-192.png", 192, 1],
  ["icon-512.png", 512, 1],
  ["icon-maskable-512.png", 512, 0.62],
  ["apple-touch-icon.png", 180, 0.88],
];

mkdirSync(OUTPUT_DIR, { recursive: true });
for (const [name, size, scale] of TARGETS) {
  writeFileSync(join(OUTPUT_DIR, name), encodePng(size, render(size, scale)));
  console.log(`generated ${name} (${size}px, scale ${scale})`);
}
