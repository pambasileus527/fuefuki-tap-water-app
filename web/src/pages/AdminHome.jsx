import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { listForms, toUserMessage } from '../lib/db';
import { formatDateTime } from '../lib/csv';

export default function AdminHome() {
  const [forms, setForms] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const f = await listForms();
        if (alive) setForms(f);
      } catch (e) {
        if (alive) setError(toUserMessage(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) return <div className="spinner">読み込んでいます…</div>;

  return (
    <div>
      <h1>職員用メニュー</h1>
      {error ? <div className="alert error">{error}</div> : null}

      <div className="btn-row">
        <button className="primary" onClick={() => navigate('/admin/new')}>申請様式を作成</button>
        <button className="secondary" onClick={async () => { await signOut(auth); navigate('/admin/login'); }}>
          ログアウト
        </button>
      </div>

      <h2>申請様式の一覧</h2>
      {forms.length === 0 ? (
        <p className="muted">まだ様式がありません。「申請様式を作成」から始めてください。</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>様式名</th>
                <th>状態</th>
                <th>作成日時</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id}>
                  <td><Link to={`/admin/forms/${f.id}`}>{f.title}</Link></td>
                  <td>
                    <span className={`status-badge ${f.status === 'active' ? 'status-active' : 'status-disabled'}`}>
                      {f.status === 'active' ? '受付中' : '停止中'}
                    </span>
                  </td>
                  <td>{formatDateTime(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="muted">
        このシステムには氏名などの個人を特定する情報は保存されません。
        申請者IDと本人の対応は、行政側で別に管理してください。
      </p>
    </div>
  );
}
