import { Loader2, Sparkles, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GenerateButtonProps {
  isGenerating: boolean;
  hasContent: boolean;
  onGenerate: () => void;
  onClear: () => void;
}

export function GenerateButton({ isGenerating, hasContent, onGenerate, onClear }: GenerateButtonProps) {
  if (hasContent) {
    return (
      <div className="flex gap-3 justify-center">
        <Button
          onClick={onGenerate}
          disabled={isGenerating}
          variant="outline"
          className="gap-2"
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          Generate New
        </Button>
        <Button
          onClick={onClear}
          variant="ghost"
          className="text-muted-foreground"
        >
          Clear
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={onGenerate}
      disabled={isGenerating}
      size="lg"
      className="gap-2 px-8"
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Discovering...
        </>
      ) : (
        <>
          <Sparkles className="w-4 h-4" />
          Generate Content
        </>
      )}
    </Button>
  );
}
