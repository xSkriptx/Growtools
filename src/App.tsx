import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";

// Tool Pages
import DatDecoder from "./pages/tools/DatDecoder";
import DataMining from "./pages/tools/DataMining";
import RttexConverter from "./pages/tools/RttexConverter";
import AccountChecker from "./pages/tools/AccountChecker";
import ServerMonitor from "./pages/tools/ServerMonitor";
import CacheChecker from "./pages/tools/CacheChecker";
import WorldRenderer from "./pages/tools/WorldRenderer";
import LevelCalculator from "./pages/tools/LevelCalculator";
import AdminChecker from "./pages/tools/AdminChecker";
import GrowtopiaNews from "./pages/tools/GrowtopiaNews";
import ItemBrowser from "./pages/tools/ItemBrowser";
import WorldPlanner from "./pages/tools/WorldPlanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Index />} />
            
            {/* Tool Routes */}
            <Route path="/dat-decoder" element={<DatDecoder />} />
            <Route path="/data-mining" element={<DataMining />} />
            <Route path="/rttex-converter" element={<RttexConverter />} />
            <Route path="/account-checker" element={<AccountChecker />} />
            <Route path="/server-monitor" element={<ServerMonitor />} />
            <Route path="/cache-checker" element={<CacheChecker />} />
            <Route path="/world-renderer" element={<WorldRenderer />} />
            <Route path="/level-calculator" element={<LevelCalculator />} />
            <Route path="/admin-checker" element={<AdminChecker />} />
            <Route path="/news" element={<GrowtopiaNews />} />
            <Route path="/item-browser" element={<ItemBrowser />} />
            <Route path="/world-planner" element={<WorldPlanner />} />
            
            {/* Coming Soon Routes */}
            <Route path="/proxy-server" element={<ComingSoon title="Proxy Server" />} />
            <Route path="/set-planner" element={<ComingSoon title="Set Planner" />} />
            <Route path="/gacha-simulator" element={<ComingSoon title="Gacha Simulator" />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
