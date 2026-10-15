import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheckBig, CircleX, Eye, LoaderCircle, Shield, TriangleAlert, X } from "lucide-react";
import { PageHeader, StatCard } from "../components/ui/Card";
import UnderlineTabs from "../components/ui/UnderlineTabs";
import { StepTypeIcon } from "../components/chat/PipelineSteps";
import { apiGet } from "../lib/api";
import { parseJsonArray } from "../lib/utils";

const COST_PER_1K_TOKENS = 0.01;
const mutedFg = { color: "hsl(var(--muted-foreground))" };
const fg = { color: "hsl(var(--foreground))" };

const formatMs = (ms) => (ms == null ? "—" : ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);

function formatTokenPair(tokensIn, tokensOut) {
  const a = tokensIn ?? 0;
  const b = tokensOut ?? 0;
  return a === 0 && b === 0 ? "—" : `${a.toLocaleString()} / ${b.toLocaleString()}`;
}

const isFlagged = (run) => parseJsonArray(run.safety_checks).some((c) => c.verdict !== "pass");

function statusColor(status) {
  if (status === "completed") return "hsl(142, 71%, 38%)";
  if (status === "failed") return "hsl(0, 84%, 55%)";
  if (status === "running") return "hsl(217, 91%, 55%)";
  return "hsl(var(--muted-foreground))";
}

function MetaRow({ label, value }) {
  return (
    <>
      <span className="font-sans text-xs font-medium uppercase tracking-wider" style={mutedFg}>
        {label}
      </span>
      <span className="font-sans text-sm" style={fg}>
        {value}
      </span>
    </>
  );
}

const sectionHeading = "font-sans text-xs font-semibold uppercase tracking-widest";
const preBase = {
  fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
  fontSize: "12px",
  borderRadius: "var(--radius)",
};

