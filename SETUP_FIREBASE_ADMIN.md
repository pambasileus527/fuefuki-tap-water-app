# Firebase 管理者アカウント設定メモ

## 結論

- Firebase CLI は `xxxx@gmail.com` でログイン済み
- 実際の職員管理者アカウントは `xxxx@gmail.com`
- Firestore のルールで管理者判定を行う `adminEmails()` には、`xxxx@gmail.com` を入れる
- そのアカウントが Firebase Authentication に登録されていないと、`permission-denied` になる

## 必要な設定

### 1. Firebase Authentication に管理者アカウントを追加

Firebase Console → Authentication → Users

- Email: `xxxx@gmail.com`
- Password: `passw0rd`
- 追加

Email/Password を有効にしていることを確認する

### 2. Firestore ルールに管理者メールを追加

`firestore.rules` の `adminEmails()` に次を入れる

```js
function adminEmails() {
  return [
    'xxxx@gmail.com'
  ];
}
```

### 3. ルールをデプロイ

```bash
cd /Users/traveler/Desktop/works/fuefuki-tap-water-app
docker compose exec dev bash -lc 'cd /workspace && firebase deploy --only firestore:rules'
```

### 4. 自動シードスクリプトを実行

```bash
cd /Users/traveler/Desktop/works/fuefuki-tap-water-app
docker compose exec dev bash -lc 'cd /workspace/web && ADMIN_EMAIL=xxxx@gmail.com ADMIN_PASSWORD=passw0rd node scripts/seed-water-form.mjs'
```

## 重要な理解

- `xxxx@gmail.com` は Firebase CLI / Google アカウントの契約メール
- `xxxx@gmail.com` は実際の職員アカウント
- Firestore ルールは `request.auth.token.email` を見て判定する
- そのため、管理者メールと Authentication のユーザーが一致していないと、`permission-denied` になる

## その後

シードスクリプトが成功したら、表示された様式IDを `web/src/config.js` の `PRIMARY_FORM_ID` に挿入し、次を実行する

```bash
docker compose exec dev bash -lc 'cd /workspace/web && npm run build && cd /workspace && firebase deploy --only hosting'
```

## まとめ

CLI の Gmail と管理者アカウントは別物で構わないが、Firestore のルールと Authentication のユーザーは同じ `xxxx@gmail.com` に揃える必要がある。
