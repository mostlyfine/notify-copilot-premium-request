import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { calcDaysRemaining, buildQuotaParams, printQuotaToConsole, main } from "../src/index";
import type { QuotaParams } from "../src/types";
import type { CopilotUserResponse } from "../src/github";

vi.mock("../src/github");
vi.mock("../src/slack");

import { fetchCopilotQuota } from "../src/github";
import { buildSlackPayload, sendSlackNotification } from "../src/slack";

const mockFetchCopilotQuota = vi.mocked(fetchCopilotQuota);
const mockBuildSlackPayload = vi.mocked(buildSlackPayload);
const mockSendSlackNotification = vi.mocked(sendSlackNotification);

// --- calcDaysRemaining ---

describe("calcDaysRemaining", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("リセット日が未来のとき正の値になる", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T09:00:00Z"));

    expect(calcDaysRemaining("2026-05-01T00:00:00Z")).toBe(8);
  });

  it("リセット日が過去のとき 0 になる（負にならない）", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T09:00:00Z"));

    expect(calcDaysRemaining("2026-05-01T00:00:00Z")).toBe(0);
  });

  it("リセット日と現在が同日のとき 0 になる", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T12:00:00Z"));

    expect(calcDaysRemaining("2026-05-01T00:00:00Z")).toBe(0);
  });
});

// --- buildQuotaParams ---

describe("buildQuotaParams", () => {
  const mockResponse: CopilotUserResponse = {
    quota_snapshots: {
      chat: { entitlement: 100, remaining: 80, unlimited: false, percent_remaining: 80 },
      completions: { entitlement: 200, remaining: 150, unlimited: false, percent_remaining: 75 },
      premium_interactions: {
        entitlement: 300,
        remaining: 200,
        unlimited: false,
        percent_remaining: 66.7,
      },
    },
    quota_reset_date_utc: "2026-05-01T00:00:00Z",
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it("premium_interactions のフィールドが QuotaParams にマッピングされる", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T09:00:00Z"));

    const params = buildQuotaParams(mockResponse);

    expect(params.remaining).toBe(200);
    expect(params.entitlement).toBe(300);
    expect(params.percentRemaining).toBe(66.7);
    expect(params.unlimited).toBe(false);
    expect(params.resetDate).toBe("2026-05-01T00:00:00Z");
  });

  it("daysRemaining が quota_reset_date_utc から計算される", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-22T09:00:00Z"));

    const params = buildQuotaParams(mockResponse);

    expect(params.daysRemaining).toBe(8);
  });

  it("unlimited: true の場合も正しくマッピングされる", () => {
    const unlimitedResponse: CopilotUserResponse = {
      ...mockResponse,
      quota_snapshots: {
        ...mockResponse.quota_snapshots,
        premium_interactions: { entitlement: 0, remaining: 0, unlimited: true, percent_remaining: 100 },
      },
    };

    const params = buildQuotaParams(unlimitedResponse);

    expect(params.unlimited).toBe(true);
  });
});

// --- printQuotaToConsole ---

describe("printQuotaToConsole", () => {
  let consoleLogs: string[];

  beforeEach(() => {
    consoleLogs = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      consoleLogs.push(args.join(" "));
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseParams: QuotaParams = {
    remaining: 200,
    entitlement: 300,
    percentRemaining: 66.7,
    unlimited: false,
    resetDate: "2026-05-01T00:00:00Z",
    daysRemaining: 9,
  };

  it("unlimited: false のとき残量・総量・パーセントが出力される", () => {
    printQuotaToConsole(baseParams);
    const output = consoleLogs.join("\n");
    expect(output).toContain("200");
    expect(output).toContain("300");
    expect(output).toContain("66.7%");
  });

  it("unlimited: true のとき「無制限」が出力される", () => {
    printQuotaToConsole({ ...baseParams, unlimited: true });
    const output = consoleLogs.join("\n");
    expect(output).toContain("無制限");
  });

  it("unlimited: true のとき残量・総量は出力されない", () => {
    printQuotaToConsole({ ...baseParams, unlimited: true });
    const output = consoleLogs.join("\n");
    expect(output).not.toMatch(/200 \/ 300/);
  });

  it("リセット日が YYYY-MM-DD 形式（T以降カット）で出力される", () => {
    printQuotaToConsole(baseParams);
    const output = consoleLogs.join("\n");
    expect(output).toContain("2026-05-01");
    expect(output).not.toContain("T00:00:00Z");
  });

  it("残り日数が出力される", () => {
    printQuotaToConsole(baseParams);
    const output = consoleLogs.join("\n");
    expect(output).toContain("9 日");
  });

  it("総日数は出力されない", () => {
    printQuotaToConsole(baseParams);
    const output = consoleLogs.join("\n");
    expect(output).not.toMatch(/9 日 \//);
  });
});

// --- main ---

describe("main", () => {
  const mockResponse = {
    quota_snapshots: {
      chat: { entitlement: 100, remaining: 80, unlimited: false, percent_remaining: 80 },
      completions: { entitlement: 200, remaining: 150, unlimited: false, percent_remaining: 75 },
      premium_interactions: {
        entitlement: 300,
        remaining: 200,
        unlimited: false,
        percent_remaining: 66.7,
      },
    },
    quota_reset_date_utc: "2026-05-01T00:00:00Z",
  };

  const mockPayload = { blocks: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.SLACK_WEBHOOK_URL;

    mockFetchCopilotQuota.mockResolvedValue(mockResponse);
    mockBuildSlackPayload.mockReturnValue(mockPayload);
    mockSendSlackNotification.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("SLACK_WEBHOOK_URL 未設定のとき console.warn が呼ばれる", async () => {
    await main();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("SLACK_WEBHOOK_URL")
    );
  });

  it("SLACK_WEBHOOK_URL 未設定のとき sendSlackNotification は呼ばれない", async () => {
    await main();
    expect(mockSendSlackNotification).not.toHaveBeenCalled();
  });

  it("SLACK_WEBHOOK_URL が設定されているとき sendSlackNotification が呼ばれる", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

    await main();

    expect(mockSendSlackNotification).toHaveBeenCalledWith(
      "https://hooks.slack.com/test",
      mockPayload
    );
  });

  it("SLACK_WEBHOOK_URL が設定されているとき buildSlackPayload が呼ばれる", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

    await main();

    expect(mockBuildSlackPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        remaining: 200,
        entitlement: 300,
        unlimited: false,
      })
    );
  });

  it("fetchCopilotQuota が失敗したとき例外が伝播する", async () => {
    mockFetchCopilotQuota.mockRejectedValue(new Error("gh auth error"));

    await expect(main()).rejects.toThrow("gh auth error");
  });

  it("sendSlackNotification が失敗したとき例外が伝播する", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    mockSendSlackNotification.mockRejectedValue(new Error("Slack webhook failed: 500"));

    await expect(main()).rejects.toThrow("Slack webhook failed: 500");
  });
});
