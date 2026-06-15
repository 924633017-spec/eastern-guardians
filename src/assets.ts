import type { Deity } from "./data";

const ASSET_RELEASE = "20260614a";

function withVersion(path: string) {
  return `${path}?v=${ASSET_RELEASE}`;
}

export function getDeityCutoutSrc(id: Deity["id"]) {
  return withVersion(`/deities/${id}.png`);
}

export function getDeityPosterSrc(id: Deity["id"]) {
  return withVersion(`/deity-posters/${id}-poster.png`);
}
