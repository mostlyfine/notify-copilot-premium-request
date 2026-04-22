export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
}

export interface SlackPayload {
  blocks: SlackBlock[];
}

/**
 * Slack Incoming Webhook へ通知を送信する。
 */
export async function sendSlackNotification(
  webhookUrl: string,
  payload: SlackPayload
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Slack webhook failed: ${response.status} ${response.statusText} - ${body}`
    );
  }
}

/**
 * プレミアムリクエスト使用状況の Slack メッセージを構築する。
 */
export function buildSlackPayload(params: {
  remaining: number;
  entitlement: number;
  percentRemaining: number;
  unlimited: boolean;
  resetDate: string;
  daysRemaining: number;
  daysTotal: number;
}): SlackPayload {
  const {
    remaining,
    entitlement,
    percentRemaining,
    unlimited,
    resetDate,
    daysRemaining,
    daysTotal,
  } = params;

  const usageText = unlimited
    ? "無制限"
    : `残量: *${remaining} / ${entitlement}* (${percentRemaining.toFixed(1)}%)`;

  const usageBar = unlimited ? "" : buildUsageBar(100 - percentRemaining);

  const resetDateFormatted = resetDate.split("T")[0];

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🤖 GitHub Copilot Premium Request 使用状況",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `📊 *Premium Interactions*`,
          `　${usageText}`,
          usageBar ? `　${usageBar}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: [
          `🗓️ リセット日: *${resetDateFormatted}*`,
          `📅 残り日数: *${daysRemaining} 日 / ${daysTotal} 日*`,
        ].join("\n"),
      },
    },
  ];

  return { blocks };
}

/**
 * 使用率に応じたテキストプログレスバーを生成する（0-100%）。
 */
function buildUsageBar(percentUsed: number): string {
  const total = 20;
  const filled = Math.round((percentUsed / 100) * total);
  const empty = total - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `\`[${bar}] ${percentUsed.toFixed(1)}% 使用済み\``;
}
