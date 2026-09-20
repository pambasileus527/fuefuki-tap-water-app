import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { createForm, toUserMessage } from '../lib/db';
import { validateFields, sanitizeText } from '../lib/validate';
import FieldEditor from './FieldEditor';

export default function AdminNewForm() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submittedNote, setSubmittedNote] = useState('');
  const [fields, setFields] = useState([
    { label: '住所', type: 'textarea', required: true, optionsText: '' },
  ]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    const t = sanitizeText(title);
    if (!t) { setError('様式のタイトルを入力してください'); return; }
    const v = validateFields(fields);
    if (!v.ok) { setError(v.message); return; }

    setBusy(true);
    try {
      const formId = await createForm({
        title: t,
        description: sanitizeText(description),
        submittedNote: sanitizeText(submittedNote),
        fields: v.fields,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }, auth.currentUser.uid);
      navigate(`/admin/forms/${formId}`);
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>申請様式を作成</h1>
      <div className="alert info">
        氏名・電話番号・お客様番号などは、この項目リストに含めないでください。
        それらは提出後、職員が「事前申請番号で検索・基本情報の入力」画面から別途入力します。
      </div>
      {error ? <div className="alert error">{error}</div> : null}

      <form onSubmit={submit}>
        <label className="field">
          様式のタイトル
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：○○給付金 申請書" required />
        </label>
        <label className="field">
          説明（任意・申請画面の先頭に表示されます）
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="field">
          受付終了日時（任意・空欄なら無期限）
          <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </label>
        <label className="field">
          提出完了時の案内文（任意・例：連絡先センターの案内など）
          <textarea
            value={submittedNote}
            onChange={(e) => setSubmittedNote(e.target.value)}
            placeholder="例：この事前申請番号を、笛吹市上下水道料金センターへお伝えください。お客様番号・氏名・電話番号・詳しいご住所を確認後、手続きを完了します。"
          />
        </label>

        <h2>申請項目</h2>
        <FieldEditor fields={fields} setFields={setFields} />

        <div className="btn-row">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? '作成しています…' : '様式を作成'}
          </button>
        </div>
      </form>
    </div>
  );
}
