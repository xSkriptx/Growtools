export interface Item {
  id: number;
  name: string;
  type: number;
  material: number;
  file_name?: string;
  file_hash?: number;
  visual_type?: number;
  cook_time?: number;
  tex_x?: number;
  tex_y?: number;
  storage_type?: number;
  layer?: number;
  collision_type?: number;
  hardness?: number;
  regen_time?: number;
  clothing_type?: number;
  rarity?: number;
  max_hold?: number;
  alt_file_path?: string;
  alt_file_hash?: number;
  anim_ms?: number;
  pet_name?: string;
  pet_prefix?: string;
  pet_suffix?: string;
  pet_ability?: string;
  seed_base?: number;
  seed_over?: number;
  tree_base?: number;
  tree_over?: number;
  bg_col?: number;
  fg_col?: number;
  seed1?: number;
  seed2?: number;
  bloom_time?: number;
  anim_type?: number;
  anim_string?: string;
  anim_tex?: string;
  anim_string2?: string;
  dlayer1?: number;
  dlayer2?: number;
  properties2?: number;
  _unk?: Uint8Array;
  tile_range?: number;
  pile_range?: number;
  custom_punch?: string;
  _unk2?: Uint8Array;
  clock_div?: number;
  parent_id?: number;
  _unk3?: Uint8Array;
  alt_sit_path?: string;
  _unk4?: string;
  _unk5?: number;
  _unk6?: number;
  _unk7?: Uint8Array;
  _unk8?: number;
  _unk9?: number;
  item_description?: string;
  item_info?: number;
  _unk10?: number;
  properties?: number;
}

interface FieldDefinition {
  size: number;
  version: number;
}

const STRING = -1;
const STRING_XOR = -2;

function field(size: number, { version = 0 } = {}): FieldDefinition {
  return { size, version };
}

function getGenericTemplate() {
  return {
    "id": field(4),
    "properties": field(2),
    "type": field(1),
    "material": field(1),
    "name": field(STRING_XOR),
    "file_name": field(STRING),
    "file_hash": field(4),
    "visual_type": field(1),
    "cook_time": field(4),
    "tex_x": field(1),
    "tex_y": field(1),
    "storage_type": field(1),
    "layer": field(1),
    "collision_type": field(1),
    "hardness": field(1),
    "regen_time": field(4),
    "clothing_type": field(1),
    "rarity": field(2),
    "max_hold": field(1),
    "alt_file_path": field(STRING),
    "alt_file_hash": field(4),
    "anim_ms": field(4),
    "pet_name": field(STRING, { version: 4 }),
    "pet_prefix": field(STRING, { version: 4 }),
    "pet_suffix": field(STRING, { version: 4 }),
    "pet_ability": field(STRING, { version: 5 }),
    "seed_base": field(1),
    "seed_over": field(1),
    "tree_base": field(1),
    "tree_over": field(1),
    "bg_col": field(4),
    "fg_col": field(4),
    "seed1": field(2),
    "seed2": field(2),
    "bloom_time": field(4),
    "anim_type": field(4, { version: 7 }),
    "anim_string": field(STRING, { version: 7 }),
    "anim_tex": field(STRING, { version: 8 }),
    "anim_string2": field(STRING, { version: 8 }),
    "dlayer1": field(4, { version: 8 }),
    "dlayer2": field(4, { version: 8 }),
    "properties2": field(2, { version: 9 }),
    "_unk": field(62, { version: 9 }),
    "tile_range": field(4, { version: 10 }),
    "pile_range": field(4, { version: 10 }),
    "custom_punch": field(STRING, { version: 11 }),
    "_unk2": field(13, { version: 12 }),
    "clock_div": field(4, { version: 13 }),
    "parent_id": field(4, { version: 14 }),
    "_unk3": field(25, { version: 15 }),
    "alt_sit_path": field(STRING, { version: 15 }),
    "_unk4": field(STRING, { version: 16 }),
    "_unk5": field(4, { version: 17 }),
    "_unk6": field(4, { version: 18 }),
    "_unk7": field(9, { version: 19 }),
    "_unk8": field(1, { version: 20 }),
    "_unk9": field(1, { version: 21 }),
    "item_description": field(STRING, { version: 22 }),
    "item_info": field(4, { version: 23 }),
    "_unk10": field(1, { version: 24 }),
  };
}

function parseNumber(buffer: Uint8Array, offset: number, size: number) {
  let value = 0;
  for (let i = 0; i < size; i++) {
    value += buffer[offset + i] << (i * 8);
  }
  return { value, newOffset: offset + size };
}

