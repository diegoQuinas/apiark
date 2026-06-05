import { forwardRef, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import type { HttpMethod } from "@apiark/types";
import { Loader2, Send } from "lucide-react";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { HeaderEnvironmentSelector } from "@/components/environment/header-environment-selector";
import { VariableHighlightInput } from "./variable-highlight-input";

const METHODS: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-emerald-400",
  POST: "text-amber-400",
  PUT: "text-blue-400",
  PATCH: "text-purple-400",
  DELETE: "text-red-400",
  HEAD: "text-cyan-400",
  OPTIONS: "text-gray-400",
};

const METHOD_BG: Record<HttpMethod, string> = {
  GET: "bg-emerald-500/10",
  POST: "bg-amber-500/10",
  PUT: "bg-blue-500/10",
  PATCH: "bg-purple-500/10",
  DELETE: "bg-red-500/10",
  HEAD: "bg-cyan-500/10",
  OPTIONS: "bg-gray-500/10",
};

type UrlBarProps = {
  /** Extra buttons to render between the URL input and the Send button */
  extraActions?: React.ReactNode;
  /** Override the Send button entirely (used by WS/SSE for Connect/Disconnect) */
  sendButton?: React.ReactNode;
  /** Disable URL input (e.g. while WS is connected) */
  urlDisabled?: boolean;
};

export const UrlBar = forwardRef<HTMLInputElement, UrlBarProps>(function UrlBar(
  { extraActions, sendButton, urlDisabled },
  ref,
) {
  const { t } = useTranslation();
  const tab = useActiveTab();
  const { setMethod, setUrl, send } = useTabStore();

  const sendBtnRef = useRef<HTMLButtonElement>(null);

  const flashSendButton = useCallback((success: boolean) => {
    const btn = sendBtnRef.current;
    if (!btn) return;
    const cls = success ? "animate-flash-green" : "animate-flash-red";
    btn.classList.add(cls);
    const onEnd = () => { btn.classList.remove(cls); btn.removeEventListener("animationend", onEnd); };
    btn.addEventListener("animationend", onEnd);
  }, []);

  // Watch for response/error changes to flash the send button
  useEffect(() => {
    if (!tab || tab.loading) return;
    if (tab.response) flashSendButton(tab.response.status < 400);
    else if (tab.error) flashSendButton(false);
  }, [tab?.response, tab?.error, tab?.loading, flashSendButton]);

  if (!tab) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      send();
    }
  };

  return (
    <div data-tour="url-bar" className="flex items-center gap-3 bg-[var(--color-card)] px-4 py-3">
      {/* Method selector — show static badge for non-HTTP protocols */}
      {tab.protocol === "graphql" ? (
        <span className="rounded-lg bg-violet-500/15 px-3 py-2 text-sm font-bold text-violet-400">
          GQL
        </span>
      ) : tab.protocol === "websocket" ? (
        <span className="rounded-lg bg-cyan-500/15 px-3 py-2 text-sm font-bold text-cyan-400">
          WS
        </span>
      ) : tab.protocol === "sse" ? (
        <span className="rounded-lg bg-orange-500/15 px-3 py-2 text-sm font-bold text-orange-400">
          SSE
        </span>
      ) : tab.protocol === "grpc" ? (
        <span className="rounded-lg bg-green-500/15 px-3 py-2 text-sm font-bold text-green-400">
          gRPC
        </span>
      ) : (
        <select
          value={tab.method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          className={`${METHOD_COLORS[tab.method]} ${METHOD_BG[tab.method]} cursor-pointer rounded-lg px-3 py-2 text-sm font-bold outline-none transition-colors focus:ring-2 focus:ring-[var(--color-accent)]/50`}
        >
          {METHODS.map((m) => (
            <option key={m} value={m} className="text-[var(--color-text-primary)] bg-[var(--color-elevated)]">
              {m}
            </option>
          ))}
        </select>
      )}

      {/* URL input with variable highlighting overlay */}
      <div className="flex-1">
        <VariableHighlightInput
          ref={ref}
          value={tab.url}
          onChange={setUrl}
          onKeyDown={handleKeyDown}
          disabled={urlDisabled}
          placeholder={t("request.urlPlaceholder")}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-accent)]/50 focus:ring-2 focus:ring-[var(--color-accent)]/20 disabled:opacity-60 placeholder-[var(--color-text-dimmed)]"
          overlayClassName="px-4 text-sm"
        />
      </div>

      {/* Active environment selector — surfaced in the header so the selected
          environment is always visible and switchable (issue #88) */}
      <HeaderEnvironmentSelector />

      {/* Extra protocol-specific actions */}
      {extraActions}

      {/* Send button (or custom override for WS/SSE) */}
      {sendButton ?? (
        <div className="relative">
          <button
            ref={sendBtnRef}
            data-tour="send-btn"
            onClick={send}
            disabled={tab.loading || !tab.url.trim()}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
          >
            {tab.loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {t("request.send")}
          </button>
          <HintTooltip hintId="send-shortcut" message="Tip: Press Ctrl+Enter to send requests quickly" />
        </div>
      )}
    </div>
  );
});
