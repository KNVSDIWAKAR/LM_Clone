import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CircleAlert, CodeXml, FileText, LoaderCircle, Wrench, X } from "lucide-react";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import { apiGet } from "../lib/api";

const mutedFg = { color: "hsl(var(--muted-foreground))" };
const fg = { color: "hsl(var(--foreground))" };
const panelBox = { background: "hsl(var(--card))", borderColor: "hsl(var(--border))" };

const skillMarkdownComponents = {
  h1: ({ children }) => (
    <h1 className="font-serif text-xl font-semibold mt-1 mb-3" style={fg}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-sans text-xs font-semibold mt-5 mb-2 uppercase tracking-widest" style={mutedFg}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-sans text-sm font-semibold mt-3 mb-1" style={fg}>
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="mb-3 leading-7 font-sans text-sm" style={fg}>
      {children}
    </p>
  ),
  ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal font-sans text-sm space-y-2 leading-7">{children}</ol>,
  ul: ({ children }) => <ul className="mb-3 ml-5 list-disc font-sans text-sm space-y-1.5 leading-7">{children}</ul>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  code: ({ children, className }) =>
    className?.startsWith("language-") ? (
      <pre className="rounded p-3 overflow-x-auto text-xs my-3" style={{ background: "hsl(var(--muted))" }}>
        <code>{children}</code>
      </pre>
    ) : (
      <code className="rounded px-1.5 py-0.5 text-xs font-mono" style={{ background: "hsl(var(--muted))", ...fg }}>
        {children}
      </code>
    ),
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
};

function StatChip({ label, value, tone }) {
  const color = tone === "good" ? "#16a34a" : tone === "bad" ? "#ef4444" : "hsl(var(--muted-foreground))";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-sans text-xs"
      style={{ background: "hsl(var(--muted))" }}
    >
      <span style={mutedFg}>{label}</span>
      <span className="font-medium" style={{ color }}>
        {value}
      </span>
    </span>
  );
}

function DrawerStatus({ icon, text }) {
  return (
    <div className="flex items-center gap-2 py-16 justify-center" style={mutedFg}>
      {icon} <span className="font-sans text-sm">{text}</span>
    </div>
  );
}

