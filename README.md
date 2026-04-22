# notify copilot premium request

GitHub Copilot のプレミアムリクエスト使用状況を毎朝 Slack に通知する TypeScript スクリプト。

## 概要

`gh api /copilot_internal/user` を使って現在の Copilot クォータを取得し、Slack に通知します。

**通知内容:**
- Premium Interactions の残量 / 上限 / 使用率
- 請求サイクルのリセット日・残り日数

## 動作要件

- Node.js 20 以上

## セットアップ

### 1. GitHub Personal Access Token (PAT) の作成

1. GitHub Settings → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. 以下の権限を付与:
   - **Copilot** (Read-only) — クォータ情報の取得に必要
3. トークンをコピー

### 2. Slack Incoming Webhook の作成 (Slack通知する場合)

1. [Slack API Apps](https://api.slack.com/apps) にアクセス
2. **Create New App** → **From scratch** を選択
3. **Incoming Webhooks** を有効化し、**Add New Webhook to Workspace** をクリック
4. 通知先チャンネルを選択し、Webhook URL をコピー

### 3. GitHub Actions Secrets の設定

リポジトリの **Settings** → **Secrets and variables** → **Actions** で以下を追加:

| 名前 | 説明 |
|------|------|
| `SLACK_WEBHOOK_URL` | Slack Incoming Webhook URL |
| `GH_TOKEN` | 上記で作成した GitHub PAT |

### 4. ローカル実行

```bash
# 依存関係のインストール
npm install

# 環境変数を設定して実行
export GH_TOKEN="ghp_..."
npm start
```

> **Note:** `SLACK_WEBHOOK_URL` を設定しない場合は Slack への送信をスキップし、使用状況をコンソールに出力します。

## GitHub Actions スケジュール

`.github/workflows/notify.yml` により、毎日 **9:00 AM JST (0:00 UTC)** に自動実行されます。

手動実行も可能: リポジトリの **Actions** タブ → **Copilot Premium Request Monitor** → **Run workflow**

## 通知例

```
🤖 GitHub Copilot Premium Request 使用状況

📊 残量: 150 / 300 (50.0%)
　`[██████████░░░░░░░░░░] 50.0% 使用済み`

🗓️ リセット日: 2026-05-01
📅 残り日数: 9 日
```

## 開発

```bash
# テスト実行
npm test

# テスト（ウォッチモード）
npm run test:watch

# カバレッジ計測
npm run coverage

# 型チェック
npm run typecheck
```

## ライセンス

- MIT
