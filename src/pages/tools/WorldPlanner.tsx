import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Map, Pencil, Eraser, Droplets, Undo, Redo, Download, Upload, Grid, 
  Slash, Square, Circle, Move, Pipette, Image, Trash2, Search, Wrench, Paintbrush, SquareDashedMousePointer, Copy, Scissors, Clipboard, X } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { WorldPlannerEngine } from "@/lib/worldPlanner/engine";
import { loadItems, isPlaceable, autoLayer, getImage, isImageLoaded } from "@/lib/worldPlanner/itemLoader";
import { GTItem, Tool, LayerMode } from "@/lib/worldPlanner/types";

const TOOLS: { id: Tool; icon: any; label: string; key: string }[] = [
  { id: 'pencil', icon: Pencil, label: 'Pencil', key: 'P' },
  { id: 'line', icon: Slash, label: 'Line', key: 'L' },
  { id: 'rect', icon: Square, label: 'Rectangle', key: 'R' },
  { id: 'fillRect', icon: Square, label: 'Filled Rect', key: '⇧R' },
  { id: 'circle', icon: Circle, label: 'Circle', key: 'C' },
  { id: 'fill', icon: Droplets, label: 'Fill', key: 'F' },
  { id: 'paint', icon: Paintbrush, label: 'Paint', key: 'B' },
  { id: 'wrench', icon: Wrench, label: 'Wrench', key: 'W' },
  { id: 'select', icon: SquareDashedMousePointer, label: 'Select', key: 'S' },
  { id: 'erase', icon: Eraser, label: 'Erase', key: 'E' },
  { id: 'eyedrop', icon: Pipette, label: 'Eyedrop', key: 'I' },
  { id: 'pan', icon: Move, label: 'Pan', key: 'M' },
];

