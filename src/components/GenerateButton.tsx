import { Leaf, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ImageProvider = "replicate" | "openai";

interface GenerateButtonProps {
  onClick: () => void;
  isLoading: boolean;
  provider: ImageProvider;
  onProviderChange: (provider: ImageProvider) => void;
}

export function GenerateButton({
  onClick,
  isLoading,
  provider,
  onProviderChange,
}: GenerateButtonProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        onClick={onClick}
        disabled={isLoading}
        size="lg"
        className="bg-botanical hover:bg-botanical/90 text-botanical-foreground font-body px-8 py-6 text-base"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Discovering botanical fact...
          </>
        ) : (
          <>
            <Leaf className="mr-2 h-5 w-5" />
            Generate Content Package
          </>
        )}
      </Button>

      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-body">
            Image model:
          </span>
          <Select
            value={provider}
            onValueChange={(v) => onProviderChange?.(v as ImageProvider)}
            disabled={isLoading}
          >
            <SelectTrigger className="h-8 w-[240px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="replicate">Replicate (FLUX 1.1 Pro)</SelectItem>
              <SelectItem value="openai">OpenAI (gpt-image-2 HQ)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {provider === "replicate" && (
          <p className="text-[10px] text-muted-foreground font-body max-w-[280px] text-center">
            ~$0.24 per package, billed directly to Replicate.
          </p>
        )}
        {provider === "openai" && (
          <p className="text-[10px] text-muted-foreground font-body max-w-[280px] text-center">
            ~$0.77 per six-image package, billed directly to Replicate (runs gpt-image-2 high quality). Output is 2:3 (1024×1536).
          </p>
        )}
      </div>
    </div>
  );
}
