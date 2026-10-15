import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronUp, CircleCheckBig, Shield, TriangleAlert } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import DecisionTraceDiagram from "../components/decisions/DecisionTraceDiagram";
import { apiGet, apiPost } from "../lib/api";
import { buildRationale } from "../lib/compliance";
import { parseJsonArray, timeAgo } from "../lib/utils";

/** Reviewer identity recorded on every decision and audit event. */
export const REVIEWER = "yash.k@firstsource.com";

const mutedFg = { color: "hsl(var(--muted-foreground))" };
const fg = { color: "hsl(var(--foreground))" };
const dangerBanner = {
  background: "hsl(0, 84%, 97%)",
  border: "1px solid hsl(0, 84%, 80%)",
  borderRadius: "var(--radius)",
};
const textareaStyle = {
  background: "hsl(var(--muted))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "calc(var(--radius) - 2px)",
  color: "hsl(var(--foreground))",
  outline: "none",
};

export function SectionLabel({ children }) {
  return (
    <p className="font-sans text-xs font-semibold uppercase tracking-widest mb-2" style={mutedFg}>
      {children}
    </p>
  );
}

function FactCard({ label, value }) {
  return (
    <Card className="flex flex-col gap-1 py-3">
      <p className="font-sans text-xs font-semibold uppercase tracking-wide" style={mutedFg}>
        {label}
      </p>
      <p className="font-sans text-sm font-medium" style={fg}>
        {value}
      </p>
    </Card>
  );
}

