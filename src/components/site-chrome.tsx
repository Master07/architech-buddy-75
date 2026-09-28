import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import iconMark from "@/assets/icon-mark.png.asset.json";
import primaryLockup from "@/assets/primary-lockup.png.asset.json";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center" aria-label="System Design Architect by Corbet AI">
          <img src={primaryLockup.url} alt="System Design Architect by Corbet AI" className="hidden h-9 w-auto sm:block" />
          <img src={iconMark.url} alt="System Design Architect" className="h-7 w-auto sm:hidden" />
        </Link>
        <nav className="flex items-center gap-1 sm:gap-3">
          <Button asChild size="sm" variant="ghost">
            <Link to="/samples" className="label-mono">Samples</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/docs" className="label-mono">Docs</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth" className="label-mono">Sign in</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>
          System Design Architect — built by{" "}
          <a href="https://corbetai.com" className="underline hover:text-foreground">
            Corbet AI
          </a>
          . Free during beta.
        </p>
        <nav className="flex flex-wrap gap-4">
          <Link to="/about" className="hover:text-foreground">About</Link>
          <Link to="/samples" className="hover:text-foreground">Samples</Link>
          <Link to="/docs" className="hover:text-foreground">API docs</Link>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </nav>
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function pageHead(path: string, title: string, description: string) {
  const url = `https://sda.corbetai.com${path}`;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: url }],
  };
}
