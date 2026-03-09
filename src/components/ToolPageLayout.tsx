import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ToolPageLayoutProps {
  title: string;
  description: string;
  icon: LucideIcon;
  color: "green" | "purple" | "blue" | "orange" | "pink" | "cyan" | "yellow" | "red";
  children: ReactNode;
}

const colorClasses = {
  green: "from-gt-green/20 to-gt-green/5 border-gt-green/30 text-gt-green",
  purple: "from-gt-purple/20 to-gt-purple/5 border-gt-purple/30 text-gt-purple",
  blue: "from-gt-blue/20 to-gt-blue/5 border-gt-blue/30 text-gt-blue",
  orange: "from-gt-orange/20 to-gt-orange/5 border-gt-orange/30 text-gt-orange",
  pink: "from-gt-pink/20 to-gt-pink/5 border-gt-pink/30 text-gt-pink",
  cyan: "from-gt-cyan/20 to-gt-cyan/5 border-gt-cyan/30 text-gt-cyan",
  yellow: "from-gt-yellow/20 to-gt-yellow/5 border-gt-yellow/30 text-gt-yellow",
  red: "from-gt-red/20 to-gt-red/5 border-gt-red/30 text-gt-red",
};

export function ToolPageLayout({ title, description, icon: Icon, color, children }: ToolPageLayoutProps) {
  return (
    <div className="container py-8 md:py-12">
      {/* Back Button */}
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Tools</span>
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className={cn(
          "w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br border",
          colorClasses[color]
        )}>
          <Icon className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
          <p className="text-muted-foreground mt-1">{description}</p>
        </div>
      </div>

      {/* Content */}
      <div className="animate-fade-in">
        {children}
      </div>
    </div>
  );
}
