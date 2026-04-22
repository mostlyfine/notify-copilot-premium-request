import { execSync } from "child_process";

export interface QuotaEntry {
  entitlement: number;
  remaining: number;
  unlimited: boolean;
  percent_remaining: number;
}

export interface QuotaSnapshots {
  chat: QuotaEntry;
  completions: QuotaEntry;
  premium_interactions: QuotaEntry;
}

export interface CopilotUserResponse {
  quota_snapshots: QuotaSnapshots;
  quota_reset_date_utc: string;
}

/**
 * gh api CLI を使って /copilot_internal/user を呼び出し、
 * 現在の Copilot クォータ情報を取得する。
 * gh の組み込み認証を使用するため、追加の認証設定が不要。
 */
export function fetchCopilotQuota(): CopilotUserResponse {
  const output = execSync("gh api /copilot_internal/user", {
    encoding: "utf-8",
  });
  return JSON.parse(output) as CopilotUserResponse;
}
