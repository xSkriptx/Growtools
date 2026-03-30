import { useState, useCallback, useEffect } from "react";
import { Image, Upload, Download, RefreshCw, ArrowRight, Archive, Zap } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RTTEXConverter, runConcurrent } from "@/lib/rttexConverter";
import JSZip from "jszip";

type ConvStatus = 'pending' | 'converting' | 'completed' | 'error';
interface Conv { file: File; status: ConvStatus; result?: Blob; resultUrl?: string; sourceUrl?: string; error?: string }

export default function RttexConverter() {
  const [conversions, setConversions] = useState<Conv[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [fastMode, setFastMode] = useState(true);
  const [conversionStartTime, setConversionStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    addFiles(Array.from(e.dataTransfer.files).filter(isSupported));
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []).filter(isSupported));
  };

  function isSupported(f: File) {
    return f.name.toLowerCase().endsWith('.rttex') || f.name.toLowerCase().endsWith('.png');
  }

  function addFiles(newFiles: File[]) {
    if (!newFiles.length) return;
    setConversions(prev => [...prev, ...newFiles.map(file => ({
      file,
      status: 'pending' as ConvStatus,
      sourceUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    }))]);
  }

  useEffect(() => {
    if (!isConverting || !conversionStartTime) return;
    const id = setInterval(() => setElapsedTime(Math.round((Date.now() - conversionStartTime) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isConverting, conversionStartTime]);

  // Mark a single conversion's status (thread-safe setter pattern)
  function setStatus(idx: number, update: Partial<Conv>) {
    setConversions(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      const updated = { ...c, ...update };
      // Create resultUrl for completed RTTEX conversions
      if (updated.status === 'completed' && updated.result && c.file.name.endsWith('.rttex')) {
        updated.resultUrl = URL.createObjectURL(updated.result);
      }
      return updated;
    }));
  }

  const convertFiles = async () => {
    const pending = conversions.map((c, i) => ({ ...c, i })).filter(c => c.status === 'pending');
    if (!pending.length) return;

    setIsConverting(true);
    setConversionStartTime(Date.now());
    setElapsedTime(0);

    // Mark all pending as 'converting' immediately so the UI reacts
    setConversions(prev => prev.map(c => c.status === 'pending' ? { ...c, status: 'converting' } : c));

    const tasks = pending.map(({ file, i }) => async () => {
      try {
        const result = file.name.endsWith('.rttex')
          ? await RTTEXConverter.convertRTTEXToPNG(file, fastMode)
          : await RTTEXConverter.convertPNGToRTTEX(file, fastMode);
        setStatus(i, { status: 'completed', result });
      } catch (err) {
        setStatus(i, {
          status: 'error',
          error: err instanceof Error ? err.message : 'Conversion failed'
        });
      }
    });

    await runConcurrent(tasks);

    setIsConverting(false);
    setConversionStartTime(null);
    setElapsedTime(0);
  };

  const downloadResult = (conv: Conv) => {
    if (!conv.result) return;
    const newName = conv.file.name.replace(/\.(rttex|png)$/i, conv.file.name.endsWith('.rttex') ? '.png' : '.rttex');
    RTTEXConverter.downloadBlob(conv.result, newName);
  };

  const downloadAllAsZip = async () => {
    const completed = conversions.filter(c => c.status === 'completed' && c.result);
    if (!completed.length) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (const c of completed) {
        const newName = c.file.name.replace(/\.(rttex|png)$/i, c.file.name.endsWith('.rttex') ? '.png' : '.rttex');
        zip.file(newName, c.result!);
      }
      RTTEXConverter.downloadBlob(await zip.generateAsync({ type: 'blob' }), 'converted_textures.zip');
    } finally {
      setIsZipping(false);
    }
  };

  const clearAll = () => {
    conversions.forEach(c => {
      if (c.sourceUrl) URL.revokeObjectURL(c.sourceUrl);
      if (c.resultUrl) URL.revokeObjectURL(c.resultUrl);
    });
    setConversions([]);
  };

  const completedCount = conversions.filter(c => c.status === 'completed').length;
  const doneCount = conversions.filter(c => c.status === 'completed' || c.status === 'error').length;
  const progress = conversions.length ? (doneCount / conversions.length) * 100 : 0;

  const statusDot = (s: ConvStatus) => ({
    completed: 'bg-gt-green', error: 'bg-gt-red', converting: 'bg-gt-yellow', pending: 'bg-muted'
  }[s]);

  return (
    <ToolPageLayout title="RTTEX Converter" description="Convert RTTEX texture files to PNG and vice versa." icon={Image} color="blue">
      <div className="space-y-6">

        {/* Fast Mode Toggle */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <Checkbox id="fast-mode" checked={fastMode} onCheckedChange={v => setFastMode(v as boolean)} />
              <Label htmlFor="fast-mode" className="flex items-center gap-2 cursor-pointer">
                <Zap className="w-4 h-4 text-yellow-500" />
                <span className="font-medium">Fast Conversion (Recommended)</span>
                <Badge variant="secondary" className="ml-2">6 parallel workers · level-0 deflate</Badge>
              </Label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {fastMode
                ? "Zero-copy pixel ops · no canvas for RTTEX decode · parallel batch execution"
                : "Canvas-based conversion with maximum compression"}
            </p>
          </CardContent>
        </Card>

        {/* Upload Zone */}
        <Card>
          <CardContent className="p-6">
            <input type="file" accept=".rttex,.png" multiple onChange={handleFileSelect} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="cursor-pointer block">
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
                onDragLeave={e => e.preventDefault()}
                className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              >
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Drop RTTEX or PNG files here</p>
                <p className="text-sm text-muted-foreground">Supports batch conversion • Max 20MB per file</p>
              </div>
            </label>
          </CardContent>
        </Card>

        {/* Conversion Queue */}
        {conversions.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>Queue ({conversions.length} files)</CardTitle>
                <div className="flex gap-2 items-center flex-wrap">
                  {isConverting && (
                    <div className="flex items-center gap-3">
                      <div className="w-32"><Progress value={progress} /></div>
                      <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                        {doneCount}/{conversions.length} · {elapsedTime}s
                      </span>
                    </div>
                  )}
                  <Button onClick={convertFiles} disabled={isConverting || conversions.every(c => c.status !== 'pending')}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${isConverting ? 'animate-spin' : ''}`} />
                    Convert All
                  </Button>
                  {completedCount > 0 && (
                    <Button variant="secondary" onClick={downloadAllAsZip} disabled={isZipping}>
                      <Archive className={`w-4 h-4 mr-2 ${isZipping ? 'animate-pulse' : ''}`} />
                      {isZipping ? 'Zipping…' : `Download ZIP (${completedCount})`}
                    </Button>
                  )}
                  <Button variant="outline" onClick={clearAll}>Clear All</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {conversions.map((conv, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-lg border bg-card/50">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot(conv.status)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{conv.file.name}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm text-muted-foreground">{conv.file.name.endsWith('.rttex') ? '.png' : '.rttex'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{(conv.file.size / 1024).toFixed(1)} KB</Badge>
                        <Badge variant={conv.status === 'completed' ? 'default' : conv.status === 'error' ? 'destructive' : 'secondary'}>
                          {conv.status}
                        </Badge>
                      </div>
                      {conv.error && <p className="text-sm text-destructive mt-1">{conv.error}</p>}
                    </div>
                    {(conv.status === 'converting' || conv.status === 'completed') && (
                      <div className="flex items-center gap-4">
                        {conv.file.name.endsWith('.png') && conv.sourceUrl && (
                          <div className="w-16 h-16 rounded overflow-hidden bg-black/10 border flex-shrink-0">
                            <img src={conv.sourceUrl} alt="Source" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                          </div>
                        )}
                        {conv.file.name.endsWith('.rttex') && conv.resultUrl && (
                          <div className="w-16 h-16 rounded overflow-hidden bg-black/10 border flex-shrink-0">
                            <img src={conv.resultUrl} alt="Converted" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                          </div>
                        )}
                        {conv.status === 'completed' && (
                          <Button size="sm" onClick={() => downloadResult(conv)}>
                            <Download className="w-4 h-4 mr-2" />Download
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-3">About RTTEX Format</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">RTTEX → PNG</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Extracts texture data from Growtopia files</li>
                  <li>• Preserves original image quality</li>
                  <li>• Compatible with image editors</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">PNG → RTTEX</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Converts PNG to game-compatible format</li>
                  <li>• Optimized for Growtopia textures</li>
                  <li>• Maintains transparency support</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ToolPageLayout>
  );

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      conversions.forEach(c => {
        if (c.sourceUrl) URL.revokeObjectURL(c.sourceUrl);
        if (c.resultUrl) URL.revokeObjectURL(c.resultUrl);
      });
    };
  }, []);
}