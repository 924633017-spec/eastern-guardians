import path from "path";
import sharp from "sharp";

const REPO_ROOT = "/Users/apple/Documents/New project555";
const SOURCE_DIR = path.join(REPO_ROOT, "public/deities");
const FILES = ["guanyin", "caishen", "yuelao", "wenchang", "mazu"];

function getColorDistance(r, g, b, target) {
  return Math.sqrt((r - target.r) ** 2 + (g - target.g) ** 2 + (b - target.b) ** 2);
}

function sampleBorderColor(data, info) {
  const inset = 8;
  const points = [];

  for (let x = inset; x < info.width - inset; x += 24) {
    points.push([x, inset]);
    points.push([x, info.height - inset - 1]);
  }

  for (let y = inset; y < info.height - inset; y += 24) {
    points.push([inset, y]);
    points.push([info.width - inset - 1, y]);
  }

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  for (const [x, y] of points) {
    const index = (y * info.width + x) * 4;
    totalR += data[index];
    totalG += data[index + 1];
    totalB += data[index + 2];
  }

  const count = Math.max(points.length, 1);
  return {
    r: totalR / count,
    g: totalG / count,
    b: totalB / count
  };
}

function collectBorderSamples(data, info) {
  const width = info.width;
  const height = info.height;
  const samples = [];
  const stride = 6;

  function pushSample(x, y) {
    const index = (y * width + x) * 4;
    samples.push({
      x,
      y,
      r: data[index],
      g: data[index + 1],
      b: data[index + 2]
    });
  }

  for (let x = 0; x < width; x += stride) {
    pushSample(x, 0);
    pushSample(x, height - 1);
  }

  for (let y = 0; y < height; y += stride) {
    pushSample(0, y);
    pushSample(width - 1, y);
  }

  return samples;
}

function nearestCenter(pixel, centers) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < centers.length; i += 1) {
    const center = centers[i];
    const distance = getColorDistance(pixel.r, pixel.g, pixel.b, center);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return { index: bestIndex, distance: bestDistance };
}

function buildBackgroundClusters(samples) {
  const clusterCount = Math.min(4, Math.max(2, Math.floor(samples.length / 40)));
  const centers = [];

  for (let i = 0; i < clusterCount; i += 1) {
    const sample = samples[Math.floor((i / clusterCount) * (samples.length - 1))];
    centers.push({ r: sample.r, g: sample.g, b: sample.b });
  }

  for (let iteration = 0; iteration < 10; iteration += 1) {
    const totals = centers.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

    for (const sample of samples) {
      const { index } = nearestCenter(sample, centers);
      const bucket = totals[index];
      bucket.r += sample.r;
      bucket.g += sample.g;
      bucket.b += sample.b;
      bucket.count += 1;
    }

    for (let i = 0; i < centers.length; i += 1) {
      const bucket = totals[i];
      if (bucket.count === 0) continue;
      centers[i] = {
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count
      };
    }
  }

  const clusterStats = centers.map((center, index) => ({
    index,
    center,
    count: 0
  }));

  for (const sample of samples) {
    const { index } = nearestCenter(sample, centers);
    clusterStats[index].count += 1;
  }

  clusterStats.sort((a, b) => b.count - a.count);
  const selected = [];
  let cumulative = 0;
  for (const stat of clusterStats) {
    selected.push(stat.index);
    cumulative += stat.count;
    if (cumulative / samples.length >= 0.72) {
      break;
    }
  }

  return {
    centers,
    backgroundClusterIds: new Set(selected)
  };
}

function floodSelectConnectedBackground(data, info) {
  const width = info.width;
  const height = info.height;
  const visited = new Uint8Array(width * height);
  const backgroundMask = new Uint8Array(width * height);
  const queue = [];
  const borderSamples = collectBorderSamples(data, info);
  const { centers, backgroundClusterIds } = buildBackgroundClusters(borderSamples);
  const modelThreshold = 60;
  const stepThreshold = 24;

  function enqueue(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const key = y * width + x;
    if (visited[key]) return;
    visited[key] = 1;
    queue.push([x, y]);
  }

  function readPixel(x, y) {
    const index = (y * width + x) * 4;
    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2]
    };
  }

  for (let x = 0; x < width; x += 1) {
    for (const y of [0, height - 1]) {
      const pixel = readPixel(x, y);
      const match = nearestCenter(pixel, centers);
      if (backgroundClusterIds.has(match.index) && match.distance < modelThreshold) {
        enqueue(x, y);
      }
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (const x of [0, width - 1]) {
      const pixel = readPixel(x, y);
      const match = nearestCenter(pixel, centers);
      if (backgroundClusterIds.has(match.index) && match.distance < modelThreshold) {
        enqueue(x, y);
      }
    }
  }

  while (queue.length > 0) {
    const [x, y] = queue.shift();
    const key = y * width + x;
    const index = key * 4;
    const current = {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2]
    };
    const currentMatch = nearestCenter(current, centers);
    if (!backgroundClusterIds.has(currentMatch.index) || currentMatch.distance >= modelThreshold) {
      continue;
    }

    backgroundMask[key] = 1;
    for (const [dx, dy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const next = readPixel(nx, ny);
      const nextMatch = nearestCenter(next, centers);
      const stepDistance = getColorDistance(next.r, next.g, next.b, current);
      if (
        backgroundClusterIds.has(nextMatch.index) &&
        nextMatch.distance < modelThreshold &&
        stepDistance < stepThreshold
      ) {
        enqueue(nx, ny);
      }
    }
  }

  return backgroundMask;
}

async function cutout(file) {
  const inputPath = path.join(SOURCE_DIR, `${file}.png`);
  const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = Buffer.from(data);
  const border = sampleBorderColor(result, info);
  const backgroundMask = floodSelectConnectedBackground(result, info);
  const hardCut = 18;
  const softCut = 38;

  for (let i = 0; i < result.length; i += 4) {
    const pixelIndex = i / 4;
    if (!backgroundMask[pixelIndex]) {
      continue;
    }

    const r = result[i];
    const g = result[i + 1];
    const b = result[i + 2];
    const distance = getColorDistance(r, g, b, border);

    if (distance < hardCut) {
      result[i + 3] = 0;
      continue;
    }

    if (distance < softCut) {
      const alpha = Math.max(0, Math.min(255, Math.round(((distance - hardCut) / (softCut - hardCut)) * 255)));
      result[i + 3] = Math.min(result[i + 3], alpha);
    }
  }

  await sharp(result, { raw: info }).png().toFile(inputPath);
  console.log(`Processed ${file}.png with background`, [
    Math.round(border.r),
    Math.round(border.g),
    Math.round(border.b)
  ]);
}

for (const file of FILES) {
  await cutout(file);
}
