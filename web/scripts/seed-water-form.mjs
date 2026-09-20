// 「水道（下水道）使用休止・廃止届」の様式を、管理画面を使わずに自動作成するスクリプト。
// FORM_TEMPLATE_水道休止廃止届.md の内容をそのまま書き込みます。
// 氏名・電話番号・お客様番号などの個人情報に関わる項目は含みません
// （それらは提出後、職員が「事前申請番号で検索・基本情報の入力」から別途入力します）。
//
// 使い方（web/ フォルダの中で実行）：
//   ADMIN_EMAIL=you@example.jp ADMIN_PASSWORD=xxxxxxxx node scripts/seed-water-form.mjs
//
// ADMIN_EMAIL / ADMIN_PASSWORD には、Authentication に登録済みで、かつ
// firestore.rules の adminEmails() にも書かれている職員アカウントを指定してください。
// firebaseConfig は web/.env（VITE_FIREBASE_* ）から読み込みます。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { generateFormId } from '../src/lib/ids.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** web/.env を簡易パースする（KEY=VALUE の行だけを見る。dotenv 非依存） */
function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const fileEnv = loadEnvFile(path.join(__dirname, '..', '.env'));
const env = { ...fileEnv, ...process.env }; // 実際の環境変数が優先

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('web/.env に VITE_FIREBASE_* の値が見つかりません。先に web/.env を設定してください。');
  process.exit(1);
}

if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
  console.error(
    '職員アカウントのメールアドレスとパスワードが必要です。例：\n'
    + '  ADMIN_EMAIL=you@example.jp ADMIN_PASSWORD=xxxxxxxx node scripts/seed-water-form.mjs',
  );
  process.exit(1);
}

const FIELDS = [
  {
    id: 'f1', label: '郵便番号（給水場所）', type: 'zip_address', required: true,
    addressLabel: '住所（自動表示・確認用）',
  },
  {
    id: 'f2', label: '該当支所', type: 'radio', required: true,
    options: ['御坂', '一宮', '八代', '春日居', '境川', '芦川'],
  },
  { id: 'f3', label: '使用休止（廃止）日', type: 'date', required: true },
  {
    id: 'f4', label: '転出先郵便番号', type: 'zip_address', required: false,
    addressLabel: '転出先住所',
  },
  {
    id: 'f5', label: '届出者区分', type: 'radio', required: true,
    options: ['本人', '家族', '不動産', 'その他'],
  },
  {
    id: 'f6', label: '届出方法', type: 'radio', required: true,
    options: ['窓口', '電話', 'その他'],
  },
  { id: 'f7', label: '閉栓作業予定希望日', type: 'date', required: true },
];

const TITLE = '水道（下水道）使用休止・廃止届';
const DESCRIPTION = '必要事項をご入力のうえ、「入力内容を確認する」を押してください。';
const SUBMITTED_NOTE = 'この事前申請番号を、笛吹市上下水道料金センターへお伝えください。'
  + 'お客様番号・氏名・電話番号・詳しいご住所を確認後、手続きを完了します。';

async function main() {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log(`ログインしています（${env.ADMIN_EMAIL}）…`);
  await signInWithEmailAndPassword(auth, env.ADMIN_EMAIL, env.ADMIN_PASSWORD);

  let formId = null;
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateFormId();
    // eslint-disable-next-line no-await-in-loop
    const exists = await getDoc(doc(db, 'forms', candidate));
    if (!exists.exists()) { formId = candidate; break; }
  }
  if (!formId) throw new Error('様式IDの発行に失敗しました');

  await setDoc(doc(db, 'forms', formId), {
    title: TITLE,
    description: DESCRIPTION,
    submittedNote: SUBMITTED_NOTE,
    fields: FIELDS,
    status: 'active',
    deleted: false,
    startsAt: null,
    expiresAt: null,
    createdBy: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log('');
  console.log('様式を作成しました。');
  console.log(`  様式ID：${formId}`);
  console.log(`  管理画面：<プロジェクトのURL>/admin/forms/${formId}`);
  console.log(`  公開受付用URL：<プロジェクトのURL>/start/${formId}`);
  console.log('');
  console.log('トップページから自動的にこの様式を開かせたい場合は、');
  console.log(`  web/src/config.js の PRIMARY_FORM_ID に ${formId} を書き込んでから`);
  console.log('  npm run build && firebase deploy --only hosting を実行してください。');

  process.exit(0);
}

main().catch((err) => {
  console.error('失敗しました:', err.code || err.message || err);
  process.exit(1);
});
