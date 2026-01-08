import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface GeneratedAssets {
  script: string;
  thumbnailPrompt: string;
  caption: string;
  partTwoHook: string;
}

const Generator = () => {
  const [botanicalSubject, setBotanicalSubject] = useState("");
  const [claim, setClaim] = useState("");
  const [thumbnailMode, setThumbnailMode] = useState<"light" | "dark">("light");
  const [assets, setAssets] = useState<GeneratedAssets | null>(null);

  const generateScript = (subject: string, claimText: string): string => {
    return `HOOK (0–4s):
I keep hearing this thing about ${subject}.
Something about how it's not what we think it is.

DANGLE (4–9s):
That can't be right.
I had to look it up.

RE-HOOK (9–14s):
Turns out, most people get this completely wrong.
Including me, until recently.

DANGLE (14–20s):
The word itself is misleading.
We assume one thing.
The plant does another.

PAYOFF (20–25s):
Here's why it sounds impossible at first.
${claimText}

VERIFIED TRUTH (25–32s):
[INSERT VERIFIED BOTANICAL FACT HERE]
Be specific.
Be concrete.
Be historically or biologically accurate.

CLOSE (32–35s):
My brother knows plants.
I verify the facts.`;
  };

  const generateLightThumbnail = (subject: string): string => {
    return `Create a vertical 9:16 cinematic botanical thumbnail.

SUBJECT:
A realistic ${subject} specimen rendered as a physical, museum-grade pressed botanical object. Visible leaf veins, natural imperfections, and authentic botanical detail. The specimen appears mounted on archival paper with visible fiber texture.

COMPOSITION:
Subject positioned slightly off-center with clear silhouette. Generous negative space on the upper third. Strong visual hierarchy with the specimen as the sole focal point.

LIGHTING:
Soft natural daylight from upper left. Even illumination across the specimen. Gentle shadows cast at 45 degrees. No harsh highlights.

BACKGROUND:
Light architectural surface resembling aged herbarium paper or weathered limestone. Muted warm-neutral tones (cream, ecru, pale ochre). Subtle paper texture and fine grain visible.

ANNOTATIONS:
Thin graphite-style architectural annotation lines extending from key botanical features. Minimal and academic. Small reference marks in the margins.

MOOD:
Clear, calm, intellectual, trustworthy. Museum-quality presentation.

STYLE CONSTRAINTS:
- No icons
- No emojis
- No bright colors
- No futuristic or tech elements
- No influencer aesthetics
- No digital overlays
- No text`;
  };

  const generateDarkThumbnail = (subject: string): string => {
    return `Create a vertical 9:16 dark cinematic botanical thumbnail.

SUBJECT:
A realistic ${subject} specimen rendered as a physical museum object. Visible botanical detail including texture, venation, and natural form. The specimen appears as a preserved archival piece against darkness.

COMPOSITION:
Tighter framing with strong foreground presence. Partial crop allowed at edges. Subject commands the lower two-thirds of the frame. Dramatic negative space above.

LIGHTING:
Low-key cinematic lighting from a single directional source (upper right). Deep shadows with soft falloff transitions. Rim light defining the specimen edge. Chiaroscuro effect.

BACKGROUND:
Dark architectural surface in charcoal, umber, or deep taupe. Subtle grain and aged texture visible in the shadows. No pure black—always textured darkness.

ANNOTATIONS:
Minimal architectural annotation lines in pale ochre or cream. Small academic reference marks positioned discretely. Fine graphite-style indicators.

MOOD:
Mysterious, investigative, restrained, intellectual. Archival specimen under study.

STYLE CONSTRAINTS:
- No icons
- No emojis
- No bright colors
- No futuristic or sci-fi elements
- No digital overlays
- No text
- No harsh contrast`;
  };

  const generateCaption = (subject: string, claimText: string): string => {
    return `${subject} isn't what you think it is.
${claimText.split(" ").slice(0, 8).join(" ")}...`;
  };

  const generatePartTwoHook = (subject: string): string => {
    return `But that's not even the strangest thing about ${subject}.`;
  };

  const handleGenerate = () => {
    if (!botanicalSubject.trim()) return;

    const generated: GeneratedAssets = {
      script: generateScript(botanicalSubject, claim),
      thumbnailPrompt: thumbnailMode === "light" 
        ? generateLightThumbnail(botanicalSubject)
        : generateDarkThumbnail(botanicalSubject),
      caption: generateCaption(botanicalSubject, claim),
      partTwoHook: generatePartTwoHook(botanicalSubject),
    };

    setAssets(generated);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="space-y-2">
          <h1 className="font-serif text-3xl md:text-4xl text-foreground tracking-tight">
            Botanical Content Generator
          </h1>
          <p className="text-muted-foreground font-light">
            Zero memory. Each asset stands alone.
          </p>
        </header>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="font-serif text-lg font-normal">Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-sm text-muted-foreground">
                Botanical Subject
              </Label>
              <Textarea
                id="subject"
                placeholder="e.g., Foxglove, Japanese Knotweed, Ginkgo biloba..."
                value={botanicalSubject}
                onChange={(e) => setBotanicalSubject(e.target.value)}
                className="min-h-[60px] resize-none font-light"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="claim" className="text-sm text-muted-foreground">
                Claim or Fact to Verify
              </Label>
              <Textarea
                id="claim"
                placeholder="e.g., This plant was used as a heart medicine for centuries..."
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                className="min-h-[80px] resize-none font-light"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground">
                Thumbnail Mode
              </Label>
              <RadioGroup
                value={thumbnailMode}
                onValueChange={(v) => setThumbnailMode(v as "light" | "dark")}
                className="flex gap-6"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="light" id="light" />
                  <Label htmlFor="light" className="font-light cursor-pointer">
                    Light
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dark" id="dark" />
                  <Label htmlFor="dark" className="font-light cursor-pointer">
                    Dark
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button 
              onClick={handleGenerate}
              disabled={!botanicalSubject.trim()}
              className="w-full"
            >
              Generate Assets
            </Button>
          </CardContent>
        </Card>

        {assets && (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="font-serif text-lg font-normal">Generated Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="script" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="script" className="text-xs">Script</TabsTrigger>
                  <TabsTrigger value="thumbnail" className="text-xs">Thumbnail</TabsTrigger>
                  <TabsTrigger value="caption" className="text-xs">Caption</TabsTrigger>
                  <TabsTrigger value="hook" className="text-xs">Part 2</TabsTrigger>
                </TabsList>

                <TabsContent value="script" className="space-y-4">
                  <div className="relative">
                    <pre className="bg-muted/50 p-4 rounded-lg text-sm font-light whitespace-pre-wrap leading-relaxed">
                      {assets.script}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(assets.script)}
                      className="absolute top-2 right-2 text-xs"
                    >
                      Copy
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="thumbnail" className="space-y-4">
                  <div className="relative">
                    <pre className="bg-muted/50 p-4 rounded-lg text-sm font-light whitespace-pre-wrap leading-relaxed">
                      {assets.thumbnailPrompt}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(assets.thumbnailPrompt)}
                      className="absolute top-2 right-2 text-xs"
                    >
                      Copy
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="caption" className="space-y-4">
                  <div className="relative">
                    <pre className="bg-muted/50 p-4 rounded-lg text-sm font-light whitespace-pre-wrap leading-relaxed">
                      {assets.caption}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(assets.caption)}
                      className="absolute top-2 right-2 text-xs"
                    >
                      Copy
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="hook" className="space-y-4">
                  <div className="relative">
                    <pre className="bg-muted/50 p-4 rounded-lg text-sm font-light whitespace-pre-wrap leading-relaxed">
                      {assets.partTwoHook}
                    </pre>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(assets.partTwoHook)}
                      className="absolute top-2 right-2 text-xs"
                    >
                      Copy
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Generator;
