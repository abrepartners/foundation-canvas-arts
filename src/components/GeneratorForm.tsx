import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface GeneratorFormProps {
  onGenerate: (input: GeneratorInput) => void;
}

export interface GeneratorInput {
  botanicalSubject: string;
  claimOrFact: string;
  thumbnailStyle: "light" | "dark";
}

export function GeneratorForm({ onGenerate }: GeneratorFormProps) {
  const [botanicalSubject, setBotanicalSubject] = useState("");
  const [claimOrFact, setClaimOrFact] = useState("");
  const [thumbnailStyle, setThumbnailStyle] = useState<"light" | "dark">("light");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate({ botanicalSubject, claimOrFact, thumbnailStyle });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="subject" className="text-sm font-medium">
          Botanical Subject
        </Label>
        <Textarea
          id="subject"
          placeholder="e.g., Foxglove (Digitalis purpurea)"
          value={botanicalSubject}
          onChange={(e) => setBotanicalSubject(e.target.value)}
          className="min-h-[80px] resize-none font-[var(--font-body)]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="claim" className="text-sm font-medium">
          Claim or Fact to Verify
        </Label>
        <Textarea
          id="claim"
          placeholder="e.g., My brother says foxglove was used as a heart medicine"
          value={claimOrFact}
          onChange={(e) => setClaimOrFact(e.target.value)}
          className="min-h-[100px] resize-none font-[var(--font-body)]"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">Thumbnail Style</Label>
        <RadioGroup
          value={thumbnailStyle}
          onValueChange={(v) => setThumbnailStyle(v as "light" | "dark")}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="light" id="light" />
            <Label htmlFor="light" className="text-sm cursor-pointer">
              Light
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dark" id="dark" />
            <Label htmlFor="dark" className="text-sm cursor-pointer">
              Dark
            </Label>
          </div>
        </RadioGroup>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={!botanicalSubject.trim() || !claimOrFact.trim()}
      >
        Generate Assets
      </Button>
    </form>
  );
}
