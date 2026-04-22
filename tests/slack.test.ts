import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildSlackPayload, sendSlackNotification } from "../src/slack";
import type { QuotaParams } from "../src/types";

const baseParams: QuotaParams = {
  remaining: 200,
  entitlement: 300,
  percentRemaining: 66.7,
  unlimited: false,
  resetDate: "2026-05-01T00:00:00Z",
  daysRemaining: 9,
  daysTotal: 30,
};

describe("buildSlackPayload", () => {
  describe("unlimited: false の場合", () => {
    it("blocks を3つ返す（header, section×2）", () => {
      const payload = buildSlackPayload(baseParams);
      expect(payload.blocks).toHaveLength(3);
      expect(payload.blocks[0].type).toBe("header");
      expect(payload.blocks[1].type).toBe("section");
      expect(payload.blocks[2].type).toBe("section");
    });

    it("使用量テキストが残量・総量・パーセントを含む", () => {
      const payload = buildSlackPayload(baseParams);
      const text = payload.blocks[1].text?.text ?? "";
      expect(text).toContain("200");
      expect(text).toContain("300");
      expect(text).toContain("66.7%");
    });

    it("プログレスバーが含まれる", () => {
      const payload = buildSlackPayload(baseParams);
      const text = payload.blocks[1].text?.text ?? "";
      expect(text).toContain("█");
      expect(text).toContain("使用済み");
    });

    it("リセット日が YYYY-MM-DD 形式で含まれる", () => {
      const payload = buildSlackPayload(baseParams);
      const text = payload.blocks[2].text?.text ?? "";
      expect(text).toContain("2026-05-01");
    });

    it("残り日数・総日数が含まれる", () => {
      const payload = buildSlackPayload(baseParams);
      const text = payload.blocks[2].text?.text ?? "";
      expect(text).toContain("9 日 / 30 日");
    });
  });

  describe("unlimited: true の場合", () => {
    const unlimitedParams: QuotaParams = { ...baseParams, unlimited: true };

    it("使用量テキストが「無制限」になる", () => {
      const payload = buildSlackPayload(unlimitedParams);
      const text = payload.blocks[1].text?.text ?? "";
      expect(text).toContain("無制限");
    });

    it("プログレスバーが含まれない", () => {
      const payload = buildSlackPayload(unlimitedParams);
      const text = payload.blocks[1].text?.text ?? "";
      expect(text).not.toContain("使用済み");
    });
  });

  it("使用率 0% のときプログレスバーが空（░のみ）", () => {
    const params: QuotaParams = { ...baseParams, percentRemaining: 100 };
    const payload = buildSlackPayload(params);
    const text = payload.blocks[1].text?.text ?? "";
    expect(text).not.toContain("█");
    expect(text).toContain("░");
  });

  it("使用率 100% のときプログレスバーが満杯（█のみ）", () => {
    const params: QuotaParams = { ...baseParams, percentRemaining: 0 };
    const payload = buildSlackPayload(params);
    const text = payload.blocks[1].text?.text ?? "";
    expect(text).toContain("█");
    expect(text).not.toContain("░");
  });
});

describe("sendSlackNotification", () => {
  const mockPayload = buildSlackPayload(baseParams);

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetch が ok:true のとき正常終了する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    await expect(
      sendSlackNotification("https://hooks.slack.com/test", mockPayload)
    ).resolves.toBeUndefined();
  });

  it("fetch が ok:false のときエラーをスローする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "invalid_payload",
      })
    );

    await expect(
      sendSlackNotification("https://hooks.slack.com/test", mockPayload)
    ).rejects.toThrow("Slack webhook failed: 400 Bad Request - invalid_payload");
  });

  it("fetch が ok:false のときエラーメッセージにステータスコードが含まれる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () => "no_permission",
      })
    );

    await expect(
      sendSlackNotification("https://hooks.slack.com/test", mockPayload)
    ).rejects.toThrow("403");
  });

  it("正しい Content-Type ヘッダーで fetch が呼ばれる", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);

    await sendSlackNotification("https://hooks.slack.com/test", mockPayload);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://hooks.slack.com/test",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });
});
