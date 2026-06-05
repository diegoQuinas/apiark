import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useActiveCollectionEnvironments } from "@/hooks/use-active-collection-environments";
import { useCollectionStore } from "@/stores/collection-store";
import { useEnvironmentStore } from "@/stores/environment-store";
import type { CollectionNode } from "@apiark/types";

vi.mock("@/lib/tauri-api", () => ({
  loadEnvironments: vi.fn().mockResolvedValue([]),
  getResolvedVariables: vi.fn().mockResolvedValue({}),
  loadRootDotenv: vi.fn().mockResolvedValue({}),
}));

function collection(name: string, path: string): CollectionNode {
  return { type: "collection", name, path, children: [] };
}

describe("useActiveCollectionEnvironments", () => {
  beforeEach(() => {
    useCollectionStore.setState({ collections: [] });
  });

  it("loads environments for the first collection when collections are present", () => {
    const loadEnvironments = vi.fn();
    useEnvironmentStore.setState({ loadEnvironments });
    useCollectionStore.setState({
      collections: [collection("Groceries", "/tmp/groceries")],
    });

    renderHook(() => useActiveCollectionEnvironments());

    expect(loadEnvironments).toHaveBeenCalledWith("/tmp/groceries");
  });

  it("does nothing when there are no collections", () => {
    const loadEnvironments = vi.fn();
    useEnvironmentStore.setState({ loadEnvironments });

    renderHook(() => useActiveCollectionEnvironments());

    expect(loadEnvironments).not.toHaveBeenCalled();
  });
});
