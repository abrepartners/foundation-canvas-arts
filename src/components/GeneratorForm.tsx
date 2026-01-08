import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { GeneratorInputs, ThumbnailMode } from "@/types/generator";

interface GeneratorFormProps {
  onGenerate: (inputs: GeneratorInputs) => void;
  isLoading?: boolean;
}

export function GeneratorForm({ onGenerate, isLoading }: GeneratorFormProps) {
  const [botanicalSubject, setBotanicalSubject] = useState("");
  const [claimToVerify, setClaimToVerify] = useState("");
  const [thumbnailMode, setThumbnailMode] = useState<ThumbnailMode>("Light");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botanicalSubject.trim() || !claimToVerify.trim()) return;
    
    onGenerate({
      botanicalSubject: botanicalSubject.trim(),
      claimToVerify: claimToVerify.trim(),
      thumbnailMode,
    });
  };

  const isValid = botanicalSubject.trim() && claimToVerify.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border border-border/60 bg-card p-6">
        <h2 className="mb-6 font-serif text-lg font-medium text-foreground">
          Inputs
        </h2>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-sm font-medium">
              Botanical Subject
            </Label>
            <Input
              id="subject"
              value={botanicalSubject}
              onChange={(e) => setBotanicalSubject(e.target.value)}
              placeholder="e.g., Lavender, Rosemary, Chamomile"
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="claim" className="text-sm font-medium">
              Claim to Verify
            </Label>
            <Textarea
              id="claim"
              value={claimToVerify}
              onChange={(e) => setClaimToVerify(e.target.value)}
              placeholder="e.g., This plant can help you sleep better"
              rows={3}
              className="bg-background resize-none"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Thumbnail Mode</Label>
            <RadioGroup
              value={thumbnailMode}
              onValueChange={(v) => setThumbnailMode(v as ThumbnailMode)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Light" id="light" />
                <Label htmlFor="light" className="cursor-pointer text-sm font-normal">
                  Light
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Dark" id="dark" />
                <Label htmlFor="dark" className="cursor-pointer text-sm font-normal">
                  Dark
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <Button
          type="submit"
          disabled={!isValid || isLoading}
          className="mt-6 w-full"
        >
          {isLoading ? "Generating..." : "Generate Assets"}
        </Button>
      </div>
    </form>
  );
}