function SkillDrawer({ name, onClose }) {
  const { data: skill, isLoading, isError } = useQuery({
    queryKey: ["skill-detail", name],
    queryFn: () => apiGet(`/api/skills/${name}`),
  });

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
              {name}
            </span>
            <span className="font-mono text-xs" style={mutedFg}>
              SKILL.md
            </span>
          </div>
          <button onClick={onClose} aria-label="Close">
            <X size={18} style={mutedFg} />
          </button>
        </div>

        {isLoading && <DrawerStatus icon={<LoaderCircle size={18} className="animate-spin" />} text="Loading skill…" />}
        {isError && <DrawerStatus icon={<CircleAlert size={18} />} text="Failed to load this skill." />}

        {skill && (
          <div className="flex-1 overflow-y-auto p-6">
            <p className="font-sans text-sm leading-relaxed mb-4" style={fg}>
              {skill.description}
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              <StatChip label="Confidence" value={`${Math.round(skill.confidence * 100)}%`} />
              <StatChip label="Used" value={`${skill.usageCount}×`} />
              <StatChip label="Success" value={`${skill.successCount}`} tone="good" />
              <StatChip label="Failure" value={`${skill.failureCount}`} tone={skill.failureCount > 0 ? "bad" : "neutral"} />
              {skill.tools.length > 0 && <StatChip label="Tools" value={`${skill.tools.length}`} />}
            </div>

            {skill.tools.length > 0 && (
              <div className="rounded-lg border p-4 mb-5" style={panelBox}>
                <div className="flex items-center gap-2 mb-2">
                  <CodeXml size={14} style={{ color: "hsl(var(--primary))" }} />
                  <span className="font-sans text-xs font-semibold uppercase tracking-wider" style={mutedFg}>
                    Tools the script calls
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skill.tools.map((tool) => (
                    <span key={tool} className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "hsl(var(--muted))", ...fg }}>
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {skill.files.length > 1 && (
              <div className="rounded-lg border p-4 mb-5" style={panelBox}>
                <div className="font-sans text-xs font-semibold uppercase tracking-wider mb-2" style={mutedFg}>
                  Files in this skill
                </div>
                <ul className="flex flex-col gap-1">
                  {skill.files.map((file) => (
                    <li key={file.name} className="flex items-center justify-between font-mono text-xs">
                      <span style={fg}>{file.name}</span>
                      <span style={mutedFg}>{file.size} B</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border p-6 mb-5" style={panelBox}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={skillMarkdownComponents}>
                {skill.body}
              </ReactMarkdown>
            </div>

            {skill.frontmatter && (
              <details className="rounded-lg border p-4" style={panelBox}>
                <summary className="font-sans text-xs font-semibold uppercase tracking-wider cursor-pointer" style={mutedFg}>
                  YAML frontmatter
                </summary>
                <pre className="font-mono text-xs mt-3 whitespace-pre-wrap" style={fg}>
                  {skill.frontmatter}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SkillCard({ skill, onOpen }) {
  const active = skill.status?.toLowerCase() === "active";
  return (
    <button onClick={onOpen} className="text-left w-full">
      <Card className="flex flex-col gap-3 hover:brightness-95 transition-[filter] cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
            <Wrench size={16} style={fg} />
          </div>
          <Badge variant={active ? "active" : "available"}>{active ? "Active" : "Available"}</Badge>
        </div>
        <div>
          <h2 className="font-serif text-base font-semibold leading-snug" style={fg}>
            {skill.name}
          </h2>
          <p className="font-sans text-xs mt-1 leading-relaxed line-clamp-3" style={mutedFg}>
            {skill.description}
          </p>
        </div>
        <div className="mt-auto flex items-center gap-3 font-sans text-xs" style={mutedFg}>
          {typeof skill.usageCount === "number" && skill.usageCount > 0 && <span>used {skill.usageCount}×</span>}
          {typeof skill.confidence === "number" && <span>conf {Math.round(skill.confidence * 100)}%</span>}
          <span className="ml-auto font-mono">SKILL.md ›</span>
        </div>
      </Card>
    </button>
  );
}

export default function SkillsManager() {
  const { data: skills = [], isLoading, isError } = useQuery({ queryKey: ["skills"], queryFn: () => apiGet("/api/skills") });
  const [openName, setOpenName] = useState(null);

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight" style={fg}>
          Skills Manager
        </h1>
        <p className="font-sans text-sm mt-1" style={mutedFg}>
          All skills available to the Mortgage Operations Orchestrator — loaded at runtime from{" "}
          <span className="font-mono text-xs">agent/skills/</span>. Click any skill to see the full{" "}
          <span className="font-mono text-xs">SKILL.md</span>.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 py-12 justify-center">
          <LoaderCircle size={18} className="animate-spin" style={mutedFg} />
          <span className="font-sans text-sm" style={mutedFg}>
            Loading skills…
          </span>
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 py-12 justify-center" style={mutedFg}>
          <CircleAlert size={18} />
          <span className="font-sans text-sm">Failed to load skills. Make sure the dev server is running.</span>
        </div>
      )}
      {!isLoading && !isError && (
        <>
          <p className="font-sans text-xs uppercase tracking-widest mb-4" style={mutedFg}>
            {skills.length} Skill{skills.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((skill) => (
              <SkillCard key={skill.name} skill={skill} onOpen={() => setOpenName(skill.name)} />
            ))}
          </div>
        </>
      )}
      {openName && <SkillDrawer name={openName} onClose={() => setOpenName(null)} />}
    </div>
  );
}
