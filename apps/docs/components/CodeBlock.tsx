// Plain pre/code, no highlighting library. Styled to match the design tokens.
export default function CodeBlock({
  code,
  language,
}: {
  code: string;
  language?: string;
}) {
  return (
    <div className="relative my-4 overflow-hidden rounded-lg border border-border bg-card">
      {language && (
        <div className="absolute right-3 top-2 select-none text-[10px] uppercase tracking-wider text-muted-foreground">
          {language}
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-foreground">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
