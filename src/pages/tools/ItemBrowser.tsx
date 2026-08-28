import { useState, useEffect, useRef, type ReactNode, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from "react";
import { Search, Star, Filter, Loader2, Download, Eye, ChevronDown, LayoutList, PanelTop, Move, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { DATParser, type Item } from "@/lib/datParser";
import { getImage, getIconCoordinates, setVersion, getCurrentVersion, isImageLoaded } from "@/lib/worldPlanner/itemLoader";

const FIELD_MAPPING = {
  "id": "Item ID",
  "properties": "Editable Type",
  "material": "Item Category",
  "type": "Action Type",
  "name": "Name",
  "file_name": "Texture",
  "file_hash": "Texture Hash",
  "visual_type": "Item Kind",
  "cook_time": "Val1",
  "tex_x": "Texture X",
  "tex_y": "Texture Y",
  "storage_type": "Spread Types",
  "layer": "Is Stripey Wallpaper",
  "collision_type": "Collision Type",
  "hardness": "Break Hits",
  "regen_time": "Grow Time",
  "clothing_type": "Clothing Type",
  "rarity": "Rarity",
  "max_hold": "Max Amount",
  "alt_file_path": "Extra File",
  "alt_file_hash": "Extra File Hash",
  "anim_ms": "Audio Volume",
  "pet_name": "Pet Name",
  "pet_prefix": "Pet Prefix",
  "pet_suffix": "Pet Suffix",
  "pet_ability": "Pet Ability",
  "seed_base": "Seed Base",
  "seed_over": "Seed Overlay",
  "tree_base": "Tree Base",
  "tree_over": "Tree Leaves",
  "bg_col": "BG Color",
  "fg_col": "FG Color",
  "seed1": "Seed 1",
  "seed2": "Seed 2",
  "bloom_time": "Bloom Time",
  "anim_type": "Anim Type",
  "anim_string": "Anim String",
  "anim_tex": "Anim Tex",
  "anim_string2": "Anim String 2",
  "dlayer1": "Dlayer 1",
  "dlayer2": "Dlayer 2",
  "properties2": "Properties 2",
  "_unk": "Unknown (62 bytes)",
  "tile_range": "Tile Range",
  "pile_range": "Pile Range",
  "custom_punch": "Custom Punch",
  "_unk2": "Unknown (13 bytes)",
  "clock_div": "Clock Div",
  "parent_id": "Parent ID",
  "_unk3": "Unknown (25 bytes)",
  "alt_sit_path": "Alt Sit Path",
  "_unk4": "Unknown (string)",
  "_unk5": "Unknown (4 bytes)",
  "_unk6": "Unknown (4 bytes)",
  "_unk7": "Unknown (9 bytes)",
  "_unk8": "Unknown (1 byte)",
  "_unk9": "Unknown (1 byte)",
  "item_description": "Item Description",
  "item_info": "Item Info",
  "_unk10": "Unknown (1 byte)",
};

interface RecipeEntry {
  output: string;
  ingredients: string[];
  raw: string;
}

type RecipeViewMode = "tree" | "list";

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function parseRecipeFile(text: string): RecipeEntry[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("="))
    .map((line) => {
      const [outputPart, ingredientsPart] = line.split("=");
      return {
        output: outputPart.trim(),
        ingredients: ingredientsPart
          .split("+")
          .map((ingredient) => ingredient.trim())
          .filter(Boolean),
        raw: line,
      };
    })
    .filter((entry) => entry.output.length > 0 && entry.ingredients.length > 0);
}

function findItemByName(items: Item[], name: string): Item | null {
  const target = normalizeName(name);
  return items.find((item) => normalizeName(item.name || "") === target) || null;
}

function getRecipeMap(entries: RecipeEntry[]) {
  const map = new Map<string, RecipeEntry[]>();
  for (const entry of entries) {
    const key = normalizeName(entry.output);
    const current = map.get(key) || [];
    current.push(entry);
    map.set(key, current);
  }
  return map;
}

const TREE_NODE_WIDTH = 280;
const TREE_BRANCH_GAP = 120;
const TREE_CONNECTOR_HEIGHT = 96;
const RECIPE_BLOCK_COOKIE = "growtools_recipe_blocks";
const RECIPE_BLOCK_RATE = 0.125;

type RecipeBlockStore = Record<string, string>;

function getRecipeBlockStore(): RecipeBlockStore {
  if (typeof document === "undefined") return {};

  const prefix = `${encodeURIComponent(RECIPE_BLOCK_COOKIE)}=`;
  const cookieValue = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix))
    ?.slice(prefix.length);

  if (!cookieValue) return {};

  try {
    return JSON.parse(decodeURIComponent(cookieValue)) as RecipeBlockStore;
  } catch {
    return {};
  }
}

