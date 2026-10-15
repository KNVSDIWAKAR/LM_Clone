import { useEffect, useRef, useState } from "react";
import { easeCubicOut, pointer, scaleLinear, select, sum } from "d3";
import { Info } from "lucide-react";
import { toneColor } from "./tones";
import { tooltipStyle } from "./JourneyPrimitives";

const BAR_HEIGHT = 36;

function LegendItem({ slice, selected, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-flex items-center gap-1">
      <button
        onClick={() => onSelect?.(selected === slice.label ? null : slice.label)}
        className="flex items-center gap-1.5 text-xs font-sans"
        style={{
          color: "hsl(var(--muted-foreground))",
          opacity: selected && selected !== slice.label ? 0.5 : 1,
          cursor: onSelect ? "pointer" : "default",
          background: "none",
          border: "none",
          padding: 0,
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 2, background: toneColor(slice.tone), display: "inline-block" }} />
        {slice.label} · {slice.count}
      </button>
      {slice.helper && (
        <span
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          style={{ display: "inline-flex", cursor: "help", color: "hsl(var(--muted-foreground))" }}
          aria-label={slice.helper}
        >
          <Info size={12} />
          {open && <span style={{ ...tooltipStyle, position: "absolute", bottom: "calc(100% + 8px)", left: 0 }}>{slice.helper}</span>}
        </span>
      )}
    </div>
  );
}

/** Single stacked bar of verdict counts; click a segment (or legend item) to filter the table. */
export default function DistributionBar({ slices, onSelect, selected }) {
  const svgRef = useRef(null);
  const tipRef = useRef(null);

  useEffect(() => {
    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const total = sum(slices, (s) => s.count) || 1;
    const width = svgRef.current?.clientWidth ?? 600;
    const x = scaleLinear().domain([0, total]).range([0, width]);

    let cursor = 0;
    const stacked = slices.map((s) => {
      const x0 = cursor;
      cursor += s.count;
      return { ...s, x0, x1: cursor };
    });

    const tip = select(tipRef.current);

    svg
      .attr("width", width)
      .attr("height", BAR_HEIGHT)
      .selectAll("rect")
      .data(stacked)
      .join("rect")
      .attr("y", 0)
      .attr("height", BAR_HEIGHT)
      .attr("rx", 3)
      .attr("x", (d) => x(d.x0))
      .attr("fill", (d) => toneColor(d.tone))
      .attr("opacity", (d) => (selected && selected !== d.label ? 0.35 : 1))
      .style("cursor", onSelect ? "pointer" : "default")
      .on("mousemove", (event, d) => {
        const [px] = pointer(event, svgRef.current);
        tip
          .style("opacity", "1")
          .style("left", `${px}px`)
          .html(`<strong>${d.label}</strong> · ${d.count} (${Math.round((d.count / total) * 100)}%)`);
      })
      .on("mouseleave", () => tip.style("opacity", "0"))
      .on("click", (_, d) => onSelect?.(selected === d.label ? null : d.label))
      .attr("width", 0)
      .transition()
      .delay((_, i) => i * 220)
      .duration(700)
      .ease(easeCubicOut)
      .attr("width", (d) => Math.max(0, x(d.x1) - x(d.x0) - 1));
  }, [slices, onSelect, selected]);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg ref={svgRef} style={{ width: "100%", display: "block" }} />
      <div
        ref={tipRef}
        style={{
          position: "absolute",
          top: -30,
          transform: "translateX(-50%)",
          pointerEvents: "none",
          opacity: 0,
          whiteSpace: "nowrap",
          fontSize: 11,
          padding: "3px 7px",
          borderRadius: 4,
          background: "hsl(var(--foreground))",
          color: "hsl(var(--background))",
          transition: "opacity 120ms",
        }}
      />
      <div className="flex flex-wrap gap-3 mt-2">
        {slices.map((slice) => (
          <LegendItem key={slice.label} slice={slice} selected={selected} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
