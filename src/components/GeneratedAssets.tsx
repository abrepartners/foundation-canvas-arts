import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GeneratedContent } from "@/types/generator";

interface GeneratedAssetsProps {
  content: GeneratedContent;
}

function AssetCard({ title, content }: { title: string; content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card">
      <div className="flex items-center justify-between border-b border-border/40 px-5 py-3">
        <h3 className="font-serif text-sm font-medium text-foreground">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 w-8 p-0"
        >
          {copied ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
      </div>
      <div className="p-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/90">
          {content}
        </pre>
      </div>
    </div>
  );
}

export function GeneratedAssets({ content }: GeneratedAssetsProps) {
  return (
    <div className="space-y-6">
      <AssetCard title="Script" content={content.script} />
      <AssetCard 
        title={`Thumbnail Prompt (${content.thumbnailMode})`} 
        content={content.thumbnailPrompt} 
      />
      <AssetCard title="Caption" content={content.caption} />
      <AssetCard title="Part 2 Hook" content={content.part2Hook} />
    </div>
  );
}