function CheckCard({ check, defaultExpanded = false }) {
  const [open, setOpen] = useState(defaultExpanded);
  const color =
    check.verdict === "pass" ? "hsl(142, 71%, 40%)" : check.verdict === "flagged" ? "hsl(0, 84%, 55%)" : "hsl(38, 92%, 45%)";
  const variant = check.verdict === "pass" ? "pass" : check.verdict === "flagged" ? "flagged" : "warning";

  return (
    <Card className="p-0 overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: "transparent", cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Shield size={18} style={{ color, flexShrink: 0 }} />
        <span className="flex-1 font-sans text-sm font-medium" style={fg}>
          {check.name}
        </span>
        <Badge variant={variant}>{check.verdict.toUpperCase()}</Badge>
        <span style={mutedFg}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>
      {open && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid hsl(var(--border))" }}>
          <p className="font-sans text-sm mt-3 leading-relaxed" style={mutedFg}>
            {check.detail}
          </p>
          {check.evidence && (
            <div className="mt-3 rounded px-3 py-2" style={{ background: "hsl(var(--muted))", borderLeft: `3px solid ${color}` }}>
              <p className="font-sans text-xs font-semibold uppercase tracking-wide mb-1" style={mutedFg}>
                Evidence / Policy Reference
              </p>
              <p className="font-mono text-xs leading-relaxed" style={fg}>
                {check.evidence}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function DecisionDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [justification, setJustification] = useState("");
  const [error, setError] = useState(null);
  const [showRequestInfo, setShowRequestInfo] = useState(false);
  const [infoNote, setInfoNote] = useState("");

  const { data: decision, isLoading, isError } = useQuery({
    queryKey: ["decision", id],
    queryFn: () => apiGet(`/api/decisions/${id}`),
    enabled: !!id,
  });

  async function afterMutation() {
    await queryClient.invalidateQueries({ queryKey: ["decisions"] });
    await queryClient.invalidateQueries({ queryKey: ["decision", id] });
    navigate("/decision-inbox");
  }

  async function decide(outcome) {
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/api/decisions/${id}/decide`, {
        decision: outcome,
        justification: justification.trim() || undefined,
        actor: REVIEWER,
      });
      await afterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit decision");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestInfo() {
    if (!id) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost(`/api/decisions/${id}/request-info`, { note: infoNote.trim() || undefined, actor: REVIEWER });
      await afterMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request info");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="font-sans text-sm" style={mutedFg}>
          Loading decision...
        </p>
      </div>
    );
  }

  if (isError || !decision) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
        <p className="font-sans text-sm text-red-600">Decision not found.</p>
        <Link href="/decision-inbox" className="font-sans text-sm underline">
          Back to inbox
        </Link>
      </div>
    );
  }

  const checks = parseJsonArray(decision.compliance_checks);
  const flagged = checks.some((c) => c.verdict === "flagged");
  const rationale = buildRationale(decision, checks);
  const canApprove = flagged ? justification.trim().length > 0 : true;
  const closed = decision.status === "approved" || decision.status === "rejected";

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center gap-2">
        <Link
          href="/decision-inbox"
          className="flex items-center gap-1 font-sans text-sm transition-opacity hover:opacity-70"
          style={{ ...mutedFg, textDecoration: "none" }}
        >
          <ArrowLeft size={15} />
          Back to Inbox
        </Link>
        <span style={mutedFg}>/</span>
        <span className="font-sans text-xs font-mono" style={mutedFg}>
          {decision.id}
        </span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={decision.priority ?? "medium"}>{decision.priority?.toUpperCase() ?? "—"}</Badge>
            <span className="font-sans text-xs" style={mutedFg}>
              {decision.journey} · {timeAgo(decision.created_at)}
            </span>
            {decision.status === "needs_info" && <Badge variant="medium">NEEDS INFO</Badge>}
          </div>
          <h1 className="font-serif text-xl leading-snug" style={fg}>
            {decision.title}
          </h1>
          {decision.agent && (
            <p className="font-sans text-xs" style={mutedFg}>
              Agent: {decision.agent}
            </p>
          )}
        </div>

        {!closed && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              disabled={submitting || !canApprove}
              onClick={() => decide("approved")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded font-sans text-sm font-medium transition-opacity disabled:opacity-40"
              style={{
                background: flagged ? "hsl(38, 92%, 50%)" : "hsl(142, 71%, 40%)",
                color: "#fff",
                borderRadius: "var(--radius)",
                cursor: submitting || !canApprove ? "not-allowed" : "pointer",
              }}
            >
              <CircleCheckBig size={15} />
              {flagged ? "Approve with Override" : "Approve"}
            </button>
            <button
              disabled={submitting}
              onClick={() => decide("rejected")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded font-sans text-sm font-medium transition-opacity disabled:opacity-40"
              style={{
                background: "transparent",
                color: "hsl(0, 84%, 55%)",
                border: "1px solid hsl(0, 84%, 55%)",
                borderRadius: "var(--radius)",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              <TriangleAlert size={15} />
              Reject
            </button>
            <button
              disabled={submitting}
              onClick={() => setShowRequestInfo((v) => !v)}
              className="px-3 py-1.5 rounded font-sans text-sm font-medium transition-opacity disabled:opacity-40"
              style={{
                background: showRequestInfo ? "hsl(var(--muted))" : "transparent",
                color: "hsl(var(--muted-foreground))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              Request Info
            </button>
          </div>
        )}
        {closed && (
          <Badge variant={decision.status === "approved" ? "pass" : "flagged"}>{decision.status.toUpperCase()}</Badge>
        )}
      </div>

      {error && (
        <div className="rounded px-4 py-2 font-sans text-sm" style={{ ...dangerBanner, color: "hsl(0, 84%, 40%)" }}>
          {error}
        </div>
      )}

      {flagged && !closed && (
        <div className="flex items-start gap-3 rounded px-4 py-3" style={dangerBanner}>
          <TriangleAlert size={16} style={{ color: "hsl(0, 84%, 55%)", flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="font-sans text-sm font-semibold" style={{ color: "hsl(0, 84%, 40%)" }}>
              One or more compliance checks are flagged
            </p>
            <p className="font-sans text-xs mt-0.5" style={{ color: "hsl(0, 50%, 45%)" }}>
              Approval requires a written justification before override is allowed.
            </p>
          </div>
        </div>
      )}

      <div>
        <SectionLabel>The Decision</SectionLabel>
        <Card>
          <p className="font-sans text-sm leading-relaxed" style={fg}>
            {decision.description || "No description provided."}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FactCard label="Amount" value={decision.amount ?? "—"} />
        <FactCard label="Entity" value={decision.entity ?? "—"} />
        <FactCard label="Triggered By" value={`Auto pipeline — ${decision.journey}`} />
      </div>

      <div>
        <SectionLabel>Supporting Evidence</SectionLabel>
        <Card>
          <ul className="flex flex-col gap-2">
            {rationale.map((line, i) => (
              <li key={i} className="flex items-start gap-2 font-sans text-sm" style={mutedFg}>
                <span style={{ color: "hsl(var(--primary))", flexShrink: 0 }}>›</span>
                {line}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {flagged && !closed && (
        <div>
          <SectionLabel>Override Justification</SectionLabel>
          <Card>
            <p className="font-sans text-xs mb-2" style={mutedFg}>
              Provide a written justification to enable &quot;Approve with Override&quot;. This will be logged in the Audit
              Trail.
            </p>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
              placeholder="Enter justification for overriding flagged checks..."
              className="w-full rounded px-3 py-2 font-sans text-sm resize-none"
              style={textareaStyle}
            />
          </Card>
        </div>
      )}

      {showRequestInfo && !closed && (
        <div>
          <SectionLabel>Request Information</SectionLabel>
          <Card>
            <p className="font-sans text-xs mb-2" style={mutedFg}>
              Describe the additional information needed. The decision moves to &quot;Needs Info&quot; and this note is
              logged in the Audit Trail.
            </p>
            <textarea
              value={infoNote}
              onChange={(e) => setInfoNote(e.target.value)}
              rows={3}
              placeholder="What information is needed before this can be decided?"
              className="w-full rounded px-3 py-2 font-sans text-sm resize-none"
              style={textareaStyle}
            />
            <div className="flex items-center gap-2 mt-2">
              <button
                disabled={submitting || infoNote.trim().length === 0}
                onClick={requestInfo}
                className="px-3 py-1.5 rounded font-sans text-sm font-medium transition-opacity disabled:opacity-40"
                style={{
                  background: "hsl(var(--primary))",
                  color: "hsl(var(--primary-foreground))",
                  borderRadius: "var(--radius)",
                  cursor: submitting || infoNote.trim().length === 0 ? "not-allowed" : "pointer",
                }}
              >
                Submit Request
              </button>
              <button
                disabled={submitting}
                onClick={() => setShowRequestInfo(false)}
                className="px-3 py-1.5 rounded font-sans text-sm font-medium"
                style={{
                  background: "transparent",
                  color: "hsl(var(--muted-foreground))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}

      <div>
        <SectionLabel>Decision Tracing — Compliance Checks</SectionLabel>
        <Card>
          <DecisionTraceDiagram checks={checks} />
        </Card>
      </div>

      {checks.length > 0 && (
        <div className="flex flex-col gap-3">
          {checks.map((check) => (
            <CheckCard key={check.name} check={check} defaultExpanded={check.verdict !== "pass"} />
          ))}
        </div>
      )}
    </div>
  );
}
