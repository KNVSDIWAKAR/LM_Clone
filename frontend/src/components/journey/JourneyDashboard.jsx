import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Brain,
  Calendar,
  ChartColumn,
  ChevronRight,
  ClipboardList,
  Database,
  FileText,
  Inbox,
  MessageSquare,
  Play,
  Plug,
  RotateCcw,
  ScrollText,
  Search,
  Share2,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { apiGet, apiPost } from "../../lib/api";
import DocumentViewer, { JOURNEY_DOC_DIRS } from "../knowledge/DocumentViewer";
import DistributionBar from "./DistributionBar";
import JourneyChat from "./JourneyChat";
import { FadeIn, InfoTip, KpiTile, NoResultsYet, RunProgress, ToolbarButton, VerdictPill } from "./JourneyPrimitives";
import { TONE_COLORS } from "./tones";

/** Journeys whose dashboard has been compiled this session (survives navigation). */
const compiledJourneys = new Set();

const RUN_STEPS = [
  { label: "Connecting to the knowledge base", icon: Plug },
  { label: "Fetching records", icon: Database },
  { label: "Reading policy & regulations", icon: ScrollText },
  { label: "Running deterministic checks", icon: Search },
  { label: "Scoring verdicts", icon: Brain },
  { label: "Compiling the dashboard", icon: ChartColumn },
];

const SCHEDULE_OPTIONS = ["Every hour", "Daily at 8:00 AM", "Weekly (Mon 8:00 AM)"];

const mutedFg = { color: "hsl(var(--muted-foreground))" };
const fg = { color: "hsl(var(--foreground))" };
const cardBox = { borderColor: "hsl(var(--border))", borderRadius: "var(--radius)", background: "hsl(var(--card))" };
const cellBorder = { borderBottom: "1px solid hsl(var(--border))" };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sumValues = (kpis) => kpis.reduce((n, k) => n + (parseInt(k.value, 10) || 0), 0);

/** Context handed to the journey assistant so it can answer over the whole book. */
function buildContextPreamble(dashboard, focused) {
  const results = dashboard.rows
    .map((row) => {
      const issues = row.detail
        .filter((d) => d.verdict !== "pass")
        .map((d) => d.detail)
        .join("; ");
      return `${row.id} ${row.entity} → ${row.verdict}${issues ? ` (${issues})` : ""}`;
    })
    .join(" | ");
  return (
    `Context — ${dashboard.title} dashboard, computed deterministically over the full book (${dashboard.rows.length} records). ` +
    "Answer portfolio or aggregate questions directly from the results below; do NOT ask the user for IDs and do NOT look up each record one by one. " +
    "Use the per-record tools only for a deep dive on a single record. Results: " +
    results +
    (focused ? `. The user is currently focused on ${focused.id} (${focused.entity}).` : "") +
    " The user's question follows."
  );
}

