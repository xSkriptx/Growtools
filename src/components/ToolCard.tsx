import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ToolCardProps {
  name: string;
  description: string;
  icon: LucideIcon;
  path: string;
  color: "green" | "purple" | "blue" | "orange" | "pink" | "cyan" | "yellow" | "red";
  comingSoon?: boolean;
}

const colorClasses = {
  green: "from-gt-green/20 to-gt-green/5 hover:from-gt-green/30 hover:to-gt-green/10 border-gt-green/30",
  purple: "from-gt-purple/20 to-gt-purple/5 hover:from-gt-purple/30 hover:to-gt-purple/10 border-gt-purple/30",
  blue: "from-gt-blue/20 to-gt-blue/5 hover:from-gt-blue/30 hover:to-gt-blue/10 border-gt-blue/30",
  orange: "from-gt-orange/20 to-gt-orange/5 hover:from-gt-orange/30 hover:to-gt-orange/10 border-gt-orange/30",
  pink: "from-gt-pink/20 to-gt-pink/5 hover:from-gt-pink/30 hover:to-gt-pink/10 border-gt-pink/30",
  cyan: "from-gt-cyan/20 to-gt-cyan/5 hover:from-gt-cyan/30 hover:to-gt-cyan/10 border-gt-cyan/30",
  yellow: "from-gt-yellow/20 to-gt-yellow/5 hover:from-gt-yellow/30 hover:to-gt-yellow/10 border-gt-yellow/30",
  red: "from-gt-red/20 to-gt-red/5 hover:from-gt-red/30 hover:to-gt-red/10 border-gt-red/30",
};

const iconColorClasses = {
  green: "text-gt-green",
  purple: "text-gt-purple",
  blue: "text-gt-blue",
  orange: "text-gt-orange",
  pink: "text-gt-pink",
  cyan: "text-gt-cyan",
  yellow: "text-gt-yellow",
  red: "text-gt-red",
};

export function ToolCard({ name, description, icon: Icon, path, color, comingSoon }: ToolCardProps) {
  const CardContent = (
    <div
      className={cn(
        "relative group rounded-xl border bg-gradient-to-br p-6 transition-all duration-300",
        "hover:scale-[1.02] hover:shadow-lg hover:-translate-y-1",
        colorClasses[color],
        comingSoon && "opacity-60 cursor-not-allowed"
      )}
    >
      {comingSoon && (
        <Badge 
          variant="secondary" 
          className="absolute top-3 right-3 bg-muted text-muted-foreground text-xs"
        >
          Coming Soon
        </Badge>
      )}
      
      <div className={cn(
        "w-12 h-12 rounded-lg flex items-center justify-center mb-4",
        "bg-background/50 backdrop-blur-sm",
        "group-hover:scale-110 transition-transform duration-300"
      )}>
        <Icon className={cn("w-6 h-6", iconColorClasses[color])} />
      </div>
      
      <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
        {name}
      </h3>
      
      <p className="text-sm text-muted-foreground line-clamp-2">
        {description}
      </p>
      
      <div className={cn(
        "absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        "bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"
      )} />
    </div>
  );

  if (comingSoon) {
    return CardContent;
  }

  return (
    <Link to={path} className="block">
      {CardContent}
    </Link>
  );
}
