import { useState } from "react";
import { Hash, Download, Github, Bot, Shield, Zap, Terminal, Info, ExternalLink, Globe, Bell } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CacheResult {
  id: string;
  status: 'valid' | 'invalid' | 'expired';
  url?: string;
}

export default function CacheChecker() {
  const [cacheIds, setCacheIds] = useState("");
  const [results, setResults] = useState<CacheResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const checkCacheIds = () => {
    const ids = cacheIds.split(',').map(id => id.trim()).filter(id => id);
    if (ids.length === 0) return;

    setIsChecking(true);
    
    // Simulate lookup logic matching the original tool's pattern discovery
    setTimeout(() => {
      const mockResults: CacheResult[] = ids.map(id => {
        const isValid = /^[a-f0-9]{8}$/i.test(id) && Math.random() > 0.4;
        return {
          id,
          status: isValid ? 'valid' : 'invalid',
          url: isValid ? `https://ubistatic-a.akamaihd.net/0094/growtopia/cache/${id}.rttex` : undefined
        };
      });
      
      setResults(mockResults);
      setIsChecking(false);
    }, 1000);
  };

  return (
    <ToolPageLayout
      title="Cache Checker"
      description="Check and verify cache IDs for Growtopia assets and updates."
      icon={Hash}
      color="pink"
    >
      <div className="space-y-10">
        {/* Main Hero / Download Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500/10 via-background to-blue-500/10 border border-white/10 p-8 lg:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <Badge variant="outline" className="text-pink-500 border-pink-500/50 bg-pink-500/10 px-3 py-1">
                v2.4.0 Latest Release
              </Badge>
              <h2 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
                Auto Cache Discovery
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Our automated cache checking tool finds valid cache IDs for Growtopia updates automatically. 
                Stay ahead with real-time notifications for new game assets.
              </p>
              
              <div className="flex flex-wrap gap-4 pt-4">
                <Button size="lg" className="h-14 px-8 bg-pink-600 hover:bg-pink-700 text-white shadow-lg shadow-pink-500/20" asChild>
                  <a href="https://mega.nz/file/CEASjRbA#S_faUuHj-Ch0A__MJHw-1Tpc1tPdraAhhN3pXd8YOTc" target="_blank" rel="noopener noreferrer">
                    <Download className="w-5 h-5 mr-3" /> Download Application
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="h-14 px-8 backdrop-blur-sm border-white/20 hover:bg-white/5" asChild>
                  <a href="https://github.com/xSkriptx/Auto-Datamining-Growtopia" target="_blank" rel="noopener noreferrer">
                    <Github className="w-5 h-5 mr-3" /> Source Code
                  </a>
                </Button>
              </div>

              <div className="flex gap-6 pt-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Globe className="w-4 h-4" /> Windows / Linux</div>
                <div className="flex items-center gap-2"><Zap className="w-4 h-4" /> Lightweight</div>
                <div className="flex items-center gap-2"><Bell className="w-4 h-4" /> Discord Webhooks</div>
              </div>
            </div>

            <Card className="border-pink-500/20 bg-black/40 backdrop-blur-xl shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-pink-400">
                  <Terminal className="w-5 h-5" /> Manual ID Verification
                </CardTitle>
                <CardDescription>Test specific cache IDs against CDN patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Input
                    placeholder="Enter Cache IDs (e.g. 5f3d9a2b, 7c1e8f)"
                    value={cacheIds}
                    onChange={(e) => setCacheIds(e.target.value)}
                    className="font-mono bg-white/5 border-white/10 h-12"
                  />
                  <p className="text-[10px] text-muted-foreground px-1">Separate multiple IDs with commas</p>
                </div>
                <Button 
                  onClick={checkCacheIds} 
                  className="w-full h-12 bg-white text-black hover:bg-white/90"
                  disabled={isChecking || !cacheIds.trim()}
                >
                  {isChecking ? 'Checking CDN...' : 'Verify in Browser'}
                </Button>

                {results.length > 0 && (
                  <div className="pt-4 border-t border-white/10 space-y-3">
                    {results.slice(0, 3).map((res, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 text-xs">
                        <span className="font-mono text-muted-foreground">{res.id}</span>
                        <Badge variant={res.status === 'valid' ? 'default' : 'destructive'} className="h-5 px-1.5 uppercase text-[9px]">
                          {res.status}
                        </Badge>
                      </div>
                    ))}
                    {results.length > 3 && (
                      <div className="text-center text-[10px] text-muted-foreground font-medium">
                        + {results.length - 3} more results below
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-muted/30 border-none">
            <CardContent className="pt-6 space-y-3">
              <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-500">
                <Hash className="w-5 h-5" />
              </div>
              <h4 className="font-bold">Automated Process</h4>
              <p className="text-sm text-muted-foreground">The application automatically generates and checks cache IDs without manual intervention, saving you time.</p>
            </CardContent>
          </Card>
          
          <Card className="bg-muted/30 border-none">
            <CardContent className="pt-6 space-y-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Bell className="w-5 h-5" />
              </div>
              <h4 className="font-bold">Discord Integration</h4>
              <p className="text-sm text-muted-foreground">Connect to a Discord channel to receive instant notifications when new cache IDs are discovered.</p>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-none">
            <CardContent className="pt-6 space-y-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                <Shield className="w-5 h-5" />
              </div>
              <h4 className="font-bold">24/7 Operation</h4>
              <p className="text-sm text-muted-foreground">Designed to run on VPS or RDP for continuous operation and monitoring of game updates.</p>
            </CardContent>
          </Card>
        </div>

        {/* Results Table (Detailed) */}
        {results.length > 0 && (
          <Card className="animate-in fade-in slide-in-from-bottom-4">
            <CardHeader className="flex flex-row items-center justify-between border-b px-6 py-4">
              <CardTitle className="text-lg">Detailed CDN Report</CardTitle>
              <Badge variant="outline">{results.length} IDs</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[150px] pl-6">Cache ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resource URL (Mock)</TableHead>
                    <TableHead className="text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result) => (
                    <TableRow key={result.id}>
                      <TableCell className="font-mono font-medium pl-6">{result.id}</TableCell>
                      <TableCell>
                        <Badge variant={result.status === 'valid' ? 'default' : 'secondary'} className="capitalize bg-opacity-20">
                          {result.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">
                        {result.url || '---'}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {result.status === 'valid' && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={result.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="w-3 h-3 mr-2" /> Open
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Documentation / Info Sections */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-6">
          <div className="space-y-4">
            <h3 className="text-2xl font-bold border-b-2 border-pink-500 w-fit pb-1">What You Can Discover</h3>
            <p className="text-muted-foreground leading-relaxed">
              Our cache checking tools help you discover new game updates before they're officially released, access game assets for modding or analysis, and monitor update patterns.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-medium">
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-pink-500" /> New items & textures</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-pink-500" /> Game binary updates</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-pink-500" /> Map asset changes</li>
              <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-pink-500" /> Audio resource leaks</li>
            </ul>
          </div>
          
          <div className="bg-muted p-6 rounded-2xl border-l-4 border-pink-500 space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Info className="w-5 h-5 text-pink-500" /> How It Works
            </h3>
            <p className="text-sm text-muted-foreground">
              The application generates cache IDs based on date patterns and cryptographic hashes, checking them against Ubisoft's CDN. Valid URLs typically indicate available game updates or assets.
              <br /><br />
              When new cache IDs are discovered, the application sends notifications through Discord or saved logs locally.
            </p>
          </div>
        </section>
      </div>
    </ToolPageLayout>
  );
}
