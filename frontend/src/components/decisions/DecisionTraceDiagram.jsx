import { verdictFill, verdictStroke } from "../../lib/compliance";

// Layout constants (SVG user units).
const AGENT_W = 130;
const AGENT_H = 52;
const CHECK_W = 150;
const CHECK_H = 44;
const OUT_W = 90;
const OUT_H = 52;
const AGENT_X = 20;
const CHECK_X = 220;
const OUT_X = 450;
const ROW_GAP = 60;

/** Agent → compliance checks → output, drawn as a Sankey-style flow. */
export default function DecisionTraceDiagram({ checks }) {
  const list = checks.length > 0 ? checks : [];
  const stackH = (Math.max(list.length, 1) - 1) * ROW_GAP + CHECK_H;
  const width = OUT_X + OUT_W + 20;
  const height = Math.max(AGENT_H + 40, stackH + 40);
  const midY = height / 2;
  const stackTop = (height - stackH) / 2;

  const anyFlag = list.some((c) => c.verdict === "flagged");
  const anyWarn = list.some((c) => c.verdict === "warning");
  const outcome = anyFlag ? "Blocked" : anyWarn ? "Review" : "Ready";
  const outFill = anyFlag ? "hsl(0, 84%, 60%)" : anyWarn ? "hsl(38, 92%, 50%)" : "hsl(142, 71%, 45%)";
  const outStroke = anyFlag ? "hsl(0, 84%, 45%)" : anyWarn ? "hsl(38, 92%, 40%)" : "hsl(142, 71%, 35%)";

  const agentRight = AGENT_X + AGENT_W;
  const checkRight = CHECK_X + CHECK_W;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", maxWidth: "100%" }}
      aria-label="Decision tracing diagram"
    >
      <rect
        x={AGENT_X}
        y={midY - AGENT_H / 2}
        width={AGENT_W}
        height={AGENT_H}
        rx={8}
        fill="hsl(213, 100%, 17%)"
        stroke="hsl(25, 62%, 15%)"
        strokeWidth={1.5}
      />
      <text x={AGENT_X + AGENT_W / 2} y={midY - 8} textAnchor="middle" fontSize={10} fontFamily="var(--font-sans)" fontWeight="600" fill="hsl(36, 33%, 94%)">
        Agent Decision
      </text>
      <text x={AGENT_X + AGENT_W / 2} y={midY + 8} textAnchor="middle" fontSize={9} fontFamily="var(--font-sans)" fill="hsl(36, 30%, 75%)">
        Mortgage Agentic
      </text>
      <text x={AGENT_X + AGENT_W / 2} y={midY + 20} textAnchor="middle" fontSize={9} fontFamily="var(--font-sans)" fill="hsl(36, 30%, 75%)">
        Workbench Agent
      </text>

      {list.map((check, i) => {
        const y = stackTop + i * ROW_GAP;
        const cx = CHECK_X + CHECK_W / 2;
        const cy = y + CHECK_H / 2;
        const inMid = agentRight + (CHECK_X - agentRight) * 0.5;
        const outMid = checkRight + (OUT_X - checkRight) * 0.5;
        const fill = verdictFill(check.verdict);
        return (
          <g key={check.name}>
            <path
              d={`M ${agentRight} ${midY} C ${inMid} ${midY} ${inMid} ${cy} ${CHECK_X} ${cy}`}
              fill="none"
              stroke={fill}
              strokeWidth={1.5}
              opacity={0.7}
            />
            <path
              d={`M ${checkRight} ${cy} C ${outMid} ${cy} ${outMid} ${midY} ${OUT_X} ${midY}`}
              fill="none"
              stroke={fill}
              strokeWidth={1.5}
              opacity={0.7}
            />
            <rect x={CHECK_X} y={y} width={CHECK_W} height={CHECK_H} rx={6} fill={fill} stroke={verdictStroke(check.verdict)} strokeWidth={1} />
            <text x={cx} y={cy - 6} textAnchor="middle" fontSize={9.5} fontFamily="var(--font-sans)" fontWeight="600" fill="#fff">
              {check.name.length > 20 ? check.name.slice(0, 20) + "…" : check.name}
            </text>
            <text x={cx} y={cy + 9} textAnchor="middle" fontSize={9} fontFamily="var(--font-sans)" fontWeight="500" fill="rgba(255,255,255,0.9)">
              {check.verdict.toUpperCase()}
            </text>
          </g>
        );
      })}

      {list.length === 0 && (
        <g>
          <rect x={CHECK_X} y={stackTop} width={CHECK_W} height={CHECK_H} rx={6} fill="hsl(30, 15%, 85%)" stroke="hsl(30, 15%, 75%)" strokeWidth={1} />
          <text x={CHECK_X + CHECK_W / 2} y={stackTop + CHECK_H / 2 + 4} textAnchor="middle" fontSize={9} fontFamily="var(--font-sans)" fill="hsl(25, 20%, 45%)">
            No checks
          </text>
          <path
            d={`M ${agentRight} ${midY} C ${(agentRight + CHECK_X) / 2} ${midY} ${(agentRight + CHECK_X) / 2} ${stackTop + CHECK_H / 2} ${CHECK_X} ${stackTop + CHECK_H / 2}`}
            fill="none"
            stroke="hsl(30, 15%, 75%)"
            strokeWidth={1.5}
            opacity={0.7}
          />
          <path
            d={`M ${checkRight} ${stackTop + CHECK_H / 2} C ${(checkRight + OUT_X) / 2} ${stackTop + CHECK_H / 2} ${(checkRight + OUT_X) / 2} ${midY} ${OUT_X} ${midY}`}
            fill="none"
            stroke="hsl(30, 15%, 75%)"
            strokeWidth={1.5}
            opacity={0.7}
          />
        </g>
      )}

      <rect x={OUT_X} y={midY - OUT_H / 2} width={OUT_W} height={OUT_H} rx={8} fill={outFill} stroke={outStroke} strokeWidth={1.5} />
      <text x={OUT_X + OUT_W / 2} y={midY - 7} textAnchor="middle" fontSize={9} fontFamily="var(--font-sans)" fill="rgba(255,255,255,0.85)">
        Output
      </text>
      <text x={OUT_X + OUT_W / 2} y={midY + 9} textAnchor="middle" fontSize={11} fontFamily="var(--font-sans)" fontWeight="700" fill="#fff">
        {outcome}
      </text>
    </svg>
  );
}
