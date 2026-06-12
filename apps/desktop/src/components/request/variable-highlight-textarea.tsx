import {
  forwardRef,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import { TextArea } from "@/components/ui/textarea";
import { useEnvironmentStore } from "@/stores/environment-store";
import { splitVariableSegments, VariableEditor } from "./variable-highlight-input";

type VariableHighlightTextAreaProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Classes applied to the underlying <TextArea> (border, bg, sizing, padding). */
  className?: string;
  /**
   * Alignment-critical classes for the highlight overlay. Must carry the SAME
   * horizontal padding and font size as `className` so the painted chips line
   * up with the real text underneath (e.g. "px-4 text-sm").
   */
  overlayClassName?: string;
  rows?: number;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  "aria-label"?: string;
};

/**
 * A multiline textarea that paints each `{{variable}}` reference as an
 * interactive chip — hover to preview the resolved value and its source
 * environment, click to edit it inline. The real textarea text is hidden behind
 * a colored overlay while the field is blurred; focusing reveals the raw text
 * for editing. Resolved values come from the shared environment store, so every
 * input across the request reads one cached map instead of resolving its own.
 *
 * Mirrors {@link VariableHighlightInput} but backed by a `<textarea>` with
 * multi-line overlay alignment (`items-start` + `whitespace-pre-wrap`).
 */
export const VariableHighlightTextArea = forwardRef<
  HTMLTextAreaElement,
  VariableHighlightTextAreaProps
>(function VariableHighlightTextArea(
  {
    value,
    onChange,
    placeholder,
    disabled,
    className = "",
    overlayClassName = "",
    rows = 3,
    onKeyDown,
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
      <TextArea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        aria-label={ariaLabel}
        style={showOverlay ? { WebkitTextFillColor: "transparent" } : undefined}
        className={`${className} ${
          showOverlay
            ? "text-transparent caret-[var(--color-text-primary)]"
            : "text-[var(--color-text-primary)]"
        }`}
      />
      {showOverlay && (
        <div
          className={`pointer-events-none absolute inset-0 flex items-start overflow-y-auto ${overlayClassName}`}
          aria-hidden="true"
        >
          <div className="whitespace-pre-wrap">
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
