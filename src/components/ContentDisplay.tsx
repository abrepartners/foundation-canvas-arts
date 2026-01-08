import { Button } from "@/components/ui/button";
import { RotateCcw, Copy, Check } from "lucide-react";
import { useState } from "react";
import type { BotanicalContent, FacelessVisual } from "@/hooks/useBotanicalContent";

interface ContentDisplayProps {
  content: BotanicalContent;
  onReset: () => void;
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

function ScriptSection({ script }: { script: BotanicalContent["script"] }) {
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

function FacelessVisualsSection({ visuals }: { visuals: FacelessVisual[] }) {
  const allPrompts = visuals
    .map((v) => `[${momentLabels[v.moment]}]\n${v.prompt}`)
    .join("\n\n---\n\n");

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-foreground">Faceless Visuals</h3>
        <CopyButton text={allPrompts} />
      </div>
      <p className="text-xs text-muted-foreground">
        {visuals.length} unique moments • Zero-memory prompts
      </p>
      <div className="space-y-4">
        {visuals.map((visual, idx) => (
          <div key={idx} className="border-l-2 border-primary/30 pl-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-primary">
                {momentLabels[visual.moment]}
              </span>
              <CopyButton text={visual.prompt} />
            </div>
            <p className="text-sm text-foreground/90 font-body whitespace-pre-wrap">
              {visual.prompt}
            </p>
          </div>
        ))}
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

export function ContentDisplay({ content, onReset }: ContentDisplayProps) {
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
          <FacelessVisualsSection visuals={content.faceless_visuals} />
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
