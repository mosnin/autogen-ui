import type { ComponentDoc } from "@autogen-ui/core";

interface Row {
  name: string;
  type: string;
  required: boolean;
}

/**
 * Best-effort parser for the `props` string format used in `componentCatalog`,
 * e.g. `"label: string, value: string|number, span?: 1-12 (default 4)"`.
 * Splits on top-level commas only (so unions like `'a'|'b'` survive).
 */
function parseProps(propsString: string): Row[] {
  if (!propsString || propsString.trim() === "(none)") return [];

  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of propsString) {
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) parts.push(current);

  const rows: Row[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    let name = trimmed.slice(0, colon).trim();
    const type = trimmed.slice(colon + 1).trim();
    const required = !name.endsWith("?");
    if (!required) name = name.slice(0, -1);
    rows.push({ name, type, required });
  }
  return rows;
}

export default function PropTable({ doc }: { doc: ComponentDoc }) {
  const rows = parseProps(doc.props);

  if (rows.length === 0 && !doc.acceptsChildren) {
    return (
      <p className="my-3 text-sm text-muted-foreground">
        No props. Renders standalone.
      </p>
    );
  }

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-card text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Prop</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Required</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs">{row.name}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                {row.type}
              </td>
              <td className="px-3 py-2 text-xs">
                {row.required ? "yes" : "no"}
              </td>
            </tr>
          ))}
          {doc.acceptsChildren && (
            <tr className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs">children</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                UINode[]
              </td>
              <td className="px-3 py-2 text-xs">no</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
