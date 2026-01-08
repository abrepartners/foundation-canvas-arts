import { useBotanicalGenerator } from '@/hooks/useBotanicalGenerator';
import { GeneratorHeader } from './GeneratorHeader';
import { GenerateButton } from './GenerateButton';
import { ScriptSection } from './ScriptSection';
import { ContentSection } from './ContentSection';
import { AlertCircle } from 'lucide-react';

export function BotanicalGenerator() {
  const { content, isGenerating, error, generate, clear } = useBotanicalGenerator();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <GeneratorHeader plant={content?.plant} fact={content?.fact} />

        <div className="flex justify-center mb-12">
          <GenerateButton
            isGenerating={isGenerating}
            hasContent={!!content}
            onGenerate={generate}
            onClear={clear}
          />
        </div>

        {error && (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded mb-8">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {content && (
          <div className="space-y-8">
            <ScriptSection script={content.script} />
            
            <ContentSection
              title="Thumbnail Prompt (Light)"
              content={content.thumbnailPrompt}
            />

            <ContentSection
              title="Caption"
              content={content.caption}
            />

            <ContentSection
              title="Part 2 Hook"
              content={content.part2Hook}
            />
          </div>
        )}

        <footer className="mt-16 pt-8 border-t border-border text-center">
          <p className="text-xs text-muted-foreground tracking-wide">
            My brother knows plants. I verify the facts.
          </p>
        </footer>
      </div>
    </div>
  );
}
