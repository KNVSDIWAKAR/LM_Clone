import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, CircleX, FileSearch, Inbox, LoaderCircle, UserRound } from "lucide-react";
import { Link, useLocation, useParams } from "wouter";
import LoanDrawer from "../components/knowledge/LoanDrawer";
import Card from "../components/ui/Card";
import UnderlineTabs from "../components/ui/UnderlineTabs";
import { StatusPill, fg, mutedFg, useRefreshRuns } from "../components/process/ProcessParts";
import { RunTable } from "../components/runs/RunPrimitives";
import { apiGet, apiPost } from "../lib/api";
import { PROCESSES } from "../lib/navigation";
import { timeAgo } from "../lib/utils";

const RESULT_COLOR = { fail: "hsl(0, 72%, 48%)", review: "hsl(32, 90%, 38%)", missing: "hsl(0, 72%, 48%)", invalid: "hsl(0, 72%, 48%)" };
const REVIEWER = "reviewer@workbench.local";

function DecisionRow({ d, active, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-3 py-2.5 rounded-md border transition-colors"
      style={{
        background: active ? "hsl(var(--muted))" : "hsl(var(--card))",
        borderColor: active ? "hsl(var(--primary) / 0.35)" : "hsl(var(--border))",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-sans text-sm font-medium truncate" style={fg}>
          {d.borrower_name}
        </span>
        <span className="font-sans text-[11px] shrink-0" style={mutedFg}>
          {timeAgo(d.created_at)}
        </span>
      </div>
      <p className="font-sans text-xs mt-0.5 line-clamp-2" style={mutedFg}>
        {d.reason}
      </p>
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="font-mono text-[11px]" style={mutedFg}>
          {d.loan_id}
        </span>
        <span className="font-sans text-[11px]" style={mutedFg}>
          {d.stage_name} · {d.team}
        </span>
      </div>
    </button>
  );
}

function DecisionPanel({ d, onOpenLoan, onDecided }) {
  const refresh = useRefreshRuns();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const pending = d.status === "pending";

  async function decide(decision) {
    setBusy(decision);
    setError(null);
    try {
      const r = await apiPost(`/api/decisions/${d.id}/decide`, { decision, decided_by: REVIEWER, note: note.trim() || null });
      setResult(r);
      onDecided(r);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <Card className="flex flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-sans text-xs" style={mutedFg}>
              <Link href={PROCESSES[d.stage_no - 1]?.path ?? "/"} className="hover:underline">
                Process {d.stage_no} · {d.stage_name}
              </Link>{" "}
              · gate <span className="font-mono">{d.gate}</span>
            </p>
            <button onClick={onOpenLoan} className="font-serif text-xl leading-tight text-left hover:underline" style={fg} title="Open documents">
              {d.borrower_name} <span className="font-mono text-sm" style={mutedFg}>{d.loan_id}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenLoan}
              className="inline-flex items-center gap-1.5 font-sans text-xs font-medium px-2.5 py-1 rounded border"
              style={{ borderColor: "hsl(var(--primary) / 0.4)", color: "hsl(var(--primary))", background: "hsl(var(--card))" }}
            >
              <FileSearch size={13} /> Documents & compare
            </button>
            <span className="inline-flex items-center gap-1.5 font-sans text-xs font-medium px-2 py-1 rounded" style={{ background: "hsl(0, 80%, 97%)", color: "hsl(0, 60%, 40%)" }}>
              <UserRound size={13} /> {d.team}
            </span>
          </div>
        </div>
        <p className="font-sans text-sm" style={fg}>
          {d.reason}
        </p>
      </Card>

      <section className="flex flex-col gap-2">
        <h3 className="font-sans text-xs font-semibold uppercase tracking-widest" style={mutedFg}>
          What the checks found ({d.findings.length})
        </h3>
        <RunTable columns={["Check", "Document", "Document says", "MSP says", "Result"]} empty={d.findings.length === 0 ? "No findings recorded." : null}>
          {d.findings.map((f, i) => (
            <tr key={i} style={{ background: "hsl(var(--card))", borderBottom: "1px solid hsl(var(--border))" }}>
              <td className="px-4 py-2.5 font-medium whitespace-nowrap" style={fg}>{f.check}</td>
              <td className="px-4 py-2.5 text-xs" style={mutedFg}>{f.document ?? "—"}</td>
              <td className="px-4 py-2.5 text-xs" style={fg}>{f.doc_value != null ? String(f.doc_value) : f.document ? "—" : f.detail}</td>
              <td className="px-4 py-2.5 text-xs" style={fg}>{f.msp_value != null ? String(f.msp_value) : "—"}</td>
              <td className="px-4 py-2.5 text-xs font-semibold uppercase" style={{ color: RESULT_COLOR[f.result] ?? "inherit" }}>{f.result}</td>
            </tr>
          ))}
        </RunTable>
      </section>

      {pending && !result ? (
        <Card className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="font-sans text-xs font-medium" style={mutedFg}>
              Note (required to reject)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="rounded-md border px-3 py-2 font-sans text-sm outline-none"
              style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))", ...fg }}
              placeholder="e.g. Typo in MSP name, same borrower — verified on the call"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => decide("approved")}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 font-sans text-sm font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
              style={{ background: "hsl(142, 60%, 32%)", color: "white" }}
            >
              {busy === "approved" ? <LoaderCircle size={14} className="animate-spin" /> : <CircleCheck size={14} />}
              Approve & continue
            </button>
            <button
              onClick={() => decide("rejected")}
              disabled={!!busy || !note.trim()}
              title={note.trim() ? "" : "Add a note to reject"}
              className="inline-flex items-center gap-1.5 font-sans text-sm font-medium px-3 py-1.5 rounded-md border disabled:opacity-50"
              style={{ borderColor: "hsl(0, 72%, 48%)", color: "hsl(0, 72%, 48%)", background: "hsl(var(--card))" }}
            >
              {busy === "rejected" ? <LoaderCircle size={14} className="animate-spin" /> : <CircleX size={14} />}
              Reject
            </button>
            <span className="font-sans text-xs" style={mutedFg}>
              Approve resumes the playbook from this gate; reject ends the case.
            </span>
          </div>
          {error && <p className="font-sans text-sm text-red-600">{error}</p>}
        </Card>
      ) : (
        <Card className="flex flex-col gap-1.5">
          <p className="font-sans text-sm" style={fg}>
            <span className="font-semibold capitalize">{(result?.decision ?? d).status}</span> by {(result?.decision ?? d).decided_by}{" "}
            {timeAgo((result?.decision ?? d).decided_at)}
          </p>
          {(result?.decision ?? d).note && (
            <p className="font-sans text-sm" style={mutedFg}>
              “{(result?.decision ?? d).note}”
            </p>
          )}
          {result && (
            <div className="flex flex-wrap items-center gap-2 font-sans text-sm" style={fg}>
              {d.stage_name} is now <StatusPill status={result.stage_status} />
              {result.workflow_outcome && <span style={mutedFg}>· {result.workflow_outcome}</span>}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

const TABS = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

export default function DecisionInbox() {
  const params = useParams();
  const [, navigate] = useLocation();
  const [tab, setTab] = useState("pending");
  const [openLoan, setOpenLoan] = useState(null);
  const [flash, setFlash] = useState(null);
  const qc = useQueryClient();
  const { data: all = [], isLoading } = useQuery({ queryKey: ["decisions"], queryFn: () => apiGet("/api/decisions"), refetchInterval: 5000 });

  const visible = all.filter((d) => d.status === tab);
  const selectedId = params.id ?? visible[0]?.id;
  const selected = all.find((d) => d.id === selectedId);
  const tabs = TABS.map((t) => ({ ...t, count: all.filter((d) => d.status === t.key).length }));

  // Show the decision's effect at once: move the item out of Waiting and open the next case.
  function onDecided(result) {
    const decided = result.decision;
    const next = visible.find((d) => d.id !== decided.id);
    qc.setQueryData(["decisions"], (old = []) => old.map((d) => (d.id === decided.id ? decided : d)));
    setFlash({
      ...result,
      borrower: decided.borrower_name,
      loanId: decided.loan_id,
      stage: decided.stage_name,
    });
    if (tab === "pending") navigate(next ? `/decision-inbox/${next.id}` : "/decision-inbox");
  }

  return (
    <div className="px-2 sm:px-6 py-6 max-w-7xl mx-auto flex flex-col gap-5">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight" style={fg}>
          Decision Inbox
        </h1>
        <p className="font-sans text-sm mt-1" style={mutedFg}>
          Cases a playbook paused for a person. Approving continues the case from where it stopped; it then keeps flowing until it
          finishes or hits a blocker.
        </p>
      </div>

      {flash && (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border px-4 py-2.5 font-sans text-sm"
          style={{
            borderColor: flash.decision.status === "approved" ? "hsl(142, 50%, 70%)" : "hsl(0, 60%, 80%)",
            background: flash.decision.status === "approved" ? "hsl(142, 60%, 96%)" : "hsl(0, 80%, 97%)",
            ...fg,
          }}
        >
          {flash.decision.status === "approved" ? <CircleCheck size={15} style={{ color: "hsl(142, 60%, 32%)" }} /> : <CircleX size={15} style={{ color: "hsl(0, 72%, 48%)" }} />}
          <span className="font-semibold capitalize">{flash.decision.status}</span>
          <span>
            {flash.borrower} <span className="font-mono text-xs" style={mutedFg}>{flash.loanId}</span>
          </span>
          <span style={mutedFg}>·</span>
          <span>{flash.stage} →</span>
          <StatusPill status={flash.stage_status} />
          {flash.workflow_outcome && <span style={mutedFg}>· {flash.workflow_outcome}</span>}
          <button onClick={() => setFlash(null)} className="ml-auto text-xs hover:underline" style={mutedFg}>
            Dismiss
          </button>
        </div>
      )}

      <UnderlineTabs
        tabs={tabs}
        value={tab}
        onChange={(t) => {
          setTab(t);
          navigate("/decision-inbox");
        }}
      />

      {isLoading ? (
        <p className="font-sans text-sm" style={mutedFg}>Loading…</p>
      ) : visible.length === 0 && !selected ? (
        <div className="flex flex-col items-center gap-2 py-16" style={mutedFg}>
          <Inbox size={28} />
          <p className="font-sans text-sm">{tab === "pending" ? "Nothing is waiting for a decision." : `No ${tab} decisions yet.`}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
          <aside className="flex flex-col gap-1.5 md:max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
            {visible.map((d) => (
              <DecisionRow key={d.id} d={d} active={d.id === selectedId} onSelect={() => navigate(`/decision-inbox/${d.id}`)} />
            ))}
          </aside>
          {selected && <DecisionPanel key={selected.id} d={selected} onOpenLoan={() => setOpenLoan(selected)} onDecided={onDecided} />}
        </div>
      )}
      <LoanDrawer loanId={openLoan?.loan_id} borrowerName={openLoan?.borrower_name} onClose={() => setOpenLoan(null)} />
    </div>
  );
}
