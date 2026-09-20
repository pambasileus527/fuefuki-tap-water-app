import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate((location.state && location.state.from) || '/admin', { replace: true });
    } catch (err) {
      // 内部情報を出さないため、原因の詳細は表示しない
      setError('メールアドレスまたはパスワードが正しくありません');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>管理者ログイン</h1>
      {error ? <div className="alert error">{error}</div> : null}
      <form onSubmit={submit}>
        <label className="field">
          メールアドレス
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </label>
        <label className="field">
          パスワード
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        </label>
        <div className="btn-row">
          <button className="primary" type="submit" disabled={busy}>{busy ? 'ログイン中…' : 'ログイン'}</button>
        </div>
      </form>
    </div>
  );
}
