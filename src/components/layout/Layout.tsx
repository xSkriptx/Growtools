import { ReactNode } from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background bg-grid-pattern">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
