import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  fetchForm, fetchApplicant, listApplicants, updateForm, deleteForm,
  reopenApplicant, updateApplicantMemo, saveApplicantBasicInfo, toUserMessage,
} from '../lib/db';
import { buildCsv, downloadCsv, formatDateTime } from '../lib/csv';
import { formatId, isValidApplicantId } from '../lib/ids';
import { formatZip } from '../lib/zip';
import { validateFields, sanitizeText } from '../lib/validate';
import FieldEditor, { fromApiFields } from './FieldEditor';

export default function AdminFormDetail() {
  const { formId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [title, setTitle] = useState('');
  const [fields, setFields] = useState([]);
  const [submittedNote, setSubmittedNote] = useState('');
  const [includeUnsubmitted, setIncludeUnsubmitted] = useState(true);

  const [searchId, setSearchId] = useState('');
  const [searchError, setSearchError] = useState('');
  const [found, setFound] = useState(null);
  const [basicInfo, setBasicInfo] = useState({
    customerNo: '', kana: '', name: '', phone: '', addressExtra: '',
  });

  async function reload() {
    const f = await fetchForm(formId);
    if (!f) throw Object.assign(new Error(), { code: 'not-found' });
    const list = await listApplicants(formId);
    setForm(f);
    setTitle(f.title);
    setSubmittedNote(f.submittedNote || '');
    setFields(fromApiFields(f.fields));
    setApplicants(list);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await reload();
      } catch (e) {
        if (alive) setError(toUserMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  async function run(fn, successMessage) {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const r = await fn();
      if (successMessage) setNotice(successMessage);
      return r;
    } catch (e) {
      setError(toUserMessage(e));
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="spinner">読み込んでいます…</div>;
  if (!form) return <div className="alert error">{error || '様式が見つかりません'}</div>;

  const origin = window.location.origin;
  const urlOf = (id) => `${origin}/apply/${id}`;
  const startUrl = `${origin}/start/${formId}`;
  const submittedCount = applicants.filter((a) => a.submitted).length;
  const unconfirmedCount = applicants.filter((a) => a.submitted && !a.basicInfo).length;

  /** 参考表示用：回答内容を人が読める文字列にする */
  function displayAnswer(field, answers) {
    const v = answers ? answers[field.id] : undefined;
    if (field.type === 'zip_address') {
      if (!v || !v.zip) return '（未入力）';
      return `〒${formatZip(v.zip)}${v.address ? `　${v.address}` : ''}`;
    }
    if (Array.isArray(v)) return v.join('、') || '（未選択）';
    return v || '（未入力）';
  }

  async function doSearch(idOverride) {
    setSearchError('');
    setFound(null);
    const id = (idOverride || searchId).trim().toUpperCase().replace(/[\s-]/g, '');
    if (!isValidApplicantId(id)) { setSearchError('事前申請番号の形式が正しくありません'); return; }
    setBusy(true);
    try {
      const a = await fetchApplicant(id);
      if (!a || a.formId !== formId) {
        setSearchError('この様式の事前申請番号として見つかりませんでした');
        return;
      }
      setFound(a);
      const b = a.basicInfo || {};
      setBasicInfo({
        customerNo: b.customerNo || '',
        kana: b.kana || '',
        name: b.name || '',
        phone: b.phone || '',
        addressExtra: b.addressExtra || '',
      });
    } catch (e) {
      setSearchError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>{form.title}</h1>
      {error ? <div className="alert error">{error}</div> : null}
      {notice ? <div className="alert success">{notice}</div> : null}

      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          状態：{form.status === 'active' ? '受付中' : '停止中'}<br />
          発行済み事前申請番号：{applicants.length} 件／提出済み：{submittedCount} 件<br />
          基本情報 未確認：{unconfirmedCount} 件<br />
          受付終了：{formatDateTime(form.expiresAt) || '設定なし'}
        </p>
      </div>

      {/* ------------------ 公開受付URL（自己受付） ------------------ */}
      <h2>公開受付用URL</h2>
      <p className="muted">
        この様式専用の入口URLです。市の公式サイト等にリンクしておくと、
        訪れた方がその場で事前申請番号を自分で受け取り、申請を始められます。
      </p>
      <div className="card">
        <div className="credential">{startUrl}</div>
        <div className="btn-row">
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(startUrl);
                setNotice('公開受付用URLをコピーしました');
              } catch (e) {
                setError('コピーできませんでした。画面の文字を選択してコピーしてください。');
              }
            }}
          >
            URLをコピー
          </button>
        </div>
      </div>

      <div className="alert info">
        トップページ（/）を開いた人を自動的にこの様式の受付画面へ転送したい場合は、
        下の様式ID（<span style={{ fontFamily: 'monospace' }}>{formId}</span>）を
        <code>web/src/config.js</code> の <code>PRIMARY_FORM_ID</code> に書き込んでデプロイしてください。
        <div className="btn-row">
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(formId);
                setNotice('様式IDをコピーしました');
              } catch (e) {
                setError('コピーできませんでした。画面の文字を選択してコピーしてください。');
              }
            }}
          >
            様式IDをコピー
          </button>
        </div>
      </div>

      {/* ------------------ 事前申請番号で検索・基本情報の追記 ------------------ */}
      <h2>事前申請番号で検索・基本情報の入力</h2>
      <p className="muted">
        お客様から電話・窓口で伝えられた事前申請番号を入力して検索し、
        本人確認したお客様番号・氏名・電話番号・住所の続きを入力してください。
        この内容はお客様側の画面には表示されません。
      </p>
      <label className="field">
        事前申請番号
        <input
          type="text"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          placeholder="例：K7M2-XQ4P-B6Z3-H8N5-R9TD"
          autoCapitalize="characters"
        />
      </label>
      {searchError ? <div className="alert error">{searchError}</div> : null}
      <div className="btn-row">
        <button type="button" className="secondary" disabled={busy} onClick={() => doSearch()}>検索</button>
      </div>

      {found ? (
        <>
          <div className="card">
            <p className="muted" style={{ margin: 0 }}>お客様がWebで入力済みの内容（参考）</p>
            {fields.length === 0 ? <p className="muted">項目がありません</p> : null}
            {(form.fields || []).map((f) => (
              <p key={f.id} style={{ margin: '6px 0 0' }}>
                <strong>{f.label}：</strong>{displayAnswer(f, found.answers)}
              </p>
            ))}
            <p className="muted" style={{ marginTop: 10 }}>
              状態：{found.submitted ? '提出済み' : '未提出'}
            </p>
          </div>

          <div className="card">
            <label className="field">お客様番号
              <input type="text" value={basicInfo.customerNo} onChange={(e) => setBasicInfo({ ...basicInfo, customerNo: e.target.value })} />
            </label>
            <label className="field">フリガナ
              <input type="text" value={basicInfo.kana} onChange={(e) => setBasicInfo({ ...basicInfo, kana: e.target.value })} />
            </label>
            <label className="field">氏名
              <input type="text" value={basicInfo.name} onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })} />
            </label>
            <label className="field">電話番号
              <input type="tel" value={basicInfo.phone} onChange={(e) => setBasicInfo({ ...basicInfo, phone: e.target.value })} />
            </label>
            <label className="field">番地・建物名など（住所の続き）
              <input type="text" value={basicInfo.addressExtra} onChange={(e) => setBasicInfo({ ...basicInfo, addressExtra: e.target.value })} placeholder="例：123番地 〇〇マンション201号室" />
            </label>
          </div>
          <div className="btn-row">
            <button
              type="button"
              className="primary"
              disabled={busy}
              onClick={async () => {
                const r = await run(() => saveApplicantBasicInfo(found.id, basicInfo), '基本情報を保存しました');
                if (r !== null) await run(() => reload());
              }}
            >
              基本情報を保存
            </button>
          </div>
        </>
      ) : null}

      {/* ------------------ 申請の一覧とCSV ------------------ */}
      <h2>申請の状況</h2>
      <label className="choice">
        <input
          type="checkbox"
          checked={includeUnsubmitted}
          onChange={(e) => setIncludeUnsubmitted(e.target.checked)}
        />
        未提出の申請者もCSVに含める
      </label>
      <div className="btn-row">
        <button
          type="button"
          className="primary"
          disabled={applicants.length === 0}
          onClick={() => {
            const csv = buildCsv(form, applicants, { includeUnsubmitted });
            downloadCsv(`form_${formId}.csv`, csv);
            setNotice('CSVをダウンロードしました');
          }}
        >
          CSVをダウンロード
        </button>
      </div>

      {applicants.length === 0 ? (
        <p className="muted">まだ事前申請番号が発行されていません。</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>事前申請番号</th>
                <th>メモ</th>
                <th>状態</th>
                <th>基本情報</th>
                <th>提出日時</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 14 }}>{formatId(a.id)}</td>
                  <td>
                    <input
                      type="text"
                      defaultValue={a.memo || ''}
                      style={{ fontSize: 15, padding: 6, marginTop: 0 }}
                      onBlur={(e) => {
                        const memo = sanitizeText(e.target.value);
                        if (memo !== (a.memo || '')) run(() => updateApplicantMemo(a.id, memo), 'メモを保存しました');
                      }}
                    />
                  </td>
                  <td>
                    <span className={`status-badge ${a.submitted ? 'status-active' : 'status-disabled'}`}>
                      {a.submitted ? '提出済み' : '未提出'}
                    </span>
                  </td>
                  <td>
                    {a.basicInfo ? (
                      <span className="status-badge status-active">確認済み</span>
                    ) : (
                      <span className="status-badge status-disabled">未確認</span>
                    )}
                  </td>
                  <td>{formatDateTime(a.submittedAt) || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="secondary"
                        style={{ fontSize: 14, padding: '6px 10px', minHeight: 0 }}
                        onClick={() => { setSearchId(a.id); doSearch(a.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      >
                        基本情報
                      </button>
                      {a.submitted ? (
                        <button
                          type="button"
                          className="secondary"
                          style={{ fontSize: 14, padding: '6px 10px', minHeight: 0 }}
                          disabled={busy}
                          onClick={async () => {
                            if (!window.confirm('この申請を修正できる状態に戻します。よろしいですか？')) return;
                            const r = await run(() => reopenApplicant(a.id), '修正できる状態に戻しました');
                            if (r !== null) await run(() => reload());
                          }}
                        >
                          修正を許可
                        </button>
                      ) : (
                        <a href={urlOf(a.id)} target="_blank" rel="noreferrer">URL</a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------ 様式の設定 ------------------ */}
      <h2>様式の設定</h2>
      <div className="btn-row">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={async () => {
            const next = form.status === 'active' ? 'disabled' : 'active';
            const r = await run(
              () => updateForm(formId, { status: next }),
              next === 'active' ? '受付を再開しました' : '受付を停止しました',
            );
            if (r !== null) setForm({ ...form, status: next });
          }}
        >
          {form.status === 'active' ? '受付を停止する' : '受付を再開する'}
        </button>
        <button
          type="button"
          className="danger"
          disabled={busy}
          onClick={async () => {
            if (!window.confirm('この様式を削除します。申請データは残りますが、一覧に表示されなくなります。よろしいですか？')) return;
            const r = await run(() => deleteForm(formId));
            if (r !== null) navigate('/admin');
          }}
        >
          様式を削除
        </button>
      </div>

      <label className="field">
        様式のタイトル
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field">
        提出完了時の案内文（任意）
        <textarea value={submittedNote} onChange={(e) => setSubmittedNote(e.target.value)} />
      </label>
      <FieldEditor fields={fields} setFields={setFields} />
      <div className="btn-row">
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={async () => {
            const t = sanitizeText(title);
            if (!t) { setError('様式のタイトルを入力してください'); return; }
            const v = validateFields(fields);
            if (!v.ok) { setError(v.message); return; }
            const r = await run(
              () => updateForm(formId, { title: t, fields: v.fields, submittedNote: sanitizeText(submittedNote) }),
              '保存しました',
            );
            if (r !== null) await run(() => reload());
          }}
        >
          変更を保存
        </button>
      </div>
      <p className="muted">
        すでに申請がある状態で項目名を変えると、CSVの見出しも変わります。項目を削除すると、その列は出力されなくなります。
      </p>

      <ul className="link-list">
        <li><Link to="/admin">職員用メニューへ戻る</Link></li>
      </ul>
    </div>
  );
}
