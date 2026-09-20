import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { isValidApplicantId } from '../lib/ids';

export default function Resume() {
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  function open(e) {
    e.preventDefault();
    // 区切りのハイフンや空白が入っていても受け付ける
    const cleaned = id.trim().toUpperCase().replace(/[\s-]/g, '');
    if (!isValidApplicantId(cleaned)) {
      setError('事前申請番号の形式が正しくありません。お手元の番号をご確認ください。');
      return;
    }
    navigate(`/apply/${cleaned}`);
  }

  return (
    <div>
      <h1>申請フォーム</h1>
      <p>
        以前「事前申請を開始」した際に表示された<strong>事前申請番号</strong>をお持ちの方は、
        こちらから入力の続きができます。24時間いつでもご利用いただけます。
      </p>
      <p className="muted">
        まだ事前申請番号をお持ちでない方は、ご案内されたページの「事前申請を開始」ボタンから始めてください
        （このページでは新規の事前申請番号は発行されません）。
      </p>

      {error ? <div className="alert error">{error}</div> : null}

      <form onSubmit={open}>
        <label className="field">
          事前申請番号
          <input
            type="text"
            value={id}
            onChange={(e) => { setId(e.target.value); setError(''); }}
            placeholder="例：K7M2-XQ4P-B6Z3-H8N5-R9TD"
            autoCapitalize="characters"
            autoComplete="off"
            required
          />
        </label>
        <div className="btn-row">
          <button className="primary" type="submit">入力を続ける</button>
        </div>
      </form>

      <p className="muted">
        事前申請番号は他の方に教えないでください。番号をお持ちの方だけが、その申請内容を入力・確認できます。
      </p>

      <ul className="link-list">
        <li><Link to="/admin">職員の方はこちら</Link></li>
      </ul>
    </div>
  );
}
