import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { BotanicalScript } from '@/types/botanical';

interface ScriptSectionProps {
  script: BotanicalScript;
}

const TIMING_LABELS: Record<keyof BotanicalScript, string> = {
  hook: '0–4s',
  dangle1: '4–9s',
  rehook: '9–14s',
  dangle2: '14–20s',
  payoff: '20–25s',
  verifiedTruth: '25–32s',
  close: '32–35s',
};

const SECTION_NAMES: Record<keyof BotanicalScript, string> = {
  hook: 'Hook',
  dangle1: 'Dangle',
  rehook: 'Re-hook',
  dangle2: 'Dangle',
  payoff: 'Payoff',
  verifiedTruth: 'Verified Truth',
  close: 'Close',
};

export function ScriptSection({ script }: ScriptSectionProps) {
  const [copied, setCopied] = useState(false);

  const fullScript = Object.entries(script)
    .map(([key, value]) => value)
    .join('\n\n');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sections = Object.keys(TIMING_LABELS) as Array<keyof BotanicalScript>;

  return (
    <div className="relative group">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-lg text-foreground">Video Script</h3>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-accent rounded"
          aria-label="Copy script to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>
      <div className="bg-card border border-border rounded shadow-[var(--shadow-subtle)] divide-y divide-border">
        {sections.map((key) => (
          <div key={key} className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {TIMING_LABELS[key]}
              </span>
              <span className="text-xs text-muted-foreground/60">
                {SECTION_NAMES[key]}
              </span>
            </div>
            <p className="text-foreground/90 leading-relaxed font-body text-sm">
              {script[key]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
