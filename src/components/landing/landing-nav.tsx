import { Github } from "lucide-react";

export function LandingNav() {
  return (
    <nav
      aria-label="主導覽"
      className="fixed top-0 left-0 right-0 z-50 h-14"
    >
      <div className="mx-auto max-w-6xl h-full px-6 md:px-8 flex items-center justify-between">
        <span className="text-lg font-semibold text-foreground">nudge</span>
        <a
          href="https://github.com/gv8899/Nudge"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="text-text-dim hover:text-foreground transition-colors p-2 -mr-2"
        >
          <Github className="h-5 w-5" />
        </a>
      </div>
    </nav>
  );
}
