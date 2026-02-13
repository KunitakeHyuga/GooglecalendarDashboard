# Google Calendar Dashboard (GitHub Pages)

Googleアカウントでブラウザ認証し、Googleカレンダーの予定時間を可視化・CRUDできるダッシュボードです。

## 構成

- フロントエンド: React + Tailwind + Chart.js + FullCalendar
- 認証: Google Identity Services（ブラウザ内OAuth）
- API: ブラウザから Google Calendar REST API を直接実行
- バックエンド: 不要（GitHub Pagesで配信）

## 事前準備（Google Cloud）

1. Google Cloud でプロジェクト作成
2. `Google Calendar API` を有効化
3. OAuth 同意画面を設定
4. OAuth クライアントID（Webアプリ）を作成
5. 承認済み JavaScript 生成元に以下を追加
   - ローカル: `http://localhost:3000`
   - 本番: `https://<GitHubユーザー名>.github.io`
   - 本番（project pages）: `https://<GitHubユーザー名>.github.io/<リポジトリ名>`

## 設定

`public/app-config.js` と `docs/app-config.js` の `googleClientId` を設定:

```js
window.APP_CONFIG = {
  googleClientId: 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com'
};
```

## ローカル起動

```bash
npm install
npm run dev
```

## GitHub Pages デプロイ

1. リポジトリの `Settings > Pages > Source` を `GitHub Actions` に設定
2. `main` ブランチへ push
3. Actions の `Deploy GitHub Pages` が完了すると公開

Pages 配信用ファイルは `docs/` 配下です。
