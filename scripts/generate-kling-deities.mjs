import { createHmac } from "crypto";
import fs from "fs";
import path from "path";
import {
  ART_RELEASE,
  buildPosterPrompt,
  DEITY_IDS,
  POSTER_NEGATIVE
} from "./deity-art-direction.mjs";

const REPO_ROOT = "/Users/apple/Documents/New project555";
const KLING_ENV_FILE = "/Users/apple/memory-card/.env.local";
const OUTPUT_DIR = path.join(REPO_ROOT, "output/kling");
const PUBLIC_DIR = path.join(REPO_ROOT, "public/deity-posters");
const OUTPUT_VERSION = ART_RELEASE;
const selectedIds = process.argv.slice(2);

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

const DEITIES = DEITY_IDS.filter((id) => selectedIds.length === 0 || selectedIds.includes(id)).map((id) => ({
  id,
  name: id.charAt(0).toUpperCase() + id.slice(1),
  prompt: buildPosterPrompt(id)
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
      negative_prompt: POSTER_NEGATIVE,
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
    name: deity.name,
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
      const imagePath = path.join(OUTPUT_DIR, `${task.id}-poster-${OUTPUT_VERSION}.png`);
      const publicPath = path.join(PUBLIC_DIR, `${task.id}-poster.png`);
      fs.writeFileSync(imagePath, bytes);
      fs.writeFileSync(publicPath, bytes);
      return {
        ...task,
        status,
        imageUrl: url,
        imagePath,
        publicPath
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
  const env = loadEnv(KLING_ENV_FILE);
  const apiKey = env.KLING_API_KEY || "";
  const apiSecret = env.KLING_API_SECRET || "";
  const baseUrl = env.KLING_BASE_URL || "https://api-beijing.klingai.com";

  if (!apiKey || !apiSecret) {
    throw new Error("KLING_API_KEY / KLING_API_SECRET missing");
  }

  console.log(`Submitting ${DEITIES.length} deity poster tasks (${OUTPUT_VERSION})...`);
  const tasks = [];
  for (const deity of DEITIES) {
    const task = await submitTask({ baseUrl, apiKey, apiSecret, deity });
    tasks.push(task);
    console.log(`${deity.id}: submitted ${task.taskId}`);
  }

  const results = [];
  for (const task of tasks) {
    const result = await pollTask({ baseUrl, apiKey, apiSecret, task });
    results.push(result);
    console.log(`${task.id}: saved ${result.imagePath}`);
  }

  const manifestPath = path.join(OUTPUT_DIR, "deity-manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseUrl,
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
