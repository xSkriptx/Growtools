import { useState, useEffect, useRef } from "react";
import { Search, Star, Filter, Loader2, Download, Eye } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  useEffect(() => {
    loadVersions();
  }, []);

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

  const showItemModal = (item: Item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {displayItems.map((item) => (
                <Card key={item.id} className="group hover:border-primary/50 transition-colors">
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
                          onClick={() => downloadItemPng(item)}
                          title="Download PNG"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleFavorite(item.id)}
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
                      onClick={() => showItemModal(item)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
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
          </>
        )}

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedItem?.name || "Item"} Info</DialogTitle>
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
                      key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
  );
}
