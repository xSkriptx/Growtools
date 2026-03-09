import { useState, useEffect, useRef, useCallback } from "react";
import { Server, RefreshCw, Trash2, PlayCircle, PauseCircle, AlertTriangle, Loader2 } from "lucide-react";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { cn } from "@/lib/utils";

type ServerState = "online" | "maintenance" | "offline" | "error";

interface HistoryEntry {
  timestamp: number;
  status: ServerState;
  players: number;
  responseTime: number;
}

const STATUS_CONFIG: Record<ServerState, { label: string; color: string; bg: string; border: string; detail: string }> = {
  online: {
    label: "Online",
    color: "bg-gt-green",
    bg: "bg-gt-green/10",
    border: "border-gt-green/30",
    detail: "Server is fully operational",
  },
  maintenance: {
    label: "Maintenance",
    color: "bg-gt-yellow",
    bg: "bg-gt-yellow/10",
    border: "border-gt-yellow/30",
    detail: "Server is undergoing maintenance",
  },
  offline: {
    label: "Offline",
    color: "bg-gt-red",
    bg: "bg-gt-red/10",
    border: "border-gt-red/30",
    detail: "Server is offline or unavailable",
  },
  error: {
    label: "Error",
    color: "bg-gt-yellow",
    bg: "bg-gt-yellow/10",
    border: "border-gt-yellow/30",
    detail: "Failed to connect to server",
  },
};

function getTodayKey() {
  const now = new Date();
  const ny = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  return `${ny.getFullYear()}-${ny.getMonth() + 1}-${ny.getDate()}`;
}

