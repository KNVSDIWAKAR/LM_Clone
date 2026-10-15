import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleCheckBig, Clock, Shield, TriangleAlert } from "lucide-react";
import Badge from "../components/ui/Badge";
import { PageHeader } from "../components/ui/Card";
import UnderlineTabs from "../components/ui/UnderlineTabs";
import { apiGet } from "../lib/api";

const TABS = [
  { key: "guardrails", label: "Active Guardrails" },
  { key: "frameworks", label: "Regulatory Frameworks" },
  { key: "validation", label: "Validation Schedule" },
];

const mutedFg = { color: "hsl(var(--muted-foreground))" };
const fg = { color: "hsl(var(--foreground))" };
const panel = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "var(--radius)",
  padding: "1rem 1.25rem",
};

function GuardrailGroup({ title, icon, accentColor, items, emptyText }) {
  return (
    <div className="rounded" style={{ ...panel, borderLeft: `4px solid ${accentColor}` }}>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-sans text-sm font-semibold uppercase tracking-wider" style={fg}>
          {title}
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="font-sans text-sm" style={mutedFg}>
          {emptyText}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-none" style={{ background: accentColor }} />
              <span className="font-sans text-sm" style={fg}>
                {item}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Guardrails() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["compliance"],
    queryFn: () => apiGet("/api/agent/compliance"),
  });

  return (
    <div className="flex flex-col gap-5">
      {isLoading && (
        <p className="font-sans text-sm" style={mutedFg}>
          Loading guardrails...
        </p>
      )}
      {isError && <p className="font-sans text-sm text-red-600">Failed to load compliance data.</p>}
      {!isLoading && !isError && (
        <>
          <GuardrailGroup
            title="MUST ALWAYS"
            icon={<CircleCheckBig size={16} style={{ color: "hsl(142, 71%, 40%)" }} />}
            accentColor="hsl(142, 71%, 40%)"
            items={data?.mustAlways ?? []}
            emptyText="No must-always constraints configured."
          />
          <GuardrailGroup
            title="MUST NEVER"
            icon={<TriangleAlert size={16} style={{ color: "hsl(0, 84%, 55%)" }} />}
            accentColor="hsl(0, 84%, 55%)"
            items={data?.mustNever ?? []}
            emptyText="No must-never constraints configured."
          />
          <GuardrailGroup
            title="ESCALATION"
            icon={<Shield size={16} style={{ color: "hsl(38, 92%, 48%)" }} />}
            accentColor="hsl(38, 92%, 48%)"
            items={data?.escalation ?? []}
            emptyText="No escalation rules configured."
          />
        </>
      )}
    </div>
  );
}

function Frameworks() {
  const { data: frameworks = [] } = useQuery({
    queryKey: ["compliance-frameworks"],
    queryFn: () => apiGet("/api/compliance/frameworks"),
  });

  return (
    <div className="flex flex-col gap-4">
      {frameworks.map((fw) => (
        <div key={fw.name} className="rounded" style={{ ...panel, borderLeft: "4px solid hsl(142, 71%, 40%)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="font-serif text-base font-semibold" style={fg}>
                  {fw.name}
                </span>
                <Badge variant="active">Active</Badge>
              </div>
              <p className="font-sans text-xs font-medium" style={mutedFg}>
                {fw.fullName}
              </p>
              <p className="font-sans text-sm" style={fg}>
                {fw.description}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs font-sans flex-none" style={mutedFg}>
              <span>Regulator: {fw.regulator}</span>
              <span>Validated: {fw.lastValidated}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ValidationSchedule() {
  const { data: schedule = [] } = useQuery({
    queryKey: ["compliance-validation-schedule"],
    queryFn: () => apiGet("/api/compliance/validation-schedule"),
  });

  return (
    <div className="flex flex-col gap-4">
      {schedule.map((item, i) => (
        <div key={i} className="rounded" style={panel}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="font-sans text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: "hsl(var(--muted))", ...mutedFg }}
                >
                  {item.frequency}
                </span>
                <span className="font-sans text-sm font-semibold" style={fg}>
                  {item.name}
                </span>
              </div>
              <p className="font-sans text-sm" style={mutedFg}>
                {item.description}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 text-xs font-sans flex-none" style={mutedFg}>
              <div className="flex items-center gap-1">
                <Clock size={12} />
                <span>Next: {item.next}</span>
              </div>
              <span>Owner: {item.owner}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Compliance() {
  const [tab, setTab] = useState("guardrails");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Compliance & Guardrails"
        subtitle="Safety controls and compliance framework governing agent behavior"
      />
      <UnderlineTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === "guardrails" && <Guardrails />}
      {tab === "frameworks" && <Frameworks />}
      {tab === "validation" && <ValidationSchedule />}
    </div>
  );
}
