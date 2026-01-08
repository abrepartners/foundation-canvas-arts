import { Button } from "@/components/ui/button";
import { RotateCcw, Copy, Check, RefreshCw, Loader2 } from "lucide-react";
import { useState } from "react";
import type { ContentWithId, FacelessVisual } from "@/hooks/useBotanicalContent";

interface ContentDisplayProps {
  content: ContentWithId;
  onReset: () => void;
  onRegenerateVisual?: (moment: string, prompt: string) => Promise<string | null>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 w-8 p-0">
      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

function ScriptSection({ script }: { script: ContentWithId["script"] }) {
  const sections = [
    { label: "Hook", timing: "0-4s", content: script.hook },
    { label: "Dangle 1", timing: "4-9s", content: script.dangle_1 },
    { label: "Re-hook", timing: "9-14s", content: script.rehook },
    { label: "Dangle 2", timing: "14-20s", content: script.dangle_2 },
    { label: "Payoff", timing: "20-25s", content: script.payoff },
    { label: "Verified Truth", timing: "25-32s", content: script.verified_truth },
    { label: "Close", timing: "32-35s", content: script.close },
  ];

  const fullScript = sections.map(s => s.content).join("\n\n");

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-foreground">Script</h3>
        <CopyButton text={fullScript} />
      </div>
      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.label} className="border-l-2 border-muted pl-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-primary">{section.label}</span>
              <span className="text-xs text-muted-foreground">({section.timing})</span>
            </div>
            <p className="text-sm text-foreground/90 font-body">{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const momentLabels: Record<string, string> = {
  hook: "Hook",
  dangle_1: "Dangle 1",
  rehook: "Re-hook",
  dangle_2: "Dangle 2",
  verified_truth: "Verified Truth",
  close: "Close"
};

const momentOrder = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"];

function FacelessVisualsSection({ 
  visuals, 
  onRegenerate 
}: { 
  visuals: FacelessVisual[];
  onRegenerate?: (moment: string, prompt: string) => Promise<string | null>;
}) {
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set());
  const [regenerating, setRegenerating] = useState<string | null>(null);
  
  // Sort visuals by script flow order
  const sortedVisuals = [...visuals].sort(
    (a, b) => momentOrder.indexOf(a.moment) - momentOrder.indexOf(b.moment)
  );

  const allPrompts = sortedVisuals
    .map((v) => `[${momentLabels[v.moment]}]\n${v.prompt}`)
    .join("\n\n---\n\n");

  const togglePrompt = (idx: number) => {
    setExpandedPrompts(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const handleRegenerate = async (moment: string, prompt: string) => {
    if (!onRegenerate || regenerating) return;
    setRegenerating(moment);
    try {
      await onRegenerate(moment, prompt);
    } finally {
      setRegenerating(null);
    }
  };

  const imagesGenerated = sortedVisuals.filter(v => v.image_url).length;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-foreground">Faceless Visuals</h3>
        <CopyButton text={allPrompts} />
      </div>
      <p className="text-xs text-muted-foreground">
        {visuals.length} unique moments • {imagesGenerated} images generated
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {sortedVisuals.map((visual, idx) => {
          const isRegenerating = regenerating === visual.moment;
          
          return (
            <div key={idx} className="space-y-2">
              {/* Image or placeholder */}
              <div className="aspect-[9/16] rounded-lg overflow-hidden bg-muted/50 border border-border relative group">
                {visual.image_url ? (
                  <>
                    <img 
                      src={visual.image_url} 
                      alt={`${momentLabels[visual.moment]} visual`}
                      className="w-full h-full object-cover"
                    />
                    {/* Regenerate overlay on hover */}
                    {onRegenerate && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleRegenerate(visual.moment, visual.prompt)}
                          disabled={isRegenerating}
                          className="text-xs"
                        >
                          {isRegenerating ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          Regenerate
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    {onRegenerate ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerate(visual.moment, visual.prompt)}
                        disabled={isRegenerating}
                        className="text-xs"
                      >
                        {isRegenerating ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Generate
                      </Button>
                    ) : (
                      <span className="text-xs">No image</span>
                    )}
                  </div>
                )}
                
                {/* Loading overlay */}
                {isRegenerating && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )}
              </div>
              
              {/* Moment label and actions */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-primary">
                  {momentLabels[visual.moment]}
                </span>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => togglePrompt(idx)}
                    className="h-6 px-2 text-xs"
                  >
                    {expandedPrompts.has(idx) ? "Hide" : "Prompt"}
                  </Button>
                  <CopyButton text={visual.prompt} />
                </div>
              </div>

              {/* Collapsible prompt */}
              {expandedPrompts.has(idx) && (
                <p className="text-xs text-foreground/80 font-body whitespace-pre-wrap bg-muted/30 rounded p-2">
                  {visual.prompt}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContentCard({ title, children, copyText }: { title: string; children: React.ReactNode; copyText?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-serif text-lg text-foreground">{title}</h3>
        {copyText && <CopyButton text={copyText} />}
      </div>
      {children}
    </div>
  );
}

export function ContentDisplay({ content, onReset, onRegenerateVisual }: ContentDisplayProps) {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-foreground">{content.plant_name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{content.verified_fact}</p>
        </div>
        <Button variant="outline" onClick={onReset} className="font-body">
          <RotateCcw className="mr-2 h-4 w-4" />
          Generate New
        </Button>
      </div>

      <div className="space-y-4">
        <ScriptSection script={content.script} />

        {content.faceless_visuals?.length > 0 && (
          <FacelessVisualsSection 
            visuals={content.faceless_visuals} 
            onRegenerate={onRegenerateVisual}
          />
        )}

        <ContentCard 
          title={`Thumbnail Prompt (${content.thumbnail_prompt.mode})`} 
          copyText={content.thumbnail_prompt.prompt}
        >
          <p className="text-sm text-foreground/90 font-body whitespace-pre-wrap">
            {content.thumbnail_prompt.prompt}
          </p>
        </ContentCard>

        <ContentCard title="Caption" copyText={content.caption}>
          <p className="text-sm text-foreground/90 font-body whitespace-pre-wrap">
            {content.caption}
          </p>
        </ContentCard>

        <ContentCard title="Part 2 Hook" copyText={content.part2_hook}>
          <p className="text-sm text-foreground/90 font-body whitespace-pre-wrap">
            {content.part2_hook}
          </p>
        </ContentCard>
      </div>
    </div>
  );
}
