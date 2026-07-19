import { invokeFn } from "@/lib/invokeFn";
import { useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useTrendContent, useTrendHistory } from "@/hooks/useTrendContent";
import { type ImageProvider } from "@/components/GenerateButton";
import { ContentDisplay } from "@/components/ContentDisplay";
import { HistorySidebar } from "@/components/HistorySidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  PanelLeftClose,
  PanelLeft,
  Loader2,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Trends = () => {
  const {
    content,
    isLoading,
    generate,
    reset,
    loadFromHistory,
    regenerateVisual,
    regenerateAllVisuals,
    restoreVisualVersion,
    regenerateCaption,
    isRegeneratingCaption,
  } = useTrendContent();
  const {
    history,
    isLoading: historyLoading,
    refetch,
    deleteItem,
  } = useTrendHistory();
  const { toast } = useToast();

  const isMobile = useIsMobile();
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [imageProvider, setImageProvider] = useState<ImageProvider>("replicate");
  const [subject, setSubject] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  const handleSuggest = async () => {
    setTopicsLoading(true);
    try {
      const { data, error } = await invokeFn(
        "tiktok-trend-suggestions",
        { body: { subject } },
      );
      if (error) throw new Error(error.message);
      const list: string[] = Array.isArray(data?.topics) ? data.topics : [];
      setTopics(list);
      if (list.length === 0) {
        toast({
          title: "No suggestions",
          description: "Try a different subject.",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: "Suggestions failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setTopicsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!subject.trim()) {
      toast({
        title: "Subject required",
        description: "Type a subject or pick a trending topic.",
        variant: "destructive",
      });
      return;
    }
    setSelectedId(undefined);
    await generate(subject.trim(), imageProvider);
    refetch();
  };

  const handleSelect = (item: (typeof history)[0]) => {
    setSelectedId(item.id);
    loadFromHistory(item);
    if (isMobile) setMobileSheetOpen(false);
  };

  const handleReset = () => {
    setSelectedId(undefined);
    reset();
  };

  const toggleSidebar = () => {
    if (isMobile) setMobileSheetOpen((v) => !v);
    else setDesktopSidebarOpen((v) => !v);
  };

  const sidebarOpen = isMobile ? mobileSheetOpen : desktopSidebarOpen;

  return (
    <div className="min-h-screen bg-background flex">
      {!isMobile && desktopSidebarOpen && (
        <HistorySidebar
          history={history}
          isLoading={historyLoading}
          onSelect={handleSelect}
          onDelete={deleteItem}
          selectedId={selectedId}
        />
      )}

      {isMobile && (
        <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
          <SheetContent side="left" className="p-0 w-[85vw] max-w-sm">
            <HistorySidebar
              history={history}
              isLoading={historyLoading}
              onSelect={handleSelect}
              onDelete={deleteItem}
              selectedId={selectedId}
              className="w-full"
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          title="Trend Carousel Generator"
          subtitle="Any subject — TikTok-inspired, verified-fact carousels"
          leading={
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-8 w-8 flex-shrink-0"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeft className="h-4 w-4" />
              )}
            </Button>
          }
        />

        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <div className="container py-6 md:py-8">
            {!content ? (
              <div className="flex flex-col items-center justify-center py-8 md:py-12 space-y-8">
                <div className="text-center space-y-4 max-w-xl">
                  <div className="w-16 h-16 mx-auto rounded-full bg-parchment flex items-center justify-center">
                    <TrendingUp className="w-8 h-8 text-botanical" />
                  </div>
                  <h2 className="text-xl font-serif text-foreground">
                    Verified-fact carousels for any subject
                  </h2>
                  <p className="text-muted-foreground font-body text-sm leading-relaxed">
                    Type a subject (e.g. octopuses, Roman concrete, espresso) or
                    pull trending TikTok-style topics. The same museum-grade
                    pipeline runs — script, six 9:16 study-plate visuals, ready
                    to send to TikTok.
                  </p>
                </div>

                <div className="w-full max-w-xl space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="Subject — e.g. deep-sea creatures"
                      className="font-body"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleGenerate();
                      }}
                      disabled={isLoading}
                    />
                    <Button
                      variant="outline"
                      onClick={handleSuggest}
                      disabled={topicsLoading || isLoading}
                      className="font-body whitespace-nowrap w-full sm:w-auto"
                    >
                      {topicsLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Suggest trends
                        </>
                      )}
                    </Button>
                  </div>

                  {topics.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {topics.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSubject(t)}
                          className="text-xs font-body px-3 py-1.5 rounded-full border border-border bg-card hover:bg-secondary text-foreground transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}

                  <Button
                    onClick={handleGenerate}
                    disabled={isLoading || !subject.trim()}
                    size="lg"
                    className="w-full bg-botanical hover:bg-botanical/90 text-botanical-foreground font-body py-6 text-base"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Discovering verified fact...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-5 w-5" />
                        Generate Carousel
                      </>
                    )}
                  </Button>

                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-body">
                        Image model:
                      </span>
                      <Select
                        value={imageProvider}
                        onValueChange={(v) => setImageProvider(v as ImageProvider)}
                        disabled={isLoading}
                      >
                        <SelectTrigger className="h-8 w-[240px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="replicate">Replicate (FLUX 1.1 Pro)</SelectItem>
                          <SelectItem value="openai">OpenAI (gpt-image-2 HQ)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {imageProvider === "openai" && (
                      <p className="text-[10px] text-muted-foreground font-body max-w-[280px] text-center">
                        HQ tier — slower and more expensive. Output is 2:3 (1024×1536), not true 9:16.
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-xs text-graphite font-body">
                  My brother knows things. I verify the facts.
                </p>
              </div>
            ) : (
              <ContentDisplay
                content={content}
                onReset={handleReset}
                onRegenerateVisual={(moment) =>
                  regenerateVisual(moment, imageProvider)
                }
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

export default Trends;
