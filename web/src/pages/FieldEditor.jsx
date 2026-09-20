import React from 'react';

export const FIELD_TYPE_LABELS = [
  ['text', 'テキスト'],
  ['textarea', '長文テキスト'],
  ['number', '数字'],
  ['email', 'メールアドレス'],
  ['tel', '電話番号'],
  ['date', '日付'],
  ['select', '選択式（プルダウン）'],
  ['radio', 'ラジオボタン'],
  ['checkbox', 'チェックボックス'],
  ['zip_address', '郵便番号＋住所自動入力'],
];

const NEEDS_OPTIONS = ['select', 'radio', 'checkbox'];

/** フォーム項目の編集UI（作成画面・編集画面で共用） */
export default function FieldEditor({ fields, setFields }) {
  const update = (i, patch) => setFields(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i) => setFields(fields.filter((_, idx) => idx !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[i], next[j]] = [next[j], next[i]];
    setFields(next);
  };
  const add = () => setFields([...fields, { label: '', type: 'text', required: true, optionsText: '' }]);

  return (
    <div>
      {fields.map((f, i) => (
        <div className="card" key={i}>
          <p style={{ fontWeight: 700, margin: 0 }}>項目 {i + 1}</p>
          <label className="field">
            項目名
            <input
              type="text"
              value={f.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="例：氏名"
            />
          </label>
          <label className="field">
            種類
            <select value={f.type} onChange={(e) => update(i, { type: e.target.value })}>
              {FIELD_TYPE_LABELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {NEEDS_OPTIONS.includes(f.type) ? (
            <label className="field">
              選択肢（1行に1つ）
              <textarea
                value={f.optionsText || ''}
                onChange={(e) => update(i, { optionsText: e.target.value })}
                placeholder={'はい\nいいえ'}
              />
            </label>
          ) : null}
          {f.type === 'zip_address' ? (
            <label className="field">
              自動表示される住所欄のラベル
              <input
                type="text"
                value={f.addressLabel || ''}
                onChange={(e) => update(i, { addressLabel: e.target.value })}
                placeholder="例：住所（自動表示・確認用）"
              />
            </label>
          ) : null}
          <label className="choice">
            <input
              type="checkbox"
              checked={Boolean(f.required)}
              onChange={(e) => update(i, { required: e.target.checked })}
            />
            必須にする
          </label>
          <div className="btn-row">
            <button type="button" className="secondary" onClick={() => move(i, -1)} disabled={i === 0}>上へ</button>
            <button type="button" className="secondary" onClick={() => move(i, 1)} disabled={i === fields.length - 1}>下へ</button>
            <button type="button" className="danger" onClick={() => remove(i)}>削除</button>
          </div>
        </div>
      ))}
      <div className="btn-row">
        <button type="button" className="secondary" onClick={add}>項目を追加</button>
      </div>
    </div>
  );
}

/** 画面上の項目定義を、API に送る形へ変換する */
export function toApiFields(fields) {
  return fields.map((f, i) => {
    const out = { id: f.id || `f${i + 1}`, label: f.label, type: f.type, required: Boolean(f.required) };
    if (NEEDS_OPTIONS.includes(f.type)) {
      out.options = String(f.optionsText || '').split('\n').map((s) => s.trim()).filter(Boolean);
    }
    if (f.type === 'zip_address') {
      out.addressLabel = f.addressLabel || '住所（自動表示）';
    }
    return out;
  });
}

/** API から取得した項目定義を、画面用の形へ変換する */
export function fromApiFields(fields) {
  return (fields || []).map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    required: Boolean(f.required),
    optionsText: (f.options || []).join('\n'),
    addressLabel: f.addressLabel || '',
  }));
}
