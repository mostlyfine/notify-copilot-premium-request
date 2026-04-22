import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  exec: vi.fn(),
}));

vi.mock("util", () => ({
  promisify: (fn: unknown) => fn,
}));

import { exec } from "child_process";
import { fetchCopilotQuota } from "../src/github";

const mockExec = vi.mocked(exec as unknown as (cmd: string) => Promise<{ stdout: string }>);

const validResponse = {
  quota_snapshots: {
    chat: { entitlement: 100, remaining: 80, unlimited: false, percent_remaining: 80 },
    completions: { entitlement: 200, remaining: 150, unlimited: false, percent_remaining: 75 },
    premium_interactions: { entitlement: 300, remaining: 200, unlimited: false, percent_remaining: 66.7 },
  },
  quota_reset_date_utc: "2026-05-01T00:00:00Z",
};

describe("fetchCopilotQuota", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gh api の JSON レスポンスをパースして返す", async () => {
    mockExec.mockResolvedValue({ stdout: JSON.stringify(validResponse) });

    const result = await fetchCopilotQuota();

    expect(result).toEqual(validResponse);
    expect(mockExec).toHaveBeenCalledWith("gh api /copilot_internal/user");
  });

  it("gh api が失敗した場合はエラーが伝播する", async () => {
    mockExec.mockRejectedValue(new Error("gh: command not found"));

    await expect(fetchCopilotQuota()).rejects.toThrow("gh: command not found");
  });

  it("JSON のパースに失敗した場合はエラーが伝播する", async () => {
    mockExec.mockResolvedValue({ stdout: "invalid json" });

    await expect(fetchCopilotQuota()).rejects.toThrow(SyntaxError);
  });
});
