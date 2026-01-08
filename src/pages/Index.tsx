import { useState } from "react";
import { GeneratorForm, GeneratorInput } from "@/components/GeneratorForm";
import { OutputSection } from "@/components/OutputSection";
import { generateAssets, GeneratedAssets } from "@/lib/generateAssets";

const Index = () => {
  const [assets, setAssets] = useState<GeneratedAssets | null>(null);

  const handleGenerate = (input: GeneratorInput) => {
    const generated = generateAssets(input);
    setAssets(generated);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <header className="mb-12">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight mb-2">
            Botanical Content Generator
          </h1>
          <p className="text-muted-foreground text-lg">
            Generate scripts, thumbnails, captions, and hooks for botanical verification content.
          </p>
        </header>

        <div className="grid lg:grid-cols-[400px_1fr] gap-12">
          <aside className="space-y-6">
            <div className="sticky top-6">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Input
              </h2>
              <GeneratorForm onGenerate={handleGenerate} />
            </div>
          </aside>

          <main>
            {assets ? (
              <div className="space-y-6">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                  Generated Assets
                </h2>
                <OutputSection title="Script" content={assets.script} />
                <OutputSection
                  title="Thumbnail Prompt"
                  content={assets.thumbnailPrompt}
                />
                <OutputSection title="Caption" content={assets.caption} />
                <OutputSection title="Part 2 Hook" content={assets.part2Hook} />
              </div>
            ) : (
              <div className="flex items-center justify-center h-[400px] border border-dashed border-border rounded-lg">
                <p className="text-muted-foreground text-center">
                  Enter a botanical subject and claim to generate assets.
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Index;
