// CSV生成（ブラウザ側）。Excelでの数式実行と文字化けを防ぐ。

const DANGEROUS_PREFIX = /^[=+\-@\t\r]/;
const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
const BOM = '﻿';

/** JST(UTC+9) の 'YYYY-MM-DD HH:mm:ss' 形式に整形する */
export function formatDateTime(value) {
  if (!value) return '';
  const d = value && typeof value.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}-${p(jst.getUTCMonth() + 1)}-${p(jst.getUTCDate())} `
    + `${p(jst.getUTCHours())}:${p(jst.getUTCMinutes())}:${p(jst.getUTCSeconds())}`;
}

/**
 * CSVインジェクション対策 + CSVエスケープ。
 * 1) = + - @ タブ CR で始まる値にはシングルクォートを付ける
 * 2) カンマ・改行・引用符を含む値は "" で囲む
 * 3) 制御文字は除去する
 */
export function escapeCell(value) {
  let s;
  if (value === null || value === undefined) s = '';
  else if (Array.isArray(value)) s = value.map((v) => String(v)).join(' / ');
  else if (typeof value === 'boolean') s = value ? 'はい' : 'いいえ';
  else s = String(value);

  s = s.replace(CONTROL_CHARS, '');
  if (DANGEROUS_PREFIX.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** 回答1項目分のCSVセルへ変換する（郵便番号＋住所の項目は2列に分ける） */
function answerCells(field, answers) {
  const v = answers ? answers[field.id] : undefined;
  if (field.type === 'zip_address') {
    const zip = v && typeof v === 'object' ? v.zip : '';
    const address = v && typeof v === 'object' ? v.address : '';
    return [escapeCell(zip), escapeCell(address)];
  }
  return [escapeCell(v)];
}

/**
 * 申請一覧から CSV 文字列を作る。
 * 1列目は事前申請番号。1行 = 1人分の申請。
 * 職員が個別に確認した「基本情報」（お客様番号・氏名・電話番号等）があれば、
 * 申請内容の前にあわせて出力する。
 */
export function buildCsv(form, applicants, { includeUnsubmitted = true } = {}) {
  const fields = Array.isArray(form.fields) ? form.fields : [];
  const hasBasicInfo = applicants.some((a) => a.basicInfo);

  const basicHeader = hasBasicInfo
    ? ['基本情報確認', 'お客様番号', 'フリガナ', '氏名', '電話番号', '住所（番地以降）']
    : [];

  const fieldHeader = fields.flatMap((f) => (
    f.type === 'zip_address'
      ? [`${f.label || f.id}（郵便番号）`, f.addressLabel || `${f.label || f.id}（住所）`]
      : [f.label || f.id]
  ));

  const header = ['事前申請番号', '状態', ...basicHeader, ...fieldHeader, '提出日時', '最終更新日時'];
  const lines = [header.map(escapeCell).join(',')];

  for (const a of applicants) {
    if (!includeUnsubmitted && !a.submitted) continue;
    const answers = a.answers || {};
    const b = a.basicInfo || null;

    const basicCells = hasBasicInfo
      ? [
        escapeCell(b ? '確認済み' : '未確認'),
        escapeCell(b ? b.customerNo : ''),
        escapeCell(b ? b.kana : ''),
        escapeCell(b ? b.name : ''),
        escapeCell(b ? b.phone : ''),
        escapeCell(b ? b.addressExtra : ''),
      ]
      : [];

    const row = [
      escapeCell(a.id),
      escapeCell(a.submitted ? '提出済み' : '未提出'),
      ...basicCells,
      ...fields.flatMap((f) => answerCells(f, answers)),
      escapeCell(formatDateTime(a.submittedAt)),
      escapeCell(formatDateTime(a.updatedAt)),
    ];
    lines.push(row.join(','));
  }

  // Excel互換のため BOM + CRLF
  return BOM + lines.join('\r\n') + '\r\n';
}

/** 生成した CSV をダウンロードさせる */
export function downloadCsv(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