function setRecipeBlockStore(store: RecipeBlockStore) {
  if (typeof document === "undefined") return;

  document.cookie = `${encodeURIComponent(RECIPE_BLOCK_COOKIE)}=${encodeURIComponent(JSON.stringify(store))}; path=/; max-age=31536000; samesite=lax`;
}

function getItemBlockKey(item: Item) {
  return `${item.id}`;
}

function measureTreeWidth(
  name: string,
  recipeMap: Map<string, RecipeEntry[]>,
  depth = 0,
  ancestry: string[] = []
) {
  const normalized = normalizeName(name);
  const recipe = recipeMap.get(normalized)?.[0] || null;
  const ingredients = recipe?.ingredients?.slice(0, 2) || [];

  if (depth >= 5 || !recipe || ancestry.includes(normalized) || ingredients.length === 0) {
    return TREE_NODE_WIDTH;
  }

  const nextAncestry = [...ancestry, normalized];
  const childWidths = ingredients.map((ingredient) =>
    measureTreeWidth(ingredient, recipeMap, depth + 1, nextAncestry)
  );

  if (childWidths.length === 1) {
    return Math.max(TREE_NODE_WIDTH, childWidths[0]);
  }

  return Math.max(TREE_NODE_WIDTH, childWidths[0] + TREE_BRANCH_GAP + childWidths[1]);
}

function getSeedCompanion(items: Item[], item: Item | null): Item | null {
  if (!item) return null;

  if (item.type === 19) {
    return items.find((candidate) => candidate.id === item.id - 1 && candidate.type !== 19) || null;
  }

  return items.find((candidate) => candidate.id === item.id + 1 && candidate.type === 19) || null;
}

function ItemPreview({
  item,
  items,
  size = 40,
  className = "",
}: {
  item: Item | null;
  size?: number;
  className?: string;
}) {
  const seedCompanion = getSeedCompanion(items, item);

  if (!item) {
    return <ItemSprite item={null} size={size} className={className} />;
  }

  if (!seedCompanion || item.type === 19) {
    return <ItemSprite item={item} size={size} className={className} />;
  }

  const overlaySize = Math.max(14, Math.round(size * 0.48));

  return (
    <div className={`relative inline-flex ${className}`} style={{ width: size, height: size }}>
      <div className="absolute inset-0">
        <ItemSprite item={item} size={size} />
      </div>
      <div
        className="pointer-events-none absolute -bottom-1 -right-2 rounded-md border border-transparent bg-transparent p-0 shadow-none"
        style={{ width: overlaySize, height: overlaySize }}
      >
        <ItemSprite item={seedCompanion} size={overlaySize - 4} />
      </div>
    </div>
  );
}

function BlockSeedEstimator({ item }: { item: Item }) {
  const storageKey = getItemBlockKey(item);
  const [blocks, setBlocks] = useState<string>("");

  useEffect(() => {
    const store = getRecipeBlockStore();
    setBlocks(store[storageKey] ?? "");
  }, [storageKey]);

  const parsedBlocks = Number.parseFloat(blocks);
  const validBlocks = Number.isFinite(parsedBlocks) && parsedBlocks > 0 ? parsedBlocks : 0;
  const estimatedSeeds = validBlocks * RECIPE_BLOCK_RATE;

  const handleChange = (value: string) => {
    setBlocks(value);

    const store = getRecipeBlockStore();
    if (value.trim()) {
      store[storageKey] = value;
    } else {
      delete store[storageKey];
    }

    setRecipeBlockStore(store);
  };

  return (
    <div className="rounded-lg border bg-muted/15 p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Block count</div>
          <div className="text-xs text-muted-foreground">Seed drop estimate at 12.5%</div>
        </div>
        <div className="text-sm font-semibold tabular-nums text-right">
          {validBlocks > 0 ? `≈ ${estimatedSeeds.toFixed(2)} seeds` : "Enter blocks"}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
        <Input
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          placeholder="Blocks you have"
          value={blocks}
          onChange={(event) => handleChange(event.target.value)}
        />
        <div className="text-xs text-muted-foreground sm:text-right">
          1 seed per 8 blocks
        </div>
      </div>
    </div>
  );
}

