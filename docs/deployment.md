# 配信手順（Cloudflare Workers）

取得済み独自ドメインのサブドメインで公開する手順。利用者のデータは端末内にのみ保存されるため、サーバー側に永続化の設定は不要。

## 1. ビルド

```powershell
npm ci
npm run build
```

`dist` に配信物が生成される。`dist/_headers` がセキュリティヘッダとキャッシュ制御の設定として読まれる。

**SPA のルーティングに `_redirects` を置かないこと。** 現在はWorkersとして配信する。`wrangler.jsonc` の `main` は `src/worker.ts`、assets bindingは `ASSETS`、`not_found_handling` は `none`。実在する資材は静的配信を優先し、見つからない画面URLだけをWorkerからルートHTMLへ渡す。`/assets/` の欠落は404・`Cache-Control: no-store` とし、HTMLを長期キャッシュしない。`run_worker_first` は設定せず、実在資材の要求ごとにWorkerを呼ばない。`/* /index.html 200` のような `_redirects` は不要。

## 2. Cloudflare Workers のGit連携

既存の `kakeizu-studioapp` WorkerのGit連携を利用する。新規構築時も、配信ルーターを実行できるWorkersとしてリポジトリを連携する。静的なdistだけをPagesへアップロードする方式とは設定が異なる。

GitHub 連携で作る場合のビルド設定:

| 項目                   | 値              |
| ---------------------- | --------------- |
| Production branch      | `main`          |
| Framework preset       | None            |
| Build command          | `npm run build` |
| Build output directory | `dist`          |

デプロイコマンドは `npx wrangler deploy`。静的資材のディレクトリとWorkerエントリーは `wrangler.jsonc` を参照する。

**Node のバージョンは環境変数で固定する。** Environment variables に `NODE_VERSION` = `22` を追加すること。Pages の既定 Node は古く、指定しないとビルドが失敗することがある。

`VITE_BASE_PATH` はサブドメイン運用では未設定でよい。

現在の `kakeizu-studioapp` Worker に手元から直接上げる場合は Wrangler を使う。

```powershell
npx wrangler deploy
```

## 3. サブドメインの割り当て

プロジェクト → Custom domains で `kakeizu-studioapp.nuconeko-garden.com` が割り当てられていることを確認する。

## 4. HTTPS の強制

本番では Cloudflare のリダイレクト ルール `Kakeizu Studio HTTPS` を有効にしている。対象をこのアプリのホストに限定し、HTTP のみ HTTPS に転送する。

| 項目                   | 設定                                                 |
| ---------------------- | ---------------------------------------------------- |
| リクエスト URL         | `http://kakeizu-studioapp.nuconeko-garden.com/*`     |
| ターゲット URL         | `https://kakeizu-studioapp.nuconeko-garden.com/${1}` |
| ステータス コード      | `308`（恒久転送、HTTP メソッドを保持）               |
| クエリ文字列を保存する | オン                                                 |

パスとクエリ文字列を保持する。ルールは Cloudflare 側の設定であり、Worker の再デプロイでは変更されない。他のホストへの転送設定は別途管理する。

ゾーン全体へ HTTPS を強制する場合は、SSL/TLS → Edge Certificates で次を設定する。`Always Use HTTPS` は他のサブドメインにも適用されるため、このアプリだけを対象にする場合は上記のルールを使う。

- **Always Use HTTPS**: オン
- **HSTS (HTTP Strict Transport Security)**: 有効化し、`max-age` は 6 か月以上。サブドメインを他用途に使っていない場合のみ `includeSubDomains` を付ける
- **Minimum TLS Version**: 1.2

2026-10-15 16:18 JST に対象ゾーン `nuconeko-garden.com` の保存値を TLS 1.0 から TLS 1.2 へ変更し、ページ再読み込み後も保存されていることを確認済み。本番ホストで TLS 1.0/1.1 がサーバーの protocol version alert により拒否され、TLS 1.2/1.3 は証明書・ホスト名検証を含め接続成功することを確認した。詳細は [診断報告書 F9](pentest-report-2026-10.md#f9-tls-10--11-を受け付けている) を参照。

v2 系で `.htaccess` が行っていた HTTP→HTTPS の転送は、Cloudflare 側で処理する。

## 5. 配信後の確認

```powershell
curl.exe -I https://kakeizu-studioapp.nuconeko-garden.com/
```

- `Content-Security-Policy` が返ること
- `Strict-Transport-Security: max-age=15552000` が返ること（`public/_headers` で設定。`includeSubDomains` は付けない。ゾーン全体へ広げる場合は Cloudflare 側の HSTS を使う）
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

`registerType: "prompt"`、`skipWaiting: false`、`clientsClaim: false` とし、新しいService Workerは利用者の操作まで待機する。アプリ起動時・画面へ戻った時・オンライン復帰時に更新を確認し、更新バーを表示する。別タブでWorkerが有効になっても、このタブは自動再読み込みしない。

「JSONを書き出す」または「更新する」の前に、エディターの保留中の保存を完了させる。保存が失敗した場合は更新しない。「更新する」は保存・書き出し済みの確認後だけ有効になる。一時利用の内容は、利用者が選んだ再読み込みでも消えるため、先にJSONを退避する。更新を見送ったタブは作業を続けられるが、旧エディター資材の取得に失敗した場合は退避用の画面からJSONを書き出して更新する。

以前の自動更新版のタブには、この保護を後から適用できない。初回の切り替えでは必要なJSONを退避し、すべての旧版アプリタブを閉じてから開き直す。

デプロイ後には正規JSがJavaScript・長期キャッシュ、`/assets/存在しない名前.js` が404・no-store、画面の深いURLがHTMLを返すことも確認する。

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
