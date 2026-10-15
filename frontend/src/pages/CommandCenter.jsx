import { motion } from "framer-motion";
import { Bell, ChevronRight, Info, Sparkles, Triangle, TriangleAlert } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import PromptInput from "../components/ui/PromptInput";
import Badge, { priorityVariant } from "../components/ui/Badge";
import { DOMAIN_JOURNEYS } from "../lib/navigation";
import { apiGet, apiPost } from "../lib/api";
import { formatShortDate } from "../lib/utils";

export const LOGO_URL =
  "/firstsource-logo.png";

const cardStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "var(--radius)",
};

const muted = { color: "hsl(var(--muted-foreground))" };

function JourneyCard({ icon: Icon, title, description, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.15 }}
      className="w-full flex items-start gap-4 p-5 text-left transition-colors"
      style={{ ...cardStyle, cursor: "pointer" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "hsl(213 100% 17% / 0.25)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "hsl(var(--border))")}
    >
      <Icon size={24} style={{ ...muted, flexShrink: 0, marginTop: 2 }} />
      <div className="flex-1 min-w-0">
        <h3 className="font-serif" style={{ fontSize: "16px", fontWeight: 500, color: "hsl(var(--foreground))" }}>
          {title}
        </h3>
        {description && (
          <p className="font-sans mt-1 line-clamp-2" style={{ fontSize: "13px", ...muted }}>
            {description}
          </p>
        )}
      </div>
      <ChevronRight size={18} style={{ ...muted, flexShrink: 0, marginTop: 4 }} />
    </motion.button>
  );
}

function SeverityIcon({ severity }) {
  if (severity === "warning")
    return <TriangleAlert size={16} style={{ color: "hsl(38 92% 50%)", flexShrink: 0 }} />;
  if (severity === "attention")
    return <Triangle size={16} style={{ color: "hsl(38 92% 50%)", flexShrink: 0 }} />;
  return <Info size={16} style={{ color: "hsl(217 91% 60%)", flexShrink: 0 }} />;
}

function SectionHeading({ title, count }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="font-serif" style={{ fontSize: "18px", fontWeight: 500, color: "hsl(var(--foreground))" }}>
        {title}
      </h2>
      {count > 0 && (
        <span
          className="font-sans rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ background: "hsl(var(--muted))", ...muted }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function StatusLine({ children }) {
  return (
    <p className="font-sans text-sm" style={muted}>
      {children}
    </p>
  );
}

export function AgentInsights() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-insights"],
    queryFn: () => apiGet("/api/dashboard/insights"),
  });
  const insights = data ?? [];

  return (
    <section>
      <SectionHeading title="Agent Insights" count={insights.length} />
      {isLoading && <StatusLine>Loading insights…</StatusLine>}
      {isError && <StatusLine>Could not load insights.</StatusLine>}
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className="p-4" style={cardStyle}>
            <div className="flex items-start gap-2.5">
              <SeverityIcon severity={insight.severity} />
              <div className="min-w-0">
                <p className="font-sans font-semibold" style={{ fontSize: "13px", color: "hsl(var(--foreground))" }}>
                  {insight.title}
                </p>
                <p className="font-sans mt-1" style={{ fontSize: "13px", ...muted }}>
                  {insight.body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const actionButton = "font-sans font-medium px-3 py-1.5 rounded transition-opacity hover:opacity-90";

export function ActionsRequired() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard-actions"],
    queryFn: () => apiGet("/api/dashboard/actions"),
  });
  const actions = data ?? [];

  async function decide(id, decision) {
    try {
      await apiPost(`/api/decisions/${id}/decide`, { decision });
      queryClient.invalidateQueries({ queryKey: ["dashboard-actions"] });
    } catch {
      /* the next refetch reflects server state */
    }
  }

  return (
    <section>
      <SectionHeading title="Actions Required" count={actions.length} />
      {isLoading && <StatusLine>Loading actions…</StatusLine>}
      {isError && <StatusLine>Could not load actions.</StatusLine>}
      <div className="space-y-3">
        {actions.map((action) => (
          <div key={action.id} className="p-4" style={cardStyle}>
            <div className="flex items-start gap-3">
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{ width: 32, height: 32, background: "hsl(213 100% 17% / 0.1)" }}
              >
                <Bell size={16} style={{ color: "hsl(var(--primary))" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-serif font-medium" style={{ fontSize: "15px", color: "hsl(var(--foreground))" }}>
                    {action.title}
                  </h4>
                  {action.priority && (
                    <Badge variant={priorityVariant(action.priority)}>{action.priority.toUpperCase()}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 font-sans" style={{ fontSize: "11px", ...muted }}>
                  {action.journey && <span className="uppercase tracking-wide">{action.journey}</span>}
                  {action.journey && action.created_at && <span>·</span>}
                  {action.created_at && <span>{formatShortDate(action.created_at)}</span>}
                </div>
                {action.description && (
                  <p className="font-sans mt-2" style={{ fontSize: "13px", ...muted }}>
                    {action.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => decide(action.id, "approved")}
                    className={actionButton}
                    style={{
                      fontSize: "12px",
                      background: "hsl(var(--primary))",
                      color: "hsl(var(--primary-foreground))",
                      borderRadius: "6px",
                    }}
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => decide(action.id, "rejected")}
                    className={actionButton}
                    style={{
                      fontSize: "12px",
                      background: "transparent",
                      border: "1px solid hsl(var(--destructive))",
                      color: "hsl(var(--destructive))",
                      borderRadius: "6px",
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CommandCenter() {
  const [, navigate] = useLocation();
  const ask = (message) => navigate(`/agent-console?message=${encodeURIComponent(message)}`);

  return (
    <div className="flex flex-col items-center px-2 pt-2 pb-8">
      <div className="flex flex-col items-center text-center mb-8 mt-4">
        <img
          src={LOGO_URL}
          alt="Firstsource"
          className="mb-4 rounded-xl"
          style={{ height: 56, width: "auto", objectFit: "contain" }}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <h1
          className="font-serif tracking-tight"
          style={{ fontSize: "28px", fontWeight: 600, color: "hsl(var(--foreground))" }}
        >
          Welcome, COE Team
        </h1>
        <p className="font-sans mt-1" style={{ fontSize: "14px", ...muted }}>
          Loss Mitigation Workbench — Agentic OS for retention, modification &amp; servicing recovery
        </p>
      </div>

      <PromptInput placeholder="How can I help?" onSend={ask} className="max-w-2xl w-full" />

      <section className="w-full max-w-4xl mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} style={{ color: "hsl(var(--primary))" }} />
          <h2 className="font-sans font-medium uppercase tracking-widest" style={{ fontSize: "11px", ...muted }}>
            Agent Journeys
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {DOMAIN_JOURNEYS.map((journey) => (
            <JourneyCard
              key={journey.id}
              icon={journey.icon}
              title={journey.label}
              description={journey.description}
              onClick={() => navigate(journey.path)}
            />
          ))}
        </div>
      </section>

      <div className="w-full max-w-4xl grid grid-cols-2 gap-8 mt-10">
        <AgentInsights />
        <ActionsRequired />
      </div>
    </div>
  );
}
