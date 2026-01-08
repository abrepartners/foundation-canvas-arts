import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const Index = () => {
  const [input, setInput] = useState("");
  const [thumbnailMode, setThumbnailMode] = useState<"light" | "dark">("light");
  const [outputs, setOutputs] = useState<{
    script: string;
    thumbnail: string;
    caption: string;
    hook: string;
  } | null>(null);

  const generateAssets = () => {
    if (!input.trim()) return;

    const script = `HOOK (0–4s):
${generateHook(input)}

DANGLE (4–9s):
${generateDangle1(input)}

RE-HOOK (9–14s):
${generateRehook(input)}

DANGLE (14–20s):
${generateDangle2(input)}

PAYOFF (20–26s):
${generatePayoff(input)}

CLOSE (26–30s):
${generateClose()}`;

    const thumbnail = thumbnailMode === "light" 
      ? generateLightThumbnail(input)
      : generateDarkThumbnail(input);

    const caption = generateCaption(input);
    const hook = generatePart2Hook(input);

    setOutputs({ script, thumbnail, caption, hook });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12 px-4">
        <header className="mb-12 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-light tracking-tight text-foreground mb-3">
            Botanical Generator
          </h1>
          <p className="text-muted-foreground font-body text-lg">
            My brother knows plants. I verify the facts.
          </p>
        </header>

        <Card className="mb-8 border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-xl font-normal">Input Claim</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Textarea
              placeholder="Enter a botanical claim to verify..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[120px] font-body text-base resize-none border-border/60 focus:border-primary/40"
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-3">
                <Label className="text-sm text-muted-foreground">Thumbnail Mode</Label>
                <RadioGroup
                  value={thumbnailMode}
                  onValueChange={(v) => setThumbnailMode(v as "light" | "dark")}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light" className="font-body cursor-pointer">Light</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="dark" id="dark" />
                    <Label htmlFor="dark" className="font-body cursor-pointer">Dark</Label>
                  </div>
                </RadioGroup>
              </div>

              <Button 
                onClick={generateAssets}
                disabled={!input.trim()}
                className="sm:self-end"
              >
                Generate Assets
              </Button>
            </div>
          </CardContent>
        </Card>

        {outputs && (
          <div className="space-y-6 animate-in fade-in-50 duration-500">
            <OutputCard title="Script" content={outputs.script} />
            <OutputCard title={`Thumbnail Prompt (${thumbnailMode})`} content={outputs.thumbnail} />
            <OutputCard title="Caption" content={outputs.caption} />
            <OutputCard title="Part 2 Hook" content={outputs.hook} />
          </div>
        )}
      </div>
    </div>
  );
};

const OutputCard = ({ title, content }: { title: string; content: string }) => (
  <Card className="border-border/50 shadow-sm">
    <CardHeader className="pb-3">
      <CardTitle className="font-display text-lg font-normal text-foreground/90">{title}</CardTitle>
    </CardHeader>
    <Separator className="mb-4" />
    <CardContent>
      <pre className="whitespace-pre-wrap font-body text-sm leading-relaxed text-foreground/80">
        {content}
      </pre>
    </CardContent>
  </Card>
);

// Generator functions
function generateHook(input: string): string {
  const claim = input.trim();
  return `There's something curious about ${extractSubject(claim)}. A detail most people overlook.`;
}

function generateDangle1(input: string): string {
  return `Wait. That doesn't sound right.`;
}

function generateRehook(input: string): string {
  return `I assumed I understood what this meant. But the definition itself was the problem.`;
}

function generateDangle2(input: string): string {
  const subject = extractSubject(input);
  return `The way we talk about ${subject} shapes what we think we know.`;
}

function generatePayoff(input: string): string {
  return `After checking the research, here's what actually holds up.`;
}

function generateClose(): string {
  return `My brother knows plants. I just verify what's true.`;
}

function generateLightThumbnail(input: string): string {
  const subject = extractSubject(input);
  return `SUBJECT:
A realistic ${subject} specimen rendered as a pressed botanical study, museum-grade quality, physical paper texture visible.

COMPOSITION:
Subject slightly off-center with clear silhouette and generous negative space.

LIGHTING:
Soft natural daylight with even illumination and gentle shadows cast on surface.

BACKGROUND:
Light architectural surface resembling aged cotton paper with subtle warm-cream undertones. Faint foxing and fiber texture. Muted warm-neutral palette.

ANNOTATIONS:
Thin graphite-style annotation lines extending from key features. Small handwritten Latin nomenclature in aged ink. Minimal and academic.

MOOD:
Clear, calm, intellectual, trustworthy.

STYLE CONSTRAINTS:
No icons. No emojis. No bright colors. No futuristic or tech elements. No influencer aesthetics.`;
}

function generateDarkThumbnail(input: string): string {
  const subject = extractSubject(input);
  return `SUBJECT:
A realistic ${subject} specimen rendered as a mounted botanical study, museum-grade quality, subtle dimensional presence.

COMPOSITION:
Tighter framing with strong foreground presence. Partial crop at edges allowed. Subject emerges from shadow.

LIGHTING:
Low-key cinematic lighting from single directional source. Deep shadows with soft gradient transitions. Rim light defining edges.

BACKGROUND:
Dark architectural surface in charcoal or deep umber. Subtle grain and mineral texture. Faint vignette toward edges.

ANNOTATIONS:
Minimal architectural annotation lines in muted ochre or chalk. Small academic reference marks barely visible.

MOOD:
Mysterious, investigative, restrained, intellectual.

STYLE CONSTRAINTS:
No icons. No emojis. No bright colors. No futuristic or sci-fi elements.`;
}

function generateCaption(input: string): string {
  const subject = extractSubject(input);
  return `I didn't expect this to be true.\nBut ${subject} keeps surprising me.`;
}

function generatePart2Hook(input: string): string {
  const subject = extractSubject(input);
  return `But there's another pattern hiding in ${subject} that changes everything about how we understand it.`;
}

function extractSubject(input: string): string {
  const cleaned = input.toLowerCase().trim();
  const words = cleaned.split(/\s+/).slice(0, 4).join(" ");
  return words || "this plant";
}

export default Index;
