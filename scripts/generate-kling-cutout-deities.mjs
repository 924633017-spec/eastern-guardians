import { createHmac } from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import {
  ART_RELEASE,
  buildCutoutPrompt,
  CUTOUT_NEGATIVE,
  DEITY_IDS
} from "./deity-art-direction.mjs";

const REPO_ROOT = "/Users/apple/Documents/New project555";
const KLING_ENV_FILE = "/Users/apple/memory-card/.env.local";
const OUTPUT_DIR = path.join(REPO_ROOT, "output/kling-cutouts");
const PUBLIC_DIR = path.join(REPO_ROOT, "public/deities");
const OUTPUT_VERSION = ART_RELEASE;
const CHROMA_HEX = "#5C00FF";
const rawArgs = process.argv.slice(2);
const reuseSourceOnly = rawArgs.includes("--reuse-source");
const selectedIds = rawArgs.filter((arg) => arg !== "--reuse-source");

function loadEnv(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    env[key] = value;
  }
  return env;
}

function createJwt(apiKey, apiSecret) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: apiKey,
      exp: now + 1800,
      nbf: now - 5
    })
  ).toString("base64url");
  const signature = createHmac("sha256", apiSecret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
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

function getColorDistance(r, g, b, border) {
  return Math.sqrt((r - border.r) ** 2 + (g - border.g) ** 2 + (b - border.b) ** 2);
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

function floodSelectConnectedBackground(data, info, border) {
  const width = info.width;
  const height = info.height;
  const visited = new Uint8Array(width * height);
  const backgroundMask = new Uint8Array(width * height);
  const queue = [];
  const borderSamples = collectBorderSamples(data, info);
  const { centers, backgroundClusterIds } = buildBackgroundClusters(borderSamples);
  const MODEL_THRESHOLD = 68;
  const STEP_THRESHOLD = 26;

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
      if (backgroundClusterIds.has(match.index) && match.distance < MODEL_THRESHOLD) {
        enqueue(x, y);
      }
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (const x of [0, width - 1]) {
      const pixel = readPixel(x, y);
      const match = nearestCenter(pixel, centers);
      if (backgroundClusterIds.has(match.index) && match.distance < MODEL_THRESHOLD) {
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
    if (!backgroundClusterIds.has(currentMatch.index) || currentMatch.distance >= MODEL_THRESHOLD) {
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
        nextMatch.distance < MODEL_THRESHOLD &&
        stepDistance < STEP_THRESHOLD
      ) {
        enqueue(nx, ny);
      }
    }
  }

  return backgroundMask;
}

async function removeChromaKey(inputPath, outputPath) {
  const image = sharp(inputPath);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = Buffer.from(data);
  const border = sampleBorderColor(result, info);
  const backgroundMask = floodSelectConnectedBackground(result, info, border);
  const HARD_CUT = 24;
  const SOFT_CUT = 54;

  for (let i = 0; i < result.length; i += 4) {
    const pixelIndex = i / 4;
    if (!backgroundMask[pixelIndex]) {
      continue;
    }

    const r = result[i];
    const g = result[i + 1];
    const b = result[i + 2];
    const distance = getColorDistance(r, g, b, border);
    if (distance < HARD_CUT) {
      result[i + 3] = 0;
      continue;
    }

    if (distance < SOFT_CUT) {
      const alpha = Math.max(0, Math.min(255, Math.round(((distance - HARD_CUT) / (SOFT_CUT - HARD_CUT)) * 255)));
      result[i + 3] = Math.min(result[i + 3], alpha);
    }
  }
  await sharp(result, { raw: info }).png().toFile(outputPath);
}

const DEITIES = DEITY_IDS.filter((id) => selectedIds.length === 0 || selectedIds.includes(id)).map((id) => ({
  id,
  prompt: buildCutoutPrompt(id, CHROMA_HEX)
}));

async function submitTask({ baseUrl, apiKey, apiSecret, deity }) {
  const token = createJwt(apiKey, apiSecret);
  const response = await fetch(`${baseUrl}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      model_name: "kling-v2-1",
      prompt: deity.prompt,
      negative_prompt: CUTOUT_NEGATIVE,
      n: 1,
      aspect_ratio: "9:16"
    })
  });
  const data = await response.json();
  if (data.code !== 0) {
    throw new Error(`${deity.id} submit failed: ${JSON.stringify(data)}`);
  }
  return {
    id: deity.id,
    prompt: deity.prompt,
    taskId: data.data.task_id
  };
}

async function pollTask({ baseUrl, apiKey, apiSecret, task }) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const token = createJwt(apiKey, apiSecret);
    const response = await fetch(`${baseUrl}/v1/images/generations/${task.taskId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await response.json();
    const status = data?.data?.task_status ?? "unknown";
    console.log(`${task.id}: poll ${attempt + 1} -> ${status}`);

    if (status === "succeed") {
      const url = data?.data?.task_result?.images?.[0]?.url;
      if (!url) {
        throw new Error(`${task.id} succeeded without image url`);
      }
      const imageResponse = await fetch(url);
      const bytes = Buffer.from(await imageResponse.arrayBuffer());
      const sourcePath = path.join(OUTPUT_DIR, `${task.id}-${OUTPUT_VERSION}-source.png`);
      const transparentPath = path.join(PUBLIC_DIR, `${task.id}.png`);
      fs.writeFileSync(sourcePath, bytes);
      await removeChromaKey(sourcePath, transparentPath);
      return {
        ...task,
        status,
        sourcePath,
        transparentPath
      };
    }

    if (status === "failed") {
      throw new Error(`${task.id} failed: ${JSON.stringify(data)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error(`${task.id} timed out`);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  if (reuseSourceOnly) {
    for (const deity of DEITIES) {
      const sourcePath = path.join(OUTPUT_DIR, `${deity.id}-${OUTPUT_VERSION}-source.png`);
      const transparentPath = path.join(PUBLIC_DIR, `${deity.id}.png`);
      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Missing local source for ${deity.id}: ${sourcePath}`);
      }
      await removeChromaKey(sourcePath, transparentPath);
      console.log(`${deity.id}: rebuilt ${transparentPath} from local source`);
    }
    return;
  }

  const env = loadEnv(KLING_ENV_FILE);
  const apiKey = env.KLING_API_KEY || "";
  const apiSecret = env.KLING_API_SECRET || "";
  const baseUrl = env.KLING_BASE_URL || "https://api-beijing.klingai.com";

  if (!apiKey || !apiSecret) {
    throw new Error("KLING_API_KEY / KLING_API_SECRET missing");
  }

  const tasks = [];
  console.log(`Submitting ${DEITIES.length} cutout deity tasks (${OUTPUT_VERSION})...`);
  for (const deity of DEITIES) {
    const task = await submitTask({ baseUrl, apiKey, apiSecret, deity });
    tasks.push(task);
    console.log(`${deity.id}: submitted ${task.taskId}`);
  }

  const results = [];
  for (const task of tasks) {
    const result = await pollTask({ baseUrl, apiKey, apiSecret, task });
    results.push(result);
    console.log(`${task.id}: saved ${result.transparentPath}`);
  }

  const manifestPath = path.join(OUTPUT_DIR, "cutout-manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        chromaKey: CHROMA_HEX,
        outputVersion: OUTPUT_VERSION,
        results
      },
      null,
      2
    )
  );

  console.log(`Done. Manifest: ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
