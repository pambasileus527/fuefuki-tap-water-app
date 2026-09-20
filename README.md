# 申請フォームシステム（Sparkプラン版・完全無料）

申請者ごとにIDを発行し、そのIDで申請内容を管理するシステムです。
**クレジットカード登録は不要**（Firebase Spark プラン）で運用できます。

## 特徴：お客様が申請 → 職員が本人確認情報を追記する設計

```
お客様 → 公開URL（/start/<様式ID>）を開く
       → その場で事前申請番号が自動発行される（例：K7M2-XQ4P-B6Z3-H8N5-R9TD）
       → 郵便番号などを入力して提出

お客様 → その事前申請番号を窓口・電話で市役所へ伝える

職員   → 管理画面で事前申請番号を検索
       → お客様番号・フリガナ・氏名・電話番号・住所の続きを確認して入力
       → CSVで基本情報＋申請内容をまとめて取得
```

氏名・電話番号・お客様番号などは、お客様が入力するWeb画面には一切表示・入力されません。
これらは提出後、本人確認を行った職員だけが入力できる欄（基本情報）に記録されます。

---

## 1. できあがるURL

| 画面 | URL |
|---|---|
| トップ | `https://<プロジェクトID>.web.app/`（`web/src/config.js` に様式IDを設定していれば `/start/<様式ID>` へ自動転送。未設定なら事前申請番号を入力して続きから入力する案内） |
| 公開受付用（自己受付・様式ごと） | `https://<プロジェクトID>.web.app/start/<様式ID>` |
| 続きから入力（事前申請番号を入力） | `https://<プロジェクトID>.web.app/resume` |
| 申請画面（申請者専用） | `https://<プロジェクトID>.web.app/apply/K7M2XQ4PB6Z3H8N5R9TD` |
| 職員用 | `https://<プロジェクトID>.web.app/admin` |

このシステムは水道使用休止・廃止届の専用運用を前提としています。
`/start/<様式ID>` を開くと「事前申請を開始」ボタンが表示され、押すとその場で事前申請番号を自分で受け取り、そのまま申請を始められます（自己受付）。
`web/src/config.js` の `PRIMARY_FORM_ID` に様式IDを書き込んでデプロイすると、
トップページ（`/`）を開くだけでこの画面が表示されるようになります（手順は「6-5」を参照）。

---

## 2. 準備するもの

- Googleアカウント（無料）
- Node.js 22（`node -v` で確認。無ければ https://nodejs.org からLTS版）
- Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

**クレジットカードは不要です。** プランは Spark（無料）のまま使います。

---

## 3. Firebaseプロジェクトを作る

1. https://console.firebase.google.com を開く
2. 「プロジェクトを追加」→ 名前を入力（例：`shinsei-form`）→ 作成
3. Google アナリティクスは「有効にしない」でかまいません
4. **プランのアップグレードは不要です**（Spark のままで動きます）

## 4. Firestore を有効にする

1. 左メニュー「構築」→「Firestore Database」→「データベースの作成」
2. モードは**「本番環境モード」**を選ぶ
3. ロケーションは **`asia-northeast1`（東京）**

## 5. Authentication を有効にする（職員ログイン用）

1. 左メニュー「構築」→「Authentication」→「始める」
2. 「Sign-in method」→「メール／パスワード」を**有効にする**→ 保存
3. 「Users」→「ユーザーを追加」で職員のメールアドレスとパスワードを登録
   - 複数人で使う場合は、ここで人数分登録します
   - 登録したアドレスは、次の手順6-3でルールにも書きます

## 6. このプロジェクトを設定する

### 6-1. プロジェクトIDを書き込む

`.firebaserc` の `YOUR_FIREBASE_PROJECT_ID` を自分のプロジェクトIDに置き換えます。

```json
{ "projects": { "default": "shinsei-form-xxxxx" } }
```

### 6-2. Firebase の設定値

Firebaseコンソール → 歯車 →「プロジェクトの設定」→「マイアプリ」→ `</>`（ウェブ）でアプリを登録し、
表示された値を `web/.env` に書きます（`web/.env.example` をコピーして編集）。

