import React from 'react';
import { Link } from 'react-router-dom';
import { isValidFormId } from '../lib/ids';
import { PRIMARY_FORM_ID } from '../config';
import { StartForm } from './Start';

/**
 * トップページ（/）。
 * このシステムは水道使用休止・廃止届の専用運用のため、
 * web/src/config.js の PRIMARY_FORM_ID にその様式IDを設定しておけば、
 * トップページを開いた人には（URLを /start/ に切り替えることなく）
 * そのまま「事前申請を開始」画面が表示される。
 * 未設定の場合は、事前申請番号を入力して続きから入力する画面（/resume）へ誘導する。
 */
export default function Home() {
  if (isValidFormId(PRIMARY_FORM_ID)) {
    return <StartForm formId={PRIMARY_FORM_ID} />;
  }

  return (
    <main className="page shell">
      <section className="panel">
        <h1>申請フォーム</h1>
        <p>現在ご案内できる申請はありません。</p>

        <div className="stack">
          <p>
            以前「事前申請を開始」した際に発行された事前申請番号をお持ちの方は、
            続きから入力できます。
          </p>

          <div className="btn-row vertical">
            <Link className="primary" to="/resume">事前申請番号を入力して続きから入力する</Link>
            <Link className="secondary" to="/admin">職員の方はこちら</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