export default function ServerMonitor() {
  const [status, setStatus] = useState<ServerState>("online");
  const [players, setPlayers] = useState<number>(0);
  const [responseTime, setResponseTime] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" | "checking" } | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("serverHistory") || "[]");
    } catch {
      return [];
    }
  });

  const [maintenanceCount, setMaintenanceCount] = useState<number>(() => {
    const saved = localStorage.getItem("lastResetDay");
    if (saved !== getTodayKey()) {
      localStorage.setItem("maintenanceCount", "0");
      localStorage.setItem("lastResetDay", getTodayKey());
      return 0;
    }
    return parseInt(localStorage.getItem("maintenanceCount") || "0");
  });

  const lastStatusRef = useRef<ServerState | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showStatus = (text: string, type: "success" | "error" | "checking", autoClear = false) => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    setStatusMsg({ text, type });
    if (autoClear) {
      statusTimerRef.current = setTimeout(() => setStatusMsg(null), 2500);
    }
  };

  const checkServer = useCallback(async () => {
    setIsChecking(true);
    showStatus("Checking server status...", "checking");
    const startTime = Date.now();

    try {
      const response = await fetch("https://corsproxy.io/?https://growtopiagame.com/detail", {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      const elapsed = Date.now() - startTime;

      if (response.ok) {
        const text = await response.text();
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}") + 1;

        if (start !== -1 && end > start) {
          const data = JSON.parse(text.substring(start, end));
          const onlineUsers = parseInt(data.online_user) || 0;

          let newStatus: ServerState;
          if (onlineUsers > 1000) {
            newStatus = "online";
          } else if (onlineUsers > 70) {
            newStatus = "maintenance";
          } else {
            newStatus = "offline";
          }

          // Track maintenance events
          if (lastStatusRef.current === "online" && (newStatus === "maintenance" || newStatus === "offline")) {
            const newCount = maintenanceCount + 1;
            setMaintenanceCount(newCount);
            localStorage.setItem("maintenanceCount", String(newCount));
            showStatus(`Maintenance detected! Count: ${newCount}`, "checking");
          } else {
            showStatus("Server status updated successfully", "success", true);
          }

          lastStatusRef.current = newStatus;
          setStatus(newStatus);
          setPlayers(onlineUsers);
          setResponseTime(elapsed);
          setLastUpdated(new Date());

          const entry: HistoryEntry = { timestamp: Date.now(), status: newStatus, players: onlineUsers, responseTime: elapsed };
          setHistory((prev) => {
            const updated = [...prev, entry].slice(-100);
            localStorage.setItem("serverHistory", JSON.stringify(updated));
            return updated;
          });
        } else {
          throw new Error("No JSON data found");
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.error("Server check error:", err);
      setStatus("error");
      setPlayers(0);
      setResponseTime(Date.now() - startTime);
      setLastUpdated(new Date());
      showStatus("Failed to connect to server", "error");
    } finally {
      setIsChecking(false);
    }
  }, [maintenanceCount]);

  // Initial check and auto-refresh
  useEffect(() => {
    if (history.length > 0) {
      const last = history[history.length - 1];
      setStatus(last.status);
      setPlayers(last.players);
      setResponseTime(last.responseTime);
      setLastUpdated(new Date(last.timestamp));
      lastStatusRef.current = last.status;
    } else {
      checkServer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(checkServer, 10000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, checkServer]);

  // Daily maintenance reset check
  useEffect(() => {
    const checkDaily = setInterval(() => {
      const today = getTodayKey();
      if (localStorage.getItem("lastResetDay") !== today) {
        setMaintenanceCount(0);
        localStorage.setItem("maintenanceCount", "0");
        localStorage.setItem("lastResetDay", today);
      }
    }, 60000);
    return () => clearInterval(checkDaily);
  }, []);

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("serverHistory");
    showStatus("History cleared", "success", true);
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh((prev) => {
      showStatus(prev ? "Auto refresh disabled" : "Auto refresh enabled", "success", true);
      return !prev;
    });
  };

  const cfg = STATUS_CONFIG[status];
  const recentHistory = [...history].reverse().slice(0, 10);
  const chartData = history.slice(-30).map((e) => ({
    time: new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    players: e.players,
  }));

  const statusMsgClasses = {
    success: "bg-gt-green/10 text-gt-green border border-gt-green/30",
    error: "bg-gt-red/10 text-gt-red border border-gt-red/30",
    checking: "bg-gt-yellow/10 text-gt-yellow border border-gt-yellow/30",
  };

  return (
    <ToolPageLayout
      title="Server Monitor"
      description="Monitor Growtopia server status with real-time updates and historical data."
      icon={Server}
      color="cyan"
    >
      <div className="space-y-6">
        {/* Current Status */}
        <Card className={cn("border-l-4", cfg.border.replace("/30", ""))}>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={cn("w-4 h-4 rounded-full animate-pulse", cfg.color)} />
                <div>
                  <h2 className="text-2xl font-bold">{cfg.label}</h2>
                  <p className="text-muted-foreground">{cfg.detail}</p>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-3xl font-bold">{players.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Players Online</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Message */}
        {statusMsg && (
          <div className={cn("text-sm rounded-md px-3 py-2 text-center font-medium", statusMsgClasses[statusMsg.type])}>
            {statusMsg.text}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={checkServer} disabled={isChecking} variant="outline">
            {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Check Now
          </Button>
          <Button onClick={toggleAutoRefresh} variant="outline">
            {autoRefresh ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
            Auto Refresh: {autoRefresh ? "On" : "Off"}
          </Button>
          <Badge variant="outline" className="bg-gt-yellow/10 text-gt-yellow border-gt-yellow/30">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Maintenance Events: {maintenanceCount}
          </Badge>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Player Count History</CardTitle>
            <Button variant="outline" size="sm" onClick={clearHistory} disabled={history.length === 0}>
              <Trash2 className="w-3.5 h-3.5" />
              Clear History
            </Button>
          </CardHeader>
          <CardContent>
            {chartData.length > 1 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="playerGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--gt-cyan))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--gt-cyan))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Area type="monotone" dataKey="players" stroke="hsl(var(--gt-cyan))" fill="url(#playerGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Not enough data to display chart</p>
            )}
            <p className="text-xs text-muted-foreground text-center mt-2">
              Last updated: {lastUpdated ? `${lastUpdated.toLocaleTimeString()} (${responseTime}ms)` : "—"}
            </p>
          </CardContent>
        </Card>

        {/* History Table */}
        <Card>
          <CardHeader>
            <CardTitle>Status History</CardTitle>
          </CardHeader>
          <CardContent>
            {recentHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No history yet</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Players</TableHead>
                      <TableHead>Response</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentHistory.map((entry, i) => {
                      const c = STATUS_CONFIG[entry.status];
                      return (
                        <TableRow key={i}>
                          <TableCell>{new Date(entry.timestamp).toLocaleTimeString()}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", c.color)} />
                              {c.label}
                            </div>
                          </TableCell>
                          <TableCell>{entry.players.toLocaleString()}</TableCell>
                          <TableCell>{entry.responseTime}ms</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Cards */}
        <Card>
          <CardHeader>
            <CardTitle>Status Indicators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(["online", "maintenance", "offline"] as const).map((s) => {
              const c = STATUS_CONFIG[s];
              return (
                <div key={s} className={cn("p-4 rounded-lg flex items-center gap-3", c.bg, "border", c.border)}>
                  <div className={cn("w-3 h-3 rounded-full", c.color)} />
                  <div>
                    <p className="font-semibold">{c.label}</p>
                    <p className="text-sm text-muted-foreground">{c.detail}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">About Server Monitoring: </span>
              This tool monitors the official Growtopia servers by checking the game's status API. It provides real-time information about server status, player count, and maintenance periods.
            </p>
          </CardContent>
        </Card>
      </div>
    </ToolPageLayout>
  );
}
