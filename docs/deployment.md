# 配信手順（Cloudflare Pages）

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

## 8. メール窓口の設定（Cloudflare Email Routing）

利用規約とプライバシーポリシーの問い合わせ先 `kakeizu@nuconeko-garden.com` は、Cloudflare Email Routing で受けて普段のメールへ転送する構成。**公開前にこの設定が必要**（規約に載っている窓口が届かない状態を避けるため）。

1. ダッシュボードで `nuconeko-garden.com` を選択し、Email → Email Routing を開く
2. 初回は有効化を求められる。必要な DNS レコード（MX と SPF）をまとめて追加する操作が案内されるので、それに従う
3. 転送先（Destination addresses）に普段使うメールアドレスを登録する。**確認メールのリンクを開いて承認するまで転送は行われない**
4. ルーティング規則で、カスタムアドレス `kakeizu` を作成し、宛先に承認済みの転送先を指定する
5. 外部（スマートフォンのメール等）から `kakeizu@nuconeko-garden.com` へテスト送信し、転送先に届くことを確認する

### 注意

- **有効化するとドメインの MX レコードが Cloudflare のものに置き換わる。** `nuconeko-garden.com` を他のメールサービスで受信している場合、そちらの受信が止まる
- **このアドレスから送信することはできない。** Email Routing は受信と転送のみを行う。問い合わせに返信すると、相手には転送先アドレスがそのまま見える。独自ドメインのアドレスで送信もしたい場合は、別途メールサービス（独自ドメインに対応した無料プランのあるサービス等）が必要になる
- 連絡先を変更する場合は、ここの設定とあわせて `src/features/legal/publisher.ts` の 1 行を書き換える

## 注意

- `_headers` の CSP を緩める変更は、`src/__tests__/delivery.test.ts` が検知する。緩める必要が生じた場合は理由を [architecture-decisions.md](architecture-decisions.md) に記録する
- アクセス解析・エラー監視の類は入れていない。入れると改正電気通信事業法の外部送信規律の対象になり、「外部送信ゼロ」という説明が使えなくなる
