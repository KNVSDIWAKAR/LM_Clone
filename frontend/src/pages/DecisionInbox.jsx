import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, CircleCheckBig, Clock, TriangleAlert } from "lucide-react";
import { Link } from "wouter";
import Badge from "../components/ui/Badge";
import { PageHeader, StatCard } from "../components/ui/Card";
import UnderlineTabs from "../components/ui/UnderlineTabs";
import { apiGet } from "../lib/api";
import { allChecksPass, hasFlag, hasFlagOrWarning } from "../lib/compliance";
import { parseJsonArray, timeAgo } from "../lib/utils";

const POLL_MS = 5000;
const mutedFg = { color: "hsl(var(--muted-foreground))" };

export default function DecisionInbox() {
  const [tab, setTab] = useState("all");
  const { data: decisions = [], isLoading, isError } = useQuery({
    queryKey: ["decisions"],
    queryFn: () => apiGet("/api/decisions"),
    refetchInterval: POLL_MS,
  });

  const pending = decisions.filter((d) => d.status === "pending");
  const needsInfo = decisions.filter((d) => d.status === "needs_info");
  const approved = decisions.filter((d) => d.status === "approved");
  const rejected = decisions.filter((d) => d.status === "rejected");
  const flagged = decisions.filter((d) => hasFlag(parseJsonArray(d.compliance_checks)));
  const critical = pending.filter((d) => d.priority === "critical");
  const visible = tab === "all" ? decisions : decisions.filter((d) => d.status === tab);

  const tabs = [
    { key: "all", label: "All", count: decisions.length },
    { key: "pending", label: "Pending", count: pending.length },
    { key: "needs_info", label: "Needs Info", count: needsInfo.length },
    { key: "approved", label: "Approved", count: approved.length },
    { key: "rejected", label: "Rejected", count: rejected.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Decision Inbox" subtitle="Human-in-the-loop review center for agent decisions" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          value={pending.length}
          label="Pending"
          sublabel={critical.length > 0 ? `${critical.length} Critical` : undefined}
          sublabelClass="text-red-600"
        />
        <StatCard
          value={needsInfo.length}
          label="Needs Info"
          sublabel={needsInfo.length > 0 ? "awaiting info" : undefined}
          sublabelClass="text-amber-600"
        />
        <StatCard value={approved.length} label="Approved" />
        <StatCard value={rejected.length} label="Rejected" />
        <StatCard
          value={flagged.length}
          label="Flagged"
          sublabel={flagged.length > 0 ? "by compliance" : undefined}
          sublabelClass="text-amber-600"
        />
      </div>

      <UnderlineTabs tabs={tabs} value={tab} onChange={setTab} />

      {isLoading && (
        <p className="font-sans text-sm" style={mutedFg}>
          Loading decisions...
        </p>
      )}
      {isError && <p className="font-sans text-sm text-red-600">Failed to load decisions.</p>}
      {!isLoading && !isError && visible.length === 0 && (
        <div
          className="rounded-lg border p-8 text-center"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }}
        >
          <p className="font-sans text-sm" style={mutedFg}>
            No decisions found.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((decision) => {
          const checks = parseJsonArray(decision.compliance_checks);
          const allPass = allChecksPass(checks);
          const anyIssue = hasFlagOrWarning(checks);
          const passCount = checks.filter((c) => c.verdict === "pass").length;
          const accent = allPass ? "hsl(142, 71%, 45%)" : anyIssue ? "hsl(0, 84%, 60%)" : "hsl(30, 15%, 75%)";

          return (
            <Link
              key={decision.id}
              href={`/decision-inbox/${decision.id}`}
              style={{ display: "block", textDecoration: "none" }}
            >
              <div
                className="flex items-stretch gap-0 overflow-hidden cursor-pointer transition-all border"
                style={{
                  borderLeft: `4px solid ${accent}`,
                  borderColor: "hsl(var(--border))",
                  borderLeftColor: accent,
                  background: "hsl(var(--card))",
                  borderRadius: "var(--radius)",
                }}
              >
                <div className="flex-1 px-4 py-3 flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={decision.priority ?? "medium"}>{decision.priority?.toUpperCase() ?? "—"}</Badge>
                    <span className="font-sans text-xs" style={mutedFg}>
                      {decision.journey}
                    </span>
                  </div>
                  <p className="font-sans text-sm font-semibold leading-snug" style={{ color: "hsl(var(--foreground))" }}>
                    {decision.title}
                  </p>
                  {decision.description && (
                    <p className="font-sans text-xs leading-relaxed" style={mutedFg}>
                      {decision.description.length > 120
                        ? decision.description.slice(0, 120) + "…"
                        : decision.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {checks.length > 0 && (
                      <span className="flex items-center gap-1 font-sans text-xs">
                        {allPass ? (
                          <CircleCheckBig size={13} style={{ color: "hsl(142, 71%, 40%)" }} />
                        ) : (
                          <TriangleAlert size={13} style={{ color: "hsl(0, 84%, 55%)" }} />
                        )}
                        <span style={{ color: allPass ? "hsl(142, 71%, 35%)" : "hsl(0, 84%, 50%)" }}>
                          {passCount}/{checks.length} passed
                        </span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 font-sans text-xs ml-auto" style={mutedFg}>
                      <Clock size={12} />
                      {timeAgo(decision.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center px-3" style={mutedFg}>
                  <ChevronRight size={18} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
