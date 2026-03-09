import { useState, useRef, useEffect } from "react";
import { Shield, Search, Users, Trash2, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type AccountStatus = 'active' | 'inactive' | 'unknown' | 'error';

interface AccountResult {
  growid: string;
  status: AccountStatus;
  statusCode?: number;
  message: string;
  footer: string;
  timestamp: Date;
}

const FOOTER_MESSAGES = [
  "GrowID verification in progress...",
  "Scanning with 99.9% accuracy (probably)",
  "This check sponsored by sleepless nights",
  "Powered by questionable API endpoints",
  "Results may contain traces of nonsense",
  "If this was wrong, we blame the intern",
  "Bleep bloop - bot thinking",
  "The truth is out there... and so is this GrowID status",
  "No GrowIDs were harmed in this check",
  "Status: Definitely not a potato",
];

const getRandomFooter = () =>
  FOOTER_MESSAGES[Math.floor(Math.random() * FOOTER_MESSAGES.length)];

async function checkGrowID(growid: string): Promise<AccountResult> {
  const url = "https://sb-user-id-service.xsolla.com/api/v1/user-id";
  const body = {
    settings: { projectId: 261062, merchantId: 46322 },
    loginId: "c303c94a-59c7-4050-9761-199d64dcd1eb",
    webhookUrl: "https://s2s.growtopiagame.com/script/xsolla_webhooks.php",
    user: { id: growid.trim(), country: "TR" },
    isUserIdFromWebhook: false,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://xsolla.growtopiagame.com",
        "Referer": "https://xsolla.growtopiagame.com",
      },
      body: JSON.stringify(body),
    });

    const code = response.status;

    if (code === 200 || code === 201) {
      return {
        growid,
        status: "active",
        statusCode: code,
        message: "This account has logged in within the last 365 days.",
        footer: getRandomFooter(),
        timestamp: new Date(),
      };
    } else if (code === 400) {
      return {
        growid,
        status: "inactive",
        statusCode: code,
        message: "This account hasn't logged in for over 365 days.",
        footer: getRandomFooter(),
        timestamp: new Date(),
      };
    } else {
      return {
        growid,
        status: "unknown",
        statusCode: code,
        message: `Unexpected response (Code: ${code}). Please try again later.`,
        footer: getRandomFooter(),
        timestamp: new Date(),
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      growid,
      status: "error",
      message: `Failed to check account: ${msg}`,
      footer: getRandomFooter(),
      timestamp: new Date(),
    };
  }
}

const statusConfig: Record<AccountStatus, {
  label: string;
  icon: React.ReactNode;
  border: string;
  badge: string;
  emoji: string;
}> = {
  active: {
    label: "Active Account",
    icon: <CheckCircle className="w-5 h-5 text-gt-green" />,
    border: "border-l-gt-green",
    badge: "bg-gt-green/20 text-gt-green border-gt-green/30",
    emoji: "✅",
  },
  inactive: {
    label: "Inactive Account",
    icon: <XCircle className="w-5 h-5 text-gt-red" />,
    border: "border-l-gt-red",
    badge: "bg-gt-red/20 text-gt-red border-gt-red/30",
    emoji: "❌",
  },
  unknown: {
    label: "Unknown Status",
    icon: <AlertTriangle className="w-5 h-5 text-gt-yellow" />,
    border: "border-l-gt-yellow",
    badge: "bg-gt-yellow/20 text-gt-yellow border-gt-yellow/30",
    emoji: "⚠️",
  },
  error: {
    label: "Check Failed",
    icon: <AlertTriangle className="w-5 h-5 text-gt-yellow" />,
    border: "border-l-gt-yellow",
    badge: "bg-gt-yellow/20 text-gt-yellow border-gt-yellow/30",
    emoji: "⚠️",
  },
};

