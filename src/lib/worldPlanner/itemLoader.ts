import { GTItem } from './types';

const CFG = {
  user: 'kabuokis',
  repo: 'growtopia-data',
  ver: '5.42',
  tile: 32,
};

const VERSIONS = ['5.42', '5.41', '5.40', '5.39', '5.38', '5.37', '5.36', '5.35'];

const RAW = `https://raw.githubusercontent.com/${CFG.user}/${CFG.repo}/main`;
let TEX = `${RAW}/${CFG.ver}/decoded/textures/`;

export function getTextureUrl(): string { return TEX; }
export function getVersions(): string[] { return VERSIONS; }
export function getCurrentVersion(): string { return CFG.ver; }
export function setVersion(ver: string) {
  if (VERSIONS.includes(ver)) {
    CFG.ver = ver;
    TEX = `${RAW}/${CFG.ver}/decoded/textures/`;
  }
}

export function pngName(fn: string): string | null {
  if (!fn) return null;
  const b = fn.replace(/\.rttex$/i, '');
  if (/^player_(feet|handitem|longhanditem|cosmetics)/i.test(b)) return b + '_icon.png';
  return b + '.png';
}

function parseItems(txt: string): GTItem[] {
  const out: GTItem[] = [];
  for (const raw of txt.split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('id ')) continue;
    const p = l.split('|').map(s => s.trim());
    if (p.length < 6 || isNaN(+p[0])) continue;
    out.push({
      id: +p[0], type: +p[2] || 0, name: p[4] || '', file_name: p[5] || '',
      tex_x: +p[9] || 0, tex_y: +p[10] || 0, spread_type: +p[11] || 0,
      layer: +p[12] || 0, collision: +p[13] || 0, clothing_type: +p[16] || 0,
      bg_col: +p[30] || 0, bloom_time: +p[34] || 0,
    });
  }
  return out;
}

function isSeed(it: GTItem): boolean { return it.type !== 38 && it.bloom_time !== 0; }
function isCloth(it: GTItem): boolean {
  if (it.type === 20 || it.clothing_type > 0) return true;
  return /player_(feet|handitem|longhanditem|cosmetics)/i.test(it.file_name || '');
}

export function isPlaceable(it: GTItem): boolean {
  if (!it.name || it.name === 'Blank' || it.id === 0) return false;
  if (!it.file_name) return false;
  const BAD_TYPES = new Set([1, 2, 4, 8, 28, 37, 38]);
  if (BAD_TYPES.has(it.type) || it.type === 20) return false;
  if (isCloth(it) || isSeed(it)) return false;
  return true;
}

export function autoLayer(it: GTItem): 0 | 1 {
  if (it.type === 18 || it.type === 15) return 0;
  if (it.type === 10 || it.type === 17 || it.type === 41 || it.type === 62) return 1;
  if (it.collision === 0 && it.layer === 0) return 0;
  return 1;
}

export function getPaintColor(it: GTItem): string | null {
  if (!it.name.toLowerCase().includes('paint')) return null;
  if (it.id === 3492) return null; // Varnish
  // Convert BBGGRRAA to RRGGBB
  const c = it.bg_col >>> 0;
  const b = (c >> 24) & 0xFF;
  const g = (c >> 16) & 0xFF;
  const r = (c >> 8) & 0xFF;
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export async function loadItems(): Promise<GTItem[]> {
  const url = `${RAW}/${CFG.ver}/decoded/items.dat.txt`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('Failed to load items data');
  const txt = await resp.text();
  return parseItems(txt);
}

// Image cache
const imageCache: Record<string, HTMLImageElement> = {};

export function getImage(fileName: string): HTMLImageElement | null {
  if (!fileName) return null;
  const p = pngName(fileName);
  if (!p) return null;
  if (imageCache[p]) return imageCache[p];
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = TEX + p;
  imageCache[p] = img;
  return img;
}

export function isImageLoaded(img: HTMLImageElement | null): boolean {
  return !!(img && img.complete && img.naturalWidth > 0);
}

export function clearImageCache() {
  Object.keys(imageCache).forEach(k => delete imageCache[k]);
}
