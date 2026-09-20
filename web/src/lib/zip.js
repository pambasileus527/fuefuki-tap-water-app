// 郵便番号 → 住所の自動変換。
// 総務省認可の郵便番号データを提供する zipcloud の無料APIを利用する。
// https://zipcloud.ibsnet.co.jp/doc/api

const ENDPOINT = 'https://zipcloud.ibsnet.co.jp/api/search';

/**
 * 郵便番号から住所（都道府県＋市区町村＋町域）を取得する。
 * 見つからない場合は null を返す（呼び出し側で「手入力してください」等を表示する）。
 */
export async function lookupZipAddress(zip) {
  const digits = String(zip || '').replace(/[^0-9]/g, '');
  if (digits.length !== 7) return { ok: false, message: '郵便番号は7桁で入力してください' };

  let res;
  try {
    res = await fetch(`${ENDPOINT}?zipcode=${digits}`);
  } catch (e) {
    return { ok: false, message: '住所の自動検索に失敗しました。手入力してください。' };
  }
  if (!res.ok) return { ok: false, message: '住所の自動検索に失敗しました。手入力してください。' };

  let json;
  try {
    json = await res.json();
  } catch (e) {
    return { ok: false, message: '住所の自動検索に失敗しました。手入力してください。' };
  }

  if (json.status !== 200 || !Array.isArray(json.results) || json.results.length === 0) {
    return { ok: false, message: '該当する住所が見つかりませんでした。郵便番号をご確認ください。' };
  }

  const r = json.results[0];
  const address = `${r.address1 || ''}${r.address2 || ''}${r.address3 || ''}`;
  return { ok: true, address };
}

/** 表示用に郵便番号へハイフンを入れる（123-4567） */
export function formatZip(zip) {
  const digits = String(zip || '').replace(/[^0-9]/g, '');
  if (digits.length !== 7) return zip || '';
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function isValidZip(zip) {
  return /^[0-9]{7}$/.test(String(zip || '').replace(/[^0-9]/g, ''));
}
