import { fetchCopilotQuota } from "./github";
import { buildSlackPayload, sendSlackNotification } from "./slack";

function calcDaysRemaining(resetDateUtc: string): {
  daysRemaining: number;
  daysTotal: number;
} {
  const now = new Date();
  const resetDate = new Date(resetDateUtc);
  const diffMs = resetDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const nextMonthStart = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1));
  const thisMonthStart = new Date(Date.UTC(year, month - 1, 1));
  const daysTotal = Math.round(
    (nextMonthStart.getTime() - thisMonthStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  return { daysRemaining, daysTotal };
}

function printQuotaToConsole(params: {
  remaining: number;
  entitlement: number;
  percentRemaining: number;
  unlimited: boolean;
  resetDate: string;
  daysRemaining: number;
  daysTotal: number;
}): void {
  const { remaining, entitlement, percentRemaining, unlimited, resetDate, daysRemaining, daysTotal } = params;
  const resetDateFormatted = resetDate.split("T")[0];
  const usageLine = unlimited
    ? "無制限"
    : `残量: ${remaining} / ${entitlement} (${percentRemaining.toFixed(1)}%)`;

  console.log("");
  console.log("=== GitHub Copilot Premium Request 使用状況 ===");
  console.log(`📊 Premium Interactions: ${usageLine}`);
  console.log(`🗓️  リセット日: ${resetDateFormatted}`);
  console.log(`📅  残り日数:   ${daysRemaining} 日 / ${daysTotal} 日`);
  console.log("================================================");
  console.log("");
}

async function main(): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  console.log("Fetching Copilot quota...");
  const response = fetchCopilotQuota();

  const premium = response.quota_snapshots.premium_interactions;
  const { daysRemaining, daysTotal } = calcDaysRemaining(
    response.quota_reset_date_utc
  );

  const quotaParams = {
    remaining: premium.remaining,
    entitlement: premium.entitlement,
    percentRemaining: premium.percent_remaining,
    unlimited: premium.unlimited,
    resetDate: response.quota_reset_date_utc,
    daysRemaining,
    daysTotal,
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

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
