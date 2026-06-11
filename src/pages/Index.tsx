import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useBotanicalContent,
  useContentHistory,
} from "@/hooks/useBotanicalContent";
import { GenerateButton, type ImageProvider } from "@/components/GenerateButton";
import { ContentDisplay } from "@/components/ContentDisplay";
import { HistorySidebar } from "@/components/HistorySidebar";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeft } from "lucide-react";

const Index = () => {
  const { content, isLoading, generate, reset, loadFromHistory, regenerateVisual, regenerateAllVisuals, restoreVisualVersion, regenerateCaption, isRegeneratingCaption } =
    useBotanicalContent();
  const {
    history,
    isLoading: historyLoading,
    refetch,
    deleteItem,
  } = useContentHistory();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [imageProvider, setImageProvider] = useState<ImageProvider>("lovable");

  const handleSelect = (item: (typeof history)[0]) => {
    setSelectedId(item.id);
    loadFromHistory(item);
  };

  const handleGenerate = async () => {
    setSelectedId(undefined);
    await generate(imageProvider);
    refetch();
  };

  const handleReset = () => {
    setSelectedId(undefined);
    reset();
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      {sidebarOpen && (
        <HistorySidebar
          history={history}
          isLoading={historyLoading}
          onSelect={handleSelect}
          onDelete={deleteItem}
          selectedId={selectedId}
        />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-border">
          <div className="flex items-center gap-3 px-4 py-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-serif text-foreground tracking-tight">
                Botanical Content Generator
              </h1>
              <p className="text-muted-foreground font-body text-xs">
                Autonomous discovery of verifiable botanical facts
              </p>
            </div>
            <nav className="flex items-center gap-1 text-sm font-body">
              <Link
                to="/"
                className="px-3 py-1.5 rounded-md bg-secondary text-foreground"
              >
                Plants
              </Link>
              <Link
                to="/trends"
                className="px-3 py-1.5 rounded-md hover:bg-secondary text-muted-foreground"
              >
                Trends
              </Link>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="container py-8">
            {!content ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-8">
                <div className="text-center space-y-4 max-w-lg">
                  <div className="w-16 h-16 mx-auto rounded-full bg-parchment flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-botanical"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path
                        d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.5 0 3-.3 4.3-.9"
                        strokeLinecap="round"
                      />
                      <path
                        d="M12 6c-3.3 0-6 2.7-6 6s2.7 6 6 6"
                        strokeLinecap="round"
                      />
                      <path d="M15 12c0-1.7-1.3-3-3-3" strokeLinecap="round" />
                      <path d="M19 8l-1.5 1.5" strokeLinecap="round" />
                      <path d="M22 12h-2" strokeLinecap="round" />
                      <path d="M19 16l-1.5-1.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-serif text-foreground">
                    Zero-memory botanical discovery
                  </h2>
                  <p className="text-muted-foreground font-body text-sm leading-relaxed">
                    Each generation selects a real plant and one
                    counterintuitive, verifiable fact. Scripts, thumbnails,
                    captions, and visual prompts are produced as a complete
                    package.
                  </p>
                </div>

                <GenerateButton
                  onClick={handleGenerate}
                  isLoading={isLoading}
                  provider={imageProvider}
                  onProviderChange={setImageProvider}
                />

                <p className="text-xs text-graphite font-body">
                  My brother knows plants. I verify the facts.
                </p>
              </div>
            ) : (
              <ContentDisplay 
                content={content} 
                onReset={handleReset} 
                onRegenerateVisual={(moment) => regenerateVisual(moment, imageProvider)}
                onRegenerateAll={() => regenerateAllVisuals(imageProvider)}
                onRestoreVersion={restoreVisualVersion}
                onRegenerateCaption={regenerateCaption}
                isRegeneratingCaption={isRegeneratingCaption}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
