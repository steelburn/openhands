import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { usePostHogIdentify } from "#/hooks/use-posthog-identify";
import * as useConfigModule from "#/hooks/query/use-config";
import * as useMeModule from "#/hooks/query/use-me";
import * as useGitUserModule from "#/hooks/query/use-git-user";

const mockIdentify = vi.fn();
vi.mock("posthog-js/react", () => ({
  usePostHog: vi.fn(() => ({
    identify: mockIdentify,
  })),
}));
vi.mock("#/hooks/query/use-config");
vi.mock("#/hooks/query/use-me");
vi.mock("#/hooks/query/use-git-user");

describe("usePostHogIdentify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMeModule.useMe).mockReturnValue({
      data: undefined,
    } as any);
    vi.mocked(useGitUserModule.useGitUser).mockReturnValue({
      data: undefined,
    } as any);
  });

  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };

  it("should identify with keycloak user_id in SaaS mode", async () => {
    vi.mocked(useConfigModule.useConfig).mockReturnValue({
      data: { app_mode: "saas" },
    } as any);
    vi.mocked(useMeModule.useMe).mockReturnValue({
      data: { user_id: "keycloak-123", email: "user@example.com" },
    } as any);

    renderHook(() => usePostHogIdentify(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockIdentify).toHaveBeenCalledWith("keycloak-123", {
        email: "user@example.com",
      });
    });
  });

  it("should identify with git login in OSS mode", async () => {
    vi.mocked(useConfigModule.useConfig).mockReturnValue({
      data: { app_mode: "oss" },
    } as any);
    vi.mocked(useGitUserModule.useGitUser).mockReturnValue({
      data: {
        login: "devuser",
        name: "Dev User",
        email: "dev@example.com",
        company: "Acme",
      },
    } as any);

    renderHook(() => usePostHogIdentify(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockIdentify).toHaveBeenCalledWith("devuser", {
        company: "Acme",
        name: "Dev User",
        email: "dev@example.com",
        user: "devuser",
        mode: "oss",
      });
    });
  });

  it("should not identify when config is not loaded", () => {
    vi.mocked(useConfigModule.useConfig).mockReturnValue({
      data: undefined,
    } as any);

    renderHook(() => usePostHogIdentify(), { wrapper: createWrapper() });

    expect(mockIdentify).not.toHaveBeenCalled();
  });

  it("should not identify in SaaS mode until me data is available", () => {
    vi.mocked(useConfigModule.useConfig).mockReturnValue({
      data: { app_mode: "saas" },
    } as any);
    vi.mocked(useMeModule.useMe).mockReturnValue({
      data: undefined,
    } as any);

    renderHook(() => usePostHogIdentify(), { wrapper: createWrapper() });

    expect(mockIdentify).not.toHaveBeenCalled();
  });

  it("should only identify once even when data changes", async () => {
    vi.mocked(useConfigModule.useConfig).mockReturnValue({
      data: { app_mode: "saas" },
    } as any);
    vi.mocked(useMeModule.useMe).mockReturnValue({
      data: { user_id: "keycloak-123", email: "user@example.com" },
    } as any);

    const { rerender } = renderHook(() => usePostHogIdentify(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockIdentify).toHaveBeenCalledTimes(1);
    });

    // Rerender to simulate data changes
    rerender();

    expect(mockIdentify).toHaveBeenCalledTimes(1);
  });
});
