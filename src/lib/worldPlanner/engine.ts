import { GTItem, Tool, LayerMode, ViewState, ClipboardCell } from './types';
import { getImage, isImageLoaded, getBlockCategory, pngName, getPaintColor } from './itemLoader';
import { ST2, ST5, ST14, bestAutotile, bestAutotileAxis } from './autotile';

const T = 32; // tile size
const CELL = 32;
const MINZ = 0.08;
const MAXZ = 10;

export interface EngineCallbacks {
  onStatsUpdate: (blocks: number) => void;
  onCoordUpdate: (x: number, y: number) => void;
  onToolChange: (tool: Tool) => void;
  onItemPick: (item: GTItem) => void;
  onHistoryChange: (canUndo: boolean, canRedo: boolean) => void;
  onWrench?: (item: GTItem, wx: number, wy: number, layer: number) => void;
  onSelectionChange?: (hasSelection: boolean) => void;
}

interface WorldSnapshot {
  world: (number | null)[][][];
  paint: (number | null)[][];
  overrides: Record<string, { tx: number, ty: number }>;
}

export class WorldPlannerEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  world: (number | null)[][][]; // [layer][y][x]
  paintGrid: (number | null)[][]; // [y][x]
  overrides: Record<string, { tx: number, ty: number }> = {}; // "l,x,y" -> {tx, ty}
  items: GTItem[] = [];
  itemMap: Record<number, GTItem> = {};
  nameMap: Record<string, GTItem> = {};

  view: ViewState = { x: 0, y: 0, zoom: 1 };
  tool: Tool = 'pencil';
  layerMode: LayerMode = 'auto';
  selectedItem: GTItem | null = null;
  showGrid = true;

  selection: { x0: number, y0: number, x1: number, y1: number } | null = null;
  clipboard: ClipboardCell[] = [];

  private history: WorldSnapshot[] = [];
  private histIdx = -1;
  private readonly HIST_MAX = 60;
  private callbacks: EngineCallbacks;

  private dragging = false;
  private dragStart = { x: 0, y: 0 };
  private viewStart = { x: 0, y: 0 };
  private drawing = false;
  private lastCell = { x: -1, y: -1 };
  private lastMousePos = { x: 0, y: 0 };
  private shapeStart: { x: number; y: number } | null = null;
  private deleteLayer: 0 | 1 | null = null; // Track which layer to delete from during drag

  private previewCanvas: HTMLCanvasElement | null = null;
  private pvCtx: CanvasRenderingContext2D | null = null;
  private rafPending = false;
  private spaceDown = false;

  // Tile cache
  private tileCache = new Map<string, HTMLCanvasElement>();
  private retryInterval: ReturnType<typeof setInterval> | null = null;

  constructor(canvas: HTMLCanvasElement, width: number, height: number, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.width = width;
    this.height = height;
    this.callbacks = callbacks;
    this.world = [
      Array.from({ length: height }, () => new Array(width).fill(null)),
      Array.from({ length: height }, () => new Array(width).fill(null)),
    ];
    this.paintGrid = Array.from({ length: height }, () => new Array(width).fill(null));
    this.snapshot();
    this.bindEvents();
    this.startRetryLoop();
  }

  setPreviewCanvas(c: HTMLCanvasElement) {
    this.previewCanvas = c;
    this.pvCtx = c.getContext('2d');
  }

  setItems(items: GTItem[]) {
    this.items = items;
    this.itemMap = {};
    this.nameMap = {};
    items.forEach(it => {
      this.itemMap[it.id] = it;
      this.nameMap[it.name] = it;
    });
  }

  setTool(t: Tool) {
    this.tool = t;
    this.shapeStart = null;
    this.clearPreview();
    this.updateCursor();
    this.callbacks.onToolChange(t);
  }

  setLayer(l: LayerMode) { this.layerMode = l; }
  setSelectedItem(it: GTItem | null) { this.selectedItem = it; }

  private updateCursor() {
    if (this.tool === 'pan') this.canvas.style.cursor = this.dragging ? 'grabbing' : 'grab';
    else if (this.tool === 'eyedrop') this.canvas.style.cursor = 'cell';
    else if (this.tool === 'fill') this.canvas.style.cursor = 'copy';
    else this.canvas.style.cursor = 'crosshair';
  }

  resize(w: number, h: number) {
    this.canvas.width = w;
    this.canvas.height = h;
    if (this.previewCanvas) {
      this.previewCanvas.width = w;
      this.previewCanvas.height = h;
    }
    this.schedRender();
  }

  fitView() {
    const m = 40;
    const sx = (this.canvas.width - m * 2) / (this.width * CELL);
    const sy = (this.canvas.height - m * 2) / (this.height * CELL);
    this.view.zoom = Math.max(MINZ, Math.min(MAXZ, Math.min(sx, sy)));
    this.view.x = (this.canvas.width - this.width * CELL * this.view.zoom) / 2;
    this.view.y = (this.canvas.height - this.height * CELL * this.view.zoom) / 2;
  }

  private clamp() {
    const wp = this.width * CELL * this.view.zoom;
    const hp = this.height * CELL * this.view.zoom;
    const m = Math.max(this.canvas.width, this.canvas.height) * 0.65;
    this.view.x = Math.min(m, Math.max(this.view.x, this.canvas.width - wp - m));
    this.view.y = Math.min(m, Math.max(this.view.y, this.canvas.height - hp - m));
  }

  private s2w(sx: number, sy: number) {
    return {
      x: Math.floor((sx - this.view.x) / (CELL * this.view.zoom)),
      y: Math.floor((sy - this.view.y) / (CELL * this.view.zoom)),
    };
  }

  private inBounds(wx: number, wy: number) {
    return wx >= 0 && wx < this.width && wy >= 0 && wy < this.height;
  }

  // Tile rendering
  private getTileCacheKey(it: GTItem, sz: number, tx: number, ty: number) {
    return `${it.id}_${sz}_${tx}_${ty}`;
  }

  private getCachedTile(it: GTItem, sz: number, tx: number, ty: number): HTMLCanvasElement {
    const key = this.getTileCacheKey(it, sz, tx, ty);
    const cached = this.tileCache.get(key);
    if (cached) return cached;
    const oc = document.createElement('canvas');
    oc.width = sz; oc.height = sz;
    this.drawTile(oc.getContext('2d')!, it, 0, 0, sz, tx, ty);
    this.tileCache.set(key, oc);
    return oc;
  }

  private drawTile(ctx: CanvasRenderingContext2D, it: GTItem, dx: number, dy: number, sz: number, tx: number, ty: number) {
    const isIcon = /player_(feet|handitem|longhanditem|cosmetics)/i.test(it.file_name || '');
    const im = getImage(it.file_name);
    if (!im || !isImageLoaded(im)) {
      ctx.fillStyle = '#1e2736';
      ctx.fillRect(dx, dy, sz, sz);
      ctx.fillStyle = 'rgba(255,255,255,.2)';
      ctx.font = `bold ${Math.max(5, sz / 4)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', dx + sz / 2, dy + sz / 2);
      return;
    }

    let px: number, py: number;
    if (isIcon) {
      const isFeet = /player_feet/i.test(it.file_name || '');
      px = it.tex_x * T;
      py = (isFeet ? it.tex_y * 2 : it.tex_y) * T;
    } else {
      px = tx * T;
      py = ty * T;
    }

    if (px + T > im.naturalWidth || py + T > im.naturalHeight) {
      // Fallback: draw from base coords if variation is out of bounds
      const bx = it.tex_x * T, by = it.tex_y * T;
      if (bx + T <= im.naturalWidth && by + T <= im.naturalHeight) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(im, bx, by, T, T, dx, dy, sz, sz);
      } else {
        ctx.fillStyle = '#1e2736';
        ctx.fillRect(dx, dy, sz, sz);
      }
      return;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, px, py, T, T, dx, dy, sz, sz);
  }

  clearTileCache() { this.tileCache.clear(); }

  // Rendering
  schedRender() {
    if (this.rafPending) return;
    this.rafPending = true;
    requestAnimationFrame(() => {
      this.rafPending = false;
      this.render();
    });
  }

  private render() {
    const W = this.canvas.width, H = this.canvas.height;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    // Background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#87CEEB');
    grad.addColorStop(1, '#5BA3D9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const cz = CELL * this.view.zoom;
    const sx = Math.max(0, Math.floor(-this.view.x / cz));
    const sy = Math.max(0, Math.floor(-this.view.y / cz));
    const ex = Math.min(this.width, Math.ceil((W - this.view.x) / cz) + 1);
    const ey = Math.min(this.height, Math.ceil((H - this.view.y) / cz) + 1);
    const sz = Math.max(1, Math.round(cz));
    const tSz = Math.ceil(cz);

    // BG layer
    for (let wy = sy; wy < ey; wy++) {
      for (let wx = sx; wx < ex; wx++) {
        const id = this.world[0][wy][wx];
        if (id == null) continue;
        const it = this.itemMap[id];
        if (!it) continue;
        const [tx, ty] = this.getTileOffset(it, wx, wy, 0);
        const px = Math.floor(this.view.x + wx * cz);
        const py = Math.floor(this.view.y + wy * cz);
        ctx.drawImage(this.getCachedTile(it, sz, tx, ty), px, py, tSz, tSz);
      }
    }

    // FG layer
    for (let wy = sy; wy < ey; wy++) {
      for (let wx = sx; wx < ex; wx++) {
        const id = this.world[1][wy][wx];
        if (id == null) continue;
        const it = this.itemMap[id];
        if (!it) continue;
        const [tx, ty] = this.getTileOffset(it, wx, wy, 1);
        const px = Math.floor(this.view.x + wx * cz);
        const py = Math.floor(this.view.y + wy * cz);
        ctx.drawImage(this.getCachedTile(it, sz, tx, ty), px, py, tSz, tSz);
      }
    }

    // Paint layer
    for (let wy = sy; wy < ey; wy++) {
      for (let wx = sx; wx < ex; wx++) {
        const pid = this.paintGrid[wy][wx];
        if (pid == null) continue;
        const it = this.itemMap[pid];
        if (!it) continue;
        const col = getPaintColor(it);
        if (!col) continue;
        const px = Math.floor(this.view.x + wx * cz);
        const py = Math.floor(this.view.y + wy * cz);
        ctx.save();
        ctx.globalAlpha = 0.52;
        ctx.fillStyle = col;
        ctx.fillRect(px, py, tSz, tSz);
        ctx.restore();
      }
    }

    // Grid
    if (this.showGrid && this.view.zoom >= 0.25) {
      ctx.strokeStyle = 'rgba(28,38,54,0.45)';
      ctx.lineWidth = 0.5;
      for (let wx = sx; wx <= ex; wx++) {
        const px = this.view.x + wx * cz;
        ctx.beginPath();
        ctx.moveTo(px, this.view.y + sy * cz);
        ctx.lineTo(px, this.view.y + ey * cz);
        ctx.stroke();
      }
      for (let wy = sy; wy <= ey; wy++) {
        const py = this.view.y + wy * cz;
        ctx.beginPath();
        ctx.moveTo(this.view.x + sx * cz, py);
        ctx.lineTo(this.view.x + ex * cz, py);
        ctx.stroke();
      }
    }

    // World border
    const lc = this.layerMode === 'auto' ? '#fbbf24' : this.layerMode === 1 ? '#4ade80' : '#38bdf8';
    ctx.strokeStyle = lc;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.view.x - 1, this.view.y - 1,
      this.width * cz + 2, this.height * cz + 2);

    // Selection
    if (this.selection) {
      const { x0, y0, x1, y1 } = this.selection;
      const x = Math.min(x0, x1), y = Math.min(y0, y1);
      const w = Math.abs(x1 - x0) + 1, h = Math.abs(y1 - y0) + 1;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(this.view.x + x * cz, this.view.y + y * cz, w * cz, h * cz);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(this.view.x + x * cz, this.view.y + y * cz, w * cz, h * cz);
    }

    // Coordinates
    if (this.view.zoom > 1.8) {
      ctx.fillStyle = 'rgba(74,222,128,.13)';
      ctx.font = `${Math.max(5, Math.round(cz * 0.13))}px monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const step = Math.max(1, Math.floor(4 / this.view.zoom));
      for (let wx = sx; wx < ex; wx += step)
        for (let wy = sy; wy < ey; wy += step)
          ctx.fillText(`${wx},${wy}`, this.view.x + wx * cz + 2, this.view.y + wy * cz + 2);
    }

    this.updateStats();
  }

  private updateStats() {
    let tot = 0;
    for (let l = 0; l < 2; l++)
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < this.width; x++)
          if (this.world[l][y][x] != null) tot++;
    this.callbacks.onStatsUpdate(tot);
  }

  // History
  snapshot() {
    const snap: WorldSnapshot = {
      world: this.world.map(layer => layer.map(row => [...row])),
      paint: this.paintGrid.map(row => [...row]),
      overrides: { ...this.overrides },
    };
    if (this.histIdx < this.history.length - 1)
      this.history = this.history.slice(0, this.histIdx + 1);
    this.history.push(snap);
    if (this.history.length > this.HIST_MAX) this.history.shift();
    this.histIdx = this.history.length - 1;
    this.callbacks.onHistoryChange(this.histIdx > 0, this.histIdx < this.history.length - 1);
  }

  undo() {
    if (this.histIdx <= 0) return;
    this.histIdx--;
    const snap = this.history[this.histIdx];
    this.world = snap.world.map(layer => layer.map(row => [...row]));
    this.paintGrid = snap.paint.map(row => [...row]);
    this.overrides = { ...snap.overrides };
    this.clearTileCache();
    this.schedRender();
    this.callbacks.onHistoryChange(this.histIdx > 0, this.histIdx < this.history.length - 1);
  }

  redo() {
    if (this.histIdx >= this.history.length - 1) return;
    this.histIdx++;
    const snap = this.history[this.histIdx];
    this.world = snap.world.map(layer => layer.map(row => [...row]));
    this.paintGrid = snap.paint.map(row => [...row]);
    this.overrides = { ...snap.overrides };
    this.clearTileCache();
    this.schedRender();
    this.callbacks.onHistoryChange(this.histIdx > 0, this.histIdx < this.history.length - 1);
  }

  // Placement
  private getPlaceLayer(it: GTItem): 0 | 1 {
    const category = getBlockCategory(it);
    return category === 'block' ? 1 : 0;
  }

  private placeCell(wx: number, wy: number, erase: boolean) {
    if (!this.inBounds(wx, wy)) return;
    if (erase) {
      if (this.deleteLayer !== null) {
        // During drag erase, only delete from the tracked layer
        this.world[this.deleteLayer][wy][wx] = null;
      } else if (this.layerMode === 'auto') {
        // First deletion in auto mode - delete from whichever layer has content
        if (this.world[1][wy][wx] != null) {
          this.deleteLayer = 1;
          this.world[1][wy][wx] = null;
        } else if (this.world[0][wy][wx] != null) {
          this.deleteLayer = 0;
          this.world[0][wy][wx] = null;
        }
      } else {
        const l = this.layerMode as number;
        this.world[l][wy][wx] = null;
      }
    } else if (this.selectedItem) {
      const layer = this.getPlaceLayer(this.selectedItem);
      this.world[layer][wy][wx] = this.selectedItem.id;
    }
  }

  private placeCells(cells: [number, number][], erase: boolean) {
    cells.forEach(([wx, wy]) => this.placeCell(wx, wy, erase));
    this.schedRender();
  }

  private floodFill(wx: number, wy: number, erase: boolean) {
    if (!this.inBounds(wx, wy)) return;
    const layer = (!erase && this.selectedItem) ? this.getPlaceLayer(this.selectedItem) :
      (this.layerMode === 'auto' ? 1 : this.layerMode as number);
    const targetId = this.world[layer][wy][wx];
    const fillId = erase ? null : (this.selectedItem ? this.selectedItem.id : null);
    if (targetId === fillId) return;
    const q: [number, number][] = [[wx, wy]];
    const seen = new Set<string>();
    while (q.length) {
      const [cx, cy] = q.shift()!;
      const k = `${cx},${cy}`;
      if (seen.has(k) || !this.inBounds(cx, cy) || this.world[layer][cy][cx] !== targetId) continue;
      seen.add(k);
      this.world[layer][cy][cx] = fillId;
      if (seen.size > this.width * this.height) break;
      q.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    this.snapshot();
    this.clearTileCache();
    this.schedRender();
    this.autoSave();
  }

  private eyedrop(wx: number, wy: number) {
    if (!this.inBounds(wx, wy)) return;
    for (let l = 1; l >= 0; l--) {
      const id = this.world[l][wy][wx];
      if (id != null && this.itemMap[id]) {
        this.selectedItem = this.itemMap[id];
        this.callbacks.onItemPick(this.itemMap[id]);
        return;
      }
    }
  }

  // Shape helpers
  private lineCells(x0: number, y0: number, x1: number, y1: number): [number, number][] {
    const c: [number, number][] = [];
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, cx = x0, cy = y0;
    for (; ;) {
      c.push([cx, cy]);
      if (cx === x1 && cy === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
    }
    return c;
  }

  private rectCells(x0: number, y0: number, x1: number, y1: number, filled: boolean): [number, number][] {
    const c: [number, number][] = [];
    const mnX = Math.min(x0, x1), mxX = Math.max(x0, x1);
    const mnY = Math.min(y0, y1), mxY = Math.max(y0, y1);
    for (let y = mnY; y <= mxY; y++)
      for (let x = mnX; x <= mxX; x++)
        if (filled || y === mnY || y === mxY || x === mnX || x === mxX) c.push([x, y]);
    return c;
  }

  private circleCells(cx: number, cy: number, x1: number, y1: number): [number, number][] {
    const r = Math.round(Math.sqrt((x1 - cx) ** 2 + (y1 - cy) ** 2));
    const c: [number, number][] = [];
    const s = new Set<string>();
    const add = (x: number, y: number) => { const k = `${x},${y}`; if (!s.has(k)) { s.add(k); c.push([x, y]); } };
    let x = 0, y = r, d = 1 - r;
    while (x <= y) {
      [[x, y], [-x, y], [x, -y], [-x, -y], [y, x], [-y, x], [y, -x], [-y, -x]].forEach(([a, b]) => add(cx + a, cy + b));
      if (d < 0) d += 2 * x + 3; else { d += 2 * (x - y) + 5; y--; }
      x++;
    }
    return c;
  }

  // Preview
  private clearPreview() {
    if (this.pvCtx && this.previewCanvas)
      this.pvCtx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
  }

  private drawPreview(cells: [number, number][]) {
    this.clearPreview();
    if (!this.pvCtx || !this.previewCanvas || !cells.length) return;
    const cz = CELL * this.view.zoom;
    const sz = Math.max(1, Math.round(cz));
    this.pvCtx.save();
    this.pvCtx.globalAlpha = 0.5;
    cells.forEach(([wx, wy]) => {
      if (!this.inBounds(wx, wy)) return;
      const px = Math.round(this.view.x + wx * cz);
      const py = Math.round(this.view.y + wy * cz);
      if (this.selectedItem) {
        const [tx, ty] = this.getPreviewOffset(this.selectedItem, wx, wy, cells);
        this.pvCtx!.drawImage(this.getCachedTile(this.selectedItem, sz, tx, ty), px, py);
      } else {
        this.pvCtx!.fillStyle = 'rgba(74,222,128,.4)';
        this.pvCtx!.fillRect(px, py, sz, sz);
      }
    });
    this.pvCtx.restore();
  }

  private getConnMask(wx: number, wy: number, layer: number): number {
    const selfId = this.world[layer][wy][wx];
    if (selfId == null) return 0;

    const has = (nx: number, ny: number) => {
      if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) return false;
      return this.world[layer][ny][nx] === selfId;
    };

    let m = 0;
    if (has(wx - 1, wy - 1)) m |= 1;
    if (has(wx, wy - 1)) m |= 2;
    if (has(wx + 1, wy - 1)) m |= 4;
    if (has(wx - 1, wy)) m |= 8;
    if (has(wx + 1, wy)) m |= 16;
    if (has(wx - 1, wy + 1)) m |= 32;
    if (has(wx, wy + 1)) m |= 64;
    if (has(wx + 1, wy + 1)) m |= 128;
    return m;
  }

  private getTileOffset(it: GTItem, wx: number, wy: number, layer: number): [number, number] {
    const ov = this.overrides[`${layer},${wx},${wy}`];
    if (ov) return [ov.tx, ov.ty];

    const st = it.spread_type;
    if (st === 2) {
      const [c, r] = bestAutotile(ST2, this.getConnMask(wx, wy, layer), 4, 1);
      return [it.tex_x + c, it.tex_y + r];
    }
    if (st === 5) {
      const [c, r] = bestAutotile(ST5, this.getConnMask(wx, wy, layer), 4, 1);
      return [it.tex_x + c, it.tex_y + r];
    }
    if (st === 3 || st === 14) {
      const [c, r] = bestAutotileAxis(ST14, this.getConnMask(wx, wy, layer), 3, 0);
      return [it.tex_x + c, it.tex_y + r];
    }
    if (st === 7) {
      const selfId = it.id;
      const hasTop = wy > 0 && this.world[layer][wy - 1][wx] === selfId;
      const hasBot = wy < this.height - 1 && this.world[layer][wy + 1][wx] === selfId;
      let c = 3, r = 0;
      if (hasTop && hasBot) c = 1;
      else if (hasTop) c = 0;
      else if (hasBot) c = 2;
      return [it.tex_x + c, it.tex_y + r];
    }
    return [it.tex_x, it.tex_y];
  }

  private getPreviewOffset(it: GTItem, wx: number, wy: number, cells: [number, number][]): [number, number] {
    const st = it.spread_type;
    if (![2, 5, 3, 14, 7].includes(st)) return [it.tex_x, it.tex_y];

    const cellSet = new Set(cells.map(([x, y]) => `${x},${y}`));
    const layer = this.getPlaceLayer(it);

    const has = (nx: number, ny: number) => {
      if (cellSet.has(`${nx},${ny}`)) return true;
      if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) return false;
      return this.world[layer][ny][nx] === it.id;
    };

    if (st === 2 || st === 5) {
      let m = 0;
      if (has(wx - 1, wy - 1)) m |= 1;
      if (has(wx, wy - 1)) m |= 2;
      if (has(wx + 1, wy - 1)) m |= 4;
      if (has(wx - 1, wy)) m |= 8;
      if (has(wx + 1, wy)) m |= 16;
      if (has(wx - 1, wy + 1)) m |= 32;
      if (has(wx, wy + 1)) m |= 64;
      if (has(wx + 1, wy + 1)) m |= 128;
      const [c, r] = bestAutotile(st === 2 ? ST2 : ST5, m, 4, 1);
      return [it.tex_x + c, it.tex_y + r];
    }

    if (st === 3 || st === 14) {
      let m = 0;
      if (has(wx, wy - 1)) m |= 2;
      if (has(wx - 1, wy)) m |= 8;
      if (has(wx + 1, wy)) m |= 16;
      if (has(wx, wy + 1)) m |= 64;
      const [c, r] = bestAutotileAxis(ST14, m, 3, 0);
      return [it.tex_x + c, it.tex_y + r];
    }

    if (st === 7) {
      const hasTop = wy > 0 && has(wx, wy - 1);
      const hasBot = wy < this.height - 1 && has(wx, wy + 1);
      let c = 3, r = 0;
      if (hasTop && hasBot) c = 1;
      else if (hasTop) c = 0;
      else if (hasBot) c = 2;
      return [it.tex_x + c, it.tex_y + r];
    }

    return [it.tex_x, it.tex_y];
  }

  // Input handling
  private isPanGesture(e: MouseEvent) {
    return this.tool === 'pan' || e.button === 1 || (e.button === 0 && e.altKey) || this.spaceDown;
  }

  private doDown(wx: number, wy: number, erase: boolean) {
    if (this.tool === 'pan') return;
    if (this.tool === 'pencil' || this.tool === 'erase') {
      this.drawing = true;
      this.deleteLayer = null; // Reset delete layer for new stroke
      this.lastCell = { x: -1, y: -1 };
      this.placeCell(wx, wy, this.tool === 'erase' || erase);
      this.lastCell = { x: wx, y: wy };
      this.schedRender();
    } else if (this.tool === 'paint') {
      this.drawing = true;
      this.paintCell(wx, wy, erase);
      this.schedRender();
    } else if (this.tool === 'fill') {
      this.floodFill(wx, wy, erase);
    } else if (this.tool === 'eyedrop') {
      this.eyedrop(wx, wy);
    } else if (this.tool === 'wrench') {
      this.wrenchCell(wx, wy);
    } else if (this.tool === 'select') {
      this.selection = { x0: wx, y0: wy, x1: wx, y1: wy };
      this.callbacks.onSelectionChange?.(true);
      this.schedRender();
    } else if (['line', 'rect', 'fillRect', 'circle'].includes(this.tool)) {
      this.shapeStart = { x: wx, y: wy };
    }
  }

  private doMove(wx: number, wy: number, erase: boolean) {
    if (this.drawing) {
      if (wx !== this.lastCell.x || wy !== this.lastCell.y) {
        if (this.tool === 'paint') {
          this.paintCell(wx, wy, erase);
        } else {
          const cells = this.lineCells(
            this.lastCell.x < 0 ? wx : this.lastCell.x,
            this.lastCell.y < 0 ? wy : this.lastCell.y, wx, wy);
          if (this.tool === 'erase' || erase) cells.forEach(([x, y]) => this.placeCell(x, y, true));
          else this.placeCells(cells, false);
        }
        this.lastCell = { x: wx, y: wy };
        this.schedRender();
      }
    } else if (this.tool === 'select' && this.selection) {
      this.selection.x1 = wx;
      this.selection.y1 = wy;
      this.schedRender();
    } else if (this.shapeStart) {
      let cells: [number, number][] = [];
      if (this.tool === 'line') cells = this.lineCells(this.shapeStart.x, this.shapeStart.y, wx, wy);
      else if (this.tool === 'rect') cells = this.rectCells(this.shapeStart.x, this.shapeStart.y, wx, wy, false);
      else if (this.tool === 'fillRect') cells = this.rectCells(this.shapeStart.x, this.shapeStart.y, wx, wy, true);
      else if (this.tool === 'circle') cells = this.circleCells(this.shapeStart.x, this.shapeStart.y, wx, wy);
      this.drawPreview(cells);
    }
  }

  private doUp(wx: number, wy: number, erase: boolean) {
    if (this.drawing) {
      this.drawing = false;
      this.lastCell = { x: -1, y: -1 };
      this.deleteLayer = null; // Reset delete layer after drag
      this.snapshot();
      this.autoSave();
      return;
    }
    if (this.tool === 'select') {
      this.schedRender();
      return;
    }
    if (this.shapeStart) {
      let cells: [number, number][] = [];
      if (this.tool === 'line') cells = this.lineCells(this.shapeStart.x, this.shapeStart.y, wx, wy);
      else if (this.tool === 'rect') cells = this.rectCells(this.shapeStart.x, this.shapeStart.y, wx, wy, false);
      else if (this.tool === 'fillRect') cells = this.rectCells(this.shapeStart.x, this.shapeStart.y, wx, wy, true);
      else if (this.tool === 'circle') cells = this.circleCells(this.shapeStart.x, this.shapeStart.y, wx, wy);
      this.placeCells(cells, erase);
      this.snapshot();
      this.shapeStart = null;
      this.clearPreview();
      this.autoSave();
    }
  }

  private paintCell(wx: number, wy: number, erase: boolean) {
    if (!this.inBounds(wx, wy)) return;
    if (erase) {
      this.paintGrid[wy][wx] = null;
    } else if (this.selectedItem && this.selectedItem.name.toLowerCase().includes('paint')) {
      if (this.selectedItem.id === 3492) { // Varnish
        this.paintGrid[wy][wx] = null;
      } else {
        this.paintGrid[wy][wx] = this.selectedItem.id;
      }
    }
  }

  private wrenchCell(wx: number, wy: number) {
    if (!this.inBounds(wx, wy)) return;
    for (let l = 1; l >= 0; l--) {
      const id = this.world[l][wy][wx];
      if (id != null && this.itemMap[id]) {
        this.callbacks.onWrench?.(this.itemMap[id], wx, wy, l);
        return;
      }
    }
  }

  setWrenchOverride(layer: number, wx: number, wy: number, tx: number, ty: number | null) {
    const k = `${layer},${wx},${wy}`;
    if (ty === null) {
      delete this.overrides[k];
    } else {
      this.overrides[k] = { tx, ty };
    }
    this.snapshot();
    this.clearTileCache();
    this.schedRender();
    this.autoSave();
  }

  copySelection(cut = false) {
    if (!this.selection) return;
    const { x0, y0, x1, y1 } = this.selection;
    const mnX = Math.min(x0, x1), mxX = Math.max(x0, x1);
    const mnY = Math.min(y0, y1), mxY = Math.max(y0, y1);
    this.clipboard = [];
    for (let wy = mnY; wy <= mxY; wy++) {
      for (let wx = mnX; wx <= mxX; wx++) {
        if (!this.inBounds(wx, wy)) continue;
        const ox = wx - mnX, oy = wy - mnY;
        for (let l = 0; l < 2; l++) {
          const id = this.world[l][wy][wx];
          if (id != null) {
            this.clipboard.push({ ox, oy, layer: l, id, paintId: this.paintGrid[wy][wx] });
            if (cut) this.world[l][wy][wx] = null;
          }
        }
        if (cut) this.paintGrid[wy][wx] = null;
      }
    }
    if (cut) {
      this.snapshot();
      this.clearTileCache();
      this.schedRender();
      this.autoSave();
    }
  }

  pasteSelection(wx: number, wy: number) {
    if (!this.clipboard.length) return;
    this.clipboard.forEach(c => {
      const nx = wx + c.ox, ny = wy + c.oy;
      if (this.inBounds(nx, ny)) {
        this.world[c.layer][ny][nx] = c.id;
        if (c.paintId !== undefined) this.paintGrid[ny][nx] = c.paintId;
      }
    });
    this.snapshot();
    this.clearTileCache();
    this.schedRender();
    this.autoSave();
  }

  clearSelection() {
    this.selection = null;
    this.callbacks.onSelectionChange?.(false);
    this.schedRender();
  }

  private bindEvents() {
    const c = this.canvas;

    c.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      if (this.isPanGesture(e)) {
        this.dragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.viewStart = { x: this.view.x, y: this.view.y };
        c.style.cursor = 'grabbing';
        return;
      }
      const { x: wx, y: wy } = this.s2w(e.offsetX, e.offsetY);
      this.doDown(wx, wy, e.button === 2);
    });

    c.addEventListener('mousemove', (e: MouseEvent) => {
      this.lastMousePos = { x: e.clientX, y: e.clientY };
      const { x: wx, y: wy } = this.s2w(e.offsetX, e.offsetY);
      if (this.inBounds(wx, wy)) this.callbacks.onCoordUpdate(wx, wy);
      if (this.dragging) {
        this.view.x = this.viewStart.x + (e.clientX - this.dragStart.x);
        this.view.y = this.viewStart.y + (e.clientY - this.dragStart.y);
        this.clamp();
        this.schedRender();
        return;
      }
      this.doMove(wx, wy, !!(e.buttons & 2));
    });

    c.addEventListener('mouseup', (e: MouseEvent) => {
      if (this.dragging) {
        this.dragging = false;
        this.updateCursor();
        return;
      }
      const { x: wx, y: wy } = this.s2w(e.offsetX, e.offsetY);
      this.doUp(wx, wy, e.button === 2);
    });

    c.addEventListener('mouseleave', () => {
      this.dragging = false;
      this.drawing = false;
      this.shapeStart = null;
      this.clearPreview();
      this.updateCursor();
    });

    c.addEventListener('contextmenu', e => e.preventDefault());

    c.addEventListener('wheel', (e: WheelEvent) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.87 : 1.15;
      const nz = Math.max(MINZ, Math.min(MAXZ, this.view.zoom * delta));
      this.view.x = mx - (mx - this.view.x) * (nz / this.view.zoom);
      this.view.y = my - (my - this.view.y) * (nz / this.view.zoom);
      this.view.zoom = nz;
      this.clearTileCache();
      this.clamp();
      this.schedRender();
    }, { passive: false });

    // Keyboard
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); this.redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); this.copySelection(false); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'x') { e.preventDefault(); this.copySelection(true); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        // Paste at current mouse position
        const rect = c.getBoundingClientRect();
        const { x: wx, y: wy } = this.s2w(this.lastMousePos.x - rect.left, this.lastMousePos.y - rect.top);
        this.pasteSelection(wx, wy);
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); this.clearSelection(); return; }
      if (e.key === ' ' && !this.spaceDown) { this.spaceDown = true; c.style.cursor = 'grab'; }
      const k = e.key.toLowerCase();
      if (k === 'p') this.setTool('pencil');
      else if (k === 'l') this.setTool('line');
      else if (k === 'r' && e.shiftKey) this.setTool('fillRect');
      else if (k === 'r') this.setTool('rect');
      else if (k === 'c') this.setTool('circle');
      else if (k === 'f') this.setTool('fill');
      else if (k === 'e') this.setTool('erase');
      else if (k === 'i') this.setTool('eyedrop');
      else if (k === 'm') this.setTool('pan');
      else if (k === 'w') this.setTool('wrench');
      else if (k === 'b') this.setTool('paint');
      else if (k === 's') this.setTool('select');
      else if (k === 'home') { this.fitView(); this.clamp(); this.schedRender(); }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') { this.spaceDown = false; if (!this.dragging) this.updateCursor(); }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp);

    // Touch support
    let touches: Record<number, { x: number; y: number }> = {};
    let pinchD0 = 0, viewZ0 = 1;
    let tpStart: { mx: number; my: number; vx: number; vy: number } | null = null;

    const getTPos = (touch: Touch) => {
      const r = c.getBoundingClientRect();
      return { x: touch.clientX - r.left, y: touch.clientY - r.top };
    };

    c.addEventListener('touchstart', (e: TouchEvent) => {
      e.preventDefault();
      [...e.changedTouches].forEach(t => { touches[t.identifier] = getTPos(t); });
      const tc = Object.keys(touches).length;
      if (tc === 1) {
        const pos = getTPos(e.changedTouches[0]);
        const { x: wx, y: wy } = this.s2w(pos.x, pos.y);
        this.doDown(wx, wy, false);
      } else if (tc === 2) {
        this.drawing = false;
        this.shapeStart = null;
        this.clearPreview();
        const ks = Object.keys(touches);
        const p1 = touches[+ks[0]], p2 = touches[+ks[1]];
        pinchD0 = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        viewZ0 = this.view.zoom;
        tpStart = { mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2, vx: this.view.x, vy: this.view.y };
      }
    }, { passive: false });

    c.addEventListener('touchmove', (e: TouchEvent) => {
      e.preventDefault();
      [...e.changedTouches].forEach(t => { touches[t.identifier] = getTPos(t); });
      const ks = Object.keys(touches);
      if (ks.length === 1) {
        const pos = getTPos(e.changedTouches[0]);
        const { x: wx, y: wy } = this.s2w(pos.x, pos.y);
        if (this.inBounds(wx, wy)) this.callbacks.onCoordUpdate(wx, wy);
        this.doMove(wx, wy, false);
      } else if (ks.length === 2 && tpStart) {
        const p1 = touches[+ks[0]], p2 = touches[+ks[1]];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        const nz = Math.max(MINZ, Math.min(MAXZ, viewZ0 * (dist / pinchD0)));
        this.view.zoom = nz;
        this.view.x = tpStart.vx + (mx - tpStart.mx);
        this.view.y = tpStart.vy + (my - tpStart.my);
        this.clearTileCache();
        this.clamp();
        this.schedRender();
      }
    }, { passive: false });

    c.addEventListener('touchend', (e: TouchEvent) => {
      e.preventDefault();
      [...e.changedTouches].forEach(t => {
        const pos = getTPos(t);
        const { x: wx, y: wy } = this.s2w(pos.x, pos.y);
        if (Object.keys(touches).length === 1) this.doUp(wx, wy, false);
        delete touches[t.identifier];
      });
      if (Object.keys(touches).length === 0) { this.drawing = false; this.clearPreview(); }
      this.autoSave();
    }, { passive: false });

    // Cleanup stored
    (this as any)._cleanup = () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp);
      if (this.retryInterval) clearInterval(this.retryInterval);
    };
  }

  cleanup() {
    if ((this as any)._cleanup) (this as any)._cleanup();
  }

  // Autosave
  private autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;
  autoSave() {
    if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      try {
        const data = {
          v: '5.1', size: { w: this.width, h: this.height },
          world: this.world,
          paint: this.paintGrid,
          overrides: this.overrides,
          ts: Date.now(),
        };
        localStorage.setItem('gt_wp_v4', JSON.stringify(data));
      } catch { }
    }, 800);
  }

  loadFromStorage(): boolean {
    try {
      const raw = localStorage.getItem('gt_wp_v4');
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d.world || !d.size) return false;
      this.width = d.size.w || 100;
      this.height = d.size.h || 60;
      this.world = d.world;
      this.paintGrid = d.paint || Array.from({ length: this.height }, () => new Array(this.width).fill(null));
      this.overrides = d.overrides || {};
      return true;
    } catch { return false; }
  }

  // Presets
  applyPreset(name: string) {
    this.world = [
      Array.from({ length: this.height }, () => new Array(this.width).fill(null)),
      Array.from({ length: this.height }, () => new Array(this.width).fill(null)),
    ];

    if (name === 'empty') {
      // Just empty
    } else if (name === 'clear' || name === 'normal') {
      const bedrock = this.nameMap['Bedrock'];
      const dirt = this.nameMap['Dirt'];
      const rock = this.nameMap['Rock'];
      const lava = this.nameMap['Lava'];
      const caveBg = this.nameMap['Cave Background'];
      const mainDoor = this.nameMap['Main Door'];
      const W = this.width, H = this.height;

      // Bedrock bottom 6 rows
      if (bedrock) for (let y = H - 6; y < H; y++) for (let x = 0; x < W; x++) this.world[1][y][x] = bedrock.id;

      if (name === 'normal') {
        const rng = this.seededRng(Date.now());

        // Transition zone
        if (dirt) for (let y = H - 10; y < H - 6; y++)
          for (let x = 0; x < W; x++) {
            if (rng() < 0.22 && lava) this.world[1][y][x] = lava.id;
            else this.world[1][y][x] = dirt.id;
          }

        // Main dirt body
        if (dirt) {
          for (let y = 24; y < H - 10; y++) for (let x = 0; x < W; x++) this.world[1][y][x] = dirt.id;

          // Scatter rocks
          if (rock) {
            const numR = Math.floor(W * 0.5 + rng() * W * 0.6);
            let placed = 0;
            for (let t = 0; t < numR * 12 && placed < numR; t++) {
              const rx = Math.floor(rng() * W);
              const ry = 26 + Math.floor(rng() * (H - 10 - 26));
              if (this.world[1][ry][rx] === dirt.id) { this.world[1][ry][rx] = rock.id; placed++; }
            }
          }

          // Scatter lava
          if (lava) {
            const lavaCount = Math.floor(W * 0.06 + rng() * W * 0.06);
            for (let i = 0; i < lavaCount; i++) {
              const lx = Math.floor(rng() * W);
              const ly = 28 + Math.floor(rng() * (H - 10 - 28));
              const vsize = 1 + Math.floor(rng() * 4);
              for (let v = 0; v < vsize; v++) {
                const vx = Math.max(0, Math.min(W - 1, lx + Math.floor(rng() * 3) - 1));
                const vy = Math.max(24, Math.min(H - 11, ly + Math.floor(rng() * 3) - 1));
                this.world[1][vy][vx] = lava.id;
              }
            }
          }
        }

        // Main door
        if (mainDoor) {
          const doorX = 3 + Math.floor(rng() * (W - 6));
          this.world[1][23][doorX] = mainDoor.id;
          if (bedrock && 24 < H) this.world[1][24][doorX] = bedrock.id;
        }

        // Cave background behind all FG blocks
        if (caveBg) {
          for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++)
              if (this.world[1][y][x] !== null) this.world[0][y][x] = caveBg.id;
        }
      }
    }

    this.clearTileCache();
    this.snapshot();
    this.schedRender();
    this.autoSave();
  }

  private seededRng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Export/Import
  exportWorld() {
    const d = {
      v: '5.1',
      size: { w: this.width, h: this.height },
      world: this.world,
      paint: this.paintGrid,
      overrides: this.overrides,
      ts: Date.now()
    };
    const blob = new Blob([JSON.stringify(d)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gt-world-${this.width}x${this.height}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importWorld(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = (ev) => {
        try {
          const d = JSON.parse(ev.target!.result as string);
          if (!d.world || !d.size) throw new Error('Invalid');
          this.width = d.size.w;
          this.height = d.size.h;
          this.world = d.world;
          this.paintGrid = d.paint || Array.from({ length: this.height }, () => new Array(this.width).fill(null));
          this.overrides = d.overrides || {};
          this.fitView();
          this.clearTileCache();
          this.schedRender();
          this.autoSave();
          resolve();
        } catch (err) { reject(err); }
      };
      r.readAsText(file);
    });
  }

  // Resize world
  resizeWorld(w: number, h: number) {
    this.width = w;
    this.height = h;
    for (let l = 0; l < 2; l++) {
      this.world[l] = this.world[l].slice(0, h);
      while (this.world[l].length < h) this.world[l].push(new Array(w).fill(null));
      this.world[l] = this.world[l].map(row => {
        const r = row.slice(0, w);
        while (r.length < w) r.push(null);
        return r;
      });
    }

    this.paintGrid = this.paintGrid.slice(0, h);
    while (this.paintGrid.length < h) this.paintGrid.push(new Array(w).fill(null));
    this.paintGrid = this.paintGrid.map(row => {
      const r = row.slice(0, w);
      while (r.length < w) r.push(null);
      return r;
    });

    this.fitView();
    this.clearTileCache();
    this.schedRender();
    this.autoSave();
  }

  toggleGrid() { this.showGrid = !this.showGrid; this.schedRender(); }

  // Retry loop for images that haven't loaded yet
  private startRetryLoop() {
    this.retryInterval = setInterval(() => {
      let any = false;
      const seen = new Set<number>();
      for (let l = 0; l < 2; l++)
        for (let y = 0; y < this.height; y++)
          for (let x = 0; x < this.width; x++) {
            const id = this.world[l][y][x];
            if (id == null || seen.has(id)) continue;
            seen.add(id);
            const it = this.itemMap[id];
            if (!it) continue;
            const im = getImage(it.file_name);
            if (im && isImageLoaded(im)) {
              for (const k of [...this.tileCache.keys()]) {
                if (k.startsWith(id + '_')) {
                  this.tileCache.delete(k);
                  any = true;
                }
              }
            }
          }
      if (any) { this.clearTileCache(); this.schedRender(); }
    }, 2000);
  }

  // Render to PNG
  async renderToPng(): Promise<void> {
    const cellSize = T;
    const W = this.width * cellSize, H = this.height * cellSize;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const octx = off.getContext('2d')!;

    // Sky background
    const grad = octx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#87CEEB');
    grad.addColorStop(1, '#5BA3D9');
    octx.fillStyle = grad;
    octx.fillRect(0, 0, W, H);

    // BG layer
    for (let wy = 0; wy < this.height; wy++)
      for (let wx = 0; wx < this.width; wx++) {
        const id = this.world[0][wy][wx];
        if (id != null) {
          const it = this.itemMap[id];
          if (it) {
            const [tx, ty] = this.getTileOffset(it, wx, wy, 0);
            const c = this.getCachedTile(it, cellSize, tx, ty);
            octx.imageSmoothingEnabled = false;
            octx.drawImage(c, wx * cellSize, wy * cellSize);
          }
        }
      }

    // FG layer
    for (let wy = 0; wy < this.height; wy++)
      for (let wx = 0; wx < this.width; wx++) {
        const id = this.world[1][wy][wx];
        if (id != null) {
          const it = this.itemMap[id];
          if (it) {
            const [tx, ty] = this.getTileOffset(it, wx, wy, 1);
            const c = this.getCachedTile(it, cellSize, tx, ty);
            octx.imageSmoothingEnabled = false;
            octx.drawImage(c, wx * cellSize, wy * cellSize);
          }
        }
      }

    off.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gt-world-render-${this.width}x${this.height}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }
}
