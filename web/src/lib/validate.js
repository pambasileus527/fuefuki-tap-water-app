// 入力値の検証（ブラウザ側）。
// Sparkプラン構成ではサーバーがないため、ここと Firestore ルールの二段構えで守る。
import { isValidZip } from './zip.js';

const CONTROL_CHARS = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEL_RE = /^[0-9+\-() ]{8,20}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_TEXT = 200;
const MAX_TEXTAREA = 5000;

export function sanitizeText(v) {
  return String(v).replace(CONTROL_CHARS, '').trim();
}

/**
 * 回答内容を検証する。
 * draft=true（一時保存）のときは必須チェックを行わない。
 * 戻り値: { ok: true, data } または { ok: false, message }
 */
export function validateAnswers(fields, values, draft) {
  const data = {};
  for (const f of fields) {
    // 郵便番号＋自動住所（2つで1組の値を保存する）
    if (f.type === 'zip_address') {
      const raw = values[f.id] || {};
      const zip = sanitizeText(raw.zip || '');
      const address = sanitizeText(raw.address || '');
      if (zip === '') {
        if (!draft && f.required) return { ok: false, message: `「${f.label}」を入力してください` };
        data[f.id] = { zip: '', address: '' };
        continue;
      }
      if (!isValidZip(zip)) return { ok: false, message: `「${f.label}」は7桁の数字で入力してください` };
      data[f.id] = { zip, address };
      continue;
    }

    if (f.type === 'checkbox') {
      const arr = (Array.isArray(values[f.id]) ? values[f.id] : [])
        .map(sanitizeText)
        .filter((x) => (f.options || []).includes(x));
      if (!draft && f.required && arr.length === 0) {
        return { ok: false, message: `「${f.label}」を選択してください` };
      }
      data[f.id] = arr;
      continue;
    }

    const v = sanitizeText(values[f.id] === undefined || values[f.id] === null ? '' : values[f.id]);

    if (v === '') {
      if (!draft && f.required) return { ok: false, message: `「${f.label}」を入力してください` };
      data[f.id] = '';
      continue;
    }

    switch (f.type) {
      case 'textarea':
        if (v.length > MAX_TEXTAREA) return { ok: false, message: `「${f.label}」が長すぎます` };
        break;
      case 'number':
        if (!/^-?\d+(\.\d+)?$/.test(v)) return { ok: false, message: `「${f.label}」は数字で入力してください` };
        break;
      case 'email':
        if (!EMAIL_RE.test(v) || v.length > MAX_TEXT) {
          return { ok: false, message: `「${f.label}」はメールアドレスの形式で入力してください` };
        }
        break;
      case 'tel':
        if (!TEL_RE.test(v)) return { ok: false, message: `「${f.label}」は電話番号の形式で入力してください` };
        break;
      case 'date':
        if (!DATE_RE.test(v)) return { ok: false, message: `「${f.label}」は日付を選択してください` };
        break;
      case 'select':
      case 'radio':
        if (!(f.options || []).includes(v)) return { ok: false, message: `「${f.label}」の選択内容が不正です` };
        break;
      default:
        if (v.length > MAX_TEXT) return { ok: false, message: `「${f.label}」が長すぎます` };
    }
    data[f.id] = v;
  }
  return { ok: true, data };
}

/** 様式の項目定義を検証する（管理画面用） */
export function validateFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    return { ok: false, message: '項目を1つ以上設定してください' };
  }
  if (fields.length > 50) return { ok: false, message: '項目は最大50個までです' };

  const seen = new Set();
  const out = [];
  for (let i = 0; i < fields.length; i += 1) {
    const f = fields[i];
    const label = sanitizeText(f.label || '');
    if (!label) return { ok: false, message: `項目${i + 1}の項目名を入力してください` };
    if (label.length > 100) return { ok: false, message: `項目${i + 1}の項目名が長すぎます` };

    let id = String(f.id || '').replace(/[^A-Za-z0-9_]/g, '');
    if (!id) id = `f${i + 1}`;
    while (seen.has(id)) id = `${id}_`;
    seen.add(id);

    const item = { id, label, type: f.type, required: Boolean(f.required) };
    if (f.type === 'zip_address') {
      item.addressLabel = sanitizeText(f.addressLabel || '住所（自動表示）');
    }
    if (['select', 'radio', 'checkbox'].includes(f.type)) {
      const options = String(f.optionsText || '')
        .split('\n')
        .map(sanitizeText)
        .filter(Boolean);
      if (options.length === 0) {
        return { ok: false, message: `項目「${label}」の選択肢を1つ以上入力してください` };
      }
      item.options = options;
    }
    out.push(item);
  }
  return { ok: true, fields: out };
}
