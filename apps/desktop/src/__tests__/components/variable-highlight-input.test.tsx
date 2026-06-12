import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  VariableHighlightInput,
  splitVariableSegments,
} from "@/components/request/variable-highlight-input";
import { useEnvironmentStore } from "@/stores/environment-store";

// The store imports the real Tauri bridge at module load; stub it like the
// other suites so jsdom never tries to resolve @tauri-apps.
vi.mock("@/lib/tauri-api", () => ({
  loadEnvironments: vi.fn().mockResolvedValue([]),
  getResolvedVariables: vi.fn().mockResolvedValue({}),
  saveEnvironment: vi.fn().mockResolvedValue(undefined),
  loadRootDotenv: vi.fn().mockResolvedValue({}),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("splitVariableSegments", () => {
  it("returns a single text segment when there are no variables", () => {
    expect(splitVariableSegments("https://api.example.com")).toEqual([
      { type: "text", value: "https://api.example.com" },
    ]);
  });

  it("splits text and variable references in order", () => {
    expect(splitVariableSegments("{{base}}/users/{{id}}")).toEqual([
      { type: "var", value: "base" },
      { type: "text", value: "/users/" },
      { type: "var", value: "id" },
    ]);
  });

  it("matches names with hyphens and dots (backend regex parity, #98)", () => {
    expect(splitVariableSegments("{{bff-host}}/{{api.key}}")).toEqual([
      { type: "var", value: "bff-host" },
      { type: "text", value: "/" },
      { type: "var", value: "api.key" },
    ]);
  });
});

describe("VariableHighlightInput", () => {
  beforeEach(() => {
    useEnvironmentStore.setState({
      environments: [],
      activeEnvironmentName: "development",
      activeCollectionPath: "/test",
      runtimeOverrides: {},
      resolvedVariables: { baseUrl: "http://localhost:3000" },
    });
  });

  it("renders the current value in the text input", () => {
    render(
      <VariableHighlightInput
        value="hello"
        onChange={() => {}}
        aria-label="field"
      />,
    );
    expect((screen.getByLabelText("field") as HTMLInputElement).value).toBe(
      "hello",
    );
  });

  it("paints no chip overlay when the value has no variables", () => {
    render(
      <VariableHighlightInput
        value="https://api.example.com"
        onChange={() => {}}
        aria-label="field"
      />,
    );
    // The colored chip overlay is only rendered when variables are present.
    expect(screen.queryByText(/\{\{/)).not.toBeInTheDocument();
  });

  it("paints one chip per variable reference", () => {
    render(
      <VariableHighlightInput
        value="{{baseUrl}}/users/{{userId}}"
        onChange={() => {}}
        aria-label="field"
      />,
    );
    // Chips live in an aria-hidden decorative overlay, so query by text.
    expect(screen.getByText("{{baseUrl}}")).toBeInTheDocument();
    expect(screen.getByText("{{userId}}")).toBeInTheDocument();
  });

  it("propagates edits through onChange", () => {
    const onChange = vi.fn();
    render(
      <VariableHighlightInput
        value="hello"
        onChange={onChange}
        aria-label="field"
      />,
    );
    fireEvent.change(screen.getByLabelText("field"), {
      target: { value: "world" },
    });
    expect(onChange).toHaveBeenCalledWith("world");
  });
});
