import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Database, Info, LoaderCircle, Play } from "lucide-react";
import { TONE_COLORS } from "./tones";

const mutedFg = { color: "hsl(var(--muted-foreground))" };
const fg = { color: "hsl(var(--foreground))" };

export const tooltipStyle = {
  zIndex: 50,
  background: "hsl(var(--foreground))",
  color: "hsl(var(--background))",
  fontSize: 12,
  lineHeight: 1.55,
  padding: "10px 12px",
  borderRadius: 6,
  width: "max-content",
  maxWidth: 320,
  minWidth: 240,
  whiteSpace: "normal",
  wordBreak: "normal",
  overflowWrap: "break-word",
  boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
  pointerEvents: "none",
};

/** (i) icon with a hover tooltip below it. */
export function InfoTip({ text, size = 12 }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{ display: "inline-flex", position: "relative", cursor: "help", ...mutedFg }}
      aria-label={text}
    >
      <Info size={size} />
      {open && (
        <span
          role="tooltip"
          style={{
            ...tooltipStyle,
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            fontFamily: "var(--font-sans)",
            fontWeight: 400,
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

export function VerdictPill({ text, tone }) {
  const color = TONE_COLORS[tone];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-sans font-medium whitespace-nowrap"
      style={{ background: `${color}1a`, color }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 99, background: color, display: "inline-block" }} />
      {text}
    </span>
  );
}

export function ToolbarButton({ icon: Icon, label, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-sans font-medium border transition-colors hover:brightness-95"
      style={{
        background: primary ? "hsl(var(--primary))" : "hsl(var(--card))",
        color: primary ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))",
        borderColor: primary ? "hsl(var(--primary))" : "hsl(var(--border))",
      }}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

/** Compact progress strip shown while the agent "compiles" the dashboard. */
export function RunProgress({ active, label, Icon, step, total, progress }) {
  if (!active) return null;
  return (
    <div className="rounded-md border mb-3 overflow-hidden" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card))" }}>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <Icon size={13} style={{ color: "hsl(var(--primary))" }} />
        <LoaderCircle size={12} className="animate-spin" style={{ color: "hsl(var(--primary))" }} />
        <div className="flex-1 min-w-0 relative overflow-hidden" style={{ height: 18 }}>
          <AnimatePresence mode="wait">
            <motion.span
              key={label}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -14 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="absolute inset-0 font-sans text-xs truncate"
              style={fg}
            >
              {label}…
            </motion.span>
          </AnimatePresence>
        </div>
        <span className="font-mono text-[10px] tabular-nums flex-none" style={mutedFg}>
          {step}/{total}
        </span>
      </div>
      <div style={{ height: 2, background: "hsl(var(--muted))" }}>
        <motion.div
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ height: "100%", background: "hsl(var(--primary))" }}
        />
      </div>
    </div>
  );
}

export function NoResultsYet({ recordCount, sources, onRun }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-5" style={{ paddingTop: 88, paddingBottom: 88 }}>
      <div
        className="flex items-center justify-center"
        style={{ width: 64, height: 64, borderRadius: 16, background: "hsl(var(--muted))" }}
      >
        <Database size={26} style={mutedFg} />
      </div>
      <div className="max-w-md">
        <h2 className="font-serif text-2xl" style={fg}>
          No results yet
        </h2>
        <p className="font-sans text-sm mt-2" style={mutedFg}>
          Run the agent to compile {recordCount} record{recordCount === 1 ? "" : "s"} from the knowledge base
          {sources.length > 0 ? ` (${sources.slice(0, 4).join(" · ")})` : ""} into this dashboard.
        </p>
      </div>
      <button
        onClick={onRun}
        className="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-sans font-semibold hover:brightness-95"
        style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
      >
        <Play size={15} /> Run agent
      </button>
    </div>
  );
}

export function FadeIn({ animate, children }) {
  if (!animate) return <>{children}</>;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
      {children}
    </motion.div>
  );
}

const NUMBER_RE = /\d+(?:\.\d+)?/g;

/** Counts every number inside a formatted string (e.g. "$2,100" or "4 / 7") up from zero. */
export function CountUp({ value, animate, duration = 1200 }) {
  const [display, setDisplay] = useState(animate ? value.replace(NUMBER_RE, "0") : value);

  useEffect(() => {
    if (!animate) {
      setDisplay(value);
      return;
    }
    const matches = Array.from(value.matchAll(NUMBER_RE));
    if (!matches.length) {
      setDisplay(value);
      return;
    }
    const targets = matches.map((m) => parseFloat(m[0]));
    const start = performance.now();
    let frame = 0;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      let next = value;
      matches.forEach((_, idx) => {
        const target = targets[idx];
        const current = target * eased;
        const text = target % 1 === 0 ? Math.round(current).toString() : current.toFixed(1);
        let seen = -1;
        next = next.replace(NUMBER_RE, (m) => (++seen === idx ? text : m));
      });
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, animate, duration]);

  return <>{display}</>;
}

export function KpiTile({ kpi, index, animate }) {
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8, scale: 0.92 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: index * 0.18, ease: "easeOut" }}
      className="rounded border px-2 py-1.5"
      style={{ borderColor: "hsl(var(--border))", borderRadius: "var(--radius)", background: "hsl(var(--card))" }}
    >
      <div className="flex items-center gap-1">
        <span className="font-sans text-xs uppercase tracking-wide truncate" style={mutedFg}>
          {kpi.label}
        </span>
        {kpi.helper && <InfoTip text={kpi.helper} />}
      </div>
      <div
        className="font-serif text-xl leading-none tabular-nums mt-0.5"
        style={{ color: kpi.tone ? TONE_COLORS[kpi.tone] : "hsl(var(--foreground))" }}
      >
        <CountUp value={kpi.value} animate={animate} duration={1200} />
      </div>
      {kpi.sub && (
        <div className="font-sans text-xs mt-0.5" style={mutedFg}>
          {kpi.sub}
        </div>
      )}
    </motion.div>
  );
}
