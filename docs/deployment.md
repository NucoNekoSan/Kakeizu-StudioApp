# 配信手順（Cloudflare Pages）

取得済み独自ドメインのサブドメインで公開する手順。利用者のデータは端末内にのみ保存されるため、サーバー側に永続化の設定は不要。

## 1. ビルド

```powershell
npm ci
npm run build
```

`dist` に配信物が生成される。`dist/_headers` と `dist/_redirects` が Cloudflare Pages の設定として読まれる。

## 2. Cloudflare Pages プロジェクトの作成

Cloudflare ダッシュボード → Workers & Pages → Create → Pages。

GitHub 連携で作る場合のビルド設定:

| 項目                   | 値              |
| ---------------------- | --------------- |
| Framework preset       | None            |
| Build command          | `npm run build` |
| Build output directory | `dist`          |
| Node version           | 22              |

環境変数は不要（`VITE_BASE_PATH` はサブドメイン運用では未設定でよい）。

手元から直接上げる場合は Wrangler を使う。

```powershell
npx wrangler pages deploy dist --project-name kakeizu-studio
```

## 3. サブドメインの割り当て

プロジェクト → Custom domains → Set up a custom domain で `kakeizu.nuconeko-garden.com` を追加する。メインドメイン `nuconeko-garden.com` を同一アカウントで管理しているため、CNAME は自動で作成される。

## 4. HTTPS の強制

SSL/TLS → Edge Certificates で次を有効にする。

- **Always Use HTTPS**: オン
- **HSTS (HTTP Strict Transport Security)**: 有効化し、`max-age` は 6 か月以上。サブドメインを他用途に使っていない場合のみ `includeSubDomains` を付ける
- **Minimum TLS Version**: 1.2

v2 系で `.htaccess` が行っていた HTTP→HTTPS の 308 転送は、この設定が代わりを果たす。

## 5. 配信後の確認

```powershell
curl.exe -I https://kakeizu.nuconeko-garden.com/
```

- `Content-Security-Policy` が返ること
- `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY` が返ること
- `curl.exe -I https://kakeizu.nuconeko-garden.com/sw.js` が `Cache-Control: no-cache` を返すこと
- HTTP でアクセスすると HTTPS へ転送されること

ブラウザでの確認:

- DevTools の Console に CSP 違反が出ないこと
- Application → Service Workers が activated になっていること
- Application → Manifest に警告が出ず、インストール可能と表示されること
- **Network タブで、自オリジン以外への通信が 1 件も無いこと**（組織の導入審査で問われる点。スクリーンショットを残しておくと説明しやすい）
- オフラインに切り替えてリロードしても動作すること

## 6. インストール（ローカル利用版）

配信した URL を Windows の Edge / Chrome で開き、アドレスバー右のインストールアイコン、またはメニューの「アプリとしてインストール」を選ぶ。スタートメニューに登録され、独立したウィンドウで起動する。以降はオフラインでも利用できる。

コード署名が不要なため、SmartScreen の警告は出ない。

## 7. 更新の反映

`registerType: "prompt"` のため、新しいバージョンを配信しても自動では切り替わらない。利用者の画面に「新しいバージョンがあります」のバーが出て、「更新する」を押したときに適用される。編集途中の入力を失わせないための挙動。

## 注意

- `_headers` の CSP を緩める変更は、`src/__tests__/delivery.test.ts` が検知する。緩める必要が生じた場合は理由を [architecture-decisions.md](architecture-decisions.md) に記録する
- アクセス解析・エラー監視の類は入れていない。入れると改正電気通信事業法の外部送信規律の対象になり、「外部送信ゼロ」という説明が使えなくなる
