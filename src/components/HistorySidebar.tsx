import { History, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import type { SavedContent } from "@/hooks/useBotanicalContent";

interface HistorySidebarProps {
  history: SavedContent[];
  isLoading: boolean;
  onSelect: (item: SavedContent) => void;
  onDelete: (id: string) => void;
  selectedId?: string;
  className?: string;
}

export function HistorySidebar({
  history,
  isLoading,
  onSelect,
  onDelete,
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
              <div
                key={item.id}
                className={`group relative rounded-md transition-colors ${
                  selectedId === item.id
                    ? "bg-secondary"
                    : "hover:bg-secondary/50"
                }`}
              >
                <button
                  onClick={() => onSelect(item)}
                  className="w-full text-left p-3 pr-10"
                >
                  <p className="font-serif text-sm text-foreground truncate">
                    {item.plant_name || "Untitled"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(item.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