function TreeNodeCard({
  item,
  title,
  subtitle,
  items,
  size = 44,
}: {
  item: Item | null;
  title: string;
  subtitle: string;
  items: Item[];
  size?: number;
}) {
  return (
    <div className="flex w-full max-w-[280px] items-center gap-4 rounded-xl border bg-background/80 px-5 py-4 shadow-sm select-none">
      <ItemPreview item={item} items={items} size={size} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

function RecipeTreeNode({
  name,
  items,
  recipeMap,
  depth = 0,
  ancestry = [],
  isRoot = false,
}: {
  name: string;
  items: Item[];
  recipeMap: Map<string, RecipeEntry[]>;
  depth?: number;
  ancestry?: string[];
  isRoot?: boolean;
}) {
  const normalized = normalizeName(name);
  const currentRecipe = recipeMap.get(normalized)?.[0] || null;
  const nodeItem = findItemByName(items, name);
  const nextAncestry = [...ancestry, normalized];
  const canRecurse = depth < 5 && currentRecipe && !ancestry.includes(normalized);
  const ingredients = currentRecipe?.ingredients || [];
  const childBranches = ingredients.slice(0, 2).filter(Boolean) as string[];
  const hasChildren = canRecurse && childBranches.length > 0;
  const childLayouts = childBranches.map((childName) => ({
    name: childName,
    width: measureTreeWidth(childName, recipeMap, depth + 1, nextAncestry),
  }));
  const childRowWidth =
    childLayouts.length === 2
      ? childLayouts[0].width + TREE_BRANCH_GAP + childLayouts[1].width
      : childLayouts[0]?.width || 0;
  const nodeWidth = Math.max(TREE_NODE_WIDTH, childRowWidth);
  const rowLeft = (nodeWidth - childRowWidth) / 2;
  const childCenters =
    childLayouts.length === 2
      ? [
          rowLeft + childLayouts[0].width / 2,
          rowLeft + childLayouts[0].width + TREE_BRANCH_GAP + childLayouts[1].width / 2,
        ]
      : [nodeWidth / 2];

  return (
    <div className="flex flex-col items-center text-center select-none" style={{ width: nodeWidth }}>
      <div className="flex justify-center" style={{ width: nodeWidth }}>
        <TreeNodeCard
          item={nodeItem}
          title={name}
          subtitle={isRoot ? "Crafted item" : ingredients.length > 0 ? "Crafted ingredient" : "Required item"}
          items={items}
          size={isRoot ? 52 : 40}
        />
      </div>

      {hasChildren && (
        <div className="relative mt-12 w-full pt-6" style={{ width: nodeWidth }}>
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-visible"
            viewBox={`0 0 ${nodeWidth} ${TREE_CONNECTOR_HEIGHT}`}
            preserveAspectRatio="none"
          >
            <path d={`M ${nodeWidth / 2} 6 V 34`} stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {childCenters.map((childCenterX) => (
              <path
                key={`${name}-${childCenterX}`}
                d={`M ${nodeWidth / 2} 34 L ${childCenterX} ${TREE_CONNECTOR_HEIGHT - 8}`}
                stroke="currentColor"
                strokeOpacity="0.22"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
              />
            ))}
          </svg>
          <div
            className="mx-auto flex items-start justify-center pt-[88px]"
            style={{ width: childRowWidth, gap: TREE_BRANCH_GAP }}
          >
            {childLayouts.map((layout) => {
              const childNormalized = normalizeName(layout.name);
              const childInCycle = nextAncestry.includes(childNormalized);

              return (
                <div key={`${name}-${layout.name}`} className="flex min-w-0 flex-col items-center" style={{ width: layout.width }}>
                  <RecipeTreeNode
                    name={layout.name}
                    items={items}
                    recipeMap={recipeMap}
                    depth={depth + 1}
                    ancestry={nextAncestry}
                  />
                  {childInCycle && <Badge variant="outline" className="mt-2 text-[10px]">cycle</Badge>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PanZoomSurface({
  children,
  resetKey,
  enableWheelZoom = true,
}: {
  children: ReactNode;
  resetKey: string;
  enableWheelZoom?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [resetKey]);

  const clampZoom = (value: number) => Math.min(2.8, Math.max(0.45, value));

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!enableWheelZoom) return;
    event.preventDefault();
    event.stopPropagation();
    const scale = event.deltaY < 0 ? 1.12 : 0.9;
    setZoom((current) => clampZoom(current * scale));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setOffset({
      x: dragRef.current.offsetX + (event.clientX - dragRef.current.x),
      y: dragRef.current.offsetY + (event.clientY - dragRef.current.y),
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="relative h-[72vh] overflow-hidden rounded-xl border bg-muted/10 select-none" style={{ userSelect: "none", WebkitUserSelect: "none", overscrollBehavior: "contain" }}>
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 shadow-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((current) => clampZoom(current * 1.12))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((current) => clampZoom(current * 0.9))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <span className="ml-1 text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
      </div>

      <div
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        onWheelCapture={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="absolute left-0 top-0 origin-top-left p-10 select-none"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            width: "max-content",
            minWidth: "100%",
          }}
        >
          <div className="flex w-max flex-col gap-16 select-none">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemSprite({
  item,
  size = 32,
  className = "",
}: {
  item: Item | null;
  size?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderTick, setRenderTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;

    if (!item) {
      ctx.fillStyle = "#475569";
      ctx.font = `${Math.max(10, Math.round(size * 0.42))}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", size / 2, size / 2);
      return;
    }

    const draw = () => {
      if (isSeedItem(item)) {
        drawSeedBadge(canvas, item, size);
        return;
      }

      if (!item.file_name) {
        ctx.fillStyle = "#475569";
        ctx.font = `${Math.max(10, Math.round(size * 0.42))}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", size / 2, size / 2);
        return;
      }

      const img = getImage(item.file_name);
      if (!img) {
        ctx.fillStyle = "#334155";
        ctx.fillRect(0, 0, size, size);
        return;
      }

      if (!isImageLoaded(img)) {
        img.onload = () => setRenderTick((value) => value + 1);
        ctx.fillStyle = "#334155";
        ctx.fillRect(0, 0, size, size);
        return;
      }

      try {
        if (item.file_name.toLowerCase().includes("player_feet") || item.file_name.toLowerCase().includes("player_handitem") || item.file_name.toLowerCase().includes("player_longhanditem") || item.file_name.toLowerCase().includes("player_cosmetics")) {
          drawBootIcon(ctx, img, item, size, size);
        } else {
          const [texX, texY] = getIconCoordinates(item);
          ctx.drawImage(img, texX * 32, texY * 32, 32, 32, 0, 0, size, size);
        }
      } catch {
        ctx.fillStyle = "#475569";
        ctx.font = `${Math.max(10, Math.round(size * 0.36))}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("ERR", size / 2, size / 2);
      }
    };

    draw();
  }, [item, size, renderTick]);

  return <canvas ref={canvasRef} className={className} style={{ imageRendering: "pixelated" }} />;
}

function RecipeBranch({
  name,
  items,
  recipeMap,
  depth = 0,
  ancestry = [],
}: {
  name: string;
  items: Item[];
  recipeMap: Map<string, RecipeEntry[]>;
  depth?: number;
  ancestry?: string[];
}) {
  const normalized = normalizeName(name);
  const directRecipes = recipeMap.get(normalized) || [];
  const matchedItem = findItemByName(items, name);

  if (depth > 4 || ancestry.includes(normalized) || directRecipes.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ItemSprite item={matchedItem} size={20} className="shrink-0" />
        <span className="truncate">{name}</span>
        {directRecipes.length === 0 && <Badge variant="outline" className="text-[10px]">raw</Badge>}
        {depth > 4 && <Badge variant="outline" className="text-[10px]">depth</Badge>}
        {ancestry.includes(normalized) && <Badge variant="outline" className="text-[10px]">cycle</Badge>}
      </div>
    );
  }

  const recipe = directRecipes[0];
  const nextAncestry = [...ancestry, normalized];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-lg border bg-background/60 px-3 py-2">
        <ItemSprite item={matchedItem} size={24} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{recipe.output}</div>
          <div className="text-[11px] text-muted-foreground">Crafted recipe</div>
        </div>
        {directRecipes.length > 1 && <Badge variant="secondary" className="text-[10px]">{directRecipes.length} options</Badge>}
      </div>

      <div className="ml-3 space-y-2 border-l border-border/70 pl-4">
        {recipe.ingredients.map((ingredient) => {
          const childRecipes = recipeMap.get(normalizeName(ingredient)) || [];
          return (
            <div key={`${recipe.raw}-${ingredient}`} className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <ItemSprite item={findItemByName(items, ingredient)} size={20} className="shrink-0" />
                <span className="truncate">{ingredient}</span>
                {childRecipes.length > 0 && <Badge variant="outline" className="text-[10px]">recipe</Badge>}
              </div>
              {childRecipes.length > 0 && !nextAncestry.includes(normalizeName(ingredient)) && (
                <div className="ml-4">
                  <RecipeBranch
                    name={ingredient}
                    items={items}
                    recipeMap={recipeMap}
                    depth={depth + 1}
                    ancestry={nextAncestry}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isSeedItem(item: Item): boolean {
  return item.type !== 38 && (item.bloom_time || 0) !== 0;
}

function isIconItem(item: Item): boolean {
  const fn = item.file_name?.toLowerCase() ?? "";
  return /player_(feet|handitem|longhanditem|cosmetics)/.test(fn);
}

function decodeGTColor(value: number): [number, number, number] {
  const num = (value || 0) >>> 0;
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  // Growtopia sometimes stores seed colors as a plain 24-bit RGB value
  // or as a little-endian 32-bit word where the lowest byte is unused.
  if ((num & 0xff) === 0) {
    return [r, g, b];
  }

  return [
    (num >> 8) & 0xff,
    (num >> 16) & 0xff,
    (num >> 24) & 0xff,
  ];
}

function drawBootIcon(ctx: CanvasRenderingContext2D, img: HTMLImageElement, item: Item, width = 32, height = 32) {
  const fileName = item.file_name?.toLowerCase() ?? "";
  const isFeet = fileName.includes('player_feet');
  const tx = item.tex_x || 0;
  const ty = isFeet ? (item.tex_y || 0) * 2 : (item.tex_y || 0);
  if (tx < 0 || ty < 0) return false;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, tx * 32, ty * 32, 32, 32, 0, 0, width, height);
  return true;
}

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height };
}

function drawSeedBadge(canvas: HTMLCanvasElement, seedItem: Item, size: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);

  const img = getImage('seed.png');
  if (!img) {
    ctx.fillStyle = '#1e2736';
    ctx.fillRect(0, 0, size, size);
    return;
  }

  const render = () => {
    if (!isImageLoaded(img)) {
      ctx.fillStyle = '#1e2736';
      ctx.fillRect(0, 0, size, size);
      return;
    }

    const baseSlot = seedItem.seed_base ?? seedItem.seed1 ?? 0;
    const overSlot = seedItem.seed_over ?? seedItem.seed2 ?? 0;
    const bgColor = decodeGTColor(seedItem.bg_col || 0);
    const fgColor = decodeGTColor(seedItem.fg_col || 0);

    const isValidSeedColor = (color: [number, number, number]) =>
      color[0] > 10 || color[1] > 10 || color[2] > 10;

    const drawLayer = (
      slot: number,
      row: number,
      color: [number, number, number],
      fallback: [number, number, number]
    ) => {
      const tileX = slot % 16;
      const tileY = row;
      const layerColor = isValidSeedColor(color) ? color : fallback;

      const layerCanvas = document.createElement('canvas');
      layerCanvas.width = 16;
      layerCanvas.height = 16;
      const layerCtx = layerCanvas.getContext('2d');
      if (!layerCtx) return;
      layerCtx.imageSmoothingEnabled = false;

      layerCtx.drawImage(img, tileX * 16, tileY * 16, 16, 16, 0, 0, 16, 16);
      const imageData = layerCtx.getImageData(0, 0, 16, 16);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        const gray = data[i] / 255;
        const tint = gray * 0.9;
        data[i] = Math.round(layerColor[0] * tint);
        data[i + 1] = Math.round(layerColor[1] * tint);
        data[i + 2] = Math.round(layerColor[2] * tint);
      }
      layerCtx.putImageData(imageData, 0, 0);

      ctx.drawImage(layerCanvas, 0, 0, 16, 16, 0, 0, size, size);
    };

    drawLayer(baseSlot, 0, bgColor, [160, 180, 80]);
    drawLayer(overSlot, 1, fgColor, [60, 80, 40]);
  };

  if (!isImageLoaded(img)) {
    img.onload = render;
  }
  render();
}

export default function ItemBrowser() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [favorites, setFavorites] = useState<number[]>([]);

  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [recipeEntries, setRecipeEntries] = useState<RecipeEntry[]>([]);
  const [recipeLoadError, setRecipeLoadError] = useState<string>("");
  const [isRecipePopupOpen, setIsRecipePopupOpen] = useState(false);
  const [recipeViewMode, setRecipeViewMode] = useState<RecipeViewMode>("tree");
  const [areFieldsOpen, setAreFieldsOpen] = useState(false);

  useEffect(() => {
    loadVersions();
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    try {
      const response = await fetch("https://raw.githubusercontent.com/kabuokis/growtopia-data/main/recapies.txt");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      setRecipeEntries(parseRecipeFile(text));
      setRecipeLoadError("");
    } catch (error) {
      console.error("Failed to load recipes", error);
      setRecipeEntries([]);
      setRecipeLoadError("Recipe data is unavailable right now.");
    }
  };

  const loadVersions = async () => {
    try {
      const availableVersions = await DATParser.getAvailableVersions();
      setVersions(availableVersions);
      if (availableVersions.length > 0) {
        setSelectedVersion(availableVersions[0]); // Set latest version as default
      }
    } catch (error) {
      console.error("Failed to load versions", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedVersion) {
      fetchItems(selectedVersion);
    }
  }, [selectedVersion]);

  const fetchItems = async (version: string) => {
    setIsLoading(true);
    try {
      const parsedItems = await DATParser.fetchFromGitHub(version);
      setVersion(version);
      setItems(parsedItems);
      setSelectedItem(parsedItems.find((item) => !DATParser.isNullItem(item) && item.type !== 19) || parsedItems.find((item) => !DATParser.isNullItem(item)) || null);
      setCurrentPage(1);
    } catch (error) {
      console.error("Failed to fetch items", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSpriteImg = (fileName: string): HTMLImageElement | null => {
    if (!fileName) return null;
    const img = getImage(fileName);
    if (!img) return null;

    if (!isImageLoaded(img)) {
      img.onload = () => {
        setItems((prevItems) => [...prevItems]);
      };
    }

    return img;
  };

  const drawItemIcon = (canvas: HTMLCanvasElement, item: Item) => {
    const { width, height } = resizeCanvasToDisplaySize(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    if (!item.file_name) {
      ctx.fillStyle = '#666';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', width / 2, height * 0.7);
      return;
    }

    const img = isSeedItem(item) ? getSpriteImg('seed.png') : getSpriteImg(item.file_name);
    if (img && img.complete && img.naturalWidth > 0) {
      try {
        if (isSeedItem(item)) {
          drawSeedBadge(canvas, item, Math.min(width, height));
        } else if (isIconItem(item)) {
          if (!drawBootIcon(ctx, img, item, width, height)) throw new Error('Boot draw failed');
        } else {
          const [texX, texY] = getIconCoordinates(item);
          ctx.drawImage(img, texX * 32, texY * 32, 32, 32, 0, 0, width, height);
        }
      } catch (e) {
        ctx.fillStyle = '#666';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ERR', 16, 18);
      }
    } else {
      ctx.fillStyle = '#444';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('...', 16, 18);
    }
  };

  const toggleFavorite = (id: number) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const formatValue = (value: unknown): string => {
    if (value === undefined || value === null) return "";
    if (value instanceof Uint8Array) {
      return Array.from(value)
        .map((b) => ("0" + b.toString(16)).slice(-2))
        .join(" ");
    }
    return String(value);
  };

  const getValueType = (value: unknown): string => {
    if (typeof value === "number") return "int";
    if (value instanceof Uint8Array) return "hex";
    return "string";
  };
  
  const downloadItemPng = (item: Item) => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    if (isSeedItem(item)) {
      const img = getImage('seed.png');
      if (!img || !isImageLoaded(img)) {
        alert('Seed texture not loaded yet or failed to load.');
        return;
      }
      drawSeedBadge(canvas, item, 32);
    } else {
      if (!item.file_name) return;
      const img = getImage(item.file_name);
      if (!img || !isImageLoaded(img)) {
        alert('Image not loaded yet or failed to load.');
        return;
      }
      let texX = item.tex_x || 0;
      let texY = item.tex_y || 0;
      const fileName = item.file_name?.toLowerCase() ?? '';
      const isFeet = fileName.includes('player_feet');
      if (isIconItem(item)) {
        texY = isFeet ? texY * 2 : texY;
      } else {
        [texX, texY] = getIconCoordinates(item);
      }
      ctx.drawImage(img, texX * 32, texY * 32, 32, 32, 0, 0, 32, 32);
    }

    const link = document.createElement('a');
    link.download = `${item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${item.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const filteredItems = items.filter((item) => {
    if (DATParser.isNullItem(item)) return false;

    if (item.type === 19 && !searchQuery.trim()) return false;
    
    const matchesSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.id.toString().includes(searchQuery);
    
    const typeStr = item.type?.toString() || "Unknown";
    const matchesType = typeFilter === "all" || typeStr === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const displayItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  // Get unique types for filter
  const types = [...new Set(items.filter(i => !DATParser.isNullItem(i)).map((item) => item.type?.toString() || "Unknown"))].sort((a, b) => Number(a) - Number(b));
  const recipeMap = getRecipeMap(recipeEntries);
  const selectedRecipes = selectedItem ? recipeMap.get(normalizeName(selectedItem.name || "")) || [] : [];

  return (
    <ToolPageLayout
      title="Item Browser"
      description="Browse and search the complete Growtopia item database."
      icon={Search}
      color="purple"
    >
      <div className="space-y-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search items by name or ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
              <Select 
                value={typeFilter} 
                onValueChange={(val) => {
                  setTypeFilter(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Action Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {types.map((type) => (
                    <SelectItem key={type} value={type}>
                      Type {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {versions.length > 0 && (
                <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Version" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions.map((v, i) => (
                      <SelectItem key={v} value={v}>
                        {v} {i === 0 && "(latest)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <Card>
            <CardContent className="p-12 text-center flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-lg font-medium">Loading items...</p>
              <p className="text-muted-foreground text-sm">Fetching DAT file from GitHub</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6 items-start">
            <Card className="xl:sticky xl:top-6">
              <CardContent className="p-4 space-y-4 max-h-[calc(100vh-9rem)] overflow-y-auto">
                {selectedItem ? (
                  <>
                    <div className="flex items-start gap-4">
                      <div className="flex shrink-0 items-center justify-center rounded-2xl border bg-muted/30 p-3">
                        <ItemPreview item={selectedItem} items={items} size={88} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="space-y-1">
                          <h3 className="truncate text-xl font-semibold">{selectedItem.name}</h3>
                          <p className="text-sm text-muted-foreground">Selected item details, seed pair, and crafting tree</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">ID: {selectedItem.id}</Badge>
                          <Badge variant="outline">Type: {selectedItem.type}</Badge>
                          <Badge variant="outline">Rarity: {selectedItem.rarity || 0}</Badge>
                          {getSeedCompanion(items, selectedItem) && <Badge className="bg-gt-yellow text-black hover:bg-gt-yellow/90">Seed pair</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => downloadItemPng(selectedItem)}>
                            <Download className="mr-2 h-4 w-4" />
                            PNG
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toggleFavorite(selectedItem.id)}>
                            <Star
                              className={`mr-2 h-4 w-4 ${favorites.includes(selectedItem.id) ? "fill-gt-yellow text-gt-yellow" : "text-muted-foreground"}`}
                            />
                            Favorite
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsRecipePopupOpen(true)}
                            disabled={selectedRecipes.length === 0}
                          >
                            <PanelTop className="mr-2 h-4 w-4" />
                            Popup recipe
                          </Button>
                        </div>
                      </div>
                    </div>

                    <BlockSeedEstimator item={selectedItem} />

                    {selectedItem.item_description && (
                      <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                        {selectedItem.item_description}
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Possible recipes</h4>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{selectedRecipes.length}</Badge>
                          <Button
                            variant={recipeViewMode === "tree" ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setRecipeViewMode(recipeViewMode === "tree" ? "list" : "tree")}
                          >
                            {recipeViewMode === "tree" ? <LayoutList className="mr-2 h-4 w-4" /> : <PanelTop className="mr-2 h-4 w-4" />}
                            {recipeViewMode === "tree" ? "List view" : "Tree view"}
                          </Button>
                        </div>
                      </div>

                      {recipeLoadError ? (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          {recipeLoadError}
                        </div>
                      ) : selectedRecipes.length > 0 ? (
                        recipeViewMode === "tree" ? (
                          <PanZoomSurface resetKey={`${selectedItem.id}-${recipeViewMode}`}>
                            <RecipeTreeNode name={selectedItem.name} items={items} recipeMap={recipeMap} isRoot />
                          </PanZoomSurface>
                        )
                        : (
                          <div className="space-y-2">
                            {selectedRecipes.map((recipe) => (
                              <div key={recipe.raw} className="rounded-lg border bg-background/70 p-3">
                                <div className="mb-2 text-sm font-medium">{recipe.output}</div>
                                <div className="flex flex-wrap gap-2">
                                  {recipe.ingredients.map((ingredient) => (
                                    <div key={`${recipe.raw}-${ingredient}`} className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-2 py-2">
                                      <Badge variant="secondary" className="gap-2 py-1">
                                        <ItemPreview item={findItemByName(items, ingredient)} items={items} size={16} />
                                        <span>{ingredient}</span>
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          No direct recipes were found in recapies.txt for this item.
                        </div>
                      )}
                    </div>

                    <Collapsible open={areFieldsOpen} onOpenChange={setAreFieldsOpen}>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">All fields</h4>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <ChevronDown className={`mr-2 h-4 w-4 transition-transform ${areFieldsOpen ? "rotate-180" : ""}`} />
                            {areFieldsOpen ? "Collapse" : "Expand"}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="pt-3">
                        <div className="space-y-3">
                          {Object.entries(selectedItem)
                            .sort(([a], [b]) => {
                              const order = ["name", "id", "item_description", "file_name"];
                              const aIndex = order.indexOf(a);
                              const bIndex = order.indexOf(b);
                              if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
                              if (aIndex !== -1) return -1;
                              if (bIndex !== -1) return 1;
                              return a.localeCompare(b);
                            })
                            .map(([key, value]) => {
                              const label = FIELD_MAPPING[key as keyof typeof FIELD_MAPPING] ||
                                key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                              const type = getValueType(value);
                              const formattedValue = formatValue(value);

                              return (
                                <div key={key} className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                                  <Label className="text-sm font-medium">
                                    {label} ({type})
                                  </Label>
                                  <div className="sm:col-span-2">
                                    <Input
                                      value={formattedValue}
                                      readOnly
                                      className="font-mono text-xs"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </>
                ) : (
                  <div className="flex h-full min-h-[20rem] items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Select an item to inspect its sprite, seed icon, and recipe tree.
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {displayItems.map((item) => (
                  <Card
                    key={item.id}
                    className={`group cursor-pointer transition-colors hover:border-primary/50 ${selectedItem?.id === item.id ? "border-primary bg-primary/5" : ""}`}
                    onClick={() => setSelectedItem(item)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center p-1 border border-border/50">
                          <canvas
                            width={32}
                            height={32}
                            style={{ imageRendering: "pixelated" }}
                            className="w-full h-full"
                            ref={(canvas) => {
                              if (canvas) drawItemIcon(canvas, item);
                            }}
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            onClick={(event) => {
                              event.stopPropagation();
                              downloadItemPng(item);
                            }}
                            title="Download PNG"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFavorite(item.id);
                            }}
                          >
                            <Star
                              className={`w-4 h-4 ${
                                favorites.includes(item.id)
                                  ? "fill-gt-yellow text-gt-yellow"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </Button>
                        </div>
                      </div>
                      <h3 className="font-semibold mb-1 truncate" title={item.name}>{item.name}</h3>
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <Badge variant="secondary" className="text-xs">
                          ID: {item.id}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Rarity: {item.rarity || 0}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Type: {item.type}
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedItem(item);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Inspect
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {filteredItems.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(parseInt(value, 10));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="8">8 per page</SelectItem>
                        <SelectItem value="12">12 per page</SelectItem>
                        <SelectItem value="16">16 per page</SelectItem>
                        <SelectItem value="32">32 per page</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="text-sm text-muted-foreground">
                      Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} entries
                    </div>
                  </div>
                  {totalPages > 1 && (
                    <Pagination>
                      <PaginationContent className="flex-wrap gap-1">
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                            className={safePage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>

                        {(() => {
                          const pages: (number | 'ellipsis')[] = [];
                          if (totalPages <= 7) {
                            for (let i = 1; i <= totalPages; i++) pages.push(i);
                          } else {
                            pages.push(1);
                            if (safePage > 3) pages.push('ellipsis');
                            const start = Math.max(2, safePage - 1);
                            const end = Math.min(totalPages - 1, safePage + 1);
                            for (let i = start; i <= end; i++) pages.push(i);
                            if (safePage < totalPages - 2) pages.push('ellipsis');
                            pages.push(totalPages);
                          }
                          return pages.map((page, idx) =>
                            page === 'ellipsis' ? (
                              <PaginationItem key={`ellipsis-${idx}`}>
                                <span className="flex h-10 w-10 items-center justify-center text-muted-foreground text-sm">...</span>
                              </PaginationItem>
                            ) : (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => setCurrentPage(page)}
                                  isActive={safePage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            )
                          );
                        })()}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                            className={safePage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </div>
              )}

              {filteredItems.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">No items found</p>
                    <p className="text-muted-foreground">Try adjusting your search or filters</p>
                  </CardContent>
                </Card>
              )}
            </div>
            </div>

          <Dialog open={isRecipePopupOpen} onOpenChange={setIsRecipePopupOpen}>
            <DialogContent className="max-w-[96vw] max-h-[92vh] overflow-hidden p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>{selectedItem?.name || "Item"} Recipes</DialogTitle>
              </DialogHeader>

              {selectedItem && (
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex shrink-0 items-center justify-center rounded-2xl border bg-muted/30 p-2">
                      <ItemPreview item={selectedItem} items={items} size={72} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">ID: {selectedItem.id}</Badge>
                        <Badge variant="outline">Type: {selectedItem.type}</Badge>
                        <Badge variant="outline">Recipes: {selectedRecipes.length}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant={recipeViewMode === "tree" ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setRecipeViewMode("tree")}
                        >
                          <PanelTop className="mr-2 h-4 w-4" />
                          Tree
                        </Button>
                        <Button
                          variant={recipeViewMode === "list" ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => setRecipeViewMode("list")}
                        >
                          <LayoutList className="mr-2 h-4 w-4" />
                          List
                        </Button>
                      </div>
                    </div>
                  </div>

                  <BlockSeedEstimator item={selectedItem} />

                  {recipeLoadError ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      {recipeLoadError}
                    </div>
                  ) : selectedRecipes.length > 0 ? (
                    recipeViewMode === "tree" ? (
                      <PanZoomSurface resetKey={`${selectedItem.id}-${recipeViewMode}-popup`}>
                        <RecipeTreeNode name={selectedItem.name} items={items} recipeMap={recipeMap} isRoot />
                      </PanZoomSurface>
                    ) : (
                      <div className="space-y-3">
                        {selectedRecipes.map((recipe) => (
                          <div key={recipe.raw} className="rounded-lg border bg-background/70 p-4">
                            <div className="mb-2 text-sm font-medium">{recipe.output}</div>
                            <div className="flex flex-wrap gap-2">
                              {recipe.ingredients.map((ingredient) => (
                                <div key={`${recipe.raw}-${ingredient}`} className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-2 py-2">
                                  <Badge variant="secondary" className="gap-2 py-1">
                                    <ItemPreview item={findItemByName(items, ingredient)} items={items} size={16} />
                                    <span>{ingredient}</span>
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No direct recipes were found in recapies.txt for this item.
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
          </>
        )}
      </div>
    </ToolPageLayout>
  );
}
