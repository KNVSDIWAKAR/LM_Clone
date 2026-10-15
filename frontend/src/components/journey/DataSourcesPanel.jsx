import { Database } from "lucide-react";

/** "Data inputs & source systems" card listing each field and its system of record. */
export default function DataSourcesPanel({ sources }) {
  if (!sources?.length) return null;
  return (
    <div
      className="rounded border p-4"
      style={{ borderColor: "hsl(var(--border))", borderRadius: "var(--radius)", background: "hsl(var(--card))" }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Database size={14} style={{ color: "hsl(var(--primary))" }} />
        <span className="font-sans text-xs font-semibold uppercase tracking-wide" style={{ color: "hsl(var(--muted-foreground))" }}>
          Data inputs &amp; source systems
        </span>
      </div>
      <div className="space-y-1.5">
        {sources.map((src) => (
          <div key={src.field} className="flex items-center justify-between gap-3 text-sm font-sans min-w-0">
            <div className="min-w-0 truncate">
              <span style={{ color: "hsl(var(--foreground))" }}>{src.field}</span>
              <span className="ml-2 text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
                {src.description}
              </span>
            </div>
            <span
              className="flex-none whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-mono"
              style={{ background: "hsl(213 100% 17% / 0.10)", color: "hsl(var(--primary))" }}
            >
              {src.sorSystem}
              {src.screen ? ` · ${src.screen}` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