export default function WorldPlanner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<WorldPlannerEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<GTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTool, setActiveTool] = useState<Tool>('pencil');
  const [activeLayer, setActiveLayer] = useState<LayerMode>('auto');
  const [selectedItem, setSelectedItem] = useState<GTItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'fg' | 'bg'>('all');
  const [blockCount, setBlockCount] = useState(0);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [sidebarPage, setSidebarPage] = useState(0);
  const [hasSelection, setHasSelection] = useState(false);
  const [wrenchData, setWrenchData] = useState<{ item: GTItem; x: number; y: number; layer: number } | null>(null);
  const ITEMS_PER_PAGE = 80;

  // Filtered items
  const filteredItems = useMemo(() => {
    let list = items.filter(isPlaceable);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(it => it.name.toLowerCase().includes(q) || String(it.id) === q);
    }
    if (filterType === 'fg') list = list.filter(it => autoLayer(it) === 1);
    if (filterType === 'bg') list = list.filter(it => autoLayer(it) === 0);
    return list;
  }, [items, searchQuery, filterType]);

  const paginatedItems = useMemo(() => {
    return filteredItems.slice(0, (sidebarPage + 1) * ITEMS_PER_PAGE);
  }, [filteredItems, sidebarPage]);

  // Init engine
  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = new WorldPlannerEngine(canvasRef.current, 100, 60, {
      onStatsUpdate: (blocks) => setBlockCount(blocks),
      onCoordUpdate: (x, y) => setCoords({ x, y }),
      onToolChange: (tool) => setActiveTool(tool),
      onItemPick: (item) => setSelectedItem(item),
      onHistoryChange: (u, r) => { setCanUndo(u); setCanRedo(r); },
      onWrench: (item, x, y, layer) => setWrenchData({ item, x, y, layer }),
      onSelectionChange: (has) => setHasSelection(has),
    });

    if (previewRef.current) engine.setPreviewCanvas(previewRef.current);
    engineRef.current = engine;

    // Load items
    loadItems().then(loadedItems => {
      setItems(loadedItems);
      engine.setItems(loadedItems);
      engine.loadFromStorage();
      engine.fitView();
      engine.schedRender();
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load items:', err);
      toast({ title: 'Error', description: 'Failed to load Growtopia items data', variant: 'destructive' });
      setLoading(false);
    });

    // Resize
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        engine.resize(rect.width, rect.height);
        engine.schedRender();
      }
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    handleResize();

    return () => {
      observer.disconnect();
      engine.cleanup();
    };
  }, []);

  // Update engine when selected item changes
  useEffect(() => {
    engineRef.current?.setSelectedItem(selectedItem);
  }, [selectedItem]);

  useEffect(() => {
    engineRef.current?.setLayer(activeLayer);
  }, [activeLayer]);

  const handleToolClick = (tool: Tool) => {
    setActiveTool(tool);
    engineRef.current?.setTool(tool);
  };

  const handlePreset = (preset: string) => {
    if (!engineRef.current) return;
    if (!confirm(`Apply preset "${preset}"? This overwrites the current world.`)) return;
    engineRef.current.applyPreset(preset);
  };

  const handleExport = () => engineRef.current?.exportWorld();
  const handleImport = () => fileInputRef.current?.click();
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !engineRef.current) return;
    try {
      await engineRef.current.importWorld(file);
      toast({ title: 'Imported', description: 'World loaded successfully' });
    } catch {
      toast({ title: 'Error', description: 'Failed to import world', variant: 'destructive' });
    }
    e.target.value = '';
  };

  const handleRender = () => engineRef.current?.renderToPng();
  const handleClear = () => {
    if (!confirm('Clear entire world?')) return;
    engineRef.current?.applyPreset('empty');
  };

  const handleGridToggle = () => {
    setShowGrid(!showGrid);
    engineRef.current?.toggleGrid();
  };

  return (
    <ToolPageLayout title="World Planner" description="Plan and design your Growtopia worlds with actual game textures." icon={Map} color="orange">
      <div className="flex flex-col lg:flex-row gap-0 border rounded-xl overflow-hidden bg-card" style={{ height: 'calc(100vh - 220px)', minHeight: '500px' }}>
        {/* Sidebar */}
        <div className="w-full lg:w-60 flex-shrink-0 border-b lg:border-b-0 lg:border-r flex flex-col bg-background overflow-hidden" style={{ maxHeight: '200px', ...(typeof window !== 'undefined' && window.innerWidth >= 1024 ? { maxHeight: 'none' } : {}) }}>
          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search blocks..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSidebarPage(0); }}
                className="pl-7 h-8 text-xs"
              />
            </div>
          </div>

          {/* Filter */}
          <div className="flex gap-1 p-1.5 border-b">
            {(['all', 'fg', 'bg'] as const).map(f => (
              <button
                key={f}
                onClick={() => { setFilterType(f); setSidebarPage(0); }}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                  filterType === f
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
            <span className="ml-auto text-[10px] text-muted-foreground self-center">{filteredItems.length}</span>
          </div>

          {/* Item List */}
          <div className="flex-1 overflow-y-auto p-1 min-h-0">
            {loading ? (
              <div className="text-center py-4 text-xs text-muted-foreground">Loading items...</div>
            ) : (
              <>
                {paginatedItems.map(it => (
                  <SidebarItem
                    key={it.id}
                    item={it}
                    selected={selectedItem?.id === it.id}
                    onClick={() => setSelectedItem(it)}
                    onDownload={downloadItemPng}
                  />
                ))}
                {paginatedItems.length < filteredItems.length && (
                  <button
                    onClick={() => setSidebarPage(p => p + 1)}
                    className="w-full text-center py-2 text-xs text-primary hover:underline"
                  >
                    Load more ({filteredItems.length - paginatedItems.length} remaining)
                  </button>
                )}
              </>
            )}
          </div>

          {/* Selected info */}
          <div className="p-2 border-t bg-muted/30">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Selected Item</div>
            {selectedItem ? (
              <div className="flex items-center gap-2">
                <ItemIcon item={selectedItem} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold truncate leading-tight">{selectedItem.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="text-[10px]" style={{ color: autoLayer(selectedItem) === 1 ? '#4ade80' : '#38bdf8' }}>
                      {autoLayer(selectedItem) === 1 ? 'Block (Foreground)' : 'Background (Layer 0)'}
                    </div>
                    <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">#{selectedItem.id}</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 gap-1.5 text-xs font-semibold hover:bg-primary/10 hover:text-primary border-primary/20"
                  onClick={() => downloadItemPng(selectedItem)}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Button>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic py-1">None selected</div>
            )}
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-1 p-1.5 border-b bg-muted/30 flex-wrap">
            {/* Undo/Redo */}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => engineRef.current?.undo()} disabled={!canUndo} title="Undo (Ctrl+Z)">
              <Undo className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => engineRef.current?.redo()} disabled={!canRedo} title="Redo (Ctrl+Y)">
              <Redo className="w-3.5 h-3.5" />
            </Button>

            <div className="w-px h-5 bg-border mx-0.5" />

            {TOOLS.map(t => {
              const Icon = t.icon;
              return (
                <Button
                  key={t.id}
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 ${activeTool === t.id ? 'bg-primary/15 text-primary border border-primary/40' : ''}`}
                  onClick={() => handleToolClick(t.id)}
                  title={`${t.label} (${t.key})`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </Button>
              );
            })}

            {hasSelection && (
              <>
                <div className="w-px h-5 bg-border mx-0.5" />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => engineRef.current?.copySelection(false)} title="Copy (Ctrl+C)">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => engineRef.current?.copySelection(true)} title="Cut (Ctrl+X)">
                  <Scissors className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => engineRef.current?.clearSelection()} title="Clear Selection (Esc)">
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            )}

            <div className="w-px h-5 bg-border mx-0.5" />

            {/* Layer tabs */}
            {([['auto', 'Auto', '#fbbf24'], [1, 'Block', '#4ade80'], [0, 'BG', '#38bdf8']] as const).map(([v, label, col]) => (
              <button
                key={String(v)}
                onClick={() => setActiveLayer(v as LayerMode)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                  activeLayer === v
                    ? 'border-current bg-current/10'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
                style={activeLayer === v ? { color: col } : undefined}
              >
                {label}
              </button>
            ))}

            <div className="flex-1" />

            {/* Coords */}
            <span className="text-[10px] font-mono text-muted-foreground mr-1">X:{coords.x} Y:{coords.y}</span>

            {/* Grid toggle */}
            <Button variant="ghost" size="icon" className={`h-7 w-7 ${showGrid ? 'text-primary' : ''}`} onClick={handleGridToggle} title="Toggle Grid">
              <Grid className="w-3.5 h-3.5" />
            </Button>

            {/* Actions dropdown */}
            <div className="flex gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExport} title="Export JSON">
                <Download className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleImport} title="Import JSON">
                <Upload className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRender} title="Render PNG">
                <Image className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={handleClear} title="Clear World">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
          </div>

          {/* Presets bar */}
          <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/10 text-xs">
            <span className="text-muted-foreground font-semibold mr-1">Presets:</span>
            {['empty', 'clear', 'normal'].map(p => (
              <button
                key={p}
                onClick={() => handlePreset(p)}
                className="px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors text-[11px] font-medium capitalize"
              >
                {p === 'clear' ? 'Clear (Bedrock)' : p === 'normal' ? 'Normal World' : 'Empty'}
              </button>
            ))}
            <div className="flex-1" />
            <Badge variant="outline" className="text-[10px]">{blockCount} blocks</Badge>
          </div>

          {/* Canvas */}
          <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#060810]" style={{ touchAction: 'none' }}>
            <canvas ref={canvasRef} className="absolute inset-0" style={{ imageRendering: 'pixelated' }} />
            <canvas ref={previewRef} className="absolute inset-0 pointer-events-none" style={{ imageRendering: 'pixelated' }} />
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-3 px-2 py-1 border-t bg-muted/30 text-[10px] text-muted-foreground">
            <span>Size: <strong className="text-foreground">100×60</strong></span>
            <span>Blocks: <strong className="text-foreground">{blockCount}</strong></span>
            <span>Tool: <strong className="text-foreground">{TOOLS.find(t => t.id === activeTool)?.label || activeTool}</strong></span>
            <span>Layer: <strong className="text-foreground">{activeLayer === 'auto' ? 'Auto' : activeLayer === 1 ? 'Block' : 'BG'}</strong></span>
            <span className="ml-auto hidden md:inline">Scroll=zoom | Alt/MMB=pan | RMB=erase | Home=fit</span>
          </div>
        </div>
      </div>
      {wrenchData && (
        <WrenchModal
          data={wrenchData}
          onClose={() => setWrenchData(null)}
          onSelect={(tx, ty) => {
            engineRef.current?.setWrenchOverride(wrenchData.layer, wrenchData.x, wrenchData.y, tx, ty);
            setWrenchData(null);
          }}
        />
      )}
    </ToolPageLayout>
  );
}

function WrenchModal({ data, onClose, onSelect }: { 
  data: { item: GTItem; x: number; y: number; layer: number }; 
  onClose: () => void; 
  onSelect: (tx: number, ty: number | null) => void 
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const tileFile = data.item.file_name;

  useEffect(() => {
    const img = getImage(tileFile);
    if (img) {
      const check = () => { if (img.naturalWidth) setImgSize({ w: img.naturalWidth, h: img.naturalHeight }); };
      if (img.complete) check();
      else img.addEventListener('load', check, { once: true });
    }
  }, [tileFile]);

  const tiles = [];
  if (imgSize.w) {
    for (let y = 0; y < imgSize.h / 32; y++) {
      for (let x = 0; x < imgSize.w / 32; x++) {
        tiles.push({ x, y });
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in duration-200">
      <div className="bg-card border rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between bg-muted/30">
          <div>
            <h3 className="font-bold">Wrench: {data.item.name}</h3>
            <p className="text-[10px] text-muted-foreground">Select a tile variation from the spritesheet or clear override.</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-4 overflow-y-auto flex flex-wrap gap-1 justify-center bg-[#0d1117]">
          {tiles.map(t => (
             <button
               key={`${t.x},${t.y}`}
               onClick={() => onSelect(t.x, t.y)}
               className="group relative border border-white/5 hover:border-primary/50 bg-black/40 transition-colors rounded overflow-hidden"
               style={{ width: 44, height: 44 }}
             >
               <div 
                 className="absolute inset-1 pointer-events-none"
                 style={{
                   imageRendering: 'pixelated',
                   backgroundImage: `url(${getImage(tileFile)?.src})`,
                   backgroundPosition: `-${t.x * 32}px -${t.y * 32}px`,
                   backgroundSize: `${imgSize.w}px ${imgSize.h}px`,
                   transform: 'scale(1.125)',
                   transformOrigin: 'top left'
                 }}
               />
               <span className="absolute bottom-0 right-0 text-[6px] text-white/20 px-0.5 group-hover:text-primary/50">{t.x},{t.y}</span>
             </button>
          ))}
        </div>
        <div className="p-3 border-t bg-muted/30 flex justify-between">
          <Button variant="outline" size="sm" onClick={() => onSelect(0, null)}>Reset to Auto</Button>
          <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

const downloadItemPng = (item: GTItem) => {
  const img = getImage(item.file_name);
  if (!img || !isImageLoaded(img)) {
    toast({ title: 'Error', description: 'Image not loaded yet.', variant: 'destructive' });
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, item.tex_x * 32, item.tex_y * 32, 32, 32, 0, 0, 32, 32);

  const link = document.createElement('a');
  link.download = `${item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${item.id}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
};

// Sub-components
function SidebarItem({ item, selected, onClick, onDownload }: { item: GTItem; selected: boolean; onClick: () => void; onDownload: (item: GTItem) => void }) {
  const layer = autoLayer(item);
  return (
    <div
      className={`group w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-left border transition-colors mb-px relative ${
        selected
          ? 'bg-primary/10 border-primary/40'
          : 'border-transparent hover:bg-muted/50'
      }`}
    >
      <button onClick={onClick} className="absolute inset-0 z-0" />
      <div className="relative z-10 flex items-center gap-1.5 flex-1 min-w-0 pointer-events-none">
        <ItemIcon item={item} size={20} />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="text-[10px] font-bold truncate">{item.name}</div>
          <div className="text-[9px] text-muted-foreground">#{item.id}</div>
        </div>
        <span
          className="text-[8px] font-bold px-1 rounded border flex-shrink-0"
          style={{
            color: layer === 1 ? '#4ade80' : '#38bdf8',
            borderColor: layer === 1 ? 'rgba(74,222,128,0.4)' : 'rgba(56,189,248,0.4)',
            background: layer === 1 ? 'rgba(74,222,128,0.06)' : 'rgba(56,189,248,0.06)',
          }}
        >
          {layer === 1 ? 'BLK' : 'BG'}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 relative z-20 opacity-0 group-hover:opacity-100 hover:bg-primary/20 hover:text-primary transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDownload(item);
        }}
        title="Download PNG"
      >
        <Download className="w-3 h-3" />
      </Button>
    </div>
  );
}

function ItemIcon({ item, size }: { item: GTItem; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawnRef = useRef(false);

  useEffect(() => {
    drawnRef.current = false;
    const draw = () => {
      if (!canvasRef.current || drawnRef.current) return;
      const img = getImage(item.file_name);
      if (!img || !isImageLoaded(img)) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      const T = 32;
      const px = item.tex_x * T, py = item.tex_y * T;
      if (px + T <= img.naturalWidth && py + T <= img.naturalHeight) {
        ctx.drawImage(img, px, py, T, T, 0, 0, size, size);
      } else {
        ctx.fillStyle = '#1e2736';
        ctx.fillRect(0, 0, size, size);
      }
      drawnRef.current = true;
    };

    draw();
    const img = getImage(item.file_name);
    if (img && !isImageLoaded(img)) {
      img.addEventListener('load', draw, { once: true });
    }
    // Retry after a delay
    const t = setTimeout(draw, 2000);
    return () => clearTimeout(t);
  }, [item, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="flex-shrink-0 rounded"
      style={{ width: size, height: size, imageRendering: 'pixelated', background: 'rgba(0,0,0,0.3)' }}
    />
  );
}
