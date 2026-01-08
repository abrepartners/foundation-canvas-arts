import { Leaf, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GenerateButtonProps {
  onClick: () => void;
  isLoading: boolean;
}

export function GenerateButton({ onClick, isLoading }: GenerateButtonProps) {
  return (
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
  );
}
