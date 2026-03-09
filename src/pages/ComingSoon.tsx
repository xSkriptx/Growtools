import { Construction } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface ComingSoonProps {
  title: string;
}

export default function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div className="container py-20 md:py-32">
      <div className="max-w-lg mx-auto text-center">
        <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
          <Construction className="w-10 h-10 text-muted-foreground" />
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          {title}
        </h1>
        
        <p className="text-muted-foreground mb-8">
          This tool is currently under development. Check back soon for updates!
        </p>
        
        <Link to="/">
          <Button>
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
