import { useState, useRef } from "react";
import { Globe, Search, Download, Loader2, ImageIcon } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function WorldRenderer() {
  const [worldName, setWorldName] = useState("");
  const [isRendering, setIsRendering] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [currentWorld, setCurrentWorld] = useState("");
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" | "checking" } | null>(
    { text: 'Enter a world name and click "Render World" to begin', type: "success" }
  );
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (text: string, type: "success" | "error" | "checking", autoClear = false) => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    setStatusMsg({ text, type });
    if (autoClear) statusTimerRef.current = setTimeout(() => setStatusMsg(null), 3000);
  };

  const renderWorld = async () => {
    const name = worldName.trim().toLowerCase();
    if (!name) { showStatus("Please enter a valid world name", "error"); return; }

    setIsRendering(true);
    setImageUrl(null);
    showStatus(`Rendering world: ${name}...`, "checking");

    const url = `https://corsproxy.io/?https://s3.amazonaws.com/world.growtopiagame.com/${name}.png`;

    try {
      const response = await fetch(url);
      if (response.status === 200) {
        const blob = await response.blob();
        if (blob.type === "image/png" || blob.size > 1000) {
          setImageUrl(URL.createObjectURL(blob));
          setCurrentWorld(name);
          showStatus(`Successfully rendered world: ${name}`, "success", true);
        } else {
          throw new Error("Invalid image format");
        }
      } else {
        showStatus(`World "${name}" has not been rendered yet. The owner needs to render it first.`, "error");
      }
    } catch (err) {
      showStatus(`Error rendering world: ${err instanceof Error ? err.message : "Unknown error"}`, "error");
    } finally {
      setIsRendering(false);
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `GT_${currentWorld}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const statusClasses = {
    success: "bg-gt-green/10 text-gt-green border border-gt-green/30",
    error: "bg-gt-red/10 text-gt-red border border-gt-red/30",
    checking: "bg-gt-yellow/10 text-gt-yellow border border-gt-yellow/30",
  };

  return (
    <ToolPageLayout title="World Renderer" description="Render any Growtopia world by entering its name." icon={Globe} color="blue">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Render a World</CardTitle>
            <p className="text-sm text-muted-foreground">Enter a Growtopia world name to generate a render of the world.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Enter world name (e.g., START)" value={worldName} onChange={(e) => setWorldName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !isRendering) renderWorld(); }} autoComplete="off" />
              <Button onClick={renderWorld} disabled={isRendering || !worldName.trim()}>
                {isRendering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isRendering ? "Rendering..." : "Render"}
              </Button>
            </div>
            {statusMsg && (
              <div className={cn("text-sm rounded-md px-3 py-2 text-center font-medium", statusClasses[statusMsg.type])}>{statusMsg.text}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Render Result</CardTitle>
            {imageUrl && (
              <Button variant="outline" size="sm" onClick={downloadImage}><Download className="w-3.5 h-3.5" /> Download</Button>
            )}
          </CardHeader>
          <CardContent>
            {imageUrl ? (
              <div className="rounded-lg overflow-hidden border bg-muted/30">
                <img src={imageUrl} alt={`Growtopia World: ${currentWorld}`} className="w-full h-auto" style={{ imageRendering: "pixelated" }} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <ImageIcon className="w-12 h-12 opacity-30" />
                <p>World render will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>About World Rendering</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>This tool connects to Growtopia's official rendering service to generate images of any Growtopia world. The world must have been visited at least once to be available.</p>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Common Issues</h4>
              <ul className="list-disc list-inside space-y-1">
                <li>If a world hasn't been visited yet, it won't have a render available</li>
                <li>Some worlds might be too new to have renders available immediately</li>
                <li>Very large worlds might take longer to render</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </ToolPageLayout>
  );
}