function PendingActions({ pending, routed, onRoute, animate }) {
  const highCount = pending.filter((p) => p.priority === "high").length;
  return (
    <div className="rounded border mb-3" style={cardBox}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: "hsl(var(--border))" }}>
        <TriangleAlert size={14} style={{ color: TONE_COLORS.warn }} />
        <span className="font-sans text-xs font-semibold uppercase tracking-wide" style={fg}>
          Pending Actions ({pending.length})
        </span>
        {highCount > 0 && (
          <span className="text-xs font-sans" style={{ color: TONE_COLORS.bad }}>
            · {highCount} high
          </span>
        )}
      </div>
      <div>
        {pending.slice(0, 4).map((item, i) => (
          <motion.div
            key={item.id}
            initial={animate ? { opacity: 0, x: -10 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: i * 0.22, ease: "easeOut" }}
            className="flex items-center justify-between gap-3 px-4 py-2 border-b last:border-b-0"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 99,
                    background: item.priority === "high" ? TONE_COLORS.bad : TONE_COLORS.warn,
                    display: "inline-block",
                  }}
                />
                <span className="font-sans text-sm font-medium truncate" style={fg}>
                  {item.title}
                </span>
              </div>
              <p className="font-sans text-xs mt-0.5 truncate" style={mutedFg}>
                {item.detail}
              </p>
            </div>
            <div className="flex-none flex items-center gap-2">
              {routed[item.id] ? (
                <span className="text-xs font-sans" style={{ color: TONE_COLORS.good }}>
                  Routed ✓
                </span>
              ) : (
                <button
                  onClick={() => onRoute(item.id)}
                  className="rounded-md px-3 py-1 text-xs font-sans font-medium border"
                  style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", ...fg }}
                >
                  {item.action}
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function KpiGroup({ title, total, tip, kpis, animate, box, dotColor, titleColor, className }) {
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${className}`} style={box}>
      <div className="flex items-center gap-2 mb-1.5">
        <span style={{ width: 7, height: 7, borderRadius: 99, background: dotColor, display: "inline-block" }} />
        <span className="font-sans text-xs font-semibold uppercase tracking-wide" style={{ color: titleColor }}>
          {title} · {total}
        </span>
        <InfoTip text={tip} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
        {kpis.map((kpi, i) => (
          <KpiTile key={kpi.label} kpi={kpi} index={i} animate={animate} />
        ))}
      </div>
    </div>
  );
}

function KpiSection({ kpis, animate }) {
  const totals = kpis.filter((k) => k.role === "total");
  const forward = kpis.filter((k) => k.role === "forward");
  const attention = kpis.filter((k) => k.role === "attention");

  return (
    <FadeIn animate={animate}>
      {totals.length > 0 && (
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 mb-2">
          {totals.map((kpi, i) => (
            <KpiTile key={kpi.label} kpi={kpi} index={i} animate={animate} />
          ))}
        </div>
      )}
      {forward.length > 0 && (
        <KpiGroup
          title="Moving forward"
          total={sumValues(forward)}
          tip="Loans whose engine verdict is a clean outcome — they progress to the next stage or finalize here without needing a human to unblock them."
          kpis={forward}
          animate={animate}
          className="mb-2"
          box={{ borderColor: "hsl(142 71% 35% / 0.25)", background: "hsl(142 71% 45% / 0.05)" }}
          dotColor={TONE_COLORS.good}
          titleColor={TONE_COLORS.good}
        />
      )}
      {attention.length > 0 && (
        <KpiGroup
          title="Needs attention"
          total={sumValues(attention)}
          tip="Loans the engine could not advance — Hold, Decline, At Risk, In QC, SLA Breach, or Refer. A human reviewer needs to act before they can move forward."
          kpis={attention}
          animate={animate}
          className="mb-3"
          box={{ borderColor: "hsl(38 92% 50% / 0.30)", background: "hsl(38 92% 50% / 0.06)" }}
          dotColor={TONE_COLORS.warn}
          titleColor="hsl(25 80% 35%)"
        />
      )}
    </FadeIn>
  );
}

function RecordsTable({ dashboard, rows, onOpen, animate }) {
  const headers = ["ID", "Entity", ...dashboard.columns, "Verdict"];
  return (
    <div className="rounded border overflow-hidden" style={cardBox}>
      <div
        className="px-4 py-2.5 border-b font-sans text-xs font-semibold uppercase tracking-wide"
        style={{ borderColor: "hsl(var(--border))", ...mutedFg }}
      >
        {rows.length} of {dashboard.rows.length} records
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-left font-sans text-xs font-medium px-4 py-2" style={{ ...mutedFg, ...cellBorder }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <motion.tr
                key={row.id}
                onClick={() => onOpen(row)}
                style={{ cursor: "pointer" }}
                initial={animate ? { opacity: 0, y: 4 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: i * 0.09, ease: "easeOut" }}
                className="hover:brightness-95 transition-[filter]"
              >
                <td className="font-mono text-xs px-4 py-2.5" style={{ ...mutedFg, ...cellBorder }}>
                  {row.id}
                </td>
                <td className="font-sans text-sm px-4 py-2.5" style={{ ...fg, ...cellBorder }}>
                  {row.entity}
                </td>
                {row.cells.map((value, j) => (
                  <td key={j} className="font-sans text-sm px-4 py-2.5" style={{ ...mutedFg, ...cellBorder }}>
                    {value}
                  </td>
                ))}
                <td className="px-4 py-2.5" style={cellBorder}>
                  <VerdictPill text={row.verdict} tone={row.tone} />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordDrawer({ record, routed, onRoute, onClose, onOpenInbox }) {
  const checkTone = (verdict) => (verdict === "pass" ? "good" : verdict === "pending" ? "warn" : "bad");
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto p-5"
        style={{ background: "hsl(var(--background))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="font-mono text-xs" style={mutedFg}>
              {record.id}
            </div>
            <h2 className="font-serif text-xl" style={fg}>
              {record.entity}
            </h2>
            <div className="mt-1">
              <VerdictPill text={record.verdict} tone={record.tone} />
            </div>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={18} style={mutedFg} />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {record.detail.map((check, i) => (
            <div key={i} className="rounded border p-3" style={cardBox}>
              <div className="flex items-center justify-between">
                <span className="font-sans text-sm font-medium" style={fg}>
                  {check.name}
                </span>
                <VerdictPill text={check.verdict} tone={checkTone(check.verdict)} />
              </div>
              <p className="font-sans text-xs mt-1" style={mutedFg}>
                {check.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          {routed ? (
            <span className="text-sm font-sans" style={{ color: TONE_COLORS.good }}>
              Routed to Decision Inbox ✓
            </span>
          ) : (
            <button
              onClick={() => onRoute(record.id)}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-sans font-medium"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              <Inbox size={14} /> Route to Decision Inbox
            </button>
          )}
          <button
            onClick={onOpenInbox}
            className="rounded-md px-3 py-2 text-sm font-sans border"
            style={{ borderColor: "hsl(var(--border))", ...fg }}
          >
            Open Inbox
          </button>
        </div>
      </div>
    </div>
  );
}

function NoDocumentsDrawer({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div className="h-full w-full max-w-md p-6" style={{ background: "hsl(var(--background))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <span className="font-serif text-lg" style={fg}>
            Documents
          </span>
          <button onClick={onClose} aria-label="Close">
            <X size={18} style={mutedFg} />
          </button>
        </div>
        <p className="font-sans text-sm" style={mutedFg}>
          This journey has no individual source documents to preview.
        </p>
      </div>
    </div>
  );
}

/**
 * Generic journey workbench: run the agent, review KPIs / distribution / records,
 * route pending items to the Decision Inbox, and chat with a journey-scoped assistant.
 */
export default function JourneyDashboard({ journeyId, customPanel }) {
  const [, navigate] = useLocation();
  const [verdictFilter, setVerdictFilter] = useState(null);
  const [focused, setFocused] = useState(null);
  const [routed, setRouted] = useState({});
  const [docsOpen, setDocsOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [toast, setToast] = useState(null);
  const [compiled, setCompiled] = useState(() => compiledJourneys.has(journeyId));
  const [animateIn, setAnimateIn] = useState(false);
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [, setStepTimes] = useState([]);

  const docDir = JOURNEY_DOC_DIRS[journeyId];
  const { data: dashboard, isLoading, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["journey-dashboard", journeyId],
    queryFn: () => apiGet(`/api/journeys/${journeyId}/dashboard`),
  });

  const visibleRows = useMemo(
    () => (dashboard?.rows ?? []).filter((r) => !verdictFilter || r.verdict === verdictFilter),
    [dashboard, verdictFilter],
  );

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  }

  async function routeRecord(recordId) {
    try {
      await apiPost(`/api/journeys/${journeyId}/route`, { recordId });
      setRouted((prev) => ({ ...prev, [recordId]: true }));
    } catch (err) {
      alert(`Could not route to Decision Inbox: ${err.message}`);
    }
  }

  async function routeAllPending() {
    const todo = (dashboard?.pending ?? []).filter((p) => !routed[p.id]);
    if (todo.length === 0) {
      showToast("Nothing pending to route.");
      return;
    }
    let count = 0;
    for (const item of todo) {
      try {
        await apiPost(`/api/journeys/${journeyId}/route`, { recordId: item.id });
        setRouted((prev) => ({ ...prev, [item.id]: true }));
        count++;
      } catch {
        /* keep routing the rest */
      }
    }
    showToast(`Routed ${count} pending item${count === 1 ? "" : "s"} to the Decision Inbox.`);
  }

  function schedule(option) {
    setScheduleOpen(false);
    showToast(`Agent run scheduled — ${option}.`);
  }

  if (isLoading)
    return (
      <div className="p-6 font-sans text-sm" style={mutedFg}>
        Loading dashboard…
      </div>
    );
  if (!dashboard)
    return (
      <div className="p-6 font-sans text-sm" style={mutedFg}>
        No dashboard available for this journey.
      </div>
    );

  const contextPreamble = buildContextPreamble(dashboard, focused);
  const sourceSystems = Array.from(new Set((dashboard.dataSources ?? []).map((s) => s.sorSystem)));
  const timeNow = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  async function runAgent() {
    if (running) return;
    setRunning(true);
    setAnimateIn(true);
    setStepTimes([]);
    setStepIdx(0);
    for (let i = 0; i < RUN_STEPS.length; i++) {
      setStepIdx(i);
      await sleep(i >= 3 ? 2100 : 1000);
      setStepTimes((prev) => {
        const next = [...prev];
        next[i] = timeNow();
        return next;
      });
    }
    await refetch();
    setStepIdx(RUN_STEPS.length);
    await sleep(400);
    setRunning(false);
    compiledJourneys.add(journeyId);
    setCompiled(true);
    setTimeout(() => setAnimateIn(false), 2500);
  }

  function reset() {
    compiledJourneys.delete(journeyId);
    setCompiled(false);
    setRouted({});
    setVerdictFilter(null);
    setFocused(null);
  }

  const currentStep = RUN_STEPS[Math.min(stepIdx, RUN_STEPS.length - 1)];
  const show = (minStep) => compiled || stepIdx >= minStep;

  return (
    <div className="flex gap-4" style={{ height: "calc(100vh - 48px)" }}>
      <div className="flex-1 min-w-0 overflow-y-auto pr-1">
        <div className="mb-6">
          <h1 className="font-serif text-2xl leading-tight tracking-tight" style={fg}>
            {dashboard.title}
          </h1>
          <p className="mt-1 font-sans text-sm" style={mutedFg}>
            {dashboard.subtitle}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="font-sans text-xs rounded-full px-2.5 py-1" style={{ background: "hsl(var(--muted))", ...mutedFg }}>
              {dashboard.rows.length} records
            </span>
            <span className="font-sans text-xs rounded-full px-2.5 py-1" style={{ background: "hsl(var(--muted))", ...mutedFg }}>
              Deterministic checks
            </span>
            <span
              className="font-sans text-xs rounded-full px-2.5 py-1"
              style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
            >
              Dual control
            </span>
          </div>
          {compiled && dataUpdatedAt > 0 && (
            <p className="mt-2 font-sans text-xs" style={mutedFg}>
              Data as of {new Date(dataUpdatedAt).toLocaleTimeString()} · compiled from the knowledge base
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-4 relative">
            <ToolbarButton icon={Play} label={running ? "Running…" : compiled ? "Re-run" : "Run agent"} primary onClick={runAgent} />
            {compiled && !running && <ToolbarButton icon={RotateCcw} label="Reset" onClick={reset} />}
            <div className="relative">
              <ToolbarButton icon={Calendar} label="Schedule" onClick={() => setScheduleOpen((v) => !v)} />
              {scheduleOpen && (
                <div
                  className="absolute left-0 mt-1 z-20 rounded-md border p-1 shadow-lg"
                  style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", minWidth: 180 }}
                >
                  <div className="px-2 py-1 font-sans text-xs" style={mutedFg}>
                    Schedule this agent run
                  </div>
                  {SCHEDULE_OPTIONS.map((option) => (
                    <button
                      key={option}
                      onClick={() => schedule(option)}
                      className="w-full text-left rounded px-2 py-1.5 font-sans text-sm hover:brightness-95"
                      style={fg}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ToolbarButton icon={FileText} label="Documents" onClick={() => setDocsOpen(true)} />
            <ToolbarButton icon={Share2} label="Routing" onClick={routeAllPending} />
            <ToolbarButton icon={ClipboardList} label="Audit" onClick={() => navigate("/audit-trail")} />
          </div>
        </div>

        {running && (
          <RunProgress
            active={running}
            label={currentStep?.label ?? "Compiling"}
            Icon={currentStep?.icon ?? Sparkles}
            step={Math.min(stepIdx + 1, RUN_STEPS.length)}
            total={RUN_STEPS.length}
            progress={stepIdx / RUN_STEPS.length}
          />
        )}

        {!running && !compiled && <NoResultsYet recordCount={dashboard.rows.length} sources={sourceSystems} onRun={runAgent} />}

        {(running || compiled) && (
          <div>
            {dashboard.pending.length > 0 && show(3) && (
              <FadeIn animate={animateIn}>
                <PendingActions pending={dashboard.pending} routed={routed} onRoute={routeRecord} animate={animateIn} />
              </FadeIn>
            )}

            {show(4) && <KpiSection kpis={dashboard.kpis} animate={animateIn} />}

            {show(4) && (
              <FadeIn animate={animateIn}>
                <div className="rounded border p-3 mb-3" style={cardBox}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-sans text-xs font-semibold uppercase tracking-wide" style={mutedFg}>
                      Verdict distribution
                    </span>
                    <InfoTip text="The split of all loans in this stage across every possible engine outcome. Each color is a different verdict — hover the legend below for what each one means. Click a slice to filter the table." />
                    {verdictFilter && (
                      <span className="font-sans text-xs" style={{ color: "hsl(var(--primary))" }}>
                        · filtered: {verdictFilter} (click to clear)
                      </span>
                    )}
                  </div>
                  <DistributionBar slices={dashboard.distribution} selected={verdictFilter} onSelect={setVerdictFilter} />
                </div>
              </FadeIn>
            )}

            {customPanel && show(5) && (
              <FadeIn animate={animateIn}>
                <div className="mb-3">{customPanel(dashboard)}</div>
              </FadeIn>
            )}

            {show(5) && (
              <FadeIn animate={animateIn}>
                <RecordsTable dashboard={dashboard} rows={visibleRows} onOpen={setFocused} animate={animateIn} />
              </FadeIn>
            )}
          </div>
        )}
      </div>

      {assistantOpen ? (
        <div
          className="flex-none flex flex-col rounded-lg border p-3"
          style={{ width: 360, borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={14} style={{ color: "hsl(var(--primary))" }} />
              <span className="font-sans text-sm font-semibold truncate" style={fg}>
                {dashboard.title} Assistant
              </span>
            </div>
            <button
              onClick={() => setAssistantOpen(false)}
              aria-label="Collapse assistant"
              title="Collapse"
              className="flex-none rounded p-1 hover:brightness-95"
              style={mutedFg}
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <p className="font-sans text-xs mb-2" style={mutedFg}>
            Always-on · scoped to this journey{focused ? ` · ${focused.id}` : ""}
          </p>
          <div className="flex-1 min-h-0">
            <JourneyChat
              journeyId={journeyId}
              title={dashboard.title}
              nudges={dashboard.suggestedQuestions}
              contextPreamble={contextPreamble}
            />
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAssistantOpen(true)}
          title="Open assistant"
          className="flex-none flex flex-col items-center gap-2 rounded-md border px-2 py-3 self-start"
          style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--primary))" }}
        >
          <MessageSquare size={16} />
          <span className="font-sans text-xs font-medium" style={{ writingMode: "vertical-rl", ...mutedFg }}>
            Assistant
          </span>
        </button>
      )}

      {focused && (
        <RecordDrawer
          record={focused}
          routed={routed[focused.id]}
          onRoute={routeRecord}
          onClose={() => setFocused(null)}
          onOpenInbox={() => navigate("/decision-inbox")}
        />
      )}

      {docsOpen &&
        (docDir ? (
          <DocumentViewer dir={docDir} title={`${dashboard.title} — Documents`} onClose={() => setDocsOpen(false)} />
        ) : (
          <NoDocumentsDrawer onClose={() => setDocsOpen(false)} />
        ))}

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-md border px-4 py-2 shadow-lg"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
        >
          <span className="font-sans text-sm" style={fg}>
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}
