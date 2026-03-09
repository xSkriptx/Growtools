import { useState, useEffect } from "react";
import { UserCheck, Search, Upload, FileText, Calendar, Shield, AlertTriangle, Info, Loader2, MapPin } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface AdminPosition {
  x: number;
  y: number;
  adminCount: number;
  adminUIDs: string[];
}

interface AdminLock {
  type: string;
  count: number;
  positions: AdminPosition[];
}

interface AdminWorld {
  date: string;
  worldName: string;
  locks: AdminLock[];
}

const LOCK_TYPES: Record<string, string> = {
  "World Lock": "World_Lock",
  "Small Lock": "Small_Lock", 
  "Big Lock": "Big_Lock",
  "Huge Lock": "Huge_Lock",
  "Royal Lock": "Royal_Lock",
  "Diamond Lock": "Diamond_Lock",
  "Builders Lock": "Builders_Lock",
  "Ruby Lock": "Ruby_Lock",
  "Emerald Lock": "Emerald_Lock",
  "Robotic Lock": "Robotic_Lock",
  "Rayman Lock": "Rayman_Lock",
  "Harmonic Lock": "Harmonic_Lock",
  "Bunny Lock": "Bunny_Lock",
  "Legendary Lock": "Legendary_Lock",
  "Blood Dragon Lock": "Blood_Dragon_Lock",
  "Ecto-Lock": "Ecto-Lock",
  "Guild Lock": "Guild_Lock",
  "Prince of Persia Lock": "Prince_of_Persia_Lock",
  "Radical City Lock": "Radical_City_Lock",
  "Assassins Creed Lock": "Assassins_Creed_Lock",
  "Enchanted Lock": "Enchanted_Lock",
  "Royal Enchanted Lock": "Royal_Enchanted_Lock",
  "Steampunk Lock": "Steampunk_Lock",
  "Immortals Fenyx Rising Lock": "Immortals_Fenyx_Rising_Lock",
  "My First World Lock": "My_First_World_Lock",
  "Blue Gem Lock": "Blue_Gem_Lock"
};

