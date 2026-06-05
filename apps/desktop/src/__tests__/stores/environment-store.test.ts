import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEnvironmentStore } from "@/stores/environment-store";

// Mock the Tauri API
vi.mock("@/lib/tauri-api", () => ({
  loadEnvironments: vi.fn().mockResolvedValue([
    { name: "development", variables: { baseUrl: "http://localhost:3000", apiKey: "dev-key" }, secrets: [] },
    { name: "production", variables: { baseUrl: "https://api.prod.com" }, secrets: ["apiKey"] },
  ]),
  getResolvedVariables: vi.fn().mockResolvedValue({
    baseUrl: "http://localhost:3000",
    apiKey: "dev-key",
  }),
  saveEnvironment: vi.fn().mockResolvedValue(undefined),
  loadRootDotenv: vi.fn().mockResolvedValue({}),
}));

import { saveEnvironment } from "@/lib/tauri-api";

describe("Environment Store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useEnvironmentStore.setState({
      environments: [],
      activeEnvironmentName: null,
      activeCollectionPath: null,
      runtimeOverrides: {},
      resolvedVariables: {},
    });
  });

  it("loads environments from collection", async () => {
    await useEnvironmentStore.getState().loadEnvironments("/test/collection");
    const state = useEnvironmentStore.getState();
    expect(state.environments).toHaveLength(2);
    expect(state.environments[0].name).toBe("development");
    expect(state.environments[1].name).toBe("production");
    expect(state.activeCollectionPath).toBe("/test/collection");
  });

  it("auto-selects first environment", async () => {
    await useEnvironmentStore.getState().loadEnvironments("/test/collection");
    expect(useEnvironmentStore.getState().activeEnvironmentName).toBe("development");
  });

  it("sets active environment", async () => {
    await useEnvironmentStore.getState().loadEnvironments("/test/collection");
    useEnvironmentStore.getState().setActiveEnvironment("production");
    expect(useEnvironmentStore.getState().activeEnvironmentName).toBe("production");
  });

  it("applies runtime mutations", () => {
    useEnvironmentStore.getState().applyMutations({
      newVar: "newValue",
      deleteVar: null,
    });
    const overrides = useEnvironmentStore.getState().runtimeOverrides;
    expect(overrides.newVar).toBe("newValue");
  });

  it("caches resolved variables after loading a collection", async () => {
    await useEnvironmentStore.getState().loadEnvironments("/test/collection");
    expect(useEnvironmentStore.getState().resolvedVariables).toEqual({
      baseUrl: "http://localhost:3000",
      apiKey: "dev-key",
    });
  });

  it("writes a variable into the active environment via setVariable", async () => {
    await useEnvironmentStore.getState().loadEnvironments("/test/collection");
    await useEnvironmentStore.getState().setVariable("baseUrl", "http://changed");

    expect(saveEnvironment).toHaveBeenCalledWith(
      "/test/collection",
      expect.objectContaining({
        name: "development",
        variables: expect.objectContaining({ baseUrl: "http://changed" }),
      }),
    );
  });

  it("ignores setVariable when no environment is active", async () => {
    useEnvironmentStore.setState({ activeCollectionPath: "/test/collection" });
    await useEnvironmentStore.getState().setVariable("baseUrl", "x");
    expect(saveEnvironment).not.toHaveBeenCalled();
  });
});