function parseString(buffer: Uint8Array, offset: number) {
  const lr = parseNumber(buffer, offset, 2);
  const bytes = buffer.slice(lr.newOffset, lr.newOffset + lr.value);
  return { 
    value: new TextDecoder().decode(bytes), 
    newOffset: lr.newOffset + lr.value 
  };
}

function decryptItemName(name: string, id: number): string {
  const key = "PBG892FXX982ABC*";
  let result = "";
  for (let i = 0; i < name.length; i++) {
    result += String.fromCharCode(
      name.charCodeAt(i) ^ key[(i + id) % key.length].charCodeAt(0)
    );
  }
  return result;
}

export class DATParser {
  static async parseFile(file: File): Promise<Item[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const buffer = new Uint8Array(event.target?.result as ArrayBuffer);
          const result = this.parseItemsDat(buffer);
          resolve(result.items);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  static parseItemsDat(buffer: Uint8Array) {
    let offset = 0;
    
    // Parse version
    const vr = parseNumber(buffer, offset, 2);
    const version = vr.value;
    offset = vr.newOffset;
    
    if (version < 22) {
      throw new Error(`Unsupported items.dat version: ${version}. Need ≥22.`);
    }
    
    // Parse item count
    const cr = parseNumber(buffer, offset, 4);
    const itemCount = cr.value;
    offset = cr.newOffset;
    
    const template = getGenericTemplate();
    const items: Item[] = [];
    
    for (let i = 0; i < itemCount; i++) {
      const item: any = {};
      
      for (const [key, f] of Object.entries(template)) {
        if (f.version > version) continue;
        
        if (f.size === STRING_XOR) {
          const r = parseString(buffer, offset);
          item[key] = decryptItemName(r.value, i);
          offset = r.newOffset;
        } else if (f.size === STRING) {
          const r = parseString(buffer, offset);
          item[key] = r.value;
          offset = r.newOffset;
        } else if (f.size > 0) {
          if (f.size <= 4) {
            const r = parseNumber(buffer, offset, f.size);
            item[key] = r.value;
            offset = r.newOffset;
          } else {
            // Store as byte array for unknown fields
            item[key] = buffer.slice(offset, offset + f.size);
            offset += f.size;
          }
        }
      }
      
      items.push(item);
    }
    
    return { version, itemCount, items };
  }

  static async fetchFromGitHub(version: string): Promise<Item[]> {
    const url = `https://raw.githubusercontent.com/kabuokis/growtopia-data/main/${version}/items.dat`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} – file not found for version ${version}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const result = this.parseItemsDat(buffer);
      
      return result.items;
    } catch (error) {
      throw new Error(`Failed to fetch from GitHub: ${error}`);
    }
  }

  static async getAvailableVersions(): Promise<string[]> {
    try {
      const response = await fetch('https://api.github.com/repos/kabuokis/growtopia-data/contents/');
      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
      
      const entries = await response.json();
      const versions = entries
        .filter((e: any) => e.type === 'dir' && /^\d/.test(e.name))
        .map((e: any) => e.name)
        .sort((a: string, b: string) => {
          const av = a.split('.').map(Number);
          const bv = b.split('.').map(Number);
          for (let i = 0; i < Math.max(av.length, bv.length); i++) {
            const d = (bv[i] || 0) - (av[i] || 0);
            if (d !== 0) return d;
          }
          return 0;
        });
      
      return versions;
    } catch (error) {
      throw new Error(`Could not load versions from GitHub: ${error}`);
    }
  }

  static exportToJSON(items: Item[]): string {
    return JSON.stringify(items, null, 2);
  }

  static exportToCSV(items: Item[]): string {
    if (items.length === 0) return '';
    
    const headers = Object.keys(items[0]);
    const rows = items.map(item => 
      headers.map(header => {
        const value = item[header as keyof Item];
        if (value === undefined || value === null) return '';
        if (value instanceof Uint8Array) {
          return Array.from(value).map(b => ('0' + b.toString(16)).slice(-2)).join(' ');
        }
        return `"${String(value).replace(/"/g, '""')}"`;
      })
    );
    
    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  static exportToTXT(items: Item[]): string {
    if (items.length === 0) return '';
    
    const headers = Object.keys(items[0]);
    const lines = [headers.join('|')];
    
    items.forEach(item => {
      const row = headers.map(header => {
        const value = item[header as keyof Item];
        if (value === undefined || value === null) return '';
        if (value instanceof Uint8Array) {
          return Array.from(value).map(b => ('0' + b.toString(16)).slice(-2)).join(' ');
        }
        return String(value).replace(/\|/g, '_'); // escape pipes
      });
      lines.push(row.join('|'));
    });
    
    return lines.join('\n');
  }

  static isNullItem(item: Item): boolean {
    return !item.name || item.name.trim() === '' || item.id === 0;
  }
}