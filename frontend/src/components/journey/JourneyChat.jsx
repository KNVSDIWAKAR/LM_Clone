import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles, Square } from "lucide-react";
import useAgentChat from "../../hooks/useAgentChat";
import ChatMessage from "../chat/ChatMessage";
import PipelineSteps from "../chat/PipelineSteps";

const mutedFg = { color: "hsl(var(--muted-foreground))" };

/**
 * Journey-scoped copilot. Every message carries `journeyId` and the dashboard
 * `contextPreamble`, so the agent answers about the records on screen.
 *
 * - `prefill` + `prefillNonce`: drop text into the composer (e.g. "Ask about this loan").
 * - `runSignal` + `runPrompt`: bump the signal to fire `runPrompt` immediately.
 */
export default function JourneyChat({
  journeyId,
  nudges,
  title,
  prefill,
  prefillNonce,
  contextPreamble,
  runSignal,
  runPrompt,
  onStreamingChange,
}) {
  const { messages, pipelineSteps, isStreaming, sendMessage, stopStream } = useAgentChat();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pipelineSteps]);

  const lastPrefill = useRef(undefined);
  useEffect(() => {
    if (prefillNonce === undefined || prefillNonce === lastPrefill.current || !prefill) return;
    lastPrefill.current = prefillNonce;
    setDraft(prefill);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [prefillNonce, prefill]);

  useEffect(() => {
    onStreamingChange?.(isStreaming);
  }, [isStreaming, onStreamingChange]);

  const lastRun = useRef(undefined);
  useEffect(() => {
    if (runSignal === undefined || runSignal <= 0 || runSignal === lastRun.current || !runPrompt || isStreaming) return;
    lastRun.current = runSignal;
    sendMessage(runPrompt, { journeyId, augment: contextPreamble });
  }, [runSignal, runPrompt, isStreaming, sendMessage, journeyId, contextPreamble]);

  const submit = useCallback(() => {
    const text = draft.trim();
    if (!text || isStreaming) return;
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    sendMessage(text, { journeyId, augment: contextPreamble });
  }, [draft, isStreaming, sendMessage, journeyId, contextPreamble]);

  const ask = useCallback(
    (question) => {
      if (!isStreaming) sendMessage(question, { journeyId, augment: contextPreamble });
    },
    [isStreaming, sendMessage, journeyId, contextPreamble],
  );

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submit();
      }
    },
    [submit],
  );

  const reversedIdx = [...messages].reverse().findIndex((m) => m.role === "agent");
  const lastAgentIdx = reversedIdx !== -1 ? messages.length - 1 - reversedIdx : -1;
  const hasDraft = draft.trim().length > 0;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto mb-3">
        {messages.length === 0 ? (
          <div className="flex flex-col h-full justify-center gap-7 px-1">
            <div className="flex flex-col items-center text-center gap-3">
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 44, height: 44, background: "hsl(var(--muted))" }}
              >
                <Sparkles size={20} style={{ color: "hsl(var(--primary))" }} />
              </div>
              <p className="font-sans text-sm" style={mutedFg}>
                Ask me anything about {title ?? "this journey"}
              </p>
            </div>
            {nudges.length > 0 && (
              <div>
                <p className="font-sans text-xs font-semibold uppercase tracking-wide mb-1.5 px-1" style={mutedFg}>
                  Suggested questions
                </p>
                <div className="flex flex-col">
                  {nudges.map((q) => (
                    <button
                      key={q}
                      onClick={() => ask(q)}
                      disabled={isStreaming}
                      className="text-left font-sans text-sm px-1 py-2.5 border-b last:border-b-0 transition-colors hover:brightness-95"
                      style={{
                        color: "hsl(var(--foreground))",
                        borderColor: "hsl(var(--border))",
                        cursor: isStreaming ? "not-allowed" : "pointer",
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((message, i) => (
            <Fragment key={i}>
              {i === lastAgentIdx && (isStreaming || pipelineSteps.length > 0) && message.role === "agent" && (
                <PipelineSteps steps={pipelineSteps} isStreaming={isStreaming} />
              )}
              <ChatMessage message={message} />
            </Fragment>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className="flex-none rounded border px-3 py-2"
        style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)" }}
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask a question or send a command..."
            disabled={isStreaming}
            className="flex-1 resize-none font-sans text-sm outline-none bg-transparent leading-relaxed"
            style={{
              color: "hsl(var(--foreground))",
              caretColor: "hsl(var(--primary))",
              minHeight: "36px",
              maxHeight: "120px",
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={isStreaming ? stopStream : submit}
            disabled={!isStreaming && !hasDraft}
            className="flex-none flex items-center justify-center w-8 h-8 rounded transition-colors"
            style={{
              background: isStreaming ? "hsl(0, 84%, 60%)" : hasDraft ? "hsl(var(--primary))" : "hsl(var(--muted))",
              color: isStreaming || hasDraft ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
            }}
            aria-label={isStreaming ? "Stop" : "Send"}
          >
            {isStreaming ? <Square size={14} fill="currentColor" /> : <Send size={14} />}
          </button>
        </div>
        <p className="mt-1.5 text-xs font-sans" style={mutedFg}>
          AI can make mistakes. Verify critical loan data.
        </p>
      </div>
    </div>
  );
}
