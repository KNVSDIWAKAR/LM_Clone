import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleAlert, FileText, LoaderCircle, Share2 } from "lucide-react";
import Card from "../components/ui/Card";
import DocumentViewer from "../components/knowledge/DocumentViewer";
import { apiGet } from "../lib/api";

const mutedFg = { color: "hsl(var(--muted-foreground))" };
const fg = { color: "hsl(var(--foreground))" };

/** Muted pill toggle shared by Knowledge Base / Agent Studio style pages. */
export function SegmentedTabs({ options, value, onChange }) {
  return (
    <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: "hsl(var(--muted))" }}>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className="font-sans text-sm font-medium px-4 py-1.5 rounded-md transition-all"
          style={
            value === opt.key
              ? { background: "hsl(var(--card))", ...fg, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
              : mutedFg
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SourceRow({ name, typeLabel, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors hover:brightness-95"
      style={{
        background: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
        borderRadius: "var(--radius)",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <FileText size={15} style={{ ...mutedFg, flexShrink: 0 }} />
      <span className="font-mono text-sm flex-1 truncate" style={fg}>
        {name}
      </span>
      <span
        className="font-sans text-xs px-2 py-0.5 rounded-full border"
        style={{ ...mutedFg, borderColor: "hsl(var(--border))", background: "hsl(var(--muted))", whiteSpace: "nowrap" }}
      >
        {typeLabel}
      </span>
    </button>
  );
}

function SourceSection({ title, count, emptyText, children }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="font-sans text-xs font-medium uppercase tracking-widest" style={mutedFg}>
          {title}
        </h2>
        <span className="font-sans text-xs px-1.5 py-0.5 rounded-full" style={{ background: "hsl(var(--muted))", ...mutedFg }}>
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="font-sans text-sm" style={mutedFg}>
          {emptyText}
        </p>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </section>
  );
}

function Sources() {
  const [viewer, setViewer] = useState(null);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["knowledge-sources"],
    queryFn: () => apiGet("/api/knowledge/sources"),
  });

  if (isLoading)
    return (
      <div className="flex items-center gap-2 py-12 justify-center">
        <LoaderCircle size={18} className="animate-spin" style={mutedFg} />
        <span className="font-sans text-sm" style={mutedFg}>
          Loading sources…
        </span>
      </div>
    );

  if (isError || !data)
    return (
      <div className="flex items-center gap-2 py-12 justify-center" style={mutedFg}>
        <CircleAlert size={18} />
        <span className="font-sans text-sm">Failed to load sources. Make sure the dev server is running.</span>
      </div>
    );

  const loanFiles = data.loanFiles
    .filter((f) => f !== ".gitkeep" && f.endsWith(".json"))
    .map((f) => ({ raw: f, display: f.replace(/\.json$/, "") }));
  const complaints = data.complaints.filter((f) => f !== ".gitkeep");

  return (
    <>
      {viewer && (
        <DocumentViewer dir={viewer.dir} title={viewer.label} preselectId={viewer.id} onClose={() => setViewer(null)} />
      )}
      <div className="flex flex-col gap-6">
        <SourceSection title="Loan Files" count={loanFiles.length} emptyText="No loan files found.">
          {loanFiles.map(({ raw, display }) => (
            <SourceRow
              key={raw}
              name={display}
              typeLabel="Loan File"
              onClick={() => setViewer({ dir: "loan-files", id: display, label: "Loan Files" })}
            />
          ))}
        </SourceSection>
        <SourceSection title="Complaints" count={complaints.length} emptyText="No complaint files found.">
          {complaints.map((file) => (
            <SourceRow
              key={file}
              name={file}
              typeLabel="Complaint"
              onClick={() => setViewer({ dir: "complaints", id: file.replace(/\.json$/, ""), label: "Complaints" })}
            />
          ))}
        </SourceSection>
      </div>
    </>
  );
}

function WikiComingSoon() {
  return (
    <Card className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <Share2 size={32} style={{ ...mutedFg, opacity: 0.5 }} />
      <div>
        <p className="font-sans text-sm font-medium" style={fg}>
          LLM Wiki — Coming Soon
        </p>
        <p className="font-sans text-xs mt-1 max-w-sm" style={mutedFg}>
          The compiled knowledge graph (entities, concepts, and syntheses derived from source documents) is planned for a
          future release. Uploaded documents will auto-ingest into a D3 force-directed wiki.
        </p>
      </div>
    </Card>
  );
}

const TABS = [
  { key: "sources", label: "Sources" },
  { key: "wiki", label: "Wiki" },
];

export default function KnowledgeBase() {
  const [tab, setTab] = useState("sources");
  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight" style={fg}>
          Knowledge Base
        </h1>
        <p className="font-sans text-sm mt-1" style={mutedFg}>
          Source documents and compiled knowledge available to the agent at runtime.
        </p>
      </div>
      <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
      {tab === "sources" ? <Sources /> : <WikiComingSoon />}
    </div>
  );
}
