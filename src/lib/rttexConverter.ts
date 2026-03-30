/**
 * rttexConverter.ts — optimised edition
 *
 * Key changes vs previous version:
 *  - All pako inflate/deflate runs in Web Workers → main thread never freezes
 *  - RTTEX→PNG uses canvas.toBlob (browser's native C++ PNG encoder)
 *    instead of pako deflate — much faster for output
 *  - PNG→RTTEX uses the minimal PNG decoder in the worker (no Image/canvas decode)
 *  - Transferable ArrayBuffers for zero-copy cross-thread message passing
 *  - Worker pool sized to min(hardwareConcurrency/2, 4) — parallel but no OOM
 *  - Sequential per-worker queue (memory released between files)
 */

import pako from 'pako';

// ─── Worker source inlined as a blob URL (no extra build config needed) ───────
const WORKER_SRC = `
"use strict";
importScripts('https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js');

function asciiEq(u8,off,s){for(let i=0;i<s.length;i++)if(u8[off+i]!==s.charCodeAt(i))return false;return true;}
function findPNGSig(u8){const s=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];outer:for(let i=0;i<=u8.length-8;i++){for(let j=0;j<8;j++)if(u8[i+j]!==s[j])continue outer;return i;}return -1;}
function pow2(n){let v=1;while(v<n)v<<=1;return v;}
const ENC=new TextEncoder();

// RTTEX → raw RGBA (all CPU work in the worker)
function decodeRTTEX(buf){
  let u8=new Uint8Array(buf);
  if(u8.length>=6&&asciiEq(u8,0,'RTPACK'))u8=pako.inflate(u8.subarray(32));
  if(!asciiEq(u8,0,'RTTXTR')){
    const emb=findPNGSig(u8);
    if(emb>=0){const sl=u8.slice(emb);return{type:'embedded-png',data:sl.buffer};}
    throw new Error('Not a RTTEX file');
  }
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  const height=dv.getUint32(8,true),width=dv.getUint32(12,true);
  const channels=3+u8[28],pixels=u8.subarray(124);
  const rgba=new Uint8ClampedArray(width*height*4);
  const rw=width*4;
  if(channels===4){
    for(let y=0;y<height;y++)rgba.set(pixels.subarray(y*rw,y*rw+rw),(height-1-y)*rw);
  }else{
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const s=(y*width+x)*3,d=((height-1-y)*width+x)*4;
      rgba[d]=pixels[s];rgba[d+1]=pixels[s+1];rgba[d+2]=pixels[s+2];rgba[d+3]=255;
    }
  }
  return{type:'rgba',rgba:rgba.buffer,width,height};
}

// Minimal PNG decoder — colour types 2 (RGB) and 6 (RGBA) only
function decodePNG(buf){
  const u8=new Uint8Array(buf),dv=new DataView(buf);
  let width=0,height=0,colorType=0;
  const idats=[];
  let pos=8;
  while(pos<u8.length){
    const len=dv.getUint32(pos,false);
    const type=String.fromCharCode(u8[pos+4],u8[pos+5],u8[pos+6],u8[pos+7]);
    const doff=pos+8;
    if(type==='IHDR'){width=dv.getUint32(doff,false);height=dv.getUint32(doff+4,false);colorType=u8[doff+9];}
    else if(type==='IDAT')idats.push(u8.subarray(doff,doff+len));
    else if(type==='IEND')break;
    pos+=12+len;
  }
  const ch=colorType===6?4:3,stride=1+width*ch;
  const combined=new Uint8Array(idats.reduce((s,c)=>s+c.length,0));
  let off=0;for(const c of idats){combined.set(c,off);off+=c.length;}
  const inflated=pako.inflate(combined);
  const rgba=new Uint8ClampedArray(width*height*4);
  const prev=new Uint8Array(width*ch);
  for(let y=0;y<height;y++){
    const flt=inflated[y*stride];
    const row=inflated.subarray(y*stride+1,y*stride+1+width*ch);
    const out=new Uint8Array(width*ch);
    for(let x=0;x<row.length;x++){
      const a=x<ch?0:out[x-ch],b=prev[x],c=x<ch?0:prev[x-ch];
      let v=row[x];
      if(flt===1)v=(v+a)&0xff;
      else if(flt===2)v=(v+b)&0xff;
      else if(flt===3)v=(v+((a+b)>>>1))&0xff;
      else if(flt===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v=(v+(pa<=pb&&pa<=pc?a:pb<=pc?b:c))&0xff;}
      out[x]=v;
    }
    prev.set(out);
    const base=y*width*4;
    if(ch===4)rgba.set(out,base);
    else for(let x=0;x<width;x++){rgba[base+x*4]=out[x*3];rgba[base+x*4+1]=out[x*3+1];rgba[base+x*4+2]=out[x*3+2];rgba[base+x*4+3]=255;}
  }
  return{rgba:rgba.buffer,width,height};
}

// RGBA (already flipped) → RTPACK/RTTEX bytes
function packRTTEX(width,height,flippedRGBA,fastMode){
  const hdr=new Uint8Array(124),dv=new DataView(hdr.buffer);
  hdr.set(ENC.encode('RTTXTR'),0);
  dv.setUint32(8,pow2(height),true);dv.setUint32(12,pow2(width),true);
  dv.setUint32(16,5121,true);dv.setUint32(20,height,true);dv.setUint32(24,width,true);
  hdr[28]=1;dv.setUint32(32,1,true);
  dv.setUint32(100,height,true);dv.setUint32(104,width,true);dv.setUint32(108,flippedRGBA.length,true);
  const payload=new Uint8Array(hdr.length+flippedRGBA.length);
  payload.set(hdr,0);payload.set(flippedRGBA,hdr.length);
  const compressed=pako.deflate(payload,{level:fastMode?1:6});
  const rtpack=new Uint8Array(32),dv2=new DataView(rtpack.buffer);
  rtpack.set(ENC.encode('RTPACK'),0);
  dv2.setUint32(8,compressed.length,true);dv2.setUint32(12,payload.length,true);rtpack[16]=1;
  const out=new Uint8Array(32+compressed.length);
  out.set(rtpack,0);out.set(compressed,32);
  return out.buffer;
}

self.onmessage=function(e){
  const{id,op,buffer,width,height,fastMode,flippedRGBA}=e.data;
  try{
    if(op==='decodeRTTEX'){
      const r=decodeRTTEX(buffer);
      if(r.type==='embedded-png')self.postMessage({id,type:'embedded-png',data:r.data},[r.data]);
      else self.postMessage({id,type:'rgba',rgba:r.rgba,width:r.width,height:r.height},[r.rgba]);
    }else if(op==='decodePNG'){
      const{rgba,width:w,height:h}=decodePNG(buffer);
      self.postMessage({id,rgba,width:w,height:h},[rgba]);
    }else if(op==='packRTTEX'){
      const buf=packRTTEX(width,height,new Uint8Array(flippedRGBA),fastMode);
      self.postMessage({id,rttexBuf:buf},[buf]);
    }
  }catch(err){
    self.postMessage({id,error:err.message});
  }
};
`;