function TraceDrawer({ run, onClose }) {
  const trace = parseJsonArray(run.trace);
  const safety = parseJsonArray(run.safety_checks);

  return (
    <>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.25)" }}
        onClick={onClose}
      />
      <motion.div
        key="panel"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-hidden"
        style={{ width: "min(520px, 100vw)", background: "hsl(var(--card))", borderLeft: "1px solid hsl(var(--border))" }}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b flex-none" style={{ borderColor: "hsl(var(--border))" }}>
          <div>
            <h2 className="font-serif text-lg leading-tight" style={fg}>
              Execution Trace
            </h2>
            <p className="mt-0.5 font-mono text-xs" style={mutedFg}>
              {run.id}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded transition-colors" style={mutedFg} aria-label="Close panel">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          <section>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-sans">
              <MetaRow label="Agent" value={run.agent} />
              <MetaRow label="Journey" value={run.journey} />
              <MetaRow
                label="Status"
                value={
                  <span className="capitalize" style={{ color: statusColor(run.status) }}>
                    {run.status}
                  </span>
                }
              />
              <MetaRow label="Started" value={run.started_at ? run.started_at.slice(0, 19).replace("T", " ") : "—"} />
              <MetaRow label="Duration" value={run.duration ?? "—"} />
              <MetaRow label="Model" value={run.model ?? "—"} />
              <MetaRow label="Tokens In" value={run.tokens_in ? run.tokens_in.toLocaleString() : "—"} />
              <MetaRow label="Tokens Out" value={run.tokens_out ? run.tokens_out.toLocaleString() : "—"} />
              <MetaRow label="Confidence" value={run.confidence != null ? run.confidence.toFixed(2) : "—"} />
            </div>
          </section>

          {(run.input || run.output) && (
            <section className="flex flex-col gap-3">
              <h3 className={sectionHeading} style={mutedFg}>
                Run Input / Output
              </h3>
              {run.input && (
                <div>
                  <p className="mb-1 font-sans text-xs font-medium" style={mutedFg}>
                    INPUT
                  </p>
                  <pre
                    className="rounded text-xs overflow-x-auto p-3 whitespace-pre-wrap break-words"
                    style={{ ...preBase, background: "hsl(25, 30%, 15%)", color: "hsl(36, 20%, 80%)" }}
                  >
                    {run.input}
                  </pre>
                </div>
              )}
              {run.output && (
                <div>
                  <p className="mb-1 font-sans text-xs font-medium" style={mutedFg}>
                    OUTPUT
                  </p>
                  <pre
                    className="rounded text-xs overflow-x-auto p-3 whitespace-pre-wrap break-words"
                    style={{ ...preBase, background: "hsl(120, 15%, 14%)", color: "hsl(120, 40%, 75%)" }}
                  >
                    {run.output}
                  </pre>
                </div>
              )}
            </section>
          )}

          <section className="flex flex-col gap-2">
            <h3 className={sectionHeading} style={mutedFg}>
              Safety Metrics
            </h3>
            {safety.length === 0 ? (
              <div
                className="flex items-center gap-2 rounded p-3 text-sm font-sans"
                style={{ background: "hsl(var(--muted))", borderRadius: "var(--radius)", ...mutedFg }}
              >
                <Shield size={15} />
                No safety flags recorded for this run.
              </div>
            ) : (
              safety.map((check, i) => {
                const pass = check.verdict === "pass";
                const color = pass ? "hsl(142, 71%, 40%)" : check.verdict === "warning" ? "hsl(38, 92%, 50%)" : "hsl(0, 84%, 55%)";
                const Icon = pass ? CircleCheckBig : TriangleAlert;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded p-3"
                    style={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderLeft: `3px solid ${color}`,
                      borderRadius: "var(--radius)",
                    }}
                  >
                    <Icon size={15} style={{ color, flexShrink: 0, marginTop: 2 }} />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-sans text-sm font-medium" style={fg}>
                        {check.name}
                      </span>
                      <span className="font-sans text-xs" style={mutedFg}>
                        {check.detail}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className={sectionHeading} style={mutedFg}>
              Step-by-Step Trace — {trace.length} step{trace.length !== 1 ? "s" : ""}
            </h3>
            {trace.length === 0 ? (
              <p className="font-sans text-sm" style={mutedFg}>
                No trace steps recorded.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {trace.map((step, i) => (
                  <div
                    key={step.id ?? i}
                    className="flex items-start gap-2.5 rounded px-3 py-2"
                    style={{ background: "hsl(var(--muted))", borderRadius: "var(--radius)" }}
                  >
                    <span className="mt-0.5 flex-none">
                      <StepTypeIcon type={step.type} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-sans text-sm font-medium leading-snug truncate" style={fg}>
                        {step.label}
                      </p>
                      {step.detail && (
                        <p className="font-sans text-xs mt-0.5" style={mutedFg}>
                          {step.detail}
                        </p>
                      )}
                    </div>
                    <span className="flex-none font-mono text-xs tabular-nums" style={mutedFg}>
                      {formatMs(step.duration)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </>
  );
}

function RunStatus({ status }) {
  if (status === "running")
    return (
      <span className="flex items-center gap-1.5" style={{ color: "hsl(217, 91%, 55%)" }}>
        <LoaderCircle size={13} className="animate-spin" />
        <span className="font-sans text-xs font-medium">Running</span>
      </span>
    );
  if (status === "completed")
    return (
      <span className="flex items-center gap-1.5" style={{ color: "hsl(142, 71%, 38%)" }}>
        <CircleCheckBig size={13} />
        <span className="font-sans text-xs font-medium">Completed</span>
      </span>
    );
  if (status === "failed")
    return (
      <span className="flex items-center gap-1.5" style={{ color: "hsl(0, 84%, 55%)" }}>
        <CircleX size={13} />
        <span className="font-sans text-xs font-medium">Failed</span>
      </span>
    );
  return (
    <span className="font-sans text-xs" style={mutedFg}>
      {status}
    </span>
  );
}

const COLUMNS = ["Run ID", "Journey", "Status", "Confidence", "Duration", "Tokens", "Cost", "Safety", ""];
const TAB_DEFS = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "running", label: "Running" },
  { key: "failed", label: "Failed" },
];

export default function AgentRuns() {
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState(null);
  const { data: runs = [], isLoading, isError } = useQuery({
    queryKey: ["agent-runs"],
    queryFn: () => apiGet("/api/agent-runs"),
    refetchInterval: 5000,
  });

  const totalTokens = runs.reduce((sum, r) => sum + (r.tokens_in ?? 0) + (r.tokens_out ?? 0), 0);
  const estCost = `$${((totalTokens / 1000) * COST_PER_1K_TOKENS).toFixed(2)}`;
  const flaggedCount = runs.filter(isFlagged).length;
  const completedCount = runs.filter((r) => r.status === "completed").length;
  const successRate = runs.length > 0 ? `${Math.round((completedCount / runs.length) * 100)}%` : "—";
  const visible = tab === "all" ? runs : runs.filter((r) => r.status === tab);
  const tabs = TAB_DEFS.map((t) => ({
    ...t,
    count: t.key === "all" ? runs.length : runs.filter((r) => r.status === t.key).length,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Agent Runs" subtitle="Full execution history with micro-level tracing and safety checks" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatCard value={runs.length} label="Runs" />
        <StatCard value={totalTokens > 0 ? totalTokens.toLocaleString() : "—"} label="Total Tokens" />
        <StatCard value={totalTokens > 0 ? estCost : "—"} label="Est. Cost" />
        <StatCard
          value={flaggedCount}
          label="Safety Flags"
          sublabel={flaggedCount > 0 ? "runs flagged" : undefined}
          sublabelClass="text-amber-600"
        />
        <StatCard value={successRate} label="Success Rate" sublabel={`${completedCount} completed`} />
      </div>

      <UnderlineTabs tabs={tabs} value={tab} onChange={setTab} />

      {isLoading && (
        <p className="font-sans text-sm" style={mutedFg}>
          Loading runs...
        </p>
      )}
      {isError && <p className="font-sans text-sm text-red-600">Failed to load agent runs.</p>}

      {!isLoading && !isError && (
        <div className="overflow-x-auto rounded" style={{ border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)" }}>
          <table className="w-full text-sm font-sans" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "hsl(var(--muted))", borderBottom: "1px solid hsl(var(--border))" }}>
                {COLUMNS.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left font-sans text-xs font-semibold uppercase tracking-wider"
                    style={mutedFg}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center font-sans text-sm" style={mutedFg}>
                    No runs found.
                  </td>
                </tr>
              ) : (
                visible.map((run, i) => {
                  const flagged = isFlagged(run);
                  const tokens = (run.tokens_in ?? 0) + (run.tokens_out ?? 0);
                  const cost = tokens > 0 ? `$${((tokens / 1000) * COST_PER_1K_TOKENS).toFixed(3)}` : "—";
                  const zebra = i % 2 === 0 ? "hsl(var(--card))" : "hsl(var(--muted))";
                  return (
                    <tr
                      key={run.id}
                      onClick={() => setSelected(run)}
                      className="transition-colors cursor-pointer"
                      style={{ background: zebra, borderBottom: "1px solid hsl(var(--border))" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--secondary))")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = zebra)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium" style={{ color: "hsl(var(--primary))" }}>
                          {run.id.slice(-6)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-sans text-sm font-medium" style={fg}>
                          {run.journey}
                        </p>
                        <p className="font-sans text-xs" style={mutedFg}>
                          {run.agent}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <RunStatus status={run.status} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-sans text-sm font-semibold tabular-nums" style={fg}>
                          {run.confidence != null ? run.confidence.toFixed(2) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-sans text-xs tabular-nums" style={mutedFg}>
                          {run.duration ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs tabular-nums" style={mutedFg}>
                          {formatTokenPair(run.tokens_in, run.tokens_out)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs tabular-nums" style={fg}>
                          {cost}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {flagged ? (
                          <span className="flex items-center gap-1" style={{ color: "hsl(38, 92%, 45%)" }}>
                            <TriangleAlert size={13} />
                            <span className="font-sans text-xs font-medium">Flagged</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1" style={{ color: "hsl(142, 71%, 38%)" }}>
                            <CircleCheckBig size={13} />
                            <span className="font-sans text-xs font-medium">Clean</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(run);
                          }}
                          className="p-1 rounded transition-colors"
                          style={mutedFg}
                          aria-label="View execution trace"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>{selected && <TraceDrawer key={selected.id} run={selected} onClose={() => setSelected(null)} />}</AnimatePresence>
    </div>
  );
}
