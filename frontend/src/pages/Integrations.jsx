import { useQuery } from "@tanstack/react-query";
import { Building2, Link2 } from "lucide-react";
import Card from "../components/ui/Card";
import { apiGet } from "../lib/api";

const mutedFg = { color: "hsl(var(--muted-foreground))" };
const fg = { color: "hsl(var(--foreground))" };

// `border: <color>` alone resets the border style to none — the reference renders these pills borderless.
const PILL_COLORS = {
  green: { background: "hsl(142, 70%, 95%)", color: "hsl(142, 60%, 35%)", border: "hsl(142, 60%, 82%)" },
  blue: { background: "hsl(217, 90%, 95%)", color: "hsl(217, 70%, 45%)", border: "hsl(217, 80%, 82%)" },
};

function StatusPill({ label, color }) {
  return (
    <span className="font-sans text-xs font-medium px-2 py-0.5 rounded-full border" style={PILL_COLORS[color]}>
      {label}
    </span>
  );
}

function IntegrationCard({ integration }) {
  const { name, category, description, authType } = integration;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-md" style={{ background: "hsl(var(--muted))" }}>
            <Building2 size={14} style={fg} />
          </div>
          <div>
            <p className="font-sans text-sm font-medium leading-tight" style={fg}>
              {name}
            </p>
            <p className="font-sans text-xs" style={mutedFg}>
              {category}
            </p>
          </div>
        </div>
        <span
          className="font-mono text-xs px-1.5 py-0.5 rounded border shrink-0"
          style={{ background: "hsl(var(--muted))", borderColor: "hsl(var(--border))", ...mutedFg }}
        >
          {authType}
        </span>
      </div>
      <p className="font-sans text-xs leading-relaxed" style={mutedFg}>
        {description}
      </p>
      <button
        className="flex items-center justify-center gap-1.5 font-sans text-xs font-medium px-3 py-1.5 rounded-md border transition-opacity mt-auto cursor-not-allowed opacity-60"
        style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", ...fg }}
        disabled
        title="Read-only in POC"
      >
        <Link2 size={12} />
        Connect
      </button>
    </Card>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 className="font-sans text-xs font-medium uppercase tracking-widest" style={mutedFg}>
      {children}
    </h2>
  );
}

export default function Integrations() {
  const { data: integrations = [] } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => apiGet("/api/integrations"),
  });
  const composio = integrations.filter((i) => i.group === "composio");
  const direct = integrations.filter((i) => i.group === "direct");

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight" style={fg}>
          Integrations
        </h1>
        <p className="font-sans text-sm mt-1" style={mutedFg}>
          Connect the Mortgage Agentic Workbench to external systems via Composio OAuth2 and direct API integrations.
        </p>
      </div>

      <section className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <SectionTitle>Composio Integrations</SectionTitle>
          <StatusPill label="Composio Active" color="green" />
          <StatusPill label="SOC2 Compliant" color="blue" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {composio.map((i) => (
            <IntegrationCard key={i.name} integration={i} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-4">
          <SectionTitle>Direct API Integrations</SectionTitle>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {direct.map((i) => (
            <IntegrationCard key={i.name} integration={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
