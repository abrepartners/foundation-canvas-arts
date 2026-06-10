import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, ChevronDown, ChevronRight } from "lucide-react";
import {
  PLATE_TEMPLATE,
  parseSubjectFromPrompt,
  type PlateSubject,
} from "@/lib/plateTemplate";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  momentLabel: string;
  currentPrompt: string;
  isRegenerating: boolean;
  onSubmit: (subject: PlateSubject) => Promise<void>;
}

export function RegenerateVisualDialog({
  open,
  onOpenChange,
  momentLabel,
  currentPrompt,
  isRegenerating,
  onSubmit,
}: Props) {
  const [subject, setSubject] = useState<PlateSubject>({
    commonName: "",
    binomial: "",
    description: "",
    specimenNote: "",
  });
  const [showTemplate, setShowTemplate] = useState(false);

  useEffect(() => {
    if (open) {
      setSubject(parseSubjectFromPrompt(currentPrompt));
    }
  }, [open, currentPrompt]);

  const canSubmit =
    subject.commonName.trim().length > 0 &&
    subject.binomial.trim().length > 0 &&
    subject.description.trim().length > 0 &&
    !isRegenerating;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      commonName: subject.commonName.trim(),
      binomial: subject.binomial.trim(),
      description: subject.description.trim(),
      specimenNote: subject.specimenNote?.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            Regenerate visual — {momentLabel}
          </DialogTitle>
          <DialogDescription>
            Edit only the botanical subject. The plate layout, palette,
            typography, and composition stay locked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="commonName">Common name</Label>
            <Input
              id="commonName"
              placeholder="e.g. Olive"
              value={subject.commonName}
              onChange={(e) =>
                setSubject((s) => ({ ...s, commonName: e.target.value }))
              }
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="binomial">Latin binomial</Label>
            <Input
              id="binomial"
              placeholder="e.g. Olea europaea"
              value={subject.binomial}
              onChange={(e) =>
                setSubject((s) => ({ ...s, binomial: e.target.value }))
              }
              maxLength={120}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Short description (3–4 lines)</Label>
            <Textarea
              id="description"
              rows={4}
              placeholder="Evergreen tree, Oleaceae family, native to the Mediterranean basin, cultivated for fruit and oil."
              value={subject.description}
              onChange={(e) =>
                setSubject((s) => ({ ...s, description: e.target.value }))
              }
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="specimen">
              Hero specimen note{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="specimen"
              rows={2}
              placeholder="single branch with silvery leaves and ripe drupes"
              value={subject.specimenNote ?? ""}
              onChange={(e) =>
                setSubject((s) => ({ ...s, specimenNote: e.target.value }))
              }
              maxLength={300}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowTemplate((v) => !v)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showTemplate ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <Lock className="h-3.5 w-3.5" />
            Locked plate template (read-only)
          </button>

          {showTemplate && (
            <pre className="text-xs font-mono whitespace-pre-wrap bg-muted/40 border border-border rounded p-3 max-h-72 overflow-y-auto text-foreground/80">
              {PLATE_TEMPLATE}
            </pre>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isRegenerating}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isRegenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Regenerating…
              </>
            ) : (
              "Regenerate"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
