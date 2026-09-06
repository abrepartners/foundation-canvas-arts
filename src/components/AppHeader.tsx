import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Clapperboard, Leaf, LogOut, Settings } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  contained?: boolean;
}

export function AppHeader({ title, subtitle, leading, contained = false }: AppHeaderProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };


  const headerInner = (
    <div className="flex items-center gap-3 py-4">
      {leading}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl md:text-2xl font-serif text-foreground tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground font-body text-xs hidden sm:block truncate">
            {subtitle}
          </p>
        )}
      </div>
      {/* Desktop nav */}
      <nav className="hidden md:flex items-center gap-1 text-sm font-body flex-shrink-0">
        <Link
          to="/"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md ${
            isActive("/")
              ? "bg-secondary text-foreground"
              : "hover:bg-secondary text-muted-foreground"
          }`}
        >
          <Leaf className="h-4 w-4" />
          Generator
        </Link>
        <Link
          to="/episodes"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md ${
            isActive("/episodes")
              ? "bg-secondary text-foreground"
              : "hover:bg-secondary text-muted-foreground"
          }`}
        >
          <Clapperboard className="h-4 w-4" />
          Episodes
        </Link>
        <Link
          to="/settings"
          className={`ml-1 px-2 py-1.5 rounded-md ${
            isActive("/settings")
              ? "bg-secondary text-foreground"
              : "hover:bg-secondary text-muted-foreground"
          }`}
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="ml-1 px-2 py-1.5 rounded-md hover:bg-secondary text-muted-foreground"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </nav>
      <div className="md:hidden flex items-center gap-1">
        <Link
          to="/episodes"
          className={`p-2 rounded-md ${
            isActive("/episodes")
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary"
          }`}
          aria-label="Episodes"
          title="Episodes"
        >
          <Clapperboard className="h-4 w-4" />
        </Link>
        <Link
          to="/settings"
          className={`p-2 rounded-md ${
            isActive("/settings")
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary"
          }`}
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="p-2 rounded-md hover:bg-secondary text-muted-foreground"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <header className="border-b border-border">
      {contained ? (
        <div className="container">{headerInner}</div>
      ) : (
        <div className="px-4">{headerInner}</div>
      )}
    </header>
  );
}
