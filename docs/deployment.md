# 配信手順（Cloudflare Workers）

取得済み独自ドメインのサブドメインで公開する手順。利用者のデータは端末内にのみ保存されるため、サーバー側に永続化の設定は不要。

## 1. ビルド

```powershell
npm ci
npm run build
```

`dist` に配信物が生成される。`dist/_headers` がセキュリティヘッダとキャッシュ制御の設定として読まれる。

**SPA のルーティングに `_redirects` を置かないこと。** Git 連携で作成したプロジェクトは Workers として構成され（`wrangler deploy` で配信される）、静的アセットの `_redirects` は検証が厳しい。`/* /index.html 200` のような全体を受けるルールは「無限ループ」と判定されてデプロイが失敗する。クライアントルーティングは wrangler 設定の `not_found_handling: "single-page-application"` が担うため、`_redirects` は不要。

## 2. Cloudflare Pages プロジェクトの作成

Cloudflare ダッシュボード → Workers & Pages → Create → Pages。

GitHub 連携で作る場合のビルド設定:

| 項目                   | 値              |
| ---------------------- | --------------- |
| Production branch      | `main`          |
| Framework preset       | None            |
| Build command          | `npm run build` |
| Build output directory | `dist`          |

**Node のバージョンは環境変数で固定する。** Environment variables に `NODE_VERSION` = `22` を追加すること。Pages の既定 Node は古く、指定しないとビルドが失敗することがある。

`VITE_BASE_PATH` はサブドメイン運用では未設定でよい。

現在の `kakeizu-studioapp` Worker に手元から直接上げる場合は Wrangler を使う。

```powershell
npx wrangler deploy
```

## 3. サブドメインの割り当て

プロジェクト → Custom domains で `kakeizu-studioapp.nuconeko-garden.com` が割り当てられていることを確認する。

## 4. HTTPS の強制

SSL/TLS → Edge Certificates で次を有効にする。

- **Always Use HTTPS**: オン
- **HSTS (HTTP Strict Transport Security)**: 有効化し、`max-age` は 6 か月以上。サブドメインを他用途に使っていない場合のみ `includeSubDomains` を付ける
- **Minimum TLS Version**: 1.2

v2 系で `.htaccess` が行っていた HTTP→HTTPS の 308 転送は、この設定が代わりを果たす。

## 5. 配信後の確認

```powershell
curl.exe -I https://kakeizu-studioapp.nuconeko-garden.com/
```

- `Content-Security-Policy` が返ること
- `X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY` が返ること
- `curl.exe -I https://kakeizu-studioapp.nuconeko-garden.com/sw.js` が `Cache-Control: no-cache` を返すこと
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

`registerType: "autoUpdate"` により、新しい Service Worker は取得後に有効化される。アプリの起動時、画面へ戻った時、オンライン復帰時にも更新を確認する。古い Worker が更新待ちになる場合は「新しいバージョンがあります」のバーから「更新する」を押す。開いたままの画面が古い場合は、編集内容を保存してから再読み込みする。

## 8. お問い合わせ窓口の確認

利用規約とプライバシーポリシーの問い合わせ先は、ぬこねこの庭の公式サイト `https://nuconeko-garden.com/` とする。

1. 利用規約とプライバシーポリシーに、指定した URL が表示されることを確認する
2. リンクが新しいタブで開き、公式サイトへ到達できることを確認する
3. 公式サイトから実際のお問い合わせ窓口へ進めることを確認する

連絡先を変更する場合は、`src/features/legal/publisher.ts` の `contactUrl` を書き換える。

## 9. Google Search Console への登録

1. 配信後、`https://kakeizu-studioapp.nuconeko-garden.com/robots.txt` と `/sitemap.xml` が表示できることを確認する。
2. [Google Search Console](https://search.google.com/search-console/) で `nuconeko-garden.com` のドメインプロパティを選ぶ。無い場合は追加し、Google が提示する TXT レコードを Cloudflare DNS に登録して所有権を確認する。既に確認済みなら DNS は変更しない。
3. 「サイトマップ」で `https://kakeizu-studioapp.nuconeko-garden.com/sitemap.xml` を送信する。
4. 「URL 検査」で `https://kakeizu-studioapp.nuconeko-garden.com/charts` を検査し、公開 URL のテストが成功したらインデックス登録をリクエストする。`/help`、`/terms`、`/privacy` も検査する。
5. 後日、サイトマップの読み取り状態とページの登録状況を Search Console で確認する。送信や登録リクエストは検索結果への掲載を保証しない。

## 注意

- `_headers` の CSP を緩める変更は、`src/__tests__/delivery.test.ts` が検知する。緩める必要が生じた場合は理由を [architecture-decisions.md](architecture-decisions.md) に記録する
- アクセス解析・エラー監視の類は入れていない。入れると改正電気通信事業法の外部送信規律の対象になり、「外部送信ゼロ」という説明が使えなくなる
