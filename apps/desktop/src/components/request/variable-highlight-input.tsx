import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import * as Popover from "@radix-ui/react-popover";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Loader2, AlertCircle, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useEnvironmentStore } from "@/stores/environment-store";
import { variableRegex } from "@/lib/variables";

/** Split a string into segments of plain text and {{variable}} references. */
export function splitVariableSegments(
  text: string,
): { type: "text" | "var"; value: string }[] {
  const segments: { type: "text" | "var"; value: string }[] = [];
  const regex = variableRegex();
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "var", value: match[1] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

/** Inline popover for editing a single variable value. */
function VariableEditor({
  varName,
  resolved,
  onSave,
  activeEnvName,
}: {
  varName: string;
  resolved: string | undefined;
  onSave: (name: string, value: string) => Promise<void>;
  activeEnvName: string | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(resolved ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when resolved value changes externally
  useEffect(() => {
    if (!open) setDraft(resolved ?? "");
  }, [resolved, open]);

  // Auto-focus input when popover opens
  useEffect(() => {
    if (open) {
      // Small delay so Radix finishes mounting
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  const handleSave = async () => {
    if (draft === (resolved ?? "") && resolved !== undefined) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(varName, draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const isUnresolved = resolved === undefined;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* Hover tooltip — preview the resolved value and its source without
          opening the editor (Postman-style). Click still opens the editor. */}
      <Tooltip.Provider delayDuration={200}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <Popover.Trigger asChild>
              <button
                type="button"
                className={`inline rounded px-0.5 font-mono transition-colors ${
                  isUnresolved
                    ? "text-[var(--color-warning)] bg-[var(--color-warning)]/10 hover:bg-[var(--color-warning)]/20"
                    : "text-[var(--color-accent)] bg-[var(--color-accent)]/10 hover:bg-[var(--color-accent)]/20"
                }`}
              >
                {`{{${varName}}}`}
              </button>
            </Popover.Trigger>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="top"
              align="start"
              sideOffset={6}
              className="z-50 max-w-xs rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-2.5 py-2 text-xs shadow-xl"
            >
              <p className="font-mono text-[var(--color-accent)]">{`{{${varName}}}`}</p>
              <p className="mt-1 break-all text-[var(--color-text-primary)]">
                {isUnresolved ? (
                  <span className="text-[var(--color-warning)]">Not set</span>
                ) : resolved === "" ? (
                  <span className="italic text-[var(--color-text-dimmed)]">
                    (empty string)
                  </span>
                ) : (
                  resolved
                )}
              </p>
              <p className="mt-1 text-[10px] text-[var(--color-text-dimmed)]">
                {activeEnvName
                  ? `from ${activeEnvName} · click to edit`
                  : "No environment selected · click to set"}
              </p>
              <Tooltip.Arrow className="fill-[var(--color-border)]" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 shadow-xl"
          sideOffset={8}
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <p className="mb-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
            <span className="font-mono text-[var(--color-accent)]">{`{{${varName}}}`}</span>
          </p>
          {!activeEnvName ? (
            <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning)]/10 px-2.5 py-2 text-xs text-[var(--color-text-secondary)]">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--color-warning)]" />
              <span>Select an environment from the header dropdown first.</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Input
                ref={inputRef}
                type="text"
                value={draft}
                placeholder={`e.g. https://api.example.com`}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSave();
                  }
                  if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                disabled={saving}
                className="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none transition-colors focus:border-[var(--color-accent)]/50 disabled:opacity-50"
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="shrink-0 rounded-md bg-[var(--color-accent)] p-1.5 text-white transition-colors hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
                title={t("common.save")}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}
          {activeEnvName && (
            <p className="mt-2 text-[10px] text-[var(--color-text-dimmed)]">
              Saves to <span className="font-mono">{activeEnvName}</span> environment. Press Enter to save.
            </p>
          )}
          <Popover.Arrow className="fill-[var(--color-border)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

type VariableHighlightInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Classes applied to the underlying <Input> (border, bg, sizing, padding). */
  className?: string;
  /**
   * Alignment-critical classes for the highlight overlay. Must carry the SAME
   * horizontal padding and font size as `className` so the painted chips line
   * up with the real text underneath (e.g. "px-4 text-sm").
   */
  overlayClassName?: string;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  type?: string;
  "aria-label"?: string;
};

/**
 * A drop-in text input that paints each `{{variable}}` reference as an
 * interactive chip — hover to preview the resolved value and its source
 * environment, click to edit it inline. The real input text is hidden behind a
 * colored overlay while the field is blurred; focusing reveals the raw text for
 * editing. Resolved values come from the shared environment store, so every
 * input across the request reads one cached map instead of resolving its own.
 */
export const VariableHighlightInput = forwardRef<
  HTMLInputElement,
  VariableHighlightInputProps
>(function VariableHighlightInput(
  {
    value,
    onChange,
    placeholder,
    disabled,
    className = "",
    overlayClassName = "",
    onKeyDown,
    type = "text",
    "aria-label": ariaLabel,
  },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const resolvedVars = useEnvironmentStore((s) => s.resolvedVariables);
  const activeEnvName = useEnvironmentStore((s) => s.activeEnvironmentName);
  const setVariable = useEnvironmentStore((s) => s.setVariable);

  const segments = useMemo(() => splitVariableSegments(value), [value]);
  const hasVariables = segments.some((s) => s.type === "var");
  const showOverlay = hasVariables && !focused;

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        // macOS WKWebView applies a default -webkit-text-fill-color to text
        // inputs that overrides `color`, so Tailwind's text-transparent alone
        // leaves the raw {{var}} text painted on top of the highlight overlay.
        // Forcing the fill color transparent too hides the real input text so
        // the overlay is the only visible layer. (issue #96)
        style={showOverlay ? { WebkitTextFillColor: "transparent" } : undefined}
        // Own the text color toggle here so the overlay (when shown) is the only
        // visible text layer. Callers must NOT set a text color in `className` —
        // otherwise both classes coexist and the winner depends on Tailwind's
        // generated order, which would re-expose the raw {{var}} text (issue #96).
        className={`${className} ${
          showOverlay
            ? "text-transparent caret-[var(--color-text-primary)]"
            : "text-[var(--color-text-primary)]"
        }`}
      />
      {showOverlay && (
        <div
          className={`pointer-events-none absolute inset-0 flex items-center ${overlayClassName}`}
          aria-hidden="true"
        >
          <div className="flex items-center overflow-hidden whitespace-nowrap">
            {segments.map((seg, i) =>
              seg.type === "text" ? (
                <span key={i} className="text-[var(--color-text-primary)]">
                  {seg.value}
                </span>
              ) : (
                <span key={i} className="pointer-events-auto">
                  <VariableEditor
                    varName={seg.value}
                    resolved={resolvedVars[seg.value]}
                    onSave={setVariable}
                    activeEnvName={activeEnvName}
                  />
                </span>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
});