export default function AdminChecker() {
  const [allData, setAllData] = useState<AdminWorld[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [lockFilter, setLockFilter] = useState("all");

  useEffect(() => {
    autoLoadData();
  }, []);

  const autoLoadData = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/data/adminchecks.txt');
      if (resp.ok) {
        const text = await resp.text();
        setAllData(parseAdminData(text));
      }
    } catch (e) {
      console.warn('Silent auto-load failed');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    setLoading(true);
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setAllData(parseAdminData(text));
      setLoading(false);
      toast({ title: "Success", description: "Admin data loaded successfully." });
    };
    reader.onerror = () => {
      setLoading(false);
      toast({ title: "Error", description: "Failed to read file.", variant: "destructive" });
    };
    reader.readAsText(file);
  };

  const parseAdminData = (textData: string): AdminWorld[] => {
    const results: AdminWorld[] = [];
    const lines = textData.split('\n');
    let currentWorld: AdminWorld | null = null;
    let currentLock: AdminLock | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('ADMIN CHECKER RESULTS -')) {
        if (currentWorld) results.push(currentWorld);
        const dateMatch = line.match(/ADMIN CHECKER RESULTS - (.*)/);
        const worldMatch = lines[i+1]?.includes('WORLD:') ? lines[i+1].match(/WORLD: (.+)/) : null;
        if (dateMatch && worldMatch) {
          currentWorld = { date: dateMatch[1].trim(), worldName: worldMatch[1].trim(), locks: [] };
          i++;
        }
      } else if (line.includes(' - Found:') && currentWorld) {
        const lockMatch = line.match(/(.+) - Found: (\d+)/);
        if (lockMatch) {
          currentLock = { type: lockMatch[1].trim(), count: parseInt(lockMatch[2]), positions: [] };
          currentWorld.locks.push(currentLock);
        }
      } else if (line.startsWith('Position') && currentLock) {
        const posMatch = line.match(/Position \d+: \((\d+),(\d+)\)/);
        if (posMatch) {
          const position: AdminPosition = { x: +posMatch[1], y: +posMatch[2], adminCount: 0, adminUIDs: [] };
          let j = i + 1;
          while (j < lines.length && !lines[j].includes('Statistics:') && !lines[j].includes('Position')) {
            const adminLine = lines[j].trim();
            if (adminLine.startsWith('Admin Count:')) {
              const countMatch = adminLine.match(/Admin Count: (\d+)/);
              if (countMatch) position.adminCount = +countMatch[1];
            } else if (adminLine.startsWith('Admin UIDs:')) {
              j++;
              while (j < lines.length && lines[j].trim().match(/^\d+\.\s*\d+$/)) {
                const uidMatch = lines[j].trim().match(/^\d+\.\s*(\d+)$/);
                if (uidMatch) position.adminUIDs.push(uidMatch[1]);
                j++;
              }
              i = j - 1;
              break;
            }
            j++;
          }
          currentLock.positions.push(position);
        }
      }
    }
    if (currentWorld) results.push(currentWorld);
    return results;
  };

  const filteredData = allData.filter(world => {
    const query = searchQuery.toLowerCase();
    const nameMatch = world.worldName.toLowerCase().includes(query);
    const lockMatch = world.locks.some(lock => 
      lock.type.toLowerCase().includes(query) || 
      lock.positions.some(pos => pos.adminUIDs.some(uid => uid.includes(query)))
    );
    
    if (lockFilter !== "all" && !world.locks.some(l => l.type === lockFilter)) return false;
    
    return nameMatch || lockMatch;
  });

  return (
    <ToolPageLayout
      title="Admin Checker"
      description="Check admin permissions on Growtopia world locks and analyze security patterns."
      icon={UserCheck}
      color="green"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex gap-3 items-start">
              <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-[11px] leading-tight text-muted-foreground">
                <strong>Anonymized:</strong> All admin UIDs are anonymized for privacy protection.
              </div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardContent className="p-4 flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-tight text-muted-foreground">
                <strong>Warning:</strong> Check dates before trading Perma Links. Data may be outdated.
              </div>
            </CardContent>
          </Card>
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 flex gap-3 items-start">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-tight text-muted-foreground">
                <strong>Data:</strong> adminchecks.txt can be found in our Discord server.
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Upload className="w-4 h-4" /> Load Admin Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <Input 
                type="file" 
                accept=".txt" 
                onChange={handleFileUpload} 
                className="max-w-xs cursor-pointer"
              />
              <div className="text-xs text-muted-foreground italic">
                Upload adminchecks.txt locally to see scan results.
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search world, lock type, or UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <select 
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
            value={lockFilter}
            onChange={(e) => setLockFilter(e.target.value)}
          >
            <option value="all">All Locks</option>
            {Object.keys(LOCK_TYPES).map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Processing admin data...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-20 text-center border rounded-xl bg-muted/20">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No admin records found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredData.map((world, idx) => (
              <Card key={`${world.worldName}-${idx}`} className="overflow-hidden">
                <div className="bg-muted/30 p-4 border-b flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-primary" />
                    <h3 className="font-bold text-lg">{world.worldName}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {world.date}
                  </div>
                </div>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {world.locks.map((lock, lidx) => (
                      <div key={lidx} className="p-3 rounded-lg border bg-card/50 space-y-3">
                        <div className="flex items-center gap-3">
                          <img 
                            src={`/images/${LOCK_TYPES[lock.type] || 'World_Lock'}.png`} 
                            className="w-8 h-8 object-contain"
                            alt={lock.type}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate">{lock.type}</div>
                            <div className="text-[10px] text-muted-foreground">{lock.count} locks found</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {lock.positions.map((pos, pidx) => (
                            <div key={pidx} className="text-[11px] p-2 rounded bg-muted/50 border border-border/50">
                              <div className="flex items-center gap-1.5 mb-1.5 text-muted-foreground font-mono">
                                <MapPin className="w-3 h-3" />
                                ({pos.x}, {pos.y})
                              </div>
                              <div className="space-y-1">
                                {pos.adminUIDs.length > 0 ? (
                                  pos.adminUIDs.map((uid, uidx) => (
                                    <div key={uidx} className="flex items-center gap-2 bg-background p-1 px-1.5 rounded border border-primary/10">
                                      <Shield className="w-2.5 h-2.5 text-primary/50" />
                                      <span className="font-mono text-[10px]">{uid}</span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-muted-foreground italic text-[10px]">No admins found</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ToolPageLayout>
  );
}
