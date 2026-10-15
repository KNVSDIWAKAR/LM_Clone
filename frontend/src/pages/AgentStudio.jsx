import { useQuery } from "@tanstack/react-query";
import { Activity, Bot, CirclePlay, FileText, Settings } from "lucide-react";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import { apiGet } from "../lib/api";

const mutedFg = { color: "hsl(var(--muted-foreground))" };
const fg = { color: "hsl(var(--foreground))" };

function ReadOnlyButton({ icon, label }) {
  return (
    <button
      className="flex items-center gap-1.5 font-sans text-xs font-medium px-3 py-1.5 rounded-md border transition-opacity opacity-70 cursor-not-allowed"
      style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", ...fg }}
      disabled
      title="Read-only in POC"
    >
      {icon}
      {label}
    </button>
  );
}

function AgentCard({ agent }) {
  return (
    <Card className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
            <Bot size={18} style={fg} />
          </div>
          <div>
            <h2 className="font-serif text-base font-semibold" style={fg}>
              {agent.name}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant={agent.status === "active" ? "active" : "available"}>
                {agent.status === "active" ? "Active" : "Available"}
              </Badge>
              <span className="font-sans text-xs" style={mutedFg}>
                {agent.engine}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="font-sans text-sm leading-relaxed" style={mutedFg}>
        {agent.description}
      </p>

      <div
        className="flex items-center gap-4 py-3 px-4 rounded-lg font-sans text-xs"
        style={{ background: "hsl(var(--muted))", ...mutedFg }}
      >
        <div className="flex items-center gap-1.5">
          <Activity size={13} />
          <span>{agent.runsToday} runs today</span>
        </div>
        <span style={{ opacity: 0.4 }}>|</span>
        <span>{agent.avgDuration}</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <span>{agent.lastRun}</span>
        {agent.sample && (
          <span className="ml-auto text-xs italic" style={{ opacity: 0.6 }}>
            sample
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {agent.skills.map((skill) => (
          <span
            key={skill}
            className="font-mono text-xs px-2.5 py-1 rounded-full border"
            style={{ background: "hsl(var(--muted))", borderColor: "hsl(var(--border))", ...fg }}
          >
            {skill}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <ReadOnlyButton icon={<Settings size={13} />} label="Configure" />
        <ReadOnlyButton icon={<CirclePlay size={13} />} label="Test Runs" />
        <ReadOnlyButton icon={<FileText size={13} />} label="View Logs" />
      </div>
    </Card>
  );
}

export default function AgentStudio() {
  const { data: agents = [] } = useQuery({ queryKey: ["agents"], queryFn: () => apiGet("/api/agents") });

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight" style={fg}>
          Agent Studio
        </h1>
        <p className="font-sans text-sm mt-1" style={mutedFg}>
          Configure and monitor all agents in the Mortgage Agentic Workbench.
        </p>
      </div>
      <p className="font-sans text-xs uppercase tracking-widest mb-4" style={mutedFg}>
        {agents.length} Agent{agents.length !== 1 ? "s" : ""}
      </p>
      <div className="flex flex-col gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
