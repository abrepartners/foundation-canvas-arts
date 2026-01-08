import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface GeneratorFormProps {
  onGenerate: (input: { subject: string; claim: string; thumbnailMode: "light" | "dark" }) => void;
  isGenerating: boolean;
}

export const GeneratorForm = ({ onGenerate, isGenerating }: GeneratorFormProps) => {
  const [subject, setSubject] = useState("");
  const [claim, setClaim] = useState("");
  const [thumbnailMode, setThumbnailMode] = useState<"light" | "dark">("light");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !claim.trim()) return;
    onGenerate({ subject, claim, thumbnailMode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="subject" className="text-sm font-medium text-foreground/80">
          Botanical Subject
        </Label>
        <Textarea
          id="subject"
          placeholder="e.g., Willow bark (Salix alba)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="min-h-[80px] resize-none border-border/50 bg-background/50 focus:border-primary/50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="claim" className="text-sm font-medium text-foreground/80">
          Claim to Verify
        </Label>
        <Textarea
          id="claim"
          placeholder="e.g., Willow bark was the original source of aspirin"
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          className="min-h-[100px] resize-none border-border/50 bg-background/50 focus:border-primary/50"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium text-foreground/80">Thumbnail Mode</Label>
        <RadioGroup
          value={thumbnailMode}
          onValueChange={(value) => setThumbnailMode(value as "light" | "dark")}
          className="flex gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="light" id="light" />
            <Label htmlFor="light" className="cursor-pointer text-foreground/70">
              Light (Daylight)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dark" id="dark" />
            <Label htmlFor="dark" className="cursor-pointer text-foreground/70">
              Dark (Cinematic)
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Button
        type="submit"
        disabled={!subject.trim() || !claim.trim() || isGenerating}
        className="w-full"
      >
        {isGenerating ? "Generating..." : "Generate Assets"}
      </Button>
    </form>
  );
};
