import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ContentSectionProps {
  title: string;
  content: string;
  className?: string;
}

export function ContentSection({ title, content, className = "" }: ContentSectionProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!content) return null;

  return (
    <div className={`animate-fade-in ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-serif text-foreground">{title}</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-8 px-2 text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <div className="bg-card border border-border rounded-md p-4">
        <pre className="whitespace-pre-wrap text-sm font-body text-card-foreground leading-relaxed">
          {content}
        </pre>
      </div>
    </div>
  );
}
