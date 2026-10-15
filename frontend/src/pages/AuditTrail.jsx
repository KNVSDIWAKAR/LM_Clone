import { useQuery } from "@tanstack/react-query";
import { Bot, Download, FileText, TriangleAlert, User } from "lucide-react";
import { PageHeader } from "../components/ui/Card";
import { apiGet } from "../lib/api";

const mutedFg = { color: "hsl(var(--muted-foreground))" };
const fg = { color: "hsl(var(--foreground))" };

function eventStyle(type) {
  switch (type) {
    case "agent_action":
      return { Icon: Bot, color: "hsl(213, 100%, 17%)", bg: "hsl(25, 62%, 92%)", badgeLabel: "Agent Action" };
    case "user_decision":
      return { Icon: User, color: "hsl(217, 91%, 45%)", bg: "hsl(217, 91%, 92%)", badgeLabel: "User Decision" };
    case "guardrail_trigger":
      return { Icon: TriangleAlert, color: "hsl(38, 92%, 40%)", bg: "hsl(38, 92%, 92%)", badgeLabel: "Guardrail" };
    default:
      return { Icon: FileText, color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted))", badgeLabel: "System" };
  }
}

const CSV_COLUMNS = ["id", "ts", "type", "actor", "action", "details", "journey", "related_run_id", "related_decision_id"];

function exportCsv(events) {
  const quote = (v) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const rows = events.map((e) => CSV_COLUMNS.map((col) => quote(e[col])).join(","));
  const csv = [CSV_COLUMNS.join(","), ...rows].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AuditTrail() {
  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ["audit-trail"],
    queryFn: () => apiGet("/api/audit-trail"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Audit Trail" subtitle="Complete chronological record of all system activity" />
        <button
          onClick={() => exportCsv(events)}
          className="flex items-center gap-2 px-3 py-2 rounded font-sans text-sm font-medium transition-colors"
          style={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "var(--radius)",
            ...fg,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--secondary))")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "hsl(var(--card))")}
        >
          <Download size={14} />
          Export Log
        </button>
      </div>

      {isLoading && (
        <p className="font-sans text-sm" style={mutedFg}>
          Loading audit trail...
        </p>
      )}
      {isError && <p className="font-sans text-sm text-red-600">Failed to load audit trail.</p>}

      {!isLoading && !isError && events.length === 0 && (
        <div
          className="rounded p-10 text-center"
          style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }}
        >
          <FileText size={32} style={{ ...mutedFg, margin: "0 auto 0.75rem" }} />
          <p className="font-sans text-sm font-medium" style={fg}>
            No audit events yet
          </p>
          <p className="mt-1 font-sans text-xs" style={mutedFg}>
            Events will appear here as agents run and decisions are made.
          </p>
        </div>
      )}

      {!isLoading && !isError && events.length > 0 && (
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-0.5" style={{ background: "hsl(var(--border))" }} />
          <div className="flex flex-col gap-0">
            {events.map((event) => {
              const { Icon, color, bg, badgeLabel } = eventStyle(event.type);
              return (
                <div key={event.id} className="relative flex items-start gap-4 pb-5">
                  <div
                    className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full flex-none"
                    style={{ background: bg, border: `2px solid ${color}` }}
                  >
                    <Icon size={16} style={{ color }} />
                  </div>
                  <div
                    className="flex-1 min-w-0 rounded"
                    style={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "var(--radius)",
                      padding: "0.75rem 1rem",
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span
                        className="font-sans text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: bg, color }}
                      >
                        {badgeLabel}
                      </span>
                      {event.journey && (
                        <span className="font-sans text-xs" style={mutedFg}>
                          {event.journey}
                        </span>
                      )}
                    </div>
                    <p className="font-sans text-sm font-semibold leading-snug" style={fg}>
                      {event.actor}
                      {event.action ? ` — ${event.action}` : ""}
                    </p>
                    {event.details && (
                      <p className="mt-1 font-sans text-xs leading-relaxed" style={mutedFg}>
                        {event.details}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="font-sans text-xs" style={mutedFg}>
                        {event.ts ? event.ts.slice(0, 19).replace("T", " ") : "—"}
                      </span>
                      <span className="font-mono text-xs" style={mutedFg}>
                        {event.id}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
