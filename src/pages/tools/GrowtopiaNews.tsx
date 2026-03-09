import { useState, useEffect } from "react";
import { Newspaper, Search, Info, AlertTriangle, Loader2 } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface NewsItem {
  name: string;
  type: string;
}

interface NewsCategory {
  name: string;
  items: NewsItem[];
}

export default function GrowtopiaNews() {
  const [allNewsData, setAllNewsData] = useState<NewsCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  useEffect(() => {
    loadNewsData();
  }, []);

  const loadNewsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/data/newleaks.txt', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`Status: ${response.status}`);
      const textData = await response.text();
      
      const parsed = parseNewsData(textData);
      setAllNewsData(parsed);
      setLastUpdated(new Date().toLocaleString());
    } catch (err: any) {
      console.error('Failed to load news:', err);
      setError('Could not load item leaks data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const parseNewsData = (textData: string): NewsCategory[] => {
    const results: NewsCategory[] = [];
    const lines = textData.split('\n');
    let currentCategory: NewsCategory | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.endsWith(':')) {
        if (currentCategory) results.push(currentCategory);
        currentCategory = {
          name: line.replace(':', '').trim(),
          items: []
        };
      } else if (currentCategory && line.trim() && !line.includes('New items found in the latest version:')) {
        const itemName = line.trim();
        if (itemName) {
          currentCategory.items.push({
            name: itemName,
            type: categorizeItem(itemName)
          });
        }
      }
    }

    if (currentCategory) results.push(currentCategory);
    return results.reverse(); // Newest first
  };

  const categorizeItem = (itemName: string): string => {
    const lowerName = itemName.toLowerCase();
    if (lowerName.includes('aura') || lowerName.includes('ring') || lowerName.includes('hand')) return 'Accessory';
    if (lowerName.includes('dress') || lowerName.includes('hat') || lowerName.includes('jacket') || 
        lowerName.includes('shorts') || lowerName.includes('hair') || lowerName.includes('eyes') ||
        lowerName.includes('teeth') || lowerName.includes('patterns')) return 'Clothing';
    if (lowerName.includes('ability') || lowerName.includes('berserker') || lowerName.includes('blood') ||
        lowerName.includes('toxic') || lowerName.includes('souls') || lowerName.includes('hungering') ||
        lowerName.includes('fireball') || lowerName.includes('slash')) return 'Ability';
    if (lowerName.includes('dungeon')) return 'Dungeon';
    if (lowerName.includes('halloween') || lowerName.includes('witch') || lowerName.includes('demon') ||
        lowerName.includes('ghost') || lowerName.includes('spooky')) return 'Halloween';
    return 'Other';
  };

  const filteredData = allNewsData.map(category => ({
    ...category,
    items: category.items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.items.length > 0);

  return (
    <ToolPageLayout
      title="Growtopia News"
      description="Latest item leaks and updates discovered through data mining."
      icon={Newspaper}
      color="pink"
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 flex gap-3 items-start">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong>Information:</strong> This section displays the latest item leaks discovered through data mining. Stay ahead of the game!
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-yellow-500/5 border-yellow-500/20">
            <CardContent className="p-4 flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <strong>Note:</strong> These items are leaked and may not be available in-game yet.
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search leaked items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={loadNewsData} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading latest leaks...</p>
          </div>
        ) : error ? (
          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-10 text-center">
              <p className="text-destructive font-medium mb-4">{error}</p>
              <Button onClick={loadNewsData}>Try Again</Button>
            </CardContent>
          </Card>
        ) : filteredData.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              No leaked items found matching your search.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {filteredData.map((category) => (
              <div key={category.name} className="space-y-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-primary">{category.name}</h2>
                  <div className="h-px flex-1 bg-border" />
                  <Badge variant="outline">{category.items.length} items</Badge>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {category.items.map((item, idx) => (
                    <Card key={`${category.name}-${idx}`} className="group hover:border-primary/50 transition-colors">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border group-hover:bg-primary/5 transition-colors">
                          <Newspaper className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate" title={item.name}>{item.name}</div>
                          <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mt-0.5">{item.type}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center text-xs text-muted-foreground py-4 border-t">
          Last updated: {lastUpdated || 'Loading...'}
        </div>
      </div>
    </ToolPageLayout>
  );
}
