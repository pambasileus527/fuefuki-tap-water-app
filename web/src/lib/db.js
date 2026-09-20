// Firestore へのアクセスをまとめたモジュール。
// 読み書きの可否は firestore.rules が判定するため、ここは「何を読み書きするか」だけを扱う。
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc,
  query, where, orderBy, limit, serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../firebase';
import { generateFormId, generateApplicantId } from './ids';
import { currentRateLimitBucket, rateLimitBucketExpiry, APPLICANT_TTL_HOURS } from './rateLimit';

/** 発行数の上限に達したときに投げる専用エラー */
export class RateLimitedError extends Error {
  constructor() {
    super('rate-limited');
    this.code = 'app/rate-limited';
  }
}

/** ユーザーに見せるメッセージへ変換する（内部情報は出さない） */
export function toUserMessage(err) {
  if (err instanceof RateLimitedError || (err && err.code === 'app/rate-limited')) {
    return 'アクセスが集中しています。しばらく時間をおいて、再度お試しください。';
  }
  const code = err && err.code ? String(err.code) : '';
  if (code.includes('permission-denied')) {
    return 'この操作は許可されていません。受付が終了しているか、すでに提出済みの可能性があります。'
      + '（アクセスが集中している場合もあります。しばらくしてから再度お試しください。）';
  }
  if (code.includes('unavailable') || code.includes('network')) {
    return '通信エラーが発生しました。電波状況を確認して、もう一度お試しください。';
  }
  if (code.includes('not-found')) return '対象が見つかりませんでした。';
  return 'エラーが発生しました。しばらくしてからもう一度お試しください。';
}

/* ---------------- 申請者（一般利用者）向け ---------------- */

/** 申請者IDから申請1件を取得する */
export async function fetchApplicant(applicantId) {
  const snap = await getDoc(doc(db, 'applicants', applicantId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** 様式（項目定義）を取得する */
export async function fetchForm(formId) {
  const snap = await getDoc(doc(db, 'forms', formId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * 申請者が自分で申請を開始する（自己受付）。
 * 新しい「一時申請ID」をその場で発行し、空の申請ドキュメントを作る。
 * 氏名などの個人情報はここでは一切扱わない。
 *
 * 同時に「1時間あたりの発行数」を rateLimits コレクションでカウントし、
 * 上限（HOURLY_ISSUE_LIMIT）を超えている場合は RateLimitedError を投げる。
 * カウンタの増分と申請ドキュメントの作成は同一トランザクションで行うため、
 * firestore.rules 側でも「カウンタを増やさずに申請だけ作る」ことはできない。
 */
export async function startApplication(formId) {
  let applicantId = null;
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateApplicantId();
    // eslint-disable-next-line no-await-in-loop
    const exists = await getDoc(doc(db, 'applicants', candidate));
    if (!exists.exists()) { applicantId = candidate; break; }
  }
  if (!applicantId) throw new Error('IDの発行に失敗しました');

  const now = new Date();
  const bucketId = currentRateLimitBucket(formId, now);
  const bucketRef = doc(db, 'rateLimits', bucketId);
  const applicantRef = doc(db, 'applicants', applicantId);
  const expireAt = new Date(now.getTime() + APPLICANT_TTL_HOURS * 60 * 60 * 1000);

  try {
    await runTransaction(db, async (tx) => {
      const bucketSnap = await tx.get(bucketRef);
      if (!bucketSnap.exists()) {
        tx.set(bucketRef, { count: 1, expireAt: rateLimitBucketExpiry(now) });
      } else {
        tx.update(bucketRef, { count: (bucketSnap.data().count || 0) + 1 });
      }
      tx.set(applicantRef, {
        formId,
        answers: {},
        submitted: false,
        memo: '',
        issuedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        submittedAt: null,
        expireAt,
        rateLimitBucket: bucketId,
      });
    });
  } catch (err) {
    const code = err && err.code ? String(err.code) : '';
    if (code.includes('permission-denied')) throw new RateLimitedError();
    throw err;
  }
  return applicantId;
}

/** 回答を保存する（submit=true で提出＝以後修正不可） */
export async function saveAnswers(applicantId, answers, submit) {
  const patch = {
    answers,
    submitted: Boolean(submit),
    updatedAt: serverTimestamp(),
  };
  if (submit) patch.submittedAt = serverTimestamp();
  await updateDoc(doc(db, 'applicants', applicantId), patch);
}

/* ---------------- 管理者向け ---------------- */

/** 様式を作成する（様式IDはブラウザ側で生成し、衝突がないか確認する） */
export async function createForm({ title, description, fields, expiresAt, submittedNote }, uid) {
  let formId = null;
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateFormId();
    // eslint-disable-next-line no-await-in-loop
    const exists = await getDoc(doc(db, 'forms', candidate));
    if (!exists.exists()) { formId = candidate; break; }
  }
  if (!formId) throw new Error('IDの発行に失敗しました');

  await setDoc(doc(db, 'forms', formId), {
    title,
    description: description || '',
    submittedNote: submittedNote || '',
    fields,
    status: 'active',
    deleted: false,
    startsAt: null,
    expiresAt: expiresAt || null,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return formId;
}

/** 様式の一覧（削除済みを除く） */
export async function listForms() {
  const q = query(
    collection(db, 'forms'),
    where('deleted', '==', false),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function updateForm(formId, patch) {
  await updateDoc(doc(db, 'forms', formId), { ...patch, updatedAt: serverTimestamp() });
}

/** 様式の削除（論理削除。申請データは残す） */
export async function deleteForm(formId) {
  await updateDoc(doc(db, 'forms', formId), {
    deleted: true, status: 'disabled', updatedAt: serverTimestamp(),
  });
}

/** 様式に紐づく申請一覧（管理者のみ） */
export async function listApplicants(formId) {
  const q = query(
    collection(db, 'applicants'),
    where('formId', '==', formId),
    orderBy('issuedAt', 'asc'),
    limit(1000),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** 提出済みの申請を修正可能な状態に戻す（管理者のみ） */
export async function reopenApplicant(applicantId) {
  await updateDoc(doc(db, 'applicants', applicantId), {
    submitted: false, submittedAt: null, updatedAt: serverTimestamp(),
  });
}

/** 管理メモの更新（誰に渡したかを行政側だけで管理したい場合に使う） */
export async function updateApplicantMemo(applicantId, memo) {
  await updateDoc(doc(db, 'applicants', applicantId), { memo, updatedAt: serverTimestamp() });
}

/**
 * 「基本情報」（お客様番号・フリガナ・氏名・電話番号・番地以降の住所）を保存する。
 * 職員が電話・窓口で本人確認したあとに入力する欄。申請者からは書き込めない。
 */
export async function saveApplicantBasicInfo(applicantId, basicInfo) {
  await updateDoc(doc(db, 'applicants', applicantId), {
    basicInfo: {
      customerNo: basicInfo.customerNo || '',
      kana: basicInfo.kana || '',
      name: basicInfo.name || '',
      phone: basicInfo.phone || '',
      addressExtra: basicInfo.addressExtra || '',
      confirmedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  });
}
