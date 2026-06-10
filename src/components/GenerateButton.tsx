import { Leaf, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ImageProvider = "lovable" | "replicate";

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

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-body">
          Image model:
        </span>
        <Select
          value={provider}
          onValueChange={(v) => onProviderChange?.(v as ImageProvider)}
          disabled={isLoading}
        >
          <SelectTrigger className="h-8 w-[220px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lovable">Lovable AI (Nano Banana)</SelectItem>
            <SelectItem value="replicate">Replicate (FLUX 1.1 Pro)</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
