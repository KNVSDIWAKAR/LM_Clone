import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CircleAlert, FileText, LoaderCircle, Stamp, X } from "lucide-react";
import { apiGet } from "../../lib/api";
import { DocumentPaper, KeyValueGrid, paperStyle } from "./DocumentRenderers";

/** Journey id → knowledge directory holding that journey's case files. */
export const JOURNEY_DOC_DIRS = {
  origination: "origination-leads",
  "trade-off": "offer-scenarios",
  "document-intake": "applications",
  valuation: "valuation-files",
  processing: "processing-files",
  underwriting: "underwriting-files",
  "disclosure-validation": "loan-files",
  "closing-qc": "closing-packages",
  "complaint-resolution": "complaints",
  "servicing-flags": "servicing-loans",
  "loss-mit": "loss-mit-files",
  "loss-mit-intake": "lm-intake-files",
  "loss-mit-trial-uw": "lm-trial-uw-files",
  "loss-mit-trial": "lm-trial-files",
  "loss-mit-closing": "lm-modclose-files",
};

const DIR_RECORD_LABELS = {
  "origination-leads": "Origination Lead",
  "offer-scenarios": "Offer Scenario",
  applications: "Application Package",
  "valuation-files": "Valuation File",
  "processing-files": "Processing File",
  "underwriting-files": "Underwriting File",
  "loan-files": "Loan File (LE/CD)",
  "closing-packages": "Closing Package",
  complaints: "Complaint",
  "servicing-loans": "Servicing Loan",
  "loss-mit-files": "LM Retention Eligibility File",
  "lm-intake-files": "LM Intake Package",
  "lm-trial-uw-files": "LM Trial Underwriting File",
  "lm-trial-files": "Trial Plan File",
  "lm-modclose-files": "Final Mod / Closing File",
};

const mutedFg = { color: "hsl(var(--muted-foreground))" };
const fg = { color: "hsl(var(--foreground))" };
const pagerButton = "w-7 h-7 rounded-md flex items-center justify-center transition-opacity disabled:opacity-30";
const pagerStyle = { border: "1px solid hsl(var(--border))", ...fg };

const recordTitle = (doc) => doc.data.borrowerName || doc.data.product || doc.id;

function CenteredStatus({ icon, text }) {
  return (
    <div className="flex items-center gap-2 py-16 justify-center" style={mutedFg}>
      {icon} <span className="font-sans text-sm">{text}</span>
    </div>
  );
}

/**
 * Right-hand drawer that pages through a knowledge directory: each record's rendered
 * documents first, then its raw record data. ←/→ to page, Esc to close.
 */
export default function DocumentViewer({ dir, title, preselectId, onClose }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["kb-dir", dir],
    queryFn: () => apiGet(`/api/knowledge/dir/${dir}`),
  });
  const records = data?.documents ?? [];
  const [selectedId, setSelectedId] = useState(preselectId);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!selectedId && records.length) setSelectedId(preselectId ?? records[0].id);
  }, [records, selectedId, preselectId]);

  const record = records.find((r) => r.id === selectedId);
  const recordLabel = DIR_RECORD_LABELS[dir] ?? "Document";
  const docs = Array.isArray(record?.data.documents) ? record.data.documents : [];
  const fields = {};
  if (record) {
    for (const [key, value] of Object.entries(record.data)) if (key !== "documents") fields[key] = value;
  }
  const pageCount = docs.length + 1;
  const dataPageIndex = docs.length;

  useEffect(() => {
    setPage(0);
  }, [selectedId]);

  const step = useCallback((delta) => setPage((p) => Math.min(Math.max(p + delta, 0), pageCount - 1)), [pageCount]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  const current = Math.min(page, pageCount - 1);
  const onDataPage = current === dataPageIndex;
  const caption = onDataPage ? `${recordLabel} — record data` : (docs[current]?.title ?? "");

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        className="h-full w-full max-w-3xl flex flex-col"
        style={{ background: "hsl(var(--background))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={16} style={{ color: "hsl(var(--primary))" }} />
            <span className="font-serif text-lg truncate" style={fg}>
              {title}
            </span>
            <span
              className="font-sans text-xs px-1.5 py-0.5 rounded-full flex-none"
              style={{ background: "hsl(var(--muted))", ...mutedFg }}
            >
              {records.length} docs
            </span>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={18} style={mutedFg} />
          </button>
        </div>

        {isLoading ? (
          <CenteredStatus icon={<LoaderCircle size={18} className="animate-spin" />} text="Loading documents…" />
        ) : isError ? (
          <CenteredStatus icon={<CircleAlert size={18} />} text="Failed to load documents." />
        ) : records.length === 0 ? (
          <CenteredStatus icon={<CircleAlert size={18} />} text="No documents available for this journey." />
        ) : (
          <div className="flex-1 flex min-h-0">
            <div className="w-56 flex-none overflow-y-auto border-r py-2" style={{ borderColor: "hsl(var(--border))" }}>
              {records.map((r) => {
                const active = r.id === selectedId;
                const docCount = Array.isArray(r.data.documents) ? r.data.documents.length : 0;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className="w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors"
                    style={{ background: active ? "hsl(var(--muted))" : "transparent" }}
                  >
                    <span className="font-sans text-sm truncate" style={{ ...fg, fontWeight: active ? 600 : 400 }}>
                      {recordTitle(r)}
                    </span>
                    <span className="font-mono text-xs truncate flex items-center gap-1" style={mutedFg}>
                      {r.id}
                      {docCount > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1 rounded-full"
                          style={{ background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}
                        >
                          <Stamp size={10} /> {docCount}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div
                className="flex items-center justify-between gap-3 px-6 py-2.5 border-b"
                style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.3)" }}
              >
                <span className="font-sans text-xs truncate" style={mutedFg}>
                  {caption}
                </span>
                <div className="flex items-center gap-1.5 flex-none">
                  <button onClick={() => step(-1)} disabled={current === 0} aria-label="Previous document" className={pagerButton} style={pagerStyle}>
                    <ChevronLeft size={15} />
                  </button>
                  <span className="font-mono text-xs tabular-nums" style={mutedFg}>
                    {current + 1} / {pageCount}
                  </span>
                  <button
                    onClick={() => step(1)}
                    disabled={current === pageCount - 1}
                    aria-label="Next document"
                    className={pagerButton}
                    style={pagerStyle}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {record && (
                  <div className="mx-auto max-w-2xl">
                    {onDataPage ? (
                      <div className="rounded-lg border p-8" style={paperStyle}>
                        <div className="mb-5 pb-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
                          <div className="font-sans text-xs uppercase tracking-widest" style={mutedFg}>
                            {recordLabel} — record data
                          </div>
                          <h3 className="font-serif text-xl mt-1" style={fg}>
                            {recordTitle(record)}
                          </h3>
                          <div className="font-mono text-xs mt-0.5" style={mutedFg}>
                            {record.id}.json
                          </div>
                        </div>
                        <KeyValueGrid obj={fields} />
                      </div>
                    ) : (
                      <DocumentPaper doc={docs[current]} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
