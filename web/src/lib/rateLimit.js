// 1時間あたりの一時申請ID発行数を制限するための補助関数。
// 実際の上限チェックは firestore.rules 側（サーバー相当）で行う。
// ここにある値は firestore.rules の HOURLY_ISSUE_LIMIT() と必ず一致させること。
export const HOURLY_ISSUE_LIMIT = 100;

// 未完了（未提出）のまま放置された一時申請を自動削除するまでの期間。
// Firestore の TTL ポリシー（applicants コレクション・expireAt フィールド）と
// あわせて設定すること（Firebaseコンソール側の設定は別途必要）。
export const APPLICANT_TTL_HOURS = 24;

/**
 * 様式IDと現在時刻から「時間バケットID」を作る。
 * 例: formId="ab12cd34ef56", 2026-09-17T08:41:00Z → "ab12cd34ef56_2026091708"
 * 同じ様式・同じ「時（hour）」の発行はすべて同じバケットに数えられる。
 */
export function currentRateLimitBucket(formId, now = new Date()) {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const h = String(now.getUTCHours()).padStart(2, '0');
  return `${formId}_${y}${m}${d}${h}`;
}

/** バケットの有効期限（掃除用。次の時間帯に入ればもう不要なので数時間後でよい） */
export function rateLimitBucketExpiry(now = new Date()) {
  return new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6時間後
}