```
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=shinsei-form-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=shinsei-form-xxxxx
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

これらは公開されても問題のない値です。データの保護は次の手順のルールで行います。

### 6-3. 職員のメールアドレスをルールに書く（重要）

`firestore.rules` を開き、`adminEmails()` の中を書き換えます。

```javascript
function adminEmails() {
  return [
    'kakari@city.example.jp',
    'tantou@city.example.jp'
  ];
}
```

**ここに書いたアドレスの人だけ**が、様式の作成・基本情報の入力・CSVダウンロードを行えます。
職員が増減したらここを直して、`firebase deploy --only firestore:rules` を実行してください。

### 6-4. Firestore TTL ポリシーを設定する（未提出データの自動削除・重要）

未提出のまま放置された一時申請（`applicants` コレクション）を自動削除するために、
Firestoreの **TTL（Time to Live）ポリシー** を設定します。これはコードのデプロイとは別に、
コンソールまたはCLIから1回だけ行う設定です。

**コンソールから設定する場合**

1. Firebaseコンソール →「Firestore Database」→「インデックス」タブ →「TTL」を選択
2. 「TTLポリシーを作成」をクリック
3. コレクショングループIDに `applicants` を入力
4. タイムスタンプ フィールドに `expireAt` を入力
5. 保存

**gcloud CLIから設定する場合**

```bash
gcloud firestore fields ttls update expireAt \
  --collection-group=applicants \
  --enable-ttl \
  --project=<あなたのプロジェクトID>
```

設定後、`expireAt` が過去の日時になったドキュメントは、Firestoreが自動的に（通常24時間以内に）削除します。
提出済みの申請は保存時に `expireAt` が `null` になるため、削除対象になりません。

---

## 7. インストールとデプロイ

```bash
cd web
npm install
npm run build
cd ..

firebase deploy
```

完了すると `Hosting URL: https://xxxxx.web.app` が表示されます。HTTPSは自動で有効です。

部分的にデプロイしたいとき:

```bash
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 7-b. Node/npmをインストールできない場合（Docker版）

Macに管理者権限がなくHomebrew等でNode/npmを入れられない場合は、`docker-compose.yml`（このフォルダ直下）を使ってコンテナの中でビルド・デプロイできます。事前にDocker Desktopのインストールだけ必要です。

```bash
# shinsei-form/ フォルダ直下で実行

# 1. 作業用コンテナを起動（ずっと立ち上げたままでOK）
docker compose up -d

# 2. コンテナに入って作業する
docker compose exec dev bash

# ── ここからコンテナの中 ──
npm install
npm run build
exit
# ── ここまで ──

# 3. Firebase CLIもコンテナの中から使う
docker compose exec dev bash
npm install -g firebase-tools
firebase login --no-localhost   # 表示されたURLをMac側のブラウザで開き、認証コードを貼り付ける
firebase use --add               # 対象プロジェクトを選択
firebase deploy
exit

