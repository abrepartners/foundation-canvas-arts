import { useBotanicalContent } from "@/hooks/useBotanicalContent";
import { GenerateButton } from "@/components/GenerateButton";
import { ContentDisplay } from "@/components/ContentDisplay";

const Index = () => {
  const { content, isLoading, generate, reset } = useBotanicalContent();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container py-6">
          <h1 className="text-3xl font-serif text-foreground tracking-tight">
            Botanical Content Generator
          </h1>
          <p className="mt-1 text-muted-foreground font-body text-sm">
            Autonomous discovery of verifiable botanical facts
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="container py-12">
        {!content ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-8">
            <div className="text-center space-y-4 max-w-lg">
              <div className="w-16 h-16 mx-auto rounded-full bg-parchment flex items-center justify-center">
                <svg 
                  className="w-8 h-8 text-botanical" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5"
                >
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c1.5 0 3-.3 4.3-.9" strokeLinecap="round" />
                  <path d="M12 6c-3.3 0-6 2.7-6 6s2.7 6 6 6" strokeLinecap="round" />
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
                Each generation selects a real plant and one counterintuitive, verifiable fact. 
                Scripts, thumbnails, captions, and visual prompts are produced as a complete package.
              </p>
            </div>
            
            <GenerateButton onClick={generate} isLoading={isLoading} />
            
            <p className="text-xs text-graphite font-body">
              My brother knows plants. I verify the facts.
            </p>
          </div>
        ) : (
          <ContentDisplay content={content} onReset={reset} />
        )}
      </main>
    </div>
  );
};

export default Index;
