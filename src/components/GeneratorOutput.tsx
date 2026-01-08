import { OutputSection } from './OutputSection';
import { FileText, Image, MessageSquare, Repeat } from 'lucide-react';
import type { GeneratorOutput } from '@/types/generator';

interface GeneratorOutputProps {
  output: GeneratorOutput;
}

export function GeneratorOutput({ output }: GeneratorOutputProps) {
  return (
    <div className="space-y-4">
      <OutputSection
        title="Script"
        content={output.script}
        icon={<FileText className="h-4 w-4 text-muted-foreground" />}
      />
      <OutputSection
        title="Thumbnail Prompt"
        content={output.thumbnailPrompt}
        icon={<Image className="h-4 w-4 text-muted-foreground" />}
      />
      <OutputSection
        title="Caption"
        content={output.caption}
        icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
      />
      <OutputSection
        title="Part 2 Hook"
        content={output.part2Hook}
        icon={<Repeat className="h-4 w-4 text-muted-foreground" />}
      />
    </div>
  );
}