# 使い終わったらコンテナを止める（node_modules等は消えずに残る）
docker compose down
```

`firebase login` はブラウザを自動で開けないため、`--no-localhost` を付けて手動でURLを開く形にしています。認証情報はDockerボリュームに保存されるので、`docker compose down` しても次回 `up` すれば再ログイン不要です。

### 7-c. 水道（下水道）使用休止・廃止届の様式を自動作成する（任意）

管理画面で1項目ずつ入力する代わりに、`web/scripts/seed-water-form.mjs` を実行すると、
`FORM_TEMPLATE_水道休止廃止届.md` の内容（タイトル・説明・提出完了時の案内文・7項目）で
様式をまとめて自動作成できます。氏名・電話番号・お客様番号などの個人情報に関わる項目は含みません。

`web/` フォルダの中（`npm install` 済みであること）で、Authentication に登録済みかつ
`adminEmails()` にも書かれている職員アカウントを指定して実行します。

```bash
cd web
ADMIN_EMAIL=you@example.jp ADMIN_PASSWORD=xxxxxxxx node scripts/seed-water-form.mjs
```

実行すると、作成された様式ID・管理画面URL・公開受付用URLが表示されます。
すでに同じ内容の様式を作成済みの場合、これを実行するともう1件、別の様式IDで新規作成されます
（既存の様式を上書きするものではありません）。不要になった様式は管理画面の「様式を削除」で消せます。

パスワードをコマンドの履歴に残したくない場合は、環境変数として先に設定してから実行してください。

```bash
export ADMIN_EMAIL=you@example.jp
export ADMIN_PASSWORD=xxxxxxxx
node scripts/seed-water-form.mjs
```

---

## 8. 使い方

### 職員

1. `/admin` を開いてログイン
2. 「申請様式を作成」→ タイトルと項目を設定（**氏名・電話番号・お客様番号などは項目に含めない**。必要なら「郵便番号＋住所自動入力」タイプが使えます）
   - 水道（下水道）使用休止・廃止届については、画面から1項目ずつ入力する代わりに、
     `web/scripts/seed-water-form.mjs` を実行すると、`FORM_TEMPLATE_水道休止廃止届.md` の内容
     （7項目・案内文つき）で様式を自動作成できます（「7-c」参照）
3. 様式詳細画面の「公開受付用URL」（`/start/<様式ID>`）を市の公式サイト等にリンクする
   - 事前申請番号は必ずこのURLを訪れた人がその場で自動発行するものです（職員が事前にIDを発行する機能はありません）
   - 同じ画面に表示される「様式ID」をコピーし、`web/src/config.js` の `PRIMARY_FORM_ID` に貼り付けて
     再度 `npm run build && firebase deploy --only hosting` すると、
     サイトのトップページ（`https://<プロジェクトID>.web.app/`）を開くだけで
     自動的にこの様式の受付画面（`/start/<様式ID>`）に転送されるようになります（一度設定すればそれ以降は不要です）
4. 提出があったら「事前申請番号で検索・基本情報の入力」にIDを入力して検索
5. お客様の入力内容（参考表示）を見ながら、お客様番号・フリガナ・氏名・電話番号・住所の続きを入力して保存
6. 「CSVをダウンロード」で、基本情報＋申請内容をまとめて取得

### 申請者

1. 案内されたURL（`/start/<様式ID>`、またはトップページ設定済みなら `/`）を開くと、
   まず様式の説明と「事前申請を開始」ボタンが表示される（この時点ではまだ何も発行されない）
2. ボタンを押すと、その場で事前申請番号が発行されて画面に表示される→「申請入力を続ける」で入力画面へ
3. 郵便番号などを入力して「入力内容を確認する」→「この内容で提出する」
4. 途中でやめる場合は「一時保存」。同じURL（`/apply/<事前申請番号>`）からどの端末でも続きを入力できます
5. **提出後は修正できません**（訂正が必要なら窓口へ連絡 → 職員が「修正を許可」）
6. 提出完了画面の案内に従い、事前申請番号を窓口・電話で伝える

### 窓口

事前申請番号を聞いたら、管理画面でそのIDを検索し、本人確認した内容（お客様番号・氏名・電話番号・住所の続き）を入力・保存します。

---

## 9. CSVの中身

基本情報を1件でも入力した様式では、申請内容の前に基本情報の列が追加されます。
「郵便番号＋住所自動入力」タイプの項目は、郵便番号と住所の2列に分かれます。

```
事前申請番号,状態,基本情報確認,お客様番号,フリガナ,氏名,電話番号,住所（番地以降）,郵便番号（給水場所）（郵便番号）,住所（自動表示・確認用）,...,提出日時,最終更新日時
K7M2XQ4PB6Z3H8N5R9TD,提出済み,確認済み,水12345678,フエフキ タロウ,笛吹 太郎,055-123-4567,123番地,4060032,山梨県笛吹市石和町松本,...,2026-09-12 10:15:00,...
P4R9TB6ZH8N5K7M2XQ4D,未提出,未確認,,,,,,4068501,山梨県笛吹市御坂町夏目原,...,,
```

