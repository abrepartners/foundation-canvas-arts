import { useState, useEffect } from "react";
import {
  useBotanicalContent,
  useContentHistory,
  type RegenerationQuote,
  type StillGenerationQuote,
} from "@/hooks/useBotanicalContent";
import { GenerateButton, type ImageProvider } from "@/components/GenerateButton";
import { ContentDisplay } from "@/components/ContentDisplay";
import { HistorySidebar } from "@/components/HistorySidebar";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Index = () => {
  const { content, isLoading, isQuoting, isQuotingRegeneration, isPackageActive, getGenerationQuote, getRegenerationQuote, generate, reset, loadFromHistory, regenerateVisual, regenerateAllVisuals, restoreVisualVersion, regenerateCaption, isRegeneratingCaption, autoResumeExhausted, retryStuck, isRetryingStuck } =
    useBotanicalContent();
  const {
    history,
    isLoading: historyLoading,
    refetch,
    deleteItem,
  } = useContentHistory();
  const isMobile = useIsMobile();
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [imageProvider, setImageProvider] = useState<ImageProvider>("openai");
  const [pendingQuote, setPendingQuote] = useState<StillGenerationQuote | null>(null);
  const [pendingRegeneration, setPendingRegeneration] = useState<{
    items: Array<{ moment: string; quote: RegenerationQuote }>;
  } | null>(null);

  const handleSelect = (item: (typeof history)[0]) => {
    setSelectedId(item.id);
    loadFromHistory(item);
    if (isMobile) setMobileSheetOpen(false);
  };

  useEffect(() => {
    const pendingId = sessionStorage.getItem("queue:load_id");
    if (!pendingId || historyLoading) return;
    const item = history.find((h) => h.id === pendingId);
    if (item) {
      sessionStorage.removeItem("queue:load_id");
      handleSelect(item);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, historyLoading]);

  const handleGenerate = async () => {
    const quote = await getGenerationQuote(imageProvider);
    if (!quote) return;
    setPendingQuote(quote);
  };

  const handleConfirmGenerate = async () => {
    const quote = pendingQuote;
    if (!quote) return;
    setPendingQuote(null);
    setSelectedId(undefined);
    await generate(imageProvider, quote);
    refetch();
  };

  const requestRegeneration = async (
    moment: string,
    promptMode: "saved" | "refresh" = "saved",
  ) => {
    const quote = await getRegenerationQuote(moment, promptMode);
    if (!quote) return null;
    setPendingRegeneration({ items: [{ moment, quote }] });
    return null;
  };

  const requestRegenerateAll = async () => {
    if (!content) return;
    const items: Array<{ moment: string; quote: RegenerationQuote }> = [];
    for (const visual of content.faceless_visuals) {
      const quote = await getRegenerationQuote(visual.moment, "saved");
      if (!quote) return;
      items.push({ moment: visual.moment, quote });
    }
    setPendingRegeneration({ items });
  };

  const handleConfirmRegeneration = async () => {
    const pending = pendingRegeneration;
    if (!pending) return;
    setPendingRegeneration(null);
    if (pending.items.length === 1) {
      const item = pending.items[0];
      await regenerateVisual(item.moment, item.quote);
      refetch();
      return;
    }
    await regenerateAllVisuals(pending.items);
    refetch();
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
      {/* Desktop sidebar */}
      {!isMobile && desktopSidebarOpen && (
        <HistorySidebar
          history={history}
          isLoading={historyLoading}
          onSelect={handleSelect}
          onDelete={deleteItem}
          selectedId={selectedId}
        />
      )}

      {/* Mobile drawer sidebar */}
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

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          title="Botanical Content Generator"
          subtitle="Autonomous discovery of verifiable botanical facts"
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

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="container py-6 md:py-8">
            {!content ? (
              <div className="flex flex-col items-center justify-center py-12 md:py-16 space-y-8">
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
                  isLoading={isLoading || isQuoting}
                  disabled={isPackageActive}
                  provider={imageProvider}
                  onProviderChange={setImageProvider}
                />

                {isPackageActive && (
                  <p className="text-xs text-muted-foreground font-body text-center">
                    The current six-image package must finish before another can start.
                  </p>
                )}

                <p className="text-xs text-graphite font-body">
                  My brother knows plants. I verify the facts.
                </p>
              </div>
            ) : (
              <ContentDisplay 
                content={content} 
                onReset={handleReset} 
                onRegenerateVisual={(moment) => requestRegeneration(moment, "saved")}
                onRefreshVisualPrompt={(moment) => requestRegeneration(moment, "refresh")}
                onRegenerateAll={requestRegenerateAll}
                isQuotingRegeneration={isQuotingRegeneration}
                onRestoreVersion={restoreVisualVersion}
                onRegenerateCaption={regenerateCaption}
                isRegeneratingCaption={isRegeneratingCaption}
                autoResumeExhausted={autoResumeExhausted}
                onRetryStuck={retryStuck}
                isRetryingStuck={isRetryingStuck}
              />
            )}
          </div>
        </main>
      </div>

      <AlertDialog
        open={Boolean(pendingQuote)}
        onOpenChange={(open) => {
          if (!open) setPendingQuote(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm six-image generation</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  This creates one caption package and six independent botanical images.
                </p>
                <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-foreground">
                  <div className="flex justify-between gap-4">
                    <span>Selected model</span>
                    <span className="font-medium text-right">{pendingQuote?.model}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Maximum estimate</span>
                    <span className="font-medium">${pendingQuote?.estimated_cost_usd.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Remaining daily allowance</span>
                    <span className="font-medium">${pendingQuote?.daily_remaining_usd.toFixed(2)}</span>
                  </div>
                </div>
                <p>
                  Only one package can run at a time. Duplicate submissions reuse the same request key and cannot create another package.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGenerate}>
              Confirm and generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(pendingRegeneration)}
        onOpenChange={(open) => {
          if (!open) setPendingRegeneration(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm {pendingRegeneration?.items.length === 1 ? "image" : "six-image"} regeneration
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  {pendingRegeneration?.items.some((item) => item.quote.prompt_mode === "refresh")
                    ? "This uses the latest locked botanical prompt for the selected image."
                    : "This reuses each image's exact saved prompt, recorded model, and recorded settings."}
                </p>
                <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-foreground">
                  <div className="flex justify-between gap-4">
                    <span>Recorded model</span>
                    <span className="font-medium text-right">
                      {Array.from(new Set(pendingRegeneration?.items.map((item) => item.quote.model) ?? [])).join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Maximum estimate</span>
                    <span className="font-medium">
                      ${(pendingRegeneration?.items.reduce((sum, item) => sum + item.quote.estimated_cost_usd, 0) ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Remaining daily allowance</span>
                    <span className="font-medium">
                      ${Math.min(...(pendingRegeneration?.items.map((item) => item.quote.daily_remaining_usd) ?? [0])).toFixed(2)}
                    </span>
                  </div>
                </div>
                <p>
                  The current image and its full generation metadata will remain available in version history.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRegeneration}>
              Confirm and regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
