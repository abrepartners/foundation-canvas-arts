import { useState } from "react";
import { GeneratorForm } from "@/components/GeneratorForm";
import { OutputCard } from "@/components/OutputCard";
import { generateAssets } from "@/lib/generator";
import { Separator } from "@/components/ui/separator";

interface GeneratedAssets {
  script: string;
  thumbnailPrompt: string;
  caption: string;
  partTwoHook: string;
}

const Index = () => {
  const [assets, setAssets] = useState<GeneratedAssets | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [thumbnailMode, setThumbnailMode] = useState<"light" | "dark">("light");

  const handleGenerate = (input: { subject: string; claim: string; thumbnailMode: "light" | "dark" }) => {
    setIsGenerating(true);
    setThumbnailMode(input.thumbnailMode);
    
    // Simulate generation delay for UX
    setTimeout(() => {
      const generated = generateAssets(input);
      setAssets(generated);
      setIsGenerating(false);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
            Content Generator
          </p>
          <h1 className="text-2xl font-light tracking-tight text-foreground">
            Botanical Asset Generator
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate scripts, thumbnail prompts, captions, and hooks.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[1fr,1.5fr]">
          {/* Input Panel */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
                Input
              </h2>
              <GeneratorForm onGenerate={handleGenerate} isGenerating={isGenerating} />
            </div>
          </div>

          {/* Output Panel */}
          <div className="space-y-6">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              Generated Assets
            </h2>

            {!assets ? (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border/50 bg-muted/20">
                <p className="text-sm text-muted-foreground">
                  Enter a subject and claim to generate assets
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <OutputCard title="Script (25–30s)" content={assets.script} />
                <OutputCard 
                  title={`Thumbnail Prompt (${thumbnailMode})`} 
                  content={assets.thumbnailPrompt} 
                  variant="muted"
                />
                <Separator className="my-2" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <OutputCard title="Caption" content={assets.caption} />
                  <OutputCard title="Part 2 Hook" content={assets.partTwoHook} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 mt-auto">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <p className="text-xs text-muted-foreground text-center">
            Zero memory. Each asset stands alone.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