- 1行 = 1人分の申請
- ファイル名は `form_<様式ID>.csv`
- UTF-8 BOM付きなので Excel でそのまま開けます
- `=` `+` `-` `@` で始まる値にはシングルクォートを付け、数式として実行されないようにしています
- 「基本情報確認」が「未確認」の行は、提出はあったが職員がまだお客様番号・氏名等を入力していないもの（折り返し連絡が必要）

---

## 10. ローカルで動かす（任意）

```bash
# ターミナル1
firebase emulators:start --only firestore,auth,hosting

# ターミナル2
cd web && npm run dev
```

ロジックの自動テストはパッケージ無しで動きます。

```bash
node selftest.mjs
```

---

## 11. ファイル構成

```
shinsei-form/
├── firebase.json              Hosting と Firestore の設定
├── .firebaserc                プロジェクトID
├── firestore.rules            ★アクセス制御の中心。職員のメールアドレスもここ
├── firestore.indexes.json     複合インデックス定義
├── selftest.mjs               依存なしで動く自動テスト
└── web/
    ├── package.json / vite.config.js / index.html / .env.example
    └── src/
        ├── firebase.js        Firebase の初期化
        ├── config.js          ★トップページで表示する様式ID（PRIMARY_FORM_ID）
        ├── lib/ids.js         事前申請番号・様式IDの生成
        ├── lib/csv.js         CSV生成・インジェクション対策
        ├── lib/validate.js    入力値の検証
        ├── lib/db.js          Firestore の読み書き
        ├── lib/zip.js         郵便番号→住所の自動変換（zipcloud API）
        ├── lib/rateLimit.js   発行数の上限・自動削除に関する定数
        └── pages/             各画面（Start.jsx が自己受付の入口、Home.jsx がトップページ、
                                Resume.jsx が「事前申請番号を入力して続きから」の画面）
```

---

## 12. データ構造（Firestore）

```
forms/{formId}                 申請様式（個人情報を含まない）
  title, description, submittedNote, fields[], status, deleted,
  startsAt, expiresAt, createdBy, createdAt, updatedAt

applicants/{applicantId}       事前申請番号（一時申請ID） = ドキュメントID（20文字のランダム）
  formId, answers{}, submitted, memo,
  issuedAt, updatedAt, submittedAt,
  expireAt,                    未提出のまま放置された仮申請をFirestore TTLで自動削除するための期限
                                （提出時に null になり、以後は削除されない）
  rateLimitBucket,             発行時にどの時間バケットで数えられたか（発行数上限のチェック用）
  basicInfo?: {                職員だけが読み書きする欄（申請者からは書けない）
    customerNo, kana, name, phone, addressExtra, confirmedAt
  }

rateLimits/{様式ID_YYYYMMDDHH} 1時間あたりの一時申請ID発行数カウンタ（個人情報なし）
  count, expireAt
```

トップページ（`/`）から自動転送する様式のIDはFirestoreには保存せず、
`web/src/config.js` の `PRIMARY_FORM_ID` にコードとして書き込みます（水道の届出専用運用のため）。

`answers` の中の「郵便番号＋住所自動入力」タイプの項目は `{ zip, address }` の形で保存されます。

---

## 13. この構成の仕組みと限界

サーバー（Cloud Functions）を使わないため、**Firestore セキュリティルールが唯一の門番**です。

**守られていること**

- 事前申請番号は32種類の文字×20文字＝約100ビット。総当たりでの推測は現実的に不可能です
- 申請の一覧取得（list）は職員だけに許可されているため、IDを知らない人は他人の申請にたどり着けません
- 申請者は「自分の申請1件」を「提出前に限って」しか更新できません
- 様式が停止中・期限切れなら、ルール側で書き込みを拒否します
- 「基本情報」（お客様番号・氏名・電話番号・住所の続き）は職員だけが書き込めます。申請者本人がその欄を書き換えることはできません
- `/start/<様式ID>` で自己受付するときも、空の申請（回答なし・未提出）しか作れないようルールで縛っています

