import { useQuery } from "@tanstack/react-query";
import { ChevronRight, CircleCheck, OctagonAlert, TriangleAlert, Workflow } from "lucide-react";
import { Link } from "wouter";
import DataSourcesPanel from "../components/journey/DataSourcesPanel";
import { apiGet } from "../lib/api";
import {
  AUTOMATION_LABELS,
  GATE_KEYS,
  GATE_LABELS,
  GATE_TONE_COLORS,
  LM_STEPS,
  SLOT_TONE_COLORS,
  STAGE_CONFIG,
  STAGE_NUMBERS,
  STAGE_SORT_ORDER,
  STAGE_TITLES,
  gateDisplay,
  summarizeStage,
  summarizeTimeline,
} from "../lib/lmPipelineModel";

const mutedFg = { color: "hsl(var(--muted-foreground))" };
const fg = { color: "hsl(var(--foreground))" };
const panel = { background: "hsl(var(--card))", borderColor: "hsl(var(--border))" };

const AUTOMATION_STYLES = {
  "automated-first-pass": { bg: "hsl(220 70% 50% / 0.12)", color: "hsl(220 70% 45%)" },
  "agent-augmented": { bg: "hsl(142 60% 35% / 0.13)", color: "hsl(142 60% 30%)" },
  "human-signoff": { bg: "hsl(38 92% 50% / 0.13)", color: "hsl(38 80% 35%)" },
  roadmap: { bg: "hsl(var(--muted) / 0.5)", color: "hsl(var(--muted-foreground))" },
  borrower: { bg: "hsl(var(--muted) / 0.3)", color: "hsl(var(--muted-foreground))" },
};

function usePipeline() {
  return useQuery({
    queryKey: ["lm-pipeline"],
    queryFn: () => apiGet("/api/journeys/loss-mit/pipeline"),
    refetchInterval: 5000,
  });
}