// ─── Worker pool ──────────────────────────────────────────────────────────────
class WorkerPool {
  private workers: Worker[] = [];
  private queue: Array<(w: Worker) => void> = [];
  private idle: Worker[] = [];
  private blobURL: string;

  constructor(size: number) {
    this.blobURL = URL.createObjectURL(new Blob([WORKER_SRC], { type: 'application/javascript' }));
    for (let i = 0; i < size; i++) {
      const w = new Worker(this.blobURL);
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  acquire(): Promise<Worker> {
    if (this.idle.length > 0) return Promise.resolve(this.idle.pop()!);
    return new Promise(resolve => this.queue.push(resolve));
  }

  release(w: Worker) {
    const next = this.queue.shift();
    if (next) next(w); else this.idle.push(w);
  }

  send<T>(w: Worker, msg: Record<string, unknown>, transfers: Transferable[] = []): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);
      const handler = (e: MessageEvent) => {
        if (e.data.id !== id) return;
        w.removeEventListener('message', handler);
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(e.data as T);
      };
      w.addEventListener('message', handler);
      w.postMessage({ ...msg, id }, transfers);
    });
  }
}

let _pool: WorkerPool | null = null;
function pool(): WorkerPool {
  if (!_pool) {
    const size = Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency ?? 4) / 2)));
    _pool = new WorkerPool(size);
  }
  return _pool;
}

// ─── Main thread helpers ──────────────────────────────────────────────────────
function makeURL(blob: Blob) { return URL.createObjectURL(blob); }