export default function AccountChecker() {
  const [growid, setGrowid] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [results, setResults] = useState<AccountResult[]>([]);
  const [isSingleChecking, setIsSingleChecking] = useState(false);
  const [isBulkChecking, setIsBulkChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' | 'checking' } | null>(
    { text: "Ready to check GrowID accounts", type: "success" }
  );
  const [checkCount, setCheckCount] = useState<number>(() => {
    return parseInt(localStorage.getItem("accountCheckCount") || "0");
  });
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (text: string, type: 'success' | 'error' | 'checking', autoClear = false) => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    setStatusMsg({ text, type });
    if (autoClear) {
      statusTimerRef.current = setTimeout(() => setStatusMsg(null), 2500);
    }
  };

  useEffect(() => () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current); }, []);

  const addResult = (result: AccountResult) => {
    setResults(prev => [result, ...prev]);
    setCheckCount(prev => {
      const next = prev + 1;
      localStorage.setItem("accountCheckCount", String(next));
      return next;
    });
  };

  const handleSingleCheck = async () => {
    const id = growid.trim();
    if (!id) { showStatus("Please enter a valid GrowID", "error"); return; }
    setIsSingleChecking(true);
    showStatus(`Checking account: ${id}...`, "checking");
    const result = await checkGrowID(id);
    addResult(result);
    showStatus(`Checked account: ${id} (Code: ${result.statusCode ?? "N/A"})`, "success", true);
    setIsSingleChecking(false);
  };

  const handleBulkCheck = async () => {
    const ids = bulkText.split("\n").map(s => s.trim()).filter(Boolean);
    if (!ids.length) { showStatus("Please enter GrowIDs to check", "error"); return; }
    if (ids.length > 10) { showStatus("Maximum 10 accounts at once", "error"); return; }
    setIsBulkChecking(true);
    showStatus(`Checking ${ids.length} accounts...`, "checking");
    for (let i = 0; i < ids.length; i++) {
      const result = await checkGrowID(ids[i]);
      addResult(result);
      if (i < ids.length - 1) await new Promise(r => setTimeout(r, 1000));
    }
    showStatus(`Finished checking ${ids.length} accounts`, "success", true);
    setIsBulkChecking(false);
  };

  const handleClear = () => {
    setResults([]);
    showStatus("Results cleared", "success", true);
  };

  const statusMsgClasses = {
    success: "bg-gt-green/10 text-gt-green border border-gt-green/30",
    error: "bg-gt-red/10 text-gt-red border border-gt-red/30",
    checking: "bg-gt-yellow/10 text-gt-yellow border border-gt-yellow/30",
  };

  return (
    <ToolPageLayout
      title="Account Checker"
      description="Check GrowID account status and activity information."
      icon={Shield}
      color="orange"
    >
      <div className="space-y-6">
        {/* Single Check */}
        <Card>
          <CardHeader>
            <CardTitle>Check GrowID Account</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter a GrowID to check its status and activity information.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter GrowID (e.g., Playername)"
                value={growid}
                onChange={e => setGrowid(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !isSingleChecking) handleSingleCheck(); }}
                autoComplete="off"
              />
              <Button onClick={handleSingleCheck} disabled={isSingleChecking || isBulkChecking || !growid.trim()}>
                {isSingleChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {isSingleChecking ? "Checking..." : "Check"}
              </Button>
            </div>

            {/* Status message */}
            {statusMsg && (
              <div className={cn("text-sm rounded-md px-3 py-2 text-center font-medium", statusMsgClasses[statusMsg.type])}>
                {statusMsg.text}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Check */}
        <Card>
          <CardHeader>
            <CardTitle>Bulk Check</CardTitle>
            <p className="text-sm text-muted-foreground">
              Check multiple GrowIDs at once (one per line, max 10)
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              placeholder={"Enter multiple GrowIDs, one per line\nExample:\nPlayer1\nPlayer2\nPlayer3"}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              rows={5}
              className="font-mono text-sm resize-y"
            />
            <Button
              onClick={handleBulkCheck}
              disabled={isBulkChecking || isSingleChecking || !bulkText.trim()}
              className="w-full"
            >
              {isBulkChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              {isBulkChecking ? "Checking Multiple Accounts..." : "Check Multiple Accounts"}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Check Results</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Checked: <strong>{checkCount}</strong>
                </span>
                <Button variant="outline" size="sm" onClick={handleClear} disabled={results.length === 0}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="border rounded-lg p-4 flex items-start gap-3">
                <span className="text-2xl">🔍</span>
                <div>
                  <p className="font-medium">No checks performed yet</p>
                  <p className="text-sm text-muted-foreground">Enter a GrowID above and click "Check Account" to get started.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {results.map((result, i) => {
                  const cfg = statusConfig[result.status];
                  return (
                    <div
                      key={i}
                      className={cn(
                        "border-l-4 rounded-lg p-4 bg-muted/30 space-y-1",
                        cfg.border
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{cfg.emoji}</span>
                          <span className="font-semibold">{cfg.label}</span>
                        </div>
                        <Badge className={cn("text-xs border", cfg.badge)} variant="outline">
                          {result.statusCode ? `Code: ${result.statusCode}` : "Error"}
                        </Badge>
                      </div>
                      <p className="text-sm">
                        <span className="text-muted-foreground">GrowID: </span>
                        <strong>{result.growid}</strong>
                      </p>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                      <p className="text-xs italic text-muted-foreground/60">{result.footer}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Cards */}
        <Card>
          <CardHeader>
            <CardTitle>What the statuses mean</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="border-l-4 border-l-gt-green rounded-lg p-4 bg-muted/30 flex items-start gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="font-semibold">Active Account</p>
                <p className="text-sm text-muted-foreground">The account has been logged into within the last 365 days.</p>
              </div>
            </div>
            <div className="border-l-4 border-l-gt-red rounded-lg p-4 bg-muted/30 flex items-start gap-3">
              <span className="text-2xl">❌</span>
              <div>
                <p className="font-semibold">Inactive Account</p>
                <p className="text-sm text-muted-foreground">The account hasn't been logged into for over 365 days.</p>
              </div>
            </div>
            <div className="border-l-4 border-l-gt-yellow rounded-lg p-4 bg-muted/30 flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold">Unknown Status</p>
                <p className="text-sm text-muted-foreground">Could not determine account status. This might be due to API issues or an invalid GrowID.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Privacy Note */}
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">About Account Checking: </span>
              This tool checks the status of Growtopia accounts using the official Xsolla API. It can determine if an account is active, inactive, or has an unknown status.
            </p>
          </CardContent>
        </Card>
      </div>
    </ToolPageLayout>
  );
}
