// 依存パッケージなしで動く簡易テスト:  node selftest.mjs
import assert from 'node:assert';
import { buildCsv, escapeCell, formatDateTime } from './web/src/lib/csv.js';
import { generateApplicantId, generateFormId, isValidApplicantId, isValidFormId, formatId } from './web/src/lib/ids.js';
import { validateAnswers, validateFields } from './web/src/lib/validate.js';
import { isValidZip, formatZip } from './web/src/lib/zip.js';
import { currentRateLimitBucket, rateLimitBucketExpiry, HOURLY_ISSUE_LIMIT, APPLICANT_TTL_HOURS } from './web/src/lib/rateLimit.js';

// --- CSVインジェクション対策 ---
assert.strictEqual(escapeCell('=SUM(A1)'), "'=SUM(A1)");
assert.strictEqual(escapeCell('+81'), "'+81");
assert.strictEqual(escapeCell('-1'), "'-1");
assert.strictEqual(escapeCell('@x'), "'@x");
assert.strictEqual(escapeCell('東京都,千代田区'), '"東京都,千代田区"');
assert.strictEqual(escapeCell('a"b'), '"a""b"');
assert.strictEqual(escapeCell(['A', 'B']), 'A / B');

// --- ID生成 ---
const ids = new Set();
for (let i = 0; i < 5000; i += 1) {
  const id = generateApplicantId();
  assert.ok(isValidApplicantId(id), `不正なID: ${id}`);
  assert.ok(!ids.has(id), '重複が発生した');
  ids.add(id);
}
assert.ok(isValidFormId(generateFormId()));
assert.strictEqual(formatId('ABCDEFGH').length, 9); // 4文字ごとにハイフン
assert.strictEqual(Math.log2(32) * 20, 100); // 事前申請番号は100ビット

// --- 郵便番号 ---
assert.ok(isValidZip('406-0032'));
assert.ok(isValidZip('4060032'));
assert.ok(!isValidZip('123'));
assert.strictEqual(formatZip('4060032'), '406-0032');

// --- 項目定義の検証（水道休止・廃止届 相当）---
const v = validateFields([
  { label: '郵便番号（給水場所）', type: 'zip_address', required: true, addressLabel: '住所（自動表示・確認用）' },
  { label: '該当支所', type: 'radio', required: true, optionsText: '御坂\n一宮\n八代\n春日居\n境川\n芦川' },
  { label: '使用休止（廃止）日', type: 'date', required: true },
  { label: '転出先郵便番号', type: 'zip_address', required: false, addressLabel: '転出先住所' },
  { label: '届出者区分', type: 'radio', required: true, optionsText: '本人\n家族\n不動産\nその他' },
  { label: '届出方法', type: 'radio', required: true, optionsText: '窓口\n電話\nその他' },
  { label: '閉栓作業予定希望日', type: 'date', required: true },
]);
assert.ok(v.ok, v.message);
assert.strictEqual(v.fields.length, 7);
assert.strictEqual(v.fields[0].type, 'zip_address');
assert.strictEqual(v.fields[0].addressLabel, '住所（自動表示・確認用）');

// --- 回答の検証 ---
const fields = v.fields;
const ok = validateAnswers(fields, {
  f1: { zip: '406-0032', address: '山梨県笛吹市石和町松本' },
  f2: '一宮',
  f3: '2026-10-01',
  f4: { zip: '', address: '' },
  f5: '本人',
  f6: '窓口',
  f7: '2026-10-03',
}, false);
assert.ok(ok.ok, ok.message);
assert.strictEqual(ok.data.f1.zip, '406-0032');
assert.strictEqual(ok.data.f1.address, '山梨県笛吹市石和町松本');
assert.strictEqual(ok.data.f4.zip, ''); // 任意項目は空でもOK

// 必須の郵便番号が空なら弾く
const missingZip = validateAnswers(fields, { ...ok.data, f1: { zip: '', address: '' } }, false);
assert.ok(!missingZip.ok);
assert.ok(missingZip.message.includes('郵便番号'));

// 郵便番号の形式が不正なら弾く
const badZip = validateAnswers(fields, { ...ok.data, f1: { zip: '123', address: '' } }, false);
assert.ok(!badZip.ok);

// 一時保存なら未入力でも通る
assert.ok(validateAnswers(fields, {}, true).ok);

// --- CSV生成（基本情報つき）---
const csv = buildCsv({ fields }, [
  {
    id: 'K7M2XQ4PB6Z3H8N5R9TD',
    answers: {
      f1: { zip: '4060032', address: '山梨県笛吹市石和町松本' },
      f2: '一宮', f3: '2026-10-01', f4: { zip: '', address: '' }, f5: '本人', f6: '窓口', f7: '2026-10-03',
    },
    basicInfo: { customerNo: '水12345678', kana: 'フエフキ タロウ', name: '笛吹 太郎', phone: '055-123-4567', addressExtra: '123番地' },
    submitted: true,
    submittedAt: new Date('2026-09-12T01:15:00Z'),
    updatedAt: new Date('2026-09-12T01:15:00Z'),
  },
  {
    id: 'P4R9TB6ZH8N5K7M2XQ4D',
    answers: { f1: { zip: '4068501', address: '山梨県笛吹市御坂町夏目原' } },
    submitted: false,
  },
]);
assert.ok(csv.startsWith('﻿'), 'BOMが必要');
const lines = csv.trim().split('\r\n');
assert.ok(lines[0].includes('お客様番号'), '基本情報の列見出しが必要');
assert.ok(lines[0].includes('郵便番号（給水場所）（郵便番号）'), 'zip_address は2列に分かれる');
assert.ok(lines[1].includes('確認済み'));
assert.ok(lines[1].includes('水12345678'));
assert.ok(lines[1].includes('4060032'));
assert.ok(lines[2].includes('未確認'));
assert.strictEqual(lines.length, 3);

// --- レート制限（1時間あたりの発行数上限）のバケットID生成 ---
const t1 = new Date('2026-09-17T08:41:00Z');
const t2 = new Date('2026-09-17T08:59:59Z');
const t3 = new Date('2026-09-17T09:00:01Z');
assert.strictEqual(currentRateLimitBucket('ab12cd34ef56', t1), 'ab12cd34ef56_2026091708');
assert.strictEqual(
  currentRateLimitBucket('ab12cd34ef56', t1),
  currentRateLimitBucket('ab12cd34ef56', t2),
  '同じ「時」なら同じバケットになる',
);
assert.notStrictEqual(
  currentRateLimitBucket('ab12cd34ef56', t2),
  currentRateLimitBucket('ab12cd34ef56', t3),
  '時をまたいだら別バケットになる',
);
assert.ok(HOURLY_ISSUE_LIMIT > 0, 'firestore.rules の HOURLY_ISSUE_LIMIT() と一致させること');
assert.ok(APPLICANT_TTL_HOURS > 0 && APPLICANT_TTL_HOURS <= 48, '未提出データの自動削除までの時間（firestore.rulesの上限48時間以内）');
assert.ok(rateLimitBucketExpiry(t1).getTime() > t1.getTime());

console.log('すべてのテストに合格しました');
console.log('---- CSV出力例 ----');
console.log(csv);
