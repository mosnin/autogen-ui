"use client";

import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
  copy?: boolean;
}

/** Plain syntax-aware code block. No highlighter dep. */
export function CodeBlock({ code, language, copy = true }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* denied */
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {language ?? "code"}
        </div>
        {copy && (
          <button
            type="button"
            onClick={onCopy}
            className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>
      <pre className="max-h-[420px] overflow-auto px-4 py-3 text-[12.5px] leading-[1.65] text-foreground/85">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
