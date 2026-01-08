import { useState } from "react";
import { GeneratorForm } from "@/components/GeneratorForm";
import { GeneratedAssets } from "@/components/GeneratedAssets";
import type { GeneratorInputs, GeneratedContent } from "@/types/generator";
import { generateContent } from "@/lib/generator";

const Index = () => {
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);

  const handleGenerate = (inputs: GeneratorInputs) => {
    const content = generateContent(inputs);
    setGeneratedContent(content);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/50">
        <div className="container mx-auto px-6 py-8">
          <h1 className="font-serif text-3xl font-light tracking-tight text-foreground">
            Botanical Content Generator
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Draft assets for botanical verification content
          </p>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10">
        <div className="grid gap-10 lg:grid-cols-[400px_1fr]">
          <aside>
            <GeneratorForm onGenerate={handleGenerate} />
          </aside>
          
          <section>
            {generatedContent ? (
              <GeneratedAssets content={generatedContent} />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/20 p-12">
                <p className="text-center text-sm text-muted-foreground">
                  Enter inputs and generate to see draft assets
                </p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Index;
