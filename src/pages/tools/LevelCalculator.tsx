import { useState, useMemo } from "react";
import { Calculator, Ghost } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface GhostItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  bonusXp?: number;
  multiplier?: number;
  tripleChance?: number;
}

const GHOST_ITEMS: GhostItem[] = [
  { id: "ghost-dragon-charm", name: "Ghost Dragon Charm", emoji: "🐉", description: "+180 XP per ghost", bonusXp: 180 },
  { id: "coconut-tart", name: "Coconut Tart", emoji: "🥥", description: "+30 XP per ghost", bonusXp: 30 },
  { id: "gingerbread-cookie", name: "Gingerbread Cookie", emoji: "🍪", description: "10% triple XP chance", tripleChance: 0.1 },
  { id: "biotronic-brain-enhancer", name: "Biotronic Brain Enhancer", emoji: "🧠", description: "50% more XP (average)", multiplier: 1.5 },
  { id: "ancestral-totem", name: "Ancestral Totem of Wisdom", emoji: "🗿", description: "5% double XP chance", multiplier: 1.05 },
  { id: "wisdom-ring", name: "Wisdom Ring", emoji: "💍", description: "10% double XP chance", multiplier: 1.1 },
];

function formatNumber(num: number) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function calcXpForLevel(level: number) {
  return 50 * (level * level + 2);
}

