import pako from 'pako';

export class RTTEXConverter {
  static async convertRTTEXToPNG(file: File): Promise<Blob> {
    const arrayBuffer = await file.arrayBuffer();
    const res = await this.decodeRTTEXBufferComplete(arrayBuffer);
    return res.blob;
  }

  static async convertPNGToRTTEX(file: File): Promise<Blob> {
    const arrayBuffer = await file.arrayBuffer();
    const res = await this.encodePNGToRTTEX(arrayBuffer);
    return res.blob;
  }

  private static makeURL(blob: Blob) {
    return URL.createObjectURL(blob);
  }

  private static asciiEquals(u8arr: Uint8Array, offset: number, text: string) {
    for (let i = 0; i < text.length; i++) {
      if (u8arr[offset + i] !== text.charCodeAt(i)) return false;
    }
    return true;
  }

  private static findEmbeddedPNG(buffer: ArrayBuffer) {
    const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const view = new Uint8Array(buffer);
    for (let i = 0; i <= view.length - sig.length; i++) {
      let ok = true;
      for (let j = 0; j < sig.length; j++) {
        if (view[i + j] !== sig[j]) { ok = false; break; }
      }
      if (ok) return i;
    }
    return -1;
  }

  private static decompressIfRTPACK(u8: Uint8Array): Uint8Array {
    if (u8.length >= 6 && this.asciiEquals(u8, 0, 'RTPACK')) {
      const compressed = u8.subarray(32);
      return pako.inflate(compressed) as Uint8Array;
    }
    return u8 as Uint8Array;
  }

  private static lowestPowerOfTwoGE(n: number) {
    let v = 1;
    while (v < n) v <<= 1;
    return v;
  }

  private static async packPngToRTPACKFromArrayBuffer(arrayBuffer: ArrayBuffer, imgWidth: number, imgHeight: number, rawRGBAflipped: Uint8Array) {
    const header = new Uint8Array(124);
    header.set(new TextEncoder().encode('RTTXTR'), 0);
    const dv = new DataView(header.buffer);
    dv.setUint32(8, this.lowestPowerOfTwoGE(imgHeight), true);
    dv.setUint32(12, this.lowestPowerOfTwoGE(imgWidth), true);
    dv.setUint32(16, 5121, true);
    dv.setUint32(20, imgHeight, true);
    dv.setUint32(24, imgWidth, true);
    header[28] = 1;
    dv.setUint32(32, 1, true);
    dv.setUint32(100, imgHeight, true);
    dv.setUint32(104, imgWidth, true);
    dv.setUint32(108, rawRGBAflipped.length, true);
    dv.setUint32(112, 0, true);

    const toCompress = new Uint8Array(header.length + rawRGBAflipped.length);
    toCompress.set(header, 0);
    toCompress.set(rawRGBAflipped, header.length);

    const compressed = pako.deflate(toCompress);
    const rtpack = new Uint8Array(32);
    rtpack.set(new TextEncoder().encode('RTPACK'), 0);
    const dv2 = new DataView(rtpack.buffer);
    dv2.setUint32(8, compressed.length, true);
    dv2.setUint32(12, 124 + rawRGBAflipped.length, true);
    rtpack[16] = 1;

    return new Blob([rtpack, compressed], { type: 'application/octet-stream' });
  }

  private static loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
      const img = new Image();
      const url = this.makeURL(blob);
      img.onload = () => { URL.revokeObjectURL(url); res(img); };
      img.onerror = () => rej(new Error('Failed to load image'));
      img.src = url;
    });
  }

  private static flipImageDataToRawRGBAflipped(imageData: ImageData) {
    const { width, height, data } = imageData;
    const out = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) {
      const srcRow = height - 1 - y;
      const srcOff = srcRow * width * 4;
      const dstOff = y * width * 4;
      out.set(data.subarray(srcOff, srcOff + width * 4), dstOff);
    }
    return out;
  }

  static async decodeRTTEXBufferComplete(
    arrayBuffer: ArrayBuffer,
    opts = { forceOpaque: false }
  ): Promise<{ url: string; blob: Blob; mime: string; note: string; width: number | null; height: number | null }> {
    let u8: Uint8Array = new Uint8Array(arrayBuffer) as any;
    if (u8.length >= 6 && this.asciiEquals(u8, 0, 'RTPACK')) u8 = this.decompressIfRTPACK(u8) as any;
    
    if (!(u8.length >= 6 && this.asciiEquals(u8, 0, 'RTTXTR'))) {
      const emb = this.findEmbeddedPNG(u8.buffer as ArrayBuffer);
      if (emb >= 0) {
        const pngBlob = new Blob([(u8.buffer as ArrayBuffer).slice(emb)], { type: 'image/png' });
        return { url: this.makeURL(pngBlob), blob: pngBlob, mime: 'image/png', note: 'embedded-png', width: null, height: null };
      }
      throw new Error('Not a RTTEX (RTTXTR) file');
    }

    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    const height = dv.getUint32(8, true);
    const width = dv.getUint32(12, true);
    const channels = 3 + dv.getUint8(28);
    const dataStart = 124;
    const pixelBytes = u8.subarray(dataStart);
    const rgba = new Uint8ClampedArray(width * height * 4);

    if (channels === 4) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const src = (y * width + x) * 4;
          const dst = ((height - 1 - y) * width + x) * 4;
          rgba[dst] = pixelBytes[src];
          rgba[dst + 1] = pixelBytes[src + 1];
          rgba[dst + 2] = pixelBytes[src + 2];
          rgba[dst + 3] = pixelBytes[src + 3];
        }
      }
    } else if (channels === 3) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const src = (y * width + x) * 3;
          const dst = ((height - 1 - y) * width + x) * 4;
          rgba[dst] = pixelBytes[src];
          rgba[dst + 1] = pixelBytes[src + 1];
          rgba[dst + 2] = pixelBytes[src + 2];
          rgba[dst + 3] = 255;
        }
      }
    }

    if (opts.forceOpaque) {
      for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get 2d context");

    const imgData = new ImageData(rgba, width, height);
    ctx.putImageData(imgData, 0, 0);

    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob(blob => blob ? res(blob) : rej(new Error("Failed to create blob")), 'image/png'));
    
    return { url: this.makeURL(blob), blob, mime: 'image/png', note: 'decoded', width, height };
  }

  static async encodePNGToRTTEX(arrayBuffer: ArrayBuffer, opts = {}): Promise<{ url: string; blob: Blob; mime: string; note: string; width: number; height: number }> {
    const blob = new Blob([arrayBuffer], { type: 'image/png' });
    const img = await this.loadImageFromBlob(blob);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not get 2d context");

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const rawRGBAflipped = this.flipImageDataToRawRGBAflipped(imageData);
    const rttxBlob = await this.packPngToRTPACKFromArrayBuffer(arrayBuffer, img.width, img.height, rawRGBAflipped);
    
    return { url: this.makeURL(rttxBlob), blob: rttxBlob, mime: 'application/octet-stream', note: 'encoded', width: img.width, height: img.height };
  }

  static downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}