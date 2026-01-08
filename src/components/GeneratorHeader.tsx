import { Leaf } from 'lucide-react';

interface GeneratorHeaderProps {
  plant?: string;
  fact?: string;
}

export function GeneratorHeader({ plant, fact }: GeneratorHeaderProps) {
  return (
    <header className="text-center mb-12">
      <div className="inline-flex items-center gap-2 text-muted-foreground mb-4">
        <Leaf className="w-5 h-5" strokeWidth={1.5} />
        <span className="text-xs uppercase tracking-[0.2em] font-medium">Botanical Archive</span>
      </div>
      
      {plant ? (
        <>
          <h1 className="font-heading text-4xl md:text-5xl text-foreground mb-3 italic">
            {plant}
          </h1>
          {fact && (
            <p className="text-muted-foreground max-w-xl mx-auto font-body text-base leading-relaxed">
              {fact}
            </p>
          )}
        </>
      ) : (
        <>
          <h1 className="font-heading text-4xl md:text-5xl text-foreground mb-3">
            Content Generator
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto font-body">
            Autonomous discovery of surprising botanical facts, 
            verified and packaged for short-form content.
          </p>
        </>
      )}
    </header>
  );
}
