import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const fg = { color: "hsl(var(--foreground))" };
const mutedFg = { color: "hsl(var(--muted-foreground))" };
const nestedBox = { borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.35)" };

/** camelCase / snake_case → "Title Case". */
export function humanizeKey(key) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function FieldValue({ value }) {
  if (value == null || value === "")
    return (
      <span className="font-sans text-sm italic" style={mutedFg}>
        —
      </span>
    );
  if (typeof value === "boolean")
    return (
      <span className="font-sans text-sm" style={fg}>
        {value ? "Yes" : "No"}
      </span>
    );
  if (typeof value === "string" || typeof value === "number")
    return (
      <span className="font-sans text-sm" style={fg}>
        {String(value)}
      </span>
    );
  if (Array.isArray(value)) {
    if (value.length === 0)
      return (
        <span className="font-sans text-sm italic" style={mutedFg}>
          none
        </span>
      );
    return (
      <div className="flex flex-col gap-2">
        {value.map((item, i) =>
          item !== null && typeof item === "object" ? (
            <div key={i} className="rounded border p-2.5" style={nestedBox}>
              <KeyValueGrid obj={item} dense />
            </div>
          ) : (
            <div key={i} className="font-sans text-sm" style={fg}>
              • {String(item)}
            </div>
          ),
        )}
      </div>
    );
  }
  return (
    <div className="rounded border p-2.5" style={nestedBox}>
      <KeyValueGrid obj={value} dense />
    </div>
  );
}

/** Recursive label/value grid for raw JSON records. */
export function KeyValueGrid({ obj, dense }) {
  return (
    <div className={dense ? "flex flex-col gap-1.5" : "flex flex-col gap-3"}>
      {Object.entries(obj).map(([key, value]) => (
        <div
          key={key}
          className="grid gap-1"
          style={{ gridTemplateColumns: dense ? "minmax(120px, 38%) 1fr" : "minmax(160px, 32%) 1fr" }}
        >
          <span className="font-sans text-xs font-medium pt-0.5" style={mutedFg}>
            {humanizeKey(key)}
          </span>
          <FieldValue value={value} />
        </div>
      ))}
    </div>
  );
}

const cell = { borderColor: "hsl(var(--border))", ...fg };

const documentMarkdownComponents = {
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="text-sm border-collapse w-full font-sans" style={{ borderColor: "hsl(var(--border))" }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead style={{ background: "hsl(var(--muted))" }}>{children}</thead>,
  th: ({ children }) => (
    <th className="px-3 py-2 text-left font-medium text-xs font-sans border" style={cell}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm font-sans border" style={cell}>
      {children}
    </td>
  ),
  h1: ({ children }) => (
    <h1 className="text-xl font-serif font-semibold mt-1 mb-3" style={fg}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xs font-sans font-semibold mt-5 mb-2 uppercase tracking-widest" style={mutedFg}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-sans font-semibold mt-3 mb-1" style={fg}>
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 leading-7 font-sans text-sm" style={fg}>
      {children}
    </p>
  ),
  ul: ({ children }) => <ul className="mb-3 ml-5 list-disc font-sans text-sm space-y-1.5 leading-7">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal font-sans text-sm space-y-1.5 leading-7">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold" style={fg}>
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic" style={mutedFg}>
      {children}
    </em>
  ),
  hr: () => <hr className="my-5" style={{ borderColor: "hsl(var(--border))" }} />,
};

export function DocumentMarkdown({ source }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={documentMarkdownComponents}>
      {source}
    </ReactMarkdown>
  );
}

function SignatureLine({ line, align }) {
  return (
    <div style={{ minWidth: 180, maxWidth: 260, textAlign: align }}>
      <div className="font-serif italic text-lg pb-1 whitespace-nowrap" style={fg}>
        {line.name}
      </div>
      <div className="pt-1.5 flex flex-col gap-0.5" style={{ borderTop: "1px solid hsl(var(--border))" }}>
        {line.role && (
          <span className="font-sans text-xs whitespace-nowrap" style={mutedFg}>
            {line.role}
          </span>
        )}
        {line.date && (
          <span className="font-mono text-xs whitespace-nowrap" style={mutedFg}>
            {line.date}
          </span>
        )}
      </div>
    </div>
  );
}

const paperStyle = {
  background: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
};

/** A rendered letter / determination with letterhead, markdown body and signatures. */
export function DocumentPaper({ doc }) {
  const body = Array.isArray(doc.body) ? doc.body.join("\n") : doc.body;
  const signature = doc.signature;

  return (
    <div className="rounded-lg border p-8" style={paperStyle}>
      <div
        className="flex items-start justify-between gap-3 pb-3 mb-5"
        style={{ borderBottom: "2px solid hsl(var(--primary))" }}
      >
        <div className="min-w-0">
          {doc.letterhead && (
            <div className="font-sans text-xs font-medium tracking-wide" style={fg}>
              {doc.letterhead}
            </div>
          )}
          {doc.kind && (
            <div className="font-sans text-[11px] uppercase tracking-widest mt-1" style={mutedFg}>
              {doc.kind}
            </div>
          )}
        </div>
        {doc.date && (
          <div className="text-right flex-none">
            <div className="font-sans text-[10px] uppercase tracking-wide" style={mutedFg}>
              Date
            </div>
            <div className="font-mono text-xs" style={fg}>
              {doc.date}
            </div>
          </div>
        )}
      </div>
      <DocumentMarkdown source={body} />
      {signature && (signature.left || signature.right) && (
        <div className="flex items-end justify-between gap-10 mt-10">
          <div>{signature.left && <SignatureLine line={signature.left} align="left" />}</div>
          <div className="ml-auto">{signature.right && <SignatureLine line={signature.right} align="right" />}</div>
        </div>
      )}
    </div>
  );
}

export { paperStyle };