**自己受付（`/start/<様式ID>`）についての注意 — 発行数の上限と自動削除**

様式IDが分かれば誰でも新しい事前申請番号（一時申請ID）を作成できます（意図した動作です）。
連番ではなく、ID自体に個人情報も含みません。大量発行対策として、以下の2つを実装しています。

1. **1時間あたりの発行数に上限を設けている**（既定100件／様式ごと・1時間ごと）。
   `rateLimits/{様式ID_時間帯}` というカウンタで数え、上限を超えると新しいIDを発行せず、
   画面には「アクセスが集中しています。しばらく時間をおいて、再度お試しください。」と表示します。
   上限は `web/src/lib/rateLimit.js` の `HOURLY_ISSUE_LIMIT` と、`firestore.rules` の
   `HOURLY_ISSUE_LIMIT()` の**両方**を同じ値に揃えてください（実際の制限はルール側が行います）。
2. **未提出のまま放置された仮申請は自動的に削除される**（既定24時間後。`web/src/lib/rateLimit.js` の
   `APPLICANT_TTL_HOURS`。`firestore.rules` 側は最大48時間まで許容）。これにはFirestoreの
   **TTL（Time to Live）ポリシー** の設定が別途必要です（下記「6-4」参照）。
   提出済みの申請は `expireAt` が `null` になるため削除されません。

**できないこと（Sparkプランの制約）**：Firestore セキュリティルールにはアクセス元のIPアドレスを
参照する仕組みがないため、**同一IPアドレスからの発行を個別に制限することはできません**。
IP単位の制限やreCAPTCHAのようなbot対策を厳密に行うには、Cloud Functions（Blazeプラン、要クレジットカード）
または Firebase App Check の導入が必要です。今の上限は「様式全体で1時間にどれだけ発行されたか」だけを数える、
という割り切った設計です。

**限界（Blaze版との違い）**

| | このSpark版 | Blaze版（Cloud Functions） |
|---|---|---|
| 費用 | 完全無料・カード不要 | 実質無料（カード登録必要） |
| 入力値の検証 | ブラウザ＋ルールの構造チェック | サーバーで厳密に検証 |
| CSV生成 | 職員のブラウザ内 | サーバー |
| CSVを取れる人 | ログインした職員のみ | 職員＋暗証番号を知る第三者も可 |
| 操作ログ | なし | 取得可能 |

**具体的な限界**：申請者が開発者ツールを使えば、自分の申請に、様式で定めた形式と違う文字列（極端に長い文章など）を書き込むことは技術的に可能です。他人の申請は読めず、書き換えもできませんが、**自分の枠の中身は自由に書ける**ということです。悪用されても影響は「その人の申請欄に変な値が入る」までですが、厳密さが必要になったら Blaze 版への移行を検討してください。

---

## 14. よくあるつまずき

| 症状 | 対処 |
|---|---|
| 職員画面で「この操作は許可されていません」 | `firestore.rules` の `adminEmails()` とログインしたアドレスが一致しているか確認 → `firebase deploy --only firestore:rules` |
| 申請画面で「見つかりませんでした」 | IDの打ち間違い、または様式が削除済み |
| 「受付が終了しているか、すでに提出済み」 | 提出済みの申請は修正できません。職員が「修正を許可」してください |
| 一覧が表示されない | インデックスの作成待ち。数分後に再読み込み（コンソール →「Firestore」→「インデックス」で状態を確認） |
| 画面が真っ白 | `web/.env` の値を確認 → `npm run build` → `firebase deploy --only hosting` |
| 郵便番号を検索しても住所が出ない | 郵便番号の自動入力は外部の郵便番号API（zipcloud）を利用しています。一時的に繋がらないこともあるので、その場合は住所欄に手入力してください |
| 「公開受付用URL」を開いても申請が始まらない | 様式が「受付中」になっているか確認（停止中・削除済みだと自己受付できません） |
