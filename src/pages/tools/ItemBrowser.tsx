import { useState, useEffect, useRef } from "react";
import { Search, Star, Filter, Loader2, Download } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DATParser, type Item } from "@/lib/datParser";

export default function ItemBrowser() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [favorites, setFavorites] = useState<number[]>([]);

  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>("");
  const [texBaseIcons, setTexBaseIcons] = useState<string>("");

  const [displayCount, setDisplayCount] = useState(50);

  const spriteCache = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    loadVersions();
  }, []);

  const loadVersions = async () => {
    try {
      const availableVersions = await DATParser.getAvailableVersions();
      setVersions(availableVersions);
      if (availableVersions.length > 0) {
        setSelectedVersion(availableVersions[0]);
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
      setTexBaseIcons(`https://raw.githubusercontent.com/kabuokis/growtopia-data/main/${version}/decoded/textures/`);
      setItems(parsedItems);
      setDisplayCount(50);
    } catch (error) {
      console.error("Failed to fetch items", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fileNameToPng = (fileName: string): string | null => {
    if (!fileName) return null;
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
      setItems(prevItems => [...prevItems]);
    };
    img.onerror = () => {
      spriteCache.current[png] = null as any;
    };
    
    return null;
  };

  const drawItemIcon = (canvas: HTMLCanvasElement, item: Item) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 32, 32);

    if (!item.file_name || !texBaseIcons) {
      ctx.fillStyle = '#666';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?', 16, 22);
      return;
    }

    const img = getSpriteImg(item.file_name);
    if (img && img.complete && img.naturalWidth > 0) {
      const texX = item.tex_x || 0;
      const texY = item.tex_y || 0;
      
      try {
        ctx.drawImage(
          img,
          texX * 32, texY * 32, 32, 32,
          0, 0, 32, 32
        );
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
  
  const downloadItemPng = (item: Item) => {
    const png = fileNameToPng(item.file_name || "");
    if (!png) return;
    
    const img = spriteCache.current[png];
    if (!img || !img.complete || img.naturalWidth === 0) {
      alert("Image not loaded yet or failed to load.");
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    const texX = item.tex_x || 0;
    const texY = item.tex_y || 0;
    
    ctx.drawImage(img, texX * 32, texY * 32, 32, 32, 0, 0, 32, 32);

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

  const displayItems = filteredItems.slice(0, displayCount);

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
                    setDisplayCount(50);
                  }}
                  className="pl-10"
                />
              </div>
              <Select 
                value={typeFilter} 
                onValueChange={(val) => {
                  setTypeFilter(val);
                  setDisplayCount(50);
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
                  </CardContent>
                </Card>
              ))}
            </div>

            {displayItems.length < filteredItems.length && (
              <div className="flex justify-center mt-6">
                <Button variant="outline" onClick={() => setDisplayCount(prev => prev + 50)}>
                  Load More ({filteredItems.length - displayItems.length} remaining)
                </Button>
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
      </div>
    </ToolPageLayout>
  );
}
