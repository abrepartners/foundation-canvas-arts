import { History, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import type { SavedContent } from "@/hooks/useBotanicalContent";

interface HistorySidebarProps {
  history: SavedContent[];
  isLoading: boolean;
  onSelect: (item: SavedContent) => void;
  // Delete is intentionally disabled until real auth exists: with no login,
  // anon DELETE is an abuse vector and the RLS lockdown revokes it. Prop kept
  // optional for API compatibility with existing callers.
  onDelete?: (id: string) => void;
  selectedId?: string;
  className?: string;
}

export function HistorySidebar({
  history,
  isLoading,
  onSelect,
  selectedId,
  className = "w-72 border-r border-border",
}: HistorySidebarProps) {
  return (
    <div className={`${className} bg-card/50 flex flex-col h-full`}>
      <div className="p-4 border-b border-border flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-serif text-sm text-foreground">History</h2>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No saved content yet.
            <br />
            Generate your first package.
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelect(item)}
                className={`w-full text-left rounded-md p-3 transition-colors ${
                  selectedId === item.id
                    ? "bg-secondary"
                    : "hover:bg-secondary/50"
                }`}
              >
                <p className="font-serif text-sm text-foreground truncate">
                  {item.plant_name || "Untitled"}
                </p>
                {item.verified_fact && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.verified_fact}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground/70 mt-1">
                  {formatDistanceToNow(new Date(item.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
