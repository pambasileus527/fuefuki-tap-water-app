import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchApplicant, fetchForm, saveAnswers, toUserMessage } from '../lib/db';
import { validateAnswers } from '../lib/validate';
import { isValidApplicantId, formatId } from '../lib/ids';
import { formatDateTime } from '../lib/csv';
import { lookupZipAddress, formatZip } from '../lib/zip';

function initialValues(fields, answers) {
  const v = {};
  for (const f of fields) {
    const stored = answers ? answers[f.id] : undefined;
    if (f.type === 'checkbox') v[f.id] = Array.isArray(stored) ? stored : [];
    else if (f.type === 'zip_address') {
      v[f.id] = stored && typeof stored === 'object'
        ? { zip: stored.zip || '', address: stored.address || '' }
        : { zip: '', address: '' };
    } else v[f.id] = stored === undefined || stored === null ? '' : String(stored);
  }
  return v;
}

/** 確認・提出後の画面で値を人が読める文字列にする */
function displayValue(field, value) {
  if (field.type === 'zip_address') {
    if (!value || !value.zip) return '（未入力）';
    return `〒${formatZip(value.zip)}${value.address ? `　${value.address}` : ''}`;
  }
  if (Array.isArray(value)) return value.join('、') || '（未選択）';
  return value || '（未入力）';
}

