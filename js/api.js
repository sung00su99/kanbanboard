/* API 베이스 URL — 로컬 Flask 서버 (Supabase 배포 시 이 값만 변경) */
const API_BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(API_BASE + path, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || '요청 처리 중 오류가 발생했습니다.');
  return data;
}

const api = {
  // 인증
  signup:  (body) => request('POST', '/signup', body),
  login:   (body) => request('POST', '/login',  body),
  logout:  ()     => request('POST', '/logout'),
  me:      ()     => request('GET',  '/me'),

  // 컬럼
  getColumns:     ()         => request('GET',    '/columns'),
  createColumn:   (body)     => request('POST',   '/columns',        body),
  updateColumn:   (id, body) => request('PUT',    `/columns/${id}`,  body),
  deleteColumn:   (id)       => request('DELETE', `/columns/${id}`),
  reorderColumns: (body)     => request('PUT',    '/columns/reorder', body),

  // 카드
  getCards:    ()         => request('GET',    '/cards'),
  createCard:  (body)     => request('POST',   '/cards',       body),
  updateCard:  (id, body) => request('PUT',    `/cards/${id}`, body),
  deleteCard:  (id)       => request('DELETE', `/cards/${id}`),
  reorderCards:(body)     => request('PUT',    '/cards/reorder', body),
};
