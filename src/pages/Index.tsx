import { useState } from 'react';
import { GeneratorForm } from '@/components/GeneratorForm';
import { GeneratorOutput } from '@/components/GeneratorOutput';
import { generateContent } from '@/lib/generateContent';
import type { GeneratorInput, GeneratorOutput as OutputType } from '@/types/generator';
import { Leaf } from 'lucide-react';

const Index = () => {
  const [output, setOutput] = useState<OutputType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async (input: GeneratorInput) => {
    setIsLoading(true);
    // Simulate brief processing
    await new Promise(resolve => setTimeout(resolve, 300));
    const result = generateContent(input);
    setOutput(result);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-12">
        {/* Header */}
        <header className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <Leaf className="h-6 w-6 text-primary" />
            <span className="text-xs font-medium tracking-[0.3em] uppercase text-muted-foreground">
              Botanical Verification
            </span>
          </div>
          <h1 className="text-3xl font-serif font-light tracking-tight text-foreground mb-2">
            Content Generator
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Generate scripts, thumbnails, captions, and hooks for botanical verification content.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Input Form */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <div className="rounded-lg border border-border/50 bg-card/30 p-6">
              <GeneratorForm onGenerate={handleGenerate} isLoading={isLoading} />
            </div>
          </div>

          {/* Output */}
          <div>
            {output ? (
              <GeneratorOutput output={output} />
            ) : (
              <div className="flex items-center justify-center h-64 rounded-lg border border-dashed border-border/50">
                <p className="text-sm text-muted-foreground">
                  Enter inputs to generate assets
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
