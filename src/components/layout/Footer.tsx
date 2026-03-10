import { Wrench, Github, MessageCircle, Heart } from "lucide-react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/50 backdrop-blur-sm">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <Wrench className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold gradient-text">Growtools</span>
            </Link>
            <p className="text-muted-foreground text-sm max-w-md">
              The ultimate utility suite for Growtopia players. Access powerful tools
              for data analysis, item browsing, server monitoring, and much more.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <a
                href="https://github.com/xSkriptx/Growtools"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">
              Popular Tools
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/dat-decoder" className="text-muted-foreground hover:text-primary transition-colors">
                  DAT Decoder
                </Link>
              </li>
              <li>
                <Link to="/server-monitor" className="text-muted-foreground hover:text-primary transition-colors">
                  Server Monitor
                </Link>
              </li>
              <li>
                <Link to="/item-browser" className="text-muted-foreground hover:text-primary transition-colors">
                  Item Browser
                </Link>
              </li>
              <li>
                <Link to="/level-calculator" className="text-muted-foreground hover:text-primary transition-colors">
                  Level Calculator
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">
              More Tools
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/world-renderer" className="text-muted-foreground hover:text-primary transition-colors">
                  World Renderer
                </Link>
              </li>
              <li>
                <Link to="/rttex-converter" className="text-muted-foreground hover:text-primary transition-colors">
                  RTTEX Converter
                </Link>
              </li>
              <li>
                <Link to="/news" className="text-muted-foreground hover:text-primary transition-colors">
                  Growtopia News
                </Link>
              </li>
              <li>
                <Link to="/world-planner" className="text-muted-foreground hover:text-primary transition-colors">
                  World Planner
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border/50 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Growtools. Not affiliated with Ubisoft or Growtopia.
          </p>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            Made with <Heart className="w-4 h-4 text-gt-red fill-current" /> by xSkriptx & kabuokis
          </p>
        </div>
      </div>
    </footer>
  );
}
