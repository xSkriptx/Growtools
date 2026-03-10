import {
  FileCode,
  Database,
  Image,
  Shield,
  Server,
  Hash,
  Globe,
  Calculator,
  UserCheck,
  Newspaper,
  Search,
  Map,
  Network,
  Palette,
  Gamepad2,
  Sparkles,
  Zap,
  Lock,
  Wrench,
} from "lucide-react";
import { ToolCard } from "@/components/ToolCard";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const tools = [
  {
    name: "DAT Decoder",
    description: "Decode and analyze Growtopia DAT files to extract item data and properties.",
    icon: FileCode,
    path: "/dat-decoder",
    color: "green" as const,
  },
  {
    name: "Data Mining",
    description: "Advanced data analysis tools for mining Growtopia game data.",
    icon: Database,
    path: "/data-mining",
    color: "purple" as const,
  },
  {
    name: "RTTEX Converter",
    description: "Convert RTTEX texture files to PNG and vice versa.",
    icon: Image,
    path: "/rttex-converter",
    color: "blue" as const,
  },
  {
    name: "Account Checker",
    description: "Check account security status and validate credentials safely.",
    icon: Shield,
    path: "/account-checker",
    color: "orange" as const,
  },
  {
    name: "Server Monitor",
    description: "Real-time monitoring of Growtopia server status and uptime.",
    icon: Server,
    path: "/server-monitor",
    color: "cyan" as const,
  },
  {
    name: "Cache ID Checker",
    description: "Verify and lookup cache IDs for items and assets.",
    icon: Hash,
    path: "/cache-checker",
    color: "pink" as const,
  },
  {
    name: "World Renderer",
    description: "Render and visualize Growtopia worlds in your browser.",
    icon: Globe,
    path: "/world-renderer",
    color: "green" as const,
  },
  {
    name: "Level Calculator",
    description: "Calculate XP requirements and level progression.",
    icon: Calculator,
    path: "/level-calculator",
    color: "yellow" as const,
  },
  {
    name: "Admin Checker",
    description: "Check admin permissions and access levels for worlds.",
    icon: UserCheck,
    path: "/admin-checker",
    color: "red" as const,
  },
  {
    name: "Growtopia News",
    description: "Latest news, updates, and item leaks from the community.",
    icon: Newspaper,
    path: "/news",
    color: "blue" as const,
  },
  {
    name: "Item Browser",
    description: "Browse and search the complete Growtopia item database.",
    icon: Search,
    path: "/item-browser",
    color: "purple" as const,
  },
  {
    name: "World Planner",
    description: "Plan and design your worlds with a visual grid editor.",
    icon: Map,
    path: "/world-planner",
    color: "orange" as const,
  },
  {
    name: "Proxy Server",
    description: "Secure proxy server for enhanced gameplay.",
    icon: Network,
    path: "/proxy-server",
    color: "cyan" as const,
    comingSoon: true,
  },
  {
    name: "Set Planner",
    description: "Plan and create custom clothing sets.",
    icon: Palette,
    path: "/set-planner",
    color: "pink" as const,
    comingSoon: true,
  },
  {
    name: "Gacha Simulator",
    description: "Simulate gacha pulls and test your luck.",
    icon: Gamepad2,
    path: "/gacha-simulator",
    color: "yellow" as const,
    comingSoon: true,
  },
];

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "All tools run directly in your browser with zero server delay.",
  },
  {
    icon: Lock,
    title: "Privacy First",
    description: "Your data never leaves your device. Everything is processed locally.",
  },
  {
    icon: Sparkles,
    title: "Always Updated",
    description: "Tools are regularly updated to support the latest game versions.",
  },
];

export default function Index() {
  return (
    <div className="flex flex-col">
      <section className="relative py-20 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-hero-gradient" />
        <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent" />
        
        <div className="container relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-fade-in">
              <Wrench className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">The Ultimate Growtopia Toolkit</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              Power Up Your{" "}
              <span className="gradient-text">Growtopia</span>{" "}
              Experience
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              Access 15+ powerful tools for data analysis, item browsing, 
              server monitoring, and much more. All free, all in your browser.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <Link to="/dat-decoder">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground px-8">
                  Get Started
                </Button>
              </Link>
              <Link to="/item-browser">
                <Button size="lg" variant="outline" className="px-8">
                  Browse Items
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              All Your Tools in One Place
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From data decoding to world planning, we've got everything you need
              to enhance your Growtopia gameplay.
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {tools.map((tool, index) => (
              <div
                key={tool.name}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <ToolCard {...tool} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-card/30">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Choose Growtools?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built by the community, for the community. Here's what makes us different.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="text-center p-6 rounded-xl bg-card/50 border border-border/50 hover:border-primary/30 transition-colors animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center glass-card p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-muted-foreground mb-6">
              Join thousands of Growtopia players who use Growtools every day.
            </p>
            <Link to="/dat-decoder">
              <Button size="lg" className="bg-primary hover:bg-primary/90">
                Try DAT Decoder Now
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
