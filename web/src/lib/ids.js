// ID生成。ブラウザの暗号用乱数（crypto.getRandomValues）を使う。

// 見間違えやすい文字（0/O、1/I/l）を除いた32文字
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const FORM_ID_LENGTH = 12;      // 様式ID：約60ビット
const APPLICANT_ID_LENGTH = 20; // 申請者ID：約100ビット（URLがそのまま本人確認になるため長くする）

/** 偏りのない乱数で文字列を作る（modulo bias を避ける） */
function randomString(length) {
  const out = [];
  const max = 256 - (256 % ALPHABET.length);
  while (out.length < length) {
    const buf = new Uint8Array(length * 2);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (out.length >= length) break;
      if (b < max) out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  return out.join('');
}

export function generateFormId() {
  return randomString(FORM_ID_LENGTH);
}

export function generateApplicantId() {
  return randomString(APPLICANT_ID_LENGTH);
}

export function isValidFormId(v) {
  return typeof v === 'string' && new RegExp(`^[${ALPHABET}]{${FORM_ID_LENGTH}}$`).test(v);
}

export function isValidApplicantId(v) {
  return typeof v === 'string' && new RegExp(`^[${ALPHABET}]{${APPLICANT_ID_LENGTH}}$`).test(v);
}

/** 見やすいように4文字ずつ区切って表示する（コピーする値そのものは区切らない） */
export function formatId(id) {
  return String(id).replace(/(.{4})(?=.)/g, '$1-');
}
