export interface GTItem {
  id: number;
  type: number;
  name: string;
  file_name: string;
  tex_x: number;
  tex_y: number;
  spread_type: number;
  layer: number;
  collision: number;
  clothing_type: number;
  bg_col: number;
  bloom_time: number;
}

export type Tool = 'pencil' | 'erase' | 'fill' | 'eyedrop' | 'line' | 'rect' | 'fillRect' | 'circle' | 'pan' | 'wrench' | 'paint' | 'select';
export type LayerMode = 'auto' | 0 | 1;
export interface WrenchOverride {
  tx: number;
  ty: number;
}

export interface ClipboardCell {
  ox: number;
  oy: number;
  layer: number;
  id: number;
  paintId?: number | null;
}

export interface WorldState {
  width: number;
  height: number;
  layers: (number | null)[][]; // [layer][y*width+x]
  paint?: (number | null)[]; // [y*width+x]
  overrides?: Record<string, WrenchOverride>; // "layer,x,y" -> override
}

export interface ViewState {
  x: number;
  y: number;
  zoom: number;
}
