import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const mainTools = [
  { name: "DAT Decoder", path: "/dat-decoder" },
  { name: "Server Monitor", path: "/server-monitor" },
  { name: "Level Calculator", path: "/level-calculator" },
  { name: "Item Browser", path: "/item-browser" },
];

const moreTools = [
  { name: "Data Mining", path: "/data-mining" },
  { name: "RTTEX Converter", path: "/rttex-converter" },
  { name: "Account Checker", path: "/account-checker" },
  { name: "Cache ID Checker", path: "/cache-checker" },
  { name: "World Renderer", path: "/world-renderer" },
  { name: "Admin Checker", path: "/admin-checker" },
  { name: "Growtopia News", path: "/news" },
  { name: "World Planner", path: "/world-planner" },
];

const comingSoon = [
  { name: "Proxy Server", path: "/proxy-server" },
  { name: "Set Planner", path: "/set-planner" },
  { name: "Gacha Simulator", path: "/gacha-simulator" },
];

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 w-full glass border-b border-border/50">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center group-hover:scale-110 transition-transform">
            <Wrench className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold gradient-text hidden sm:inline">
            Growtools
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-1">
          {mainTools.map((tool) => (
            <Link key={tool.path} to={tool.path}>
              <Button
                variant={isActive(tool.path) ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "text-sm",
                  isActive(tool.path) && "bg-primary/20 text-primary"
                )}
              >
                {tool.name}
              </Button>
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-sm">
                More Tools <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 glass">
              {moreTools.map((tool) => (
                <DropdownMenuItem key={tool.path} asChild>
                  <Link to={tool.path} className="cursor-pointer">
                    {tool.name}
                  </Link>
                </DropdownMenuItem>
              ))}
              <div className="border-t border-border my-1" />
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Coming Soon
              </div>
              {comingSoon.map((tool) => (
                <DropdownMenuItem key={tool.path} disabled className="opacity-50">
                  {tool.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Menu */}
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72 glass">
            <SheetTitle className="text-lg font-bold gradient-text mb-4">
              Growtools Menu
            </SheetTitle>
            <div className="flex flex-col gap-2 mt-4">
              <Link to="/" onClick={() => setIsOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  Home
                </Button>
              </Link>
              
              <div className="text-xs text-muted-foreground px-4 pt-4 pb-2 uppercase tracking-wider">
                Main Tools
              </div>
              {mainTools.map((tool) => (
                <Link key={tool.path} to={tool.path} onClick={() => setIsOpen(false)}>
                  <Button
                    variant={isActive(tool.path) ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      isActive(tool.path) && "bg-primary/20 text-primary"
                    )}
                  >
                    {tool.name}
                  </Button>
                </Link>
              ))}

              <div className="text-xs text-muted-foreground px-4 pt-4 pb-2 uppercase tracking-wider">
                More Tools
              </div>
              {moreTools.map((tool) => (
                <Link key={tool.path} to={tool.path} onClick={() => setIsOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start text-sm">
                    {tool.name}
                  </Button>
                </Link>
              ))}

              <div className="text-xs text-muted-foreground px-4 pt-4 pb-2 uppercase tracking-wider">
                Coming Soon
              </div>
              {comingSoon.map((tool) => (
                <Button
                  key={tool.path}
                  variant="ghost"
                  className="w-full justify-start text-sm opacity-50"
                  disabled
                >
                  {tool.name}
                </Button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