function StatTile({ icon, label, value, color, tint, border }) {
  return (
    <div className="rounded-md px-2.5 py-2" style={{ background: tint, border: `1px solid ${border}` }}>
      <div className="flex items-center gap-1 mb-0.5">
        {icon}
        <span className="font-sans" style={{ fontSize: 10, ...mutedFg, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </span>
      </div>
      <div className="font-serif tabular-nums leading-none" style={{ fontSize: 22, color }}>
        {value}
      </div>
    </div>
  );
}

function StageCard({ stage, summary }) {
  const cfg = STAGE_CONFIG[stage];
  const needsAttention = summary.attention > 0;
  const title = STAGE_TITLES[stage] ?? stage;

  return (
    <Link
      href={cfg.path}
      className="flex flex-col rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 group"
      style={{ ...panel, textDecoration: "none", minWidth: 0 }}
    >
      <div
        className="flex items-center justify-between px-3.5 py-2.5 rounded-t-xl"
        style={{
          background: needsAttention ? "hsl(25 80% 50% / 0.07)" : "hsl(142 50% 45% / 0.07)",
          borderBottom: "1px solid hsl(var(--border))",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex items-center justify-center flex-none font-sans text-xs font-semibold tabular-nums"
            style={{
              width: 22,
              height: 22,
              borderRadius: 99,
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
            }}
          >
            {STAGE_NUMBERS[stage]}
          </span>
          <div className="min-w-0">
            <div className="font-sans uppercase tracking-wider leading-none" style={{ fontSize: 10, ...mutedFg }}>
              Stage {STAGE_NUMBERS[stage]}
            </div>
            <div className="font-serif text-sm font-semibold truncate" style={fg}>
              {title}
            </div>
          </div>
        </div>
        <ChevronRight size={16} style={mutedFg} className="flex-none transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="px-3.5 py-3 flex flex-col gap-3">
        <div>
          <div className="font-serif tabular-nums leading-none" style={{ fontSize: 32, ...fg }}>
            {summary.total}
          </div>
          <div className="font-sans mt-1" style={{ fontSize: 11, ...mutedFg }}>
            total at this stage
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatTile
            icon={<CircleCheck size={13} style={{ color: SLOT_TONE_COLORS.good }} />}
            label="Moving forward"
            value={summary.forward}
            color={SLOT_TONE_COLORS.good}
            tint="hsl(142 50% 45% / 0.07)"
            border="hsl(142 50% 45% / 0.20)"
          />
          <StatTile
            icon={<TriangleAlert size={13} style={{ color: SLOT_TONE_COLORS.warn }} />}
            label="Needs attention"
            value={summary.attention}
            color={SLOT_TONE_COLORS.warn}
            tint="hsl(25 80% 50% / 0.07)"
            border="hsl(25 80% 50% / 0.25)"
          />
        </div>
        {summary.verdicts.length > 0 && (
          <div>
            <div className="font-sans uppercase tracking-wider mb-1.5" style={{ fontSize: 10, ...mutedFg }}>
              Verdict breakdown
            </div>
            <ul className="space-y-1">
              {summary.verdicts.map((v) => (
                <li key={v.verdict} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 99,
                        background: SLOT_TONE_COLORS[v.tone] ?? SLOT_TONE_COLORS.neutral,
                        flexShrink: 0,
                      }}
                    />
                    <span className="font-sans truncate" style={fg}>
                      {v.verdict}
                    </span>
                  </div>
                  <span className="font-sans font-semibold tabular-nums flex-none" style={fg}>
                    {v.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="font-sans text-xs font-medium mt-1 inline-flex items-center gap-1" style={{ color: "hsl(var(--primary))" }}>
          Open {title.toLowerCase()}
          <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

function PipelineOverview() {
  const { data } = usePipeline();
  if (!data) return null;
  const stages = data.stages.map((stage) => ({ stage, summary: summarizeStage(stage, data.borrowers) }));

  return (
    <section className="rounded-lg border p-4" style={panel}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-serif text-lg" style={fg}>
          Pipeline overview
        </h2>
        <span className="font-sans text-xs" style={mutedFg}>
          Live from the deterministic engines · refreshes every 5s
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {stages.map(({ stage, summary }) => (
          <StageCard key={stage} stage={stage} summary={summary} />
        ))}
      </div>
    </section>
  );
}

function TimelineTile({ icon, label, value, tint, border, color }) {
  return (
    <div className="rounded-md px-3 py-2.5" style={{ background: tint, border: `1px solid ${border}` }}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="font-sans uppercase tracking-wider" style={{ fontSize: 10, color }}>
          {label}
        </span>
      </div>
      <div className="font-serif tabular-nums leading-none" style={{ fontSize: 26, color }}>
        {value}
      </div>
    </div>
  );
}

function GateDot({ label, gate, dim }) {
  const color = gate ? GATE_TONE_COLORS[gate.tone] : "hsl(var(--muted-foreground))";
  return (
    <div className="flex-1 flex flex-col items-center text-center px-1" style={{ opacity: dim ? 0.35 : 1, minWidth: 0 }}>
      <span
        style={{
          width: 11,
          height: 11,
          borderRadius: 99,
          background: gate ? color : "transparent",
          border: `2px solid ${color}`,
          display: "inline-block",
        }}
      />
      <span className="font-sans mt-1 truncate w-full" style={{ fontSize: 11, ...mutedFg }}>
        {label}
      </span>
      {gate && (
        <span className="font-sans truncate w-full" style={{ fontSize: 11, fontWeight: 600, color }}>
          {gate.verdict}
        </span>
      )}
    </div>
  );
}

function CaseTimeline() {
  const { data } = usePipeline();
  if (!data) return null;
  const borrowers = [...data.borrowers].sort(
    (a, b) => (STAGE_SORT_ORDER[a.stageReached] ?? 9) - (STAGE_SORT_ORDER[b.stageReached] ?? 9),
  );
  const totals = summarizeTimeline(data.borrowers);

  return (
    <div className="rounded-lg border p-3" style={panel}>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-serif text-lg" style={fg}>
          Case Timeline
        </h2>
        <span className="font-sans text-xs" style={mutedFg}>
          {borrowers.length} borrowers · same cohort across all 5 stages
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <TimelineTile
          icon={<CircleCheck size={13} style={{ color: GATE_TONE_COLORS.good }} />}
          label="On Track"
          value={totals.onTrack}
          tint="hsl(142 50% 45% / 0.07)"
          border="hsl(142 50% 45% / 0.25)"
          color={GATE_TONE_COLORS.good}
        />
        <TimelineTile
          icon={<TriangleAlert size={13} style={{ color: GATE_TONE_COLORS.warn }} />}
          label="At Risk"
          value={totals.atRisk}
          tint="hsl(38 92% 50% / 0.08)"
          border="hsl(38 92% 50% / 0.30)"
          color="hsl(25 80% 35%)"
        />
        <TimelineTile
          icon={<OctagonAlert size={13} style={{ color: GATE_TONE_COLORS.bad }} />}
          label="SLA Breach"
          value={totals.slaBreach}
          tint="hsl(0 80% 50% / 0.07)"
          border="hsl(0 80% 50% / 0.30)"
          color={GATE_TONE_COLORS.bad}
        />
      </div>
      <div className="flex flex-col gap-2">
        {borrowers.map((borrower) => {
          const reachedIdx = data.stages.indexOf(borrower.stageReached);
          return (
            <div
              key={borrower.loanNumber}
              className="flex items-center gap-3 rounded border px-3 py-2"
              style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--background))" }}
            >
              <div className="flex-none" style={{ width: 150 }}>
                <div className="font-sans text-sm font-medium truncate" style={fg}>
                  {borrower.borrowerName}
                </div>
                <div className="font-mono text-xs" style={mutedFg}>
                  {borrower.loanNumber}
                </div>
              </div>
              <div className="flex-1 flex items-start">
                {GATE_KEYS.map((key, i) => (
                  <GateDot key={key} label={GATE_LABELS[key]} gate={gateDisplay(key, borrower)} dim={i > reachedIdx} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AutomationBadge({ automation }) {
  const style = AUTOMATION_STYLES[automation];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-sans font-medium"
      style={{ background: style.bg, color: style.color }}
    >
      {AUTOMATION_LABELS[automation]}
    </span>
  );
}

function SystemChip({ name }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono"
      style={{ background: "hsl(var(--muted) / 0.5)", ...mutedFg }}
    >
      {name}
    </span>
  );
}

function ProcessStep({ step }) {
  return (
    <div
      className="rounded-lg border p-3 space-y-1.5 transition-colors"
      style={{
        background: "hsl(var(--card))",
        borderColor: step.linkedJourney ? "hsl(var(--primary) / 0.4)" : "hsl(var(--border))",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-mono text-xs flex-none" style={mutedFg}>
            {step.id}
          </span>
          <span className="font-sans text-sm font-semibold truncate" style={fg}>
            {step.name}
          </span>
        </div>
        <AutomationBadge automation={step.automation} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="font-sans text-xs" style={mutedFg}>
          {step.team}
        </span>
        {step.fte !== null && (
          <span className="font-sans text-xs font-medium" style={fg}>
            {step.fte} FTE
          </span>
        )}
        {step.ahtLabel !== "—" && (
          <span className="font-sans text-xs" style={mutedFg}>
            AHT {step.ahtLabel}
          </span>
        )}
      </div>
      {step.systems.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {step.systems.map((s) => (
            <SystemChip key={s} name={s} />
          ))}
        </div>
      )}
      {step.linkedJourney && (
        <div className="font-sans text-xs" style={{ color: "hsl(var(--primary))" }}>
          → Open journey dashboard
        </div>
      )}
    </div>
  );
}

export default function LossMitigationEndToEnd() {
  const { data: dataSources = [] } = useQuery({
    queryKey: ["journey-data-sources", "loss-mit"],
    queryFn: () => apiGet("/api/journeys/loss-mit/data-sources"),
  });

  return (
    <div className="overflow-y-auto" style={{ height: "calc(100vh - 48px)" }}>
      <div className="space-y-4 pb-6 pr-1">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Workflow size={20} style={{ color: "hsl(var(--primary))" }} />
            <h1 className="font-serif text-2xl tracking-tight" style={fg}>
              Loss Mitigation — End to End
            </h1>
          </div>
          <p className="font-sans text-sm" style={mutedFg}>
            Live pipeline across the 5 LM stages plus the 12-step process map and source systems.
          </p>
        </div>

        <PipelineOverview />
        <CaseTimeline />

        <div className="rounded-lg border p-3" style={panel}>
          <p className="font-sans text-xs font-semibold uppercase tracking-wide mb-2" style={mutedFg}>
            Capability
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.keys(AUTOMATION_LABELS).map((key) => (
              <AutomationBadge key={key} automation={key} />
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {LM_STEPS.map((step) =>
            step.linkedJourney ? (
              <Link key={step.id} href={`/${step.linkedJourney}`} style={{ display: "block", textDecoration: "none" }}>
                <ProcessStep step={step} />
              </Link>
            ) : (
              <div key={step.id}>
                <ProcessStep step={step} />
              </div>
            ),
          )}
        </div>

        <DataSourcesPanel sources={dataSources} />

        <p className="font-sans text-xs pb-6" style={mutedFg}>
          Current-state team / FTE / AHT figures are the client&apos;s own numbers from the Firstsource process documentation.
          Agent impact is shown qualitatively (capability labels) — no projected savings.
        </p>
      </div>
    </div>
  );
}
