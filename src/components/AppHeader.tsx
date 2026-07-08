import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Leaf, TrendingUp, Film, ListChecks, LogOut } from "lucide-react";
import { lock } from "@/lib/auth";


const TABS = [
  { to: "/", label: "Plants", icon: Leaf },
  { to: "/trends", label: "Trends", icon: TrendingUp },
  { to: "/animated", label: "Animated", icon: Film },
  { to: "/queue", label: "Queue", icon: ListChecks },
];

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  contained?: boolean; // wrap in .container (Queue/Animated) vs full-width padded (Index/Trends)
}

export function AppHeader({ title, subtitle, leading, contained = false }: AppHeaderProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  const handleSignOut = async () => {
    await supabase.auth.signOut();
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
        {TABS.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className={`px-3 py-1.5 rounded-md ${
              isActive(t.to)
                ? "bg-secondary text-foreground"
                : "hover:bg-secondary text-muted-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
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
    </div>
  );


  return (
    <>
      <header className="border-b border-border">
        {contained ? (
          <div className="container">{headerInner}</div>
        ) : (
          <div className="px-4">{headerInner}</div>
        )}
      </header>

      {/* Mobile bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = isActive(t.to);
            return (
              <li key={t.to}>
                <Link
                  to={t.to}
                  className={`flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-body ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${active ? "text-foreground" : "text-muted-foreground"}`}
                  />
                  <span className={active ? "font-medium" : ""}>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
