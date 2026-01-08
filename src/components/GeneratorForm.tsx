import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { GeneratorInput, ThumbnailMode } from '@/types/generator';

interface GeneratorFormProps {
  onGenerate: (input: GeneratorInput) => void;
  isLoading?: boolean;
}

export function GeneratorForm({ onGenerate, isLoading }: GeneratorFormProps) {
  const [botanicalSubject, setBotanicalSubject] = useState('');
  const [claimToVerify, setClaimToVerify] = useState('');
  const [thumbnailMode, setThumbnailMode] = useState<ThumbnailMode>('light');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!botanicalSubject.trim() || !claimToVerify.trim()) return;
    onGenerate({ botanicalSubject, claimToVerify, thumbnailMode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="subject" className="text-sm font-medium tracking-wide uppercase text-muted-foreground">
          Botanical Subject
        </Label>
        <Input
          id="subject"
          value={botanicalSubject}
          onChange={(e) => setBotanicalSubject(e.target.value)}
          placeholder="e.g., Lavender, Ginkgo biloba, Willow bark"
          className="bg-card border-border/50 focus:border-primary/50"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="claim" className="text-sm font-medium tracking-wide uppercase text-muted-foreground">
          Claim to Verify
        </Label>
        <Textarea
          id="claim"
          value={claimToVerify}
          onChange={(e) => setClaimToVerify(e.target.value)}
          placeholder="e.g., Lavender can cure insomnia"
          className="bg-card border-border/50 focus:border-primary/50 min-h-[100px] resize-none"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium tracking-wide uppercase text-muted-foreground">
          Thumbnail Mode
        </Label>
        <RadioGroup
          value={thumbnailMode}
          onValueChange={(val) => setThumbnailMode(val as ThumbnailMode)}
          className="flex gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="light" id="light" />
            <Label htmlFor="light" className="cursor-pointer font-normal">Light</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="dark" id="dark" />
            <Label htmlFor="dark" className="cursor-pointer font-normal">Dark</Label>
          </div>
        </RadioGroup>
      </div>

      <Button
        type="submit"
        disabled={isLoading || !botanicalSubject.trim() || !claimToVerify.trim()}
        className="w-full"
      >
        {isLoading ? 'Generating...' : 'Generate Assets'}
      </Button>
    </form>
  );
}