export default function Apply() {
  const { applicantId } = useParams();
  const [state, setState] = useState('loading');
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null);
  const [applicant, setApplicant] = useState(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!isValidApplicantId(applicantId)) throw Object.assign(new Error(), { code: 'not-found' });
        const a = await fetchApplicant(applicantId);
        if (!a) throw Object.assign(new Error(), { code: 'not-found' });
        const f = await fetchForm(a.formId);
        if (!f) throw Object.assign(new Error(), { code: 'not-found' });
        if (!alive) return;
        setApplicant(a);
        setForm(f);
        setValues(initialValues(f.fields || [], a.answers));
        setState(a.submitted ? 'submitted' : 'editing');
      } catch (e) {
        if (!alive) return;
        const code = e && e.code ? String(e.code) : '';
        setLoadError(code.includes('not-found')
          ? 'この事前申請番号は見つかりませんでした。お手元の番号をご確認のうえ、担当窓口へお問い合わせください。'
          : toUserMessage(e));
        setState('error');
      }
    })();
    return () => { alive = false; };
  }, [applicantId]);

  const fields = useMemo(() => (form ? form.fields || [] : []), [form]);

  const setValue = (id, v) => {
    dirty.current = true;
    setNotice('');
    setValues((prev) => ({ ...prev, [id]: v }));
  };

  async function save(submit) {
    setError('');
    setNotice('');
    const result = validateAnswers(fields, values, !submit);
    if (!result.ok) {
      setError(result.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setBusy(true);
    try {
      await saveAnswers(applicantId, result.data, submit);
      dirty.current = false;
      if (submit) {
        setState('submitted');
        setApplicant({ ...applicant, submitted: true, submittedAt: new Date() });
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setNotice('一時保存しました。あとから同じURLで続きを入力できます。');
      }
    } catch (e) {
      setError(toUserMessage(e));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  // 自動保存（1分ごと・変更があるときだけ）
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    if (state !== 'editing') return undefined;
    const timer = setInterval(() => {
      if (dirty.current && !busy) saveRef.current(false);
    }, 60000);
    return () => clearInterval(timer);
  }, [state, busy]);

  // 未保存のまま閉じようとしたときの警告
  useEffect(() => {
    const handler = (e) => {
      if (state === 'editing' && dirty.current) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state]);

  if (state === 'loading') return <div className="spinner">読み込んでいます…</div>;

  if (state === 'error') {
    return (
      <div>
        <h1>申請フォーム</h1>
        <div className="alert error">{loadError}</div>
      </div>
    );
  }

  if (state === 'submitted') {
    return (
      <div>
        <h1>{form.title}</h1>
        <div className="alert success">提出が完了しました。ありがとうございました。</div>
        <div className="card">
          <p>事前申請番号</p>
          <div className="credential">{formatId(applicantId)}</div>
          <p className="muted">提出日時：{formatDateTime(applicant.submittedAt) || '—'}</p>
        </div>
        {form.submittedNote ? (
          <div className="alert info">{form.submittedNote}</div>
        ) : null}
        <p className="muted">
          提出後の内容は変更できません。訂正が必要な場合は担当窓口へご連絡ください。
        </p>
        <h2>提出した内容</h2>
        {fields.map((f) => (
          <div className="card" key={f.id}>
            <p style={{ fontWeight: 700, margin: 0 }}>{f.label}</p>
            <p style={{ margin: '6px 0 0' }}>{displayValue(f, values[f.id])}</p>
          </div>
        ))}
      </div>
    );
  }

  if (confirming) {
    return (
      <div>
        <h1>入力内容の確認</h1>
        <div className="alert info">
          この内容で提出します。<strong>提出後は修正できません。</strong>
        </div>
        {fields.map((f) => (
          <div className="card" key={f.id}>
            <p style={{ fontWeight: 700, margin: 0 }}>{f.label}</p>
            <p style={{ margin: '6px 0 0' }}>{displayValue(f, values[f.id])}</p>
          </div>
        ))}
        <div className="btn-row">
          <button className="primary" type="button" disabled={busy} onClick={() => save(true)}>
            {busy ? '提出しています…' : 'この内容で提出する'}
          </button>
          <button className="secondary" type="button" disabled={busy} onClick={() => setConfirming(false)}>
            入力に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>{form.title}</h1>
      {form.description ? <p>{form.description}</p> : null}

      <div className="card">
        <p style={{ margin: 0 }}>事前申請番号</p>
        <div className="credential">{formatId(applicantId)}</div>
      </div>

      {error ? <div className="alert error">{error}</div> : null}
      {notice ? <div className="alert success">{notice}</div> : null}

      <form onSubmit={(e) => { e.preventDefault(); setConfirming(true); }}>
        {fields.map((f) => (
          <Field key={f.id} field={f} value={values[f.id]} onChange={(v) => setValue(f.id, v)} />
        ))}
        <div className="btn-row">
          <button className="primary" type="submit" disabled={busy}>入力内容を確認する</button>
          <button className="secondary" type="button" disabled={busy} onClick={() => save(false)}>
            {busy ? '保存しています…' : '一時保存（あとで続ける）'}
          </button>
        </div>
      </form>
      <p className="muted">
        「一時保存」した内容は、同じURLを開けばどの端末からでも続きを入力できます。
      </p>
    </div>
  );
}

function Field({ field, value, onChange }) {
  const badge = field.required
    ? <span className="required-badge">必須</span>
    : <span className="optional-badge">任意</span>;

  if (field.type === 'zip_address') {
    return <ZipAddressField field={field} value={value} onChange={onChange} badge={badge} />;
  }

  if (field.type === 'textarea') {
    return (
      <label className="field">
        {field.label}{badge}
        <textarea value={value} onChange={(e) => onChange(e.target.value)} required={field.required} />
      </label>
    );
  }

  if (field.type === 'select') {
    return (
      <label className="field">
        {field.label}{badge}
        <select value={value} onChange={(e) => onChange(e.target.value)} required={field.required}>
          <option value="">選択してください</option>
          {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }

  if (field.type === 'radio') {
    return (
      <div className="field" role="group">
        <span style={{ fontWeight: 700 }}>{field.label}{badge}</span>
        {(field.options || []).map((o) => (
          <label className="choice" key={o}>
            <input type="radio" name={field.id} value={o} checked={value === o} onChange={() => onChange(o)} />
            {o}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div className="field" role="group">
        <span style={{ fontWeight: 700 }}>{field.label}{badge}</span>
        {(field.options || []).map((o) => (
          <label className="choice" key={o}>
            <input
              type="checkbox"
              checked={arr.includes(o)}
              onChange={(e) => onChange(e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))}
            />
            {o}
          </label>
        ))}
      </div>
    );
  }

  const typeMap = { text: 'text', number: 'number', email: 'email', tel: 'tel', date: 'date' };
  const inputMode = field.type === 'number' ? 'decimal' : field.type === 'tel' ? 'tel' : undefined;

  return (
    <label className="field">
      {field.label}{badge}
      <input
        type={typeMap[field.type] || 'text'}
        inputMode={inputMode}
        value={value}
        required={field.required}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

/** 郵便番号を入力すると住所を自動表示する項目 */
function ZipAddressField({ field, value, onChange, badge }) {
  const v = value && typeof value === 'object' ? value : { zip: '', address: '' };
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function search() {
    setMessage('');
    setBusy(true);
    const result = await lookupZipAddress(v.zip);
    setBusy(false);
    if (result.ok) {
      onChange({ zip: v.zip, address: result.address });
    } else {
      onChange({ zip: v.zip, address: '' });
      setMessage(result.message);
    }
  }

  return (
    <div>
      <label className="field">
        {field.label}{badge}
      </label>
      <div className="zip-row">
        <input
          type="text"
          inputMode="numeric"
          value={v.zip}
          placeholder="例：406-0032"
          required={field.required}
          onChange={(e) => onChange({ zip: e.target.value, address: v.address })}
        />
        <button type="button" className="secondary" disabled={busy || !v.zip} onClick={search}>
          {busy ? '検索中…' : '住所を検索'}
        </button>
      </div>
      {message ? <p className="muted" style={{ color: '#b3261e' }}>{message}</p> : null}
      <label className="field">
        {field.addressLabel || '住所（自動表示）'}
        <input type="text" value={v.address} readOnly placeholder="郵便番号を入力して「住所を検索」を押してください" />
      </label>
    </div>
  );
}
