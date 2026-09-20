import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { startApplication, fetchForm, toUserMessage } from '../lib/db';
import { isValidFormId, formatId } from '../lib/ids';

/**
 * 自己受付の入口。/start/:formId を開くと、まず様式の説明と
 * 「事前申請を開始」ボタンを表示する（この時点ではまだ何も発行しない）。
 * ボタンを押した瞬間に初めて「事前申請番号」を発行し、番号を画面に表示。
 * 「申請入力を続ける」を押して /apply/:applicantId に進む
 * （番号を自分で入力し直す必要はない）。
 *
 * ※ページを開いただけでは番号を発行しない設計にしている。
 *   リンクを共有した際のプレビュー取得（bot等の自動アクセス）で
 *   意図せず番号が発行されてしまうのを防ぐため。
 *
 * 中身の本体。formId を props で受け取る。
 * ・/start/:formId ルート（Start）と、トップページ（Home、URLを変えずに
 *   同じ画面をそのまま表示したい場合）の両方から使う。
 */
export function StartForm({ formId }) {
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [applicantId, setApplicantId] = useState('');

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!isValidFormId(formId)) throw Object.assign(new Error(), { code: 'not-found' });

        const f = await fetchForm(formId);
        if (!f || f.deleted) throw Object.assign(new Error(), { code: 'not-found' });
        if (f.status !== 'active') {
          throw Object.assign(new Error(), { code: 'permission-denied' });
        }

        if (!alive) return;
        setForm(f);
        setState('confirm');
      } catch (e) {
        if (!alive) return;

        const code = e && e.code ? String(e.code) : '';
        if (code.includes('not-found')) {
          setError('このページは見つかりませんでした。URLをご確認ください。');
        } else if (code.includes('permission-denied')) {
          setError('現在この申請の受付は行っておりません。');
        } else {
          setError(toUserMessage(e));
        }
        setState('error');
      }
    })();

    return () => { alive = false; };
  }, [formId]);

  async function begin() {
    setState('issuing');
    setError('');
    try {
      const id = await startApplication(formId);
      setApplicantId(id);
      setState('issued');
    } catch (e) {
      setError(toUserMessage(e));
      setState('confirm');
    }
  }

  if (state === 'loading') return <div className="spinner">読み込んでいます…</div>;

  if (state === 'error') {
    return (
      <main className="page shell">
        <section className="panel">
          <h1>事前申請</h1>
          <p className="error">{error}</p>
        </section>
      </main>
    );
  }

  if (state === 'confirm' || state === 'issuing') {
    return (
      <main className="page shell">
        <section className="panel">
          <h1>{form.title}</h1>
          {form.description ? <p>{form.description}</p> : null}

          <div className="stack">
            <p>
              お名前や電話番号などの入力は不要です。ボタンを押すと「事前申請番号」が発行され、
              入力画面に進みます。
            </p>

            {error ? <p className="error">{error}</p> : null}

            <button className="primary" onClick={begin} disabled={state === 'issuing'}>
              {state === 'issuing' ? '発行しています…' : '事前申請を開始'}
            </button>

            <div className="btn-row">
              <Link className="secondary" to="/resume">すでに発行済みの事前申請番号をお持ちの方はこちら</Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="page shell">
      <section className="panel">
        <h1>事前申請番号が発行されました</h1>

        <div className="stack">
          <div>
            <p className="label">事前申請番号</p>
            <p className="code">{formatId(applicantId)}</p>
          </div>

          <p>
            この番号は、途中でブラウザを閉じたときなど、入力を再開するために使います。
            念のため控えておくと安心ですが、控え忘れても問題ありません（下のボタンからそのまま入力に進めます）。
          </p>

          <Link className="primary" to={`/apply/${applicantId}`}>
            申請入力を続ける
          </Link>
        </div>
      </section>
    </main>
  );
}

/** /start/:formId ルート用（URLに様式IDを含む形でアクセスされた場合） */
export default function Start() {
  const { formId } = useParams();
  return <StartForm formId={formId} />;
}
