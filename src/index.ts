import { fetchCopilotQuota } from "./github";
import { buildSlackPayload, sendSlackNotification } from "./slack";
import type { QuotaParams } from "./types";

export function calcDaysRemaining(resetDateUtc: string): number {
  const now = new Date();
  const resetDate = new Date(resetDateUtc);
  const diffMs = resetDate.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function printQuotaToConsole(params: QuotaParams): void {
  const { remaining, entitlement, percentRemaining, unlimited, resetDate, daysRemaining } = params;
  const resetDateFormatted = resetDate.split("T")[0];
  const usageLine = unlimited
    ? "無制限"
    : `残量: ${remaining} / ${entitlement} (${percentRemaining.toFixed(1)}%)`;

  console.log("");
  console.log("=== GitHub Copilot Premium Request 使用状況 ===");
  console.log(`📊 ${usageLine}`);
  console.log(`🗓️  リセット日: ${resetDateFormatted}`);
  console.log(`📅  残り日数:   ${daysRemaining} 日`);
  console.log("================================================");
  console.log("");
}

export async function main(): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  console.log("Fetching Copilot quota...");
  const response = await fetchCopilotQuota();

  const premium = response.quota_snapshots.premium_interactions;
  const daysRemaining = calcDaysRemaining(response.quota_reset_date_utc);

  const quotaParams = {
    remaining: premium.remaining,
    entitlement: premium.entitlement,
    percentRemaining: premium.percent_remaining,
    unlimited: premium.unlimited,
    resetDate: response.quota_reset_date_utc,
    daysRemaining,
  };

  if (!webhookUrl) {
    console.warn("[WARN] SLACK_WEBHOOK_URL is not set. Printing quota to console instead.");
    printQuotaToConsole(quotaParams);
    return;
  }

  const payload = buildSlackPayload(quotaParams);

  console.log("Sending Slack notification...");
  await sendSlackNotification(webhookUrl, payload);
  console.log("Done.");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