export default function LevelCalculator() {
  const [currentLevel, setCurrentLevel] = useState(1);
  const [currentXP, setCurrentXP] = useState(0);
  const [targetLevel, setTargetLevel] = useState(10);
  const [result, setResult] = useState<{ totalXp: number; breakdown: { from: number; to: number; xp: number }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const calculate = () => {
    setError(null);
    setResult(null);

    if (currentLevel < 1 || currentLevel > 125) { setError("Current level must be 1-125"); return; }
    if (currentXP < 0) { setError("Current XP must be 0 or higher"); return; }
    if (targetLevel < 2 || targetLevel > 125) { setError("Target level must be 2-125"); return; }
    if (targetLevel <= currentLevel) { setError("Target level must be higher than current level"); return; }

    const breakdown: { from: number; to: number; xp: number }[] = [];
    let totalXp = 0;
    for (let level = currentLevel; level < targetLevel; level++) {
      const xp = calcXpForLevel(level);
      breakdown.push({ from: level, to: level + 1, xp });
      totalXp += xp;
    }
    totalXp -= currentXP;

    setResult({ totalXp, breakdown });
  };

  const toggleItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const ghostJarCalc = useMemo(() => {
    if (!result || result.totalXp <= 0) return null;

    const baseXp = 20;
    let bonusXp = 0;
    let multiplier = 1.0;
    let tripleChance = 0;

    for (const item of GHOST_ITEMS) {
      if (!selectedItems.has(item.id)) continue;
      if (item.bonusXp) bonusXp += item.bonusXp;
      if (item.multiplier) multiplier *= item.multiplier;
      if (item.tripleChance) tripleChance = item.tripleChance;
    }

    const tripleMultiplier = 1 + tripleChance * 2;
    const avgXpPerGhost = (baseXp + bonusXp) * multiplier * tripleMultiplier;
    const ghostJarsNeeded = Math.ceil(result.totalXp / avgXpPerGhost);

    return { baseXp, bonusXp, multiplier: multiplier * tripleMultiplier, avgXpPerGhost, ghostJarsNeeded };
  }, [result, selectedItems]);

  return (
    <ToolPageLayout title="Level Calculator" description="Calculate the XP needed to reach your target level in Growtopia." icon={Calculator} color="yellow">
      <div className="space-y-6">
        {/* Calculator */}
        <Card>
          <CardHeader>
            <CardTitle>Calculate XP Requirements</CardTitle>
            <p className="text-sm text-muted-foreground">Enter your current level, current XP, and target level to calculate how much XP you need.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Current Level</label>
                <Input type="number" min={1} max={125} value={currentLevel} onChange={(e) => setCurrentLevel(parseInt(e.target.value) || 0)} />
                <p className="text-xs text-muted-foreground mt-1">Min: 1 · Max: 125</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Current XP</label>
                <Input type="number" min={0} value={currentXP} onChange={(e) => setCurrentXP(parseInt(e.target.value) || 0)} />
                <p className="text-xs text-muted-foreground mt-1">XP in current level</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Target Level</label>
                <Input type="number" min={2} max={125} value={targetLevel} onChange={(e) => setTargetLevel(parseInt(e.target.value) || 0)} />
                <p className="text-xs text-muted-foreground mt-1">Min: 2 · Max: 125</p>
              </div>
            </div>

            {error && (
              <div className="text-sm rounded-md px-3 py-2 text-center font-medium bg-gt-red/10 text-gt-red border border-gt-red/30">{error}</div>
            )}

            <Button onClick={calculate} className="w-full">
              <Calculator className="w-4 h-4" /> Calculate XP
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Calculation Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.totalXp <= 0 ? (
                <div className="text-sm rounded-md px-3 py-2 text-center font-medium bg-gt-green/10 text-gt-green border border-gt-green/30">
                  You already have enough XP to reach level {targetLevel}!
                </div>
              ) : (
                <>
                  <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                    {result.breakdown.map((row) => (
                      <div key={row.from} className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/40 text-sm">
                        <span>Level {row.from} → {row.to}</span>
                        <span className="font-mono font-medium">{formatNumber(row.xp)} XP</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-primary/10 border border-primary/30 font-semibold">
                    <span>Total XP Needed</span>
                    <span className="text-lg font-mono">{formatNumber(result.totalXp)}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Ghost Jar Calculator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ghost className="w-5 h-5" />
              Ghost Jar Calculator
            </CardTitle>
            <p className="text-sm text-muted-foreground">Select items to calculate how many ghost jars you need to reach your target level.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Reference */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/40 border">
              <span className="text-2xl">👻</span>
              <div>
                <p className="font-medium text-sm">Ghost Jar (Base)</p>
                <p className="text-xs text-muted-foreground">20 XP per ghost jar</p>
              </div>
            </div>

            {/* Items */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GHOST_ITEMS.map((item) => {
                const selected = selectedItems.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg border text-left transition-all",
                      selected ? "bg-primary/10 border-primary/50" : "bg-muted/20 border-border hover:bg-muted/40"
                    )}
                  >
                    <div className={cn("w-5 h-5 rounded border-2 flex items-center justify-center text-xs", selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30")}>
                      {selected && "✓"}
                    </div>
                    <span className="text-xl">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Ghost Jar Results */}
            {ghostJarCalc && selectedItems.size > 0 && (
              <div className="space-y-2 rounded-lg border p-4 bg-muted/20">
                <h4 className="font-semibold text-sm mb-3">Ghost Jar Requirements</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between px-2 py-1"><span className="text-muted-foreground">Base XP/ghost:</span><span className="font-mono">{ghostJarCalc.baseXp}</span></div>
                  <div className="flex justify-between px-2 py-1"><span className="text-muted-foreground">Bonus XP:</span><span className="font-mono">{ghostJarCalc.bonusXp}</span></div>
                  <div className="flex justify-between px-2 py-1"><span className="text-muted-foreground">Multiplier:</span><span className="font-mono">{ghostJarCalc.multiplier.toFixed(2)}x</span></div>
                  <div className="flex justify-between px-2 py-1"><span className="text-muted-foreground">Avg XP/ghost:</span><span className="font-mono">{Math.round(ghostJarCalc.avgXpPerGhost)}</span></div>
                </div>
                <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-gt-yellow/10 border border-gt-yellow/30 font-semibold mt-2">
                  <span>Ghost Jars Needed</span>
                  <span className="text-lg font-mono">{formatNumber(ghostJarCalc.ghostJarsNeeded)}</span>
                </div>
                <p className="text-xs text-muted-foreground italic text-center">Note: Calculations are approximate and may vary based on actual gameplay.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader><CardTitle>About Level Calculation</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>The XP required for each level follows the formula: <code className="px-1.5 py-0.5 bg-muted rounded text-foreground">50 × (level² + 2)</code>. The calculator sums up the XP required for all levels between your current and target level, then subtracts your current XP.</p>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Example</h4>
              <p>If you're at level 5 with 500 XP and want to reach level 10:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Level 6: 50 × (6² + 2) = 1,900 XP</li>
                <li>Level 7: 50 × (7² + 2) = 2,550 XP</li>
                <li>Level 8: 50 × (8² + 2) = 3,300 XP</li>
                <li>Level 9: 50 × (9² + 2) = 4,150 XP</li>
                <li>Level 10: 50 × (10² + 2) = 5,100 XP</li>
                <li>Total: 17,000 − 500 = <strong className="text-foreground">16,500 XP needed</strong></li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </ToolPageLayout>
  );
}
