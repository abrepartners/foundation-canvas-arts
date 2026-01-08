import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ContentSectionProps {
  title: string;
  content: string;
  className?: string;
}

export function ContentSection({ title, content, className = '' }: ContentSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative group ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading text-lg text-foreground">{title}</h3>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-accent rounded"
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>
      <div className="bg-card border border-border rounded p-4 shadow-[var(--shadow-subtle)]">
        <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap font-body text-sm">
          {content}
        </p>
      </div>
    </div>
  );
}