// Browser's native C++ PNG encoder — faster than pako deflate in JS
function rgbaToBlob(rgba: ArrayBuffer, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  return new Promise((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png'));
}

// Flip rows in-place with a single swap buffer
function flipRows(rgba: Uint8ClampedArray, width: number, height: number) {
  const rw = width * 4, tmp = new Uint8Array(rw);
  for (let y = 0; y < (height >> 1); y++) {
    const a = y * rw, b = (height - 1 - y) * rw;
    tmp.set(rgba.subarray(a, a + rw));
    rgba.set(rgba.subarray(b, b + rw), a);
    rgba.set(tmp, b);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export class RTTEXConverter {

  static async convertRTTEXToPNG(file: File, fastMode = true): Promise<Blob> {
    const buf = await file.arrayBuffer();

    if (fastMode) {
      const p = pool();
      const w = await p.acquire();
      try {
        // Worker: RTPACK inflate + pixel reorder (CPU heavy, off main thread)
        const res = await p.send<any>(w, { op: 'decodeRTTEX', buffer: buf }, [buf]);
        if (res.type === 'embedded-png') return new Blob([res.data], { type: 'image/png' });
        // Main thread: native C++ PNG encoder via canvas.toBlob
        return await rgbaToBlob(res.rgba, res.width, res.height);
      } finally {
        p.release(w);
      }
    }

    return (await RTTEXConverter._decodeComplete(buf)).blob;
  }

  static async convertPNGToRTTEX(file: File, fastMode = true): Promise<Blob> {
    const buf = await file.arrayBuffer();

    if (fastMode) {
      const p = pool();
      const w = await p.acquire();
      try {
        // Worker: PNG inflate + filter reconstruction
        const dec = await p.send<any>(w, { op: 'decodePNG', buffer: buf }, [buf]);
        // Flip rows on main thread (fast typed-array op)
        const rgba = new Uint8ClampedArray(dec.rgba);
        flipRows(rgba, dec.width, dec.height);
        const flipped = new Uint8Array(rgba.buffer);
        // Worker: pako deflate for RTTEX packing (CPU heavy, off main thread)
        const packed = await p.send<any>(w,
          { op: 'packRTTEX', width: dec.width, height: dec.height, flippedRGBA: flipped.buffer, fastMode },
          [flipped.buffer]
        );
        return new Blob([packed.rttexBuf], { type: 'application/octet-stream' });
      } finally {
        p.release(w);
      }
    }

    return (await RTTEXConverter._encodeComplete(buf)).blob;
  }

  // ── Slow complete paths ───────────────────────────────────────────────────
  private static async _decodeComplete(buf: ArrayBuffer) {
    let u8 = new Uint8Array(buf);
    if (u8.length >= 6 && this._ascii(u8, 0, 'RTPACK')) u8 = pako.inflate(u8.subarray(32));
    if (!this._ascii(u8, 0, 'RTTXTR')) {
      const emb = this._findPNG(u8);
      if (emb >= 0) { const blob = new Blob([u8.subarray(emb)], { type: 'image/png' }); return { blob }; }
      throw new Error('Not a RTTEX file');
    }
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const height = dv.getUint32(8, true), width = dv.getUint32(12, true);
    const ch = 3 + u8[28], px = u8.subarray(124);
    const rgba = new Uint8ClampedArray(width * height * 4), rw = width * 4;
    if (ch === 4) {
      for (let y = 0; y < height; y++) rgba.set(px.subarray(y*rw, y*rw+rw), (height-1-y)*rw);
    } else {
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const s=(y*width+x)*3, d=((height-1-y)*width+x)*4;
        rgba[d]=px[s]; rgba[d+1]=px[s+1]; rgba[d+2]=px[s+2]; rgba[d+3]=255;
      }
    }
    const blob = await rgbaToBlob(rgba.buffer, width, height);
    return { blob };
  }

  private static async _encodeComplete(buf: ArrayBuffer) {
    const imgBlob = new Blob([buf], { type: 'image/png' });
    const bitmap = await createImageBitmap(imgBlob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0); bitmap.close();
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const flipped = new Uint8Array(width * height * 4), rw = width * 4;
    for (let y = 0; y < height; y++) flipped.set(data.subarray(y*rw, y*rw+rw), (height-1-y)*rw);
    const blob = await this._packRTTEX(width, height, flipped, false);
    return { blob };
  }

  private static async _packRTTEX(width: number, height: number, flipped: Uint8Array, fast: boolean): Promise<Blob> {
    const pow2 = (n: number) => { let v=1; while(v<n) v<<=1; return v; };
    const enc = new TextEncoder();
    const hdr = new Uint8Array(124), dv = new DataView(hdr.buffer);
    hdr.set(enc.encode('RTTXTR'),0);
    dv.setUint32(8,pow2(height),true); dv.setUint32(12,pow2(width),true);
    dv.setUint32(16,5121,true); dv.setUint32(20,height,true); dv.setUint32(24,width,true);
    hdr[28]=1; dv.setUint32(32,1,true);
    dv.setUint32(100,height,true); dv.setUint32(104,width,true); dv.setUint32(108,flipped.length,true);
    const payload = new Uint8Array(hdr.length + flipped.length);
    payload.set(hdr,0); payload.set(flipped,hdr.length);
    const compressed = pako.deflate(payload, { level: fast?1:6 });
    const rtpack = new Uint8Array(32), dv2 = new DataView(rtpack.buffer);
    rtpack.set(enc.encode('RTPACK'),0);
    dv2.setUint32(8,compressed.length,true); dv2.setUint32(12,payload.length,true); rtpack[16]=1;
    return new Blob([rtpack, compressed], { type: 'application/octet-stream' });
  }

  private static _ascii(u8: Uint8Array, off: number, s: string) {
    for (let i=0;i<s.length;i++) if(u8[off+i]!==s.charCodeAt(i)) return false; return true;
  }
  private static _findPNG(u8: Uint8Array) {
    const sig=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];
    outer: for(let i=0;i<=u8.length-8;i++){for(let j=0;j<8;j++)if(u8[i+j]!==sig[j])continue outer;return i;}
    return -1;
  }

  static downloadBlob(blob: Blob, filename: string) {
    const url = makeURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Concurrency is managed by the worker pool's acquire/release semaphore.
// Just run all tasks — the pool throttles automatically.
export async function runConcurrent<T>(tasks: (() => Promise<T>)[]): Promise<T[]> {
  return Promise.all(tasks.map(t => t()));
}