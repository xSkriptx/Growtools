import { useState, useCallback, useEffect, useRef } from "react";
import { FileCode, Upload, Download, Search, Filter, Eye, EyeOff, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { DATParser, type Item } from "@/lib/datParser";

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

function isLikelyOddIdSeed(item: Item, allItems: Item[]): boolean {
  if ((item.id ?? 0) % 2 !== 1) return false;
  const prev = allItems.find((it) => it.id === item.id - 1);
  if (!prev) return false;

  const hasSeedData =
    (item.seed1 ?? 0) !== 0 ||
    (item.seed2 ?? 0) !== 0 ||
    (item.seed_base ?? 0) !== 0 ||
    (item.seed_over ?? 0) !== 0 ||
    (item.bg_col ?? 0) !== 0 ||
    (item.fg_col ?? 0) !== 0 ||
    (item.bloom_time ?? 0) !== 0;

  return hasSeedData;
}

function isSeedItem(item: Item, allItems: Item[]): boolean {
  return (item.type !== 38 && (item.bloom_time || 0) !== 0) || isLikelyOddIdSeed(item, allItems);
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

function drawSeedIcon(ctx: CanvasRenderingContext2D, img: HTMLImageElement, item: Item, width = 32, height = 32) {
  const pickSlot = (primary: number | undefined, fallback: number | undefined) => {
    const p = primary ?? 0;
    const f = fallback ?? 0;
    return p !== 0 ? p : f;
  };

  const baseSlot = pickSlot(item.seed_base, item.seed1);
  const overSlot = pickSlot(item.seed_over, item.seed2);
  const bgColor = decodeGTColor(item.bg_col || 0);
  const fgColor = decodeGTColor(item.fg_col || 0);

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

    ctx.drawImage(layerCanvas, 0, 0, 16, 16, 0, 0, width, height);
  };

  drawLayer(baseSlot, 0, bgColor, [160, 180, 80]);
  drawLayer(overSlot, 1, fgColor, [60, 80, 40]);
}

function applyIconDarkTint(ctx: CanvasRenderingContext2D, width: number, height: number) {
  // Match ItemBrowser's ~10% darkening used during seed tinting.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
  ctx.fillRect(0, 0, width, height);
}

function getBlockIconCoordinates(item: Item): [number, number] {
  const x = item.tex_x || 0;
  const y = item.tex_y || 0;
  const spreadType = item.storage_type || 0;

  switch (spreadType) {
    case 2:
    case 5:
      return [x + 4, y + 1];
    case 3:
      return [x + 3, y];
    case 0:
    case 1:
    default:
      return [x, y];
  }
}

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

export default function DatDecoder() {
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showNullItems, setShowNullItems] = useState(false);
  const [showIcons, setShowIcons] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isLoadingFromGitHub, setIsLoadingFromGitHub] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' }>({ message: "", type: 'info' });
  const [texBaseIcons, setTexBaseIcons] = useState<string>("");

  // Sprite cache
  const spriteCache = useRef<Record<string, HTMLImageElement>>({});

  // Helper to resize canvas to device pixel ratio
  const resizeCanvasToDisplaySize = (canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { width, height };
  };

  // Filter states
  const [actionTypeFilter, setActionTypeFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [spreadTypeFilter, setSpreadTypeFilter] = useState("");
  const [collisionTypeFilter, setCollisionTypeFilter] = useState("");
  const [clothingTypeFilter, setClothingTypeFilter] = useState("");
  const [petAbilityFilter, setPetAbilityFilter] = useState("");

  // Sprite rendering functions
  const fileNameToPng = (fileName: string): string | null => {
    if (!fileName) return null;
    if (/\.png$/i.test(fileName)) return fileName;
    const base = fileName.replace(/\.rttex$/i, '');
    if (/^player_feet/i.test(base) || /^player_handitem/i.test(base) ||
        /^player_longhanditem/i.test(base) || /^player_cosmetics/i.test(base)) {
      return base + '_icon.png';
    }
    return base + '.png';
  };

  const getSpriteImg = (fileName: string): HTMLImageElement | null => {
    if (!fileName || !texBaseIcons) return null;
    const png = fileNameToPng(fileName);
    if (!png) return null;
    
    if (spriteCache.current[png]) return spriteCache.current[png];
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = texBaseIcons + png;
    img.onload = () => {
      spriteCache.current[png] = img;
      // Force re-render of table to show loaded icons
      setItems(prevItems => [...prevItems]);
    };
    img.onerror = () => {
      // Mark as failed so we don't keep trying
      spriteCache.current[png] = null as any;
    };
    
    return null;
  };

  const drawItemIcon = (canvas: HTMLCanvasElement, item: Item) => {
    const { width, height } = resizeCanvasToDisplaySize(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    if (!texBaseIcons) {
      // Draw default icon (question mark or similar)
      ctx.fillStyle = '#666';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', width / 2, height * 0.7);
      return;
    }

    const seed = isSeedItem(item, items);
    const img = seed ? getSpriteImg('seed.png') : (item.file_name ? getSpriteImg(item.file_name) : null);
    if (img && img.complete && img.naturalWidth > 0) {
      try {
        if (seed) {
          drawSeedIcon(ctx, img, item, width, height);
          applyIconDarkTint(ctx, width, height);
        } else if (isIconItem(item)) {
          if (!drawBootIcon(ctx, img, item, width, height)) throw new Error('Boot draw failed');
        } else {
          const [texX, texY] = getBlockIconCoordinates(item);
          ctx.drawImage(
            img,
            texX * 32, texY * 32, 32, 32, // source
            0, 0, width, height // destination
          );
          applyIconDarkTint(ctx, width, height);
        }
      } catch (e) {
        // Fallback to placeholder
        ctx.fillStyle = '#666';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ERR', width / 2, height * 0.6);
      }
    } else {
      // Show loading placeholder
      ctx.fillStyle = '#444';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('...', width / 2, height * 0.6);
    }
  };

  // Load versions on mount
  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    setIsLoadingVersions(true);
    try {
      const availableVersions = await DATParser.getAvailableVersions();
      setVersions(availableVersions);
      if (availableVersions.length > 0) {
        setSelectedVersion(availableVersions[0]); // Set latest version as default
      }
    } catch (error) {
      setStatus({ message: `Failed to load versions: ${error}`, type: 'error' });
    }
    setIsLoadingVersions(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith(".dat")) {
      setFile(droppedFile);
      parseFile(droppedFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile?.name.endsWith(".dat")) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = async (file: File) => {
    setIsLoading(true);
    setProgress(20);
    setProgressLabel("Parsing items...");
    
    try {
      const parsedItems = await DATParser.parseFile(file);
      setItems(parsedItems);
      setProgress(100);
      setProgressLabel("Done!");
      setStatus({ 
        message: `✓ Successfully decoded ${parsedItems.length.toLocaleString()} items`, 
        type: 'success' 
      });
      setTimeout(() => {
        setProgress(0);
        setProgressLabel("");
      }, 1000);
    } catch (error) {
      setStatus({ message: `Failed to parse DAT file: ${error}`, type: 'error' });
      setProgress(0);
      setProgressLabel("");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAndDecode = async () => {
    if (!selectedVersion) {
      setStatus({ message: 'Please select a version.', type: 'error' });
      return;
    }

    setIsLoadingFromGitHub(true);
    setProgress(10);
    setProgressLabel('Connecting to GitHub...');

    try {
      setProgress(30);
      setProgressLabel('Downloading file...');
      
      const parsedItems = await DATParser.fetchFromGitHub(selectedVersion);
      
      // Set texture base path for icons
      setTexBaseIcons(`https://raw.githubusercontent.com/kabuokis/growtopia-data/main/${selectedVersion}/decoded/textures/`);
      
      setProgress(80);
      setProgressLabel(`Building list (${parsedItems.length.toLocaleString()} items)...`);
      
      setItems(parsedItems);
      
      setProgress(100);
      setProgressLabel('Done!');
      setStatus({ 
        message: `✓ Version ${selectedVersion} decoded — ${parsedItems.length.toLocaleString()} items`, 
        type: 'success' 
      });
      
      setTimeout(() => {
        setProgress(0);
        setProgressLabel("");
      }, 1000);
    } catch (error) {
      setStatus({ message: `Error: ${error}`, type: 'error' });
      setProgress(0);
      setProgressLabel("");
    } finally {
      setIsLoadingFromGitHub(false);
    }
  };

  // Filter and search logic
  useEffect(() => {
    const filtered = items.filter((item) => {
      // Search filter
      const matchesSearch = searchQuery === "" || 
        item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toString().includes(searchQuery);

      // Null items filter
      const matchesNullFilter = showNullItems || !DATParser.isNullItem(item);

      // Property filters
      const matchesActionType = actionTypeFilter === "" || item.type?.toString() === actionTypeFilter;
      const matchesCategory = categoryFilter === "" || item.material?.toString() === categoryFilter;
      const matchesKind = kindFilter === "" || item.visual_type?.toString() === kindFilter;
      const matchesSpreadType = spreadTypeFilter === "" || item.storage_type?.toString() === spreadTypeFilter;
      const matchesCollisionType = collisionTypeFilter === "" || item.collision_type?.toString() === collisionTypeFilter;
      const matchesClothingType = clothingTypeFilter === "" || item.clothing_type?.toString() === clothingTypeFilter;
      const matchesPetAbility = petAbilityFilter === "" || item.pet_ability?.toString() === petAbilityFilter;

      return matchesSearch && matchesNullFilter && matchesActionType && matchesCategory && 
             matchesKind && matchesSpreadType && matchesCollisionType && matchesClothingType && matchesPetAbility;
    });

    setFilteredItems(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  }, [items, searchQuery, showNullItems, actionTypeFilter, categoryFilter, kindFilter, spreadTypeFilter, collisionTypeFilter, clothingTypeFilter, petAbilityFilter]);

  const exportData = (format: 'json' | 'csv' | 'txt') => {
    if (!filteredItems.length) return;
    
    let data: string;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case 'json':
        data = DATParser.exportToJSON(filteredItems);
        mimeType = 'application/json';
        extension = 'json';
        break;
      case 'csv':
        data = DATParser.exportToCSV(filteredItems);
        mimeType = 'text/csv';
        extension = 'csv';
        break;
      case 'txt':
        data = DATParser.exportToTXT(filteredItems);
        mimeType = 'text/plain';
        extension = 'txt';
        break;
      default:
        return;
    }
    
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `items.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setActionTypeFilter("");
    setCategoryFilter("");
    setKindFilter("");
    setSpreadTypeFilter("");
    setCollisionTypeFilter("");
    setClothingTypeFilter("");
    setPetAbilityFilter("");
    setSearchQuery("");
  };

  const showItemModal = (item: Item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const formatValue = (value: any): string => {
    if (value === undefined || value === null) return '';
    if (value instanceof Uint8Array) {
      return Array.from(value).map(b => ('0' + b.toString(16)).slice(-2)).join(' ');
    }
    return String(value);
  };

  const getValueType = (value: any): string => {
    if (typeof value === 'number') return 'int';
    if (value instanceof Uint8Array) return 'hex';
    return 'string';
  };

  return (
    <>
      <style>
        {`
          .pixelated {
            image-rendering: -moz-crisp-edges;
            image-rendering: -webkit-crisp-edges;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
          }
        `}
      </style>
      <ToolPageLayout
        title="DAT Decoder"
        description="Decode and analyze Growtopia DAT files to extract detailed item information."
        icon={FileCode}
        color="green"
      >
      <div className="space-y-6">
        {/* Source Selection */}
        <Card>
          <CardContent className="p-6">
            <Tabs defaultValue="github" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="github">GitHub Repository</TabsTrigger>
                <TabsTrigger value="local">Local File</TabsTrigger>
              </TabsList>
              
              <TabsContent value="github" className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label htmlFor="version-select" className="text-sm font-medium">
                      Select Version
                    </Label>
                    <Select 
                      value={selectedVersion} 
                      onValueChange={setSelectedVersion}
                      disabled={isLoadingVersions}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingVersions ? "Loading versions..." : "Select a version"} />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((version, index) => (
                          <SelectItem key={version} value={version}>
                            {version} {index === 0 && "(latest)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 items-end">
                    <Button 
                      onClick={fetchAndDecode}
                      disabled={!selectedVersion || isLoadingFromGitHub}
                    >
                      {isLoadingFromGitHub ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Fetch & Decode
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="local">
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <input
                    type="file"
                    accept=".dat"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium mb-2">
                      {file ? file.name : "Drop your items.dat file here"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      or click to browse
                    </p>
                  </label>
                </div>
              </TabsContent>
            </Tabs>

            {/* Progress */}
            {(progress > 0 || isLoading) && (
              <div className="mt-4 space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  {progressLabel}
                </p>
              </div>
            )}

            {/* Status */}
            {status.message && (
              <div className={`mt-4 p-3 rounded-lg ${
                status.type === 'success' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
                status.type === 'error' ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
                'bg-blue-500/10 text-blue-600 border border-blue-500/20'
              }`}>
                {status.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {items.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">Decoded Items</h3>
                    <p className="text-sm text-muted-foreground">
                      Found {items.length} items • Showing {filteredItems.length}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => exportData('json')} size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      JSON
                    </Button>
                    <Button variant="outline" onClick={() => exportData('csv')} size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                    <Button variant="outline" onClick={() => exportData('txt')} size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      TXT
                    </Button>
                  </div>
                </div>

                {/* Search and Controls */}
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Search by ID or name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="show-nulls"
                        checked={showNullItems}
                        onCheckedChange={setShowNullItems}
                      />
                      <Label htmlFor="show-nulls">Show null items</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="show-icons"
                        checked={showIcons}
                        onCheckedChange={setShowIcons}
                      />
                      <Label htmlFor="show-icons">Show icons</Label>
                    </div>
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div>
                    <Label className="text-xs">Action Type</Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={actionTypeFilter}
                      onChange={(e) => setActionTypeFilter(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Kind</Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={kindFilter}
                      onChange={(e) => setKindFilter(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Spread</Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={spreadTypeFilter}
                      onChange={(e) => setSpreadTypeFilter(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Collision</Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={collisionTypeFilter}
                      onChange={(e) => setCollisionTypeFilter(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Clothing</Label>
                    <Input
                      type="number"
                      placeholder="Any"
                      value={clothingTypeFilter}
                      onChange={(e) => setClothingTypeFilter(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      variant="outline" 
                      onClick={clearFilters}
                      size="sm"
                      className="h-8 w-full"
                    >
                      <Filter className="w-3 h-3 mr-1" />
                      Clear
                    </Button>
                  </div>
                </div>

                {/* Items per page */}
                <div className="flex items-center justify-between">
                  <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(parseInt(value))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 per page</SelectItem>
                      <SelectItem value="10">10 per page</SelectItem>
                      <SelectItem value="15">15 per page</SelectItem>
                      <SelectItem value="30">30 per page</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}–{Math.min(startIndex + itemsPerPage, filteredItems.length)} of {filteredItems.length} entries
                  </div>
                </div>

                {/* Table */}
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {showIcons && <TableHead className="w-12">Icon</TableHead>}
                        <TableHead className="w-20">ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedItems.map((item) => (
                        <TableRow key={item.id}>
                          {showIcons && (
                            <TableCell>
                              <canvas 
                                width="32" 
                                height="32" 
                                className="border rounded pixelated"
                                style={{ imageRendering: 'pixelated' }}
                                ref={(canvas) => {
                                  if (canvas) {
                                    requestAnimationFrame(() => drawItemIcon(canvas, item));
                                  }
                                }}
                              />
                            </TableCell>
                          )}
                          <TableCell className="font-mono">{item.id}</TableCell>
                          <TableCell className="font-medium">{item.name || 'Unnamed Item'}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => showItemModal(item)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent className="flex-wrap gap-1">
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>

                      {(() => {
                        const pages: (number | 'ellipsis')[] = [];
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          pages.push(1);
                          if (currentPage > 3) pages.push('ellipsis');
                          const start = Math.max(2, currentPage - 1);
                          const end = Math.min(totalPages - 1, currentPage + 1);
                          for (let i = start; i <= end; i++) pages.push(i);
                          if (currentPage < totalPages - 2) pages.push('ellipsis');
                          pages.push(totalPages);
                        }
                        return pages.map((page, idx) =>
                          page === 'ellipsis' ? (
                            <PaginationItem key={`ellipsis-${idx}`}>
                              <span className="flex h-10 w-10 items-center justify-center text-muted-foreground text-sm">…</span>
                            </PaginationItem>
                          ) : (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPage(page)}
                                isActive={currentPage === page}
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
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading skeleton */}
        {isLoading && items.length === 0 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Item Details Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedItem?.name || 'Item'} Info
              </DialogTitle>
            </DialogHeader>
            
            {selectedItem && (
              <div className="space-y-4">
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
                                key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    const type = getValueType(value);
                    const formattedValue = formatValue(value);
                    
                    return (
                      <div key={key} className="grid grid-cols-3 gap-4 items-center">
                        <Label className="text-sm font-medium">
                          {label} ({type})
                        </Label>
                        <div className="col-span-2">
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
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ToolPageLayout>
    </>
  );
}