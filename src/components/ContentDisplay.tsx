import { ContentSection } from "./ContentSection";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { BotanicalContent } from "@/hooks/useBotanicalContent";

interface ContentDisplayProps {
  content: BotanicalContent;
  onReset: () => void;
}

export function ContentDisplay({ content, onReset }: ContentDisplayProps) {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif text-foreground">Content Package</h2>
        <Button
          variant="outline"
          onClick={onReset}
          className="font-body"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Generate New
        </Button>
      </div>

      <div className="space-y-6">
        <ContentSection 
          title="Script" 
          content={content.script} 
        />
        
        <ContentSection 
          title="Thumbnail Prompt (Light)" 
          content={content.thumbnail} 
        />
        
        <ContentSection 
          title="Caption" 
          content={content.caption} 
        />
        
        <ContentSection 
          title="Part 2 Hook" 
          content={content.part2Hook} 
        />
        
        <ContentSection 
          title="Script Visuals" 
          content={content.scriptVisuals} 
        />
      </div>
    </div>
  );
}
