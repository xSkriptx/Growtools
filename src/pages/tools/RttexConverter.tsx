import { useState, useCallback } from "react";
import { Image, Upload, Download, RefreshCw, ArrowRight } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RTTEXConverter } from "@/lib/rttexConverter";

export default function RttexConverter() {
  const [files, setFiles] = useState<File[]>([]);
  const [conversions, setConversions] = useState<{
    file: File;
    status: 'pending' | 'converting' | 'completed' | 'error';
    result?: Blob;
    error?: string;
  }[]>([]);
  const [isConverting, setIsConverting] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
      file.name.endsWith('.rttex') || file.name.endsWith('.png')
    );
    addFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(file =>
      file.name.endsWith('.rttex') || file.name.endsWith('.png')
    );
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles: File[]) => {
    setFiles(prev => [...prev, ...newFiles]);
    setConversions(prev => [
      ...prev,
      ...newFiles.map(file => ({ file, status: 'pending' as const }))
    ]);
  };

  const convertFiles = async () => {
    setIsConverting(true);
    
    for (let i = 0; i < conversions.length; i++) {
      if (conversions[i].status !== 'pending') continue;
      
      setConversions(prev => prev.map((conv, idx) => 
        idx === i ? { ...conv, status: 'converting' } : conv
      ));

      try {
        const file = conversions[i].file;
        let result: Blob;
        
        if (file.name.endsWith('.rttex')) {
          result = await RTTEXConverter.convertRTTEXToPNG(file);
        } else {
          result = await RTTEXConverter.convertPNGToRTTEX(file);
        }

        setConversions(prev => prev.map((conv, idx) => 
          idx === i ? { ...conv, status: 'completed', result } : conv
        ));
      } catch (error) {
        setConversions(prev => prev.map((conv, idx) => 
          idx === i ? { 
            ...conv, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Conversion failed' 
          } : conv
        ));
      }
    }
    
    setIsConverting(false);
  };

  const downloadResult = (conversion: typeof conversions[0]) => {
    if (!conversion.result) return;
    
    const originalName = conversion.file.name;
    const newExtension = originalName.endsWith('.rttex') ? '.png' : '.rttex';
    const newName = originalName.replace(/\.(rttex|png)$/i, newExtension);
    
    RTTEXConverter.downloadBlob(conversion.result, newName);
  };

  const clearAll = () => {
    setFiles([]);
    setConversions([]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-gt-green';
      case 'error': return 'bg-gt-red';
      case 'converting': return 'bg-gt-yellow';
      default: return 'bg-muted';
    }
  };

  return (
    <ToolPageLayout
      title="RTTEX Converter"
      description="Convert RTTEX texture files to PNG and vice versa."
      icon={Image}
      color="blue"
    >
      <div className="space-y-6">
        {/* Upload Zone */}
        <Card>
          <CardContent className="p-6">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            >
              <input
                type="file"
                accept=".rttex,.png"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">
                  Drop RTTEX or PNG files here
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports batch conversion • Max 20MB per file
                </p>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Queue */}
        {conversions.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Conversion Queue ({conversions.length} files)</CardTitle>
                <div className="flex gap-2">
                  <Button 
                    onClick={convertFiles} 
                    disabled={isConverting || conversions.every(c => c.status !== 'pending')}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isConverting ? 'animate-spin' : ''}`} />
                    Convert All
                  </Button>
                  <Button variant="outline" onClick={clearAll}>
                    Clear All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {conversions.map((conversion, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 rounded-lg border bg-card/50">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(conversion.status)}`} />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{conversion.file.name}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          {conversion.file.name.endsWith('.rttex') ? '.png' : '.rttex'}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {(conversion.file.size / 1024).toFixed(1)} KB
                        </Badge>
                        <Badge 
                          variant={
                            conversion.status === 'completed' ? 'default' :
                            conversion.status === 'error' ? 'destructive' :
                            conversion.status === 'converting' ? 'secondary' : 'outline'
                          }
                        >
                          {conversion.status}
                        </Badge>
                      </div>
                      
                      {conversion.error && (
                        <p className="text-sm text-destructive mt-1">{conversion.error}</p>
                      )}
                    </div>

                    {conversion.status === 'completed' && conversion.result && (
                      <div className="flex items-center gap-4">
                        {conversion.file.name.endsWith('.rttex') && (
                          <div className="w-16 h-16 rounded overflow-hidden bg-black/10 border flex-shrink-0">
                            <img 
                              src={URL.createObjectURL(conversion.result)} 
                              alt="Preview" 
                              className="w-full h-full object-contain"
                              style={{ imageRendering: 'pixelated' }}
                            />
                          </div>
                        )}
                        <Button size="sm" onClick={() => downloadResult(conversion)}>
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
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
}
