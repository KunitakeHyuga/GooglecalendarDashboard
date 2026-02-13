# Google Calendar Dashboard

Googleアカウントでログインし、Googleカレンダーの予定時間をカレンダー別に集計・可視化し、同じ画面から予定追加もできるダッシュボードです。

## 機能

- Google OAuth ログイン
- React + Tailwind ベースのダッシュボードUI
- カレンダー一覧取得
- 期間指定でカレンダー別の利用時間（時間・件数）を集計
- 棒グラフ表示（Chart.js）
- 予定追加

## 事前準備（Google Cloud）

1. Google Cloud でプロジェクト作成
2. `Google Calendar API` を有効化
3. OAuth 同意画面を設定
4. OAuth クライアントID（Webアプリ）を作成
5. 承認済みリダイレクトURIに以下を追加
   - `http://localhost:3000/auth/google/callback`

## セットアップ

```bash
cp .env.example .env
npm install
npm run dev
```

`.env` の値をGoogle Cloudで発行した値に置き換えてください。

## 起動

- `http://localhost:3000` にアクセス
- Googleログイン後にダッシュボードを利用

## 補足

- 初回ログイン時に `calendar` スコープ（読み書き）を要求します。
- 集計は選択期間内の各イベントの開始/終了差分（分）を合算して算出しています。
