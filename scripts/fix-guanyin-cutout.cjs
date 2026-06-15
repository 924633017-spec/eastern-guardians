const sharp = require("sharp");

async function main() {
  const path = "/Users/apple/Documents/New project555/public/deities/guanyin.png";
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.from(data);
  const width = info.width;
  const height = info.height;

  const index = (x, y) => (y * width + x) * 4;
  const visited = new Uint8Array(width * height);
  const queue = [];

  const border = [];
  for (let x = 0; x < width; x += 8) {
    for (const y of [0, height - 1]) {
      const i = index(x, y);
      border.push({ r: out[i], g: out[i + 1], b: out[i + 2] });
    }
  }
  for (let y = 0; y < height; y += 8) {
    for (const x of [0, width - 1]) {
      const i = index(x, y);
      border.push({ r: out[i], g: out[i + 1], b: out[i + 2] });
    }
  }

  const avg = border.reduce(
    (acc, px) => ({ r: acc.r + px.r, g: acc.g + px.g, b: acc.b + px.b }),
    { r: 0, g: 0, b: 0 }
  );
  avg.r /= border.length;
  avg.g /= border.length;
  avg.b /= border.length;

  function distance(r, g, b) {
    return Math.sqrt((r - avg.r) ** 2 + (g - avg.g) ** 2 + (b - avg.b) ** 2);
  }

  function saturation(r, g, b) {
    return Math.max(r, g, b) - Math.min(r, g, b);
  }

  function brightness(r, g, b) {
    return (r + g + b) / 3;
  }

  function canTreatAsBackground(x, y) {
    const i = index(x, y);
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const d = distance(r, g, b);
    const s = saturation(r, g, b);
    const v = brightness(r, g, b);

    if (v < 235) return false;
    if (s > 28) return false;
    if (d > 24) return false;

    return true;
  }

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const key = y * width + x;
    if (visited[key]) return;
    if (!canTreatAsBackground(x, y)) return;
    visited[key] = 1;
    queue.push([x, y]);
  }

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    const i = index(x, y);
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    const d = distance(r, g, b);

    if (d < 12) {
      out[i + 3] = 0;
    } else {
      const alpha = Math.round(((d - 12) / (24 - 12)) * 255);
      out[i + 3] = Math.max(0, Math.min(out[i + 3], alpha));
    }

    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }

  await sharp(out, { raw: info }).png().toFile(path);
  console.log("Fixed Guanyin cutout");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
