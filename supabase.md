# Supabase 배포 가이드

현재 구조(Flask + SQLite)를 **Supabase + GitHub Pages** 로 전환하는 작업 목록입니다.

---

## 아키텍처 변경 요약

| 항목 | 현재 (로컬) | 변경 후 (배포) |
|---|---|---|
| 인증 | Flask session + werkzeug 해시 | Supabase Auth (JWT) |
| DB | SQLite (kanban.db) | Supabase PostgreSQL |
| 백엔드 서버 | Python Flask (app.py) | **불필요** (Supabase가 대체) |
| 프론트엔드 호스팅 | Flask 정적 파일 서빙 | GitHub Pages |
| API 통신 | fetch → /api/* | Supabase JS SDK |

> Supabase는 PostgreSQL + REST API + 인증을 한 번에 제공하므로 Flask 서버가 필요 없어집니다.

---

## 역할 분담

---

### 사용자가 할 일

#### 1단계 — Supabase 프로젝트 생성

- [ ] [supabase.com](https://supabase.com) 에서 계정 생성 (GitHub 계정으로 가입 가능)
- [ ] **New Project** 클릭 → 프로젝트 이름 입력, 비밀번호 설정, 리전 선택 (Northeast Asia 권장)
- [ ] 프로젝트 생성 완료 후 아래 두 값을 복사해 둠
  - **Project URL** : `Settings → API → Project URL`
  - **anon public key** : `Settings → API → anon public`

#### 2단계 — DB 스키마 적용

- [ ] Supabase 대시보드 → **SQL Editor** 클릭
- [ ] 내가 작성해 둔 `supabase/schema.sql` 파일 내용을 붙여넣고 **Run** 실행
  - profiles, columns, cards 테이블 생성
  - Row Level Security(RLS) 정책 적용
  - 회원가입 시 profiles 자동 생성 트리거 적용

#### 3단계 — config.js 에 키 입력

- [ ] 내가 생성한 `js/config.js` 파일을 열어 아래 두 값을 본인 프로젝트 값으로 교체

```js
// js/config.js
const SUPABASE_URL  = 'https://여기에-Project-URL-입력.supabase.co';
const SUPABASE_KEY  = '여기에-anon-public-key-입력';
```

#### 4단계 — GitHub Pages 활성화

- [ ] GitHub 저장소 → **Settings → Pages**
- [ ] Source: `Deploy from a branch`, Branch: `main`, 폴더: `/ (root)`
- [ ] 저장 후 발급된 URL 확인 (예: `https://sung00su99.github.io/kanbanboard`)

---

### 내가 할 일 (Claude)

코드 수정 및 파일 생성 작업입니다. 사용자가 "Supabase 작업 시작해줘" 라고 하면 바로 진행합니다.

#### 1. `supabase/schema.sql` 생성

Supabase SQL Editor에 붙여넣을 전체 스크립트.

```
supabase/
└── schema.sql    ← 테이블 생성 + RLS 정책 + 자동 트리거
```

내용:
- `profiles` 테이블 — username(아이디), name(이름) 저장 (Supabase Auth와 연결)
- `columns` 테이블 — UUID 기반, user_id로 RLS 격리
- `cards` 테이블 — UUID 기반, user_id로 RLS 격리
- Row Level Security: 본인 데이터만 조회/수정/삭제 가능
- 트리거: 회원가입 시 profiles 테이블에 자동 insert

#### 2. `js/config.js` 생성

```js
const SUPABASE_URL = 'YOUR_PROJECT_URL';
const SUPABASE_KEY = 'YOUR_ANON_KEY';
```

#### 3. `js/api.js` 교체

- 현재: `fetch('/api/...')` 기반 직접 HTTP 호출
- 변경: Supabase JS SDK (`supabase.from('columns').select()` 등)
- 인증: Flask session → Supabase Auth JWT (localStorage 자동 관리)

#### 4. `js/auth.js` 수정

| 현재 | 변경 |
|---|---|
| `POST /api/signup` | `supabase.auth.signUp()` + profiles insert |
| `POST /api/login` | `supabase.auth.signInWithPassword()` |
| `POST /api/logout` | `supabase.auth.signOut()` |
| `GET /api/me` | `supabase.auth.getUser()` + profiles 조회 |

> **아이디/이름 처리 방식:** Supabase Auth는 이메일 기반이므로 내부적으로 `아이디@kanban.app` 형식으로 저장하고, 실제 아이디와 이름은 `profiles` 테이블에서 관리합니다. 사용자 화면에는 기존과 동일하게 아이디/이름/비밀번호만 표시됩니다.

#### 5. `js/board.js` 수정

- 컬럼·카드 CRUD: Flask REST → Supabase SDK (`.select()`, `.insert()`, `.update()`, `.delete()`)
- 순서 변경: Flask PUT /reorder → Supabase `.upsert()` 배치 업데이트
- RLS 덕분에 user_id 필터 코드 불필요 (DB가 자동 처리)

#### 6. `index.html`, `board.html` 수정

- Flask 서빙이 아닌 GitHub Pages 정적 호스팅으로 동작하도록 확인
- Supabase JS SDK CDN 추가
- `js/config.js` 스크립트 추가

#### 7. `.gitignore` 업데이트

- `app.py`, `requirements.txt` 는 로컬 전용이므로 제거하거나 별도 브랜치로 보관 (사용자 결정)

---

## 진행 순서

```
사용자: Supabase 계정 생성 + 프로젝트 생성
  ↓
Claude: schema.sql + config.js + JS 파일 수정
  ↓
사용자: schema.sql 실행 + config.js 키 입력
  ↓
사용자: git push → GitHub Pages 자동 배포
  ↓
브라우저에서 https://sung00su99.github.io/kanbanboard 접속 확인
```

---

## 참고 — 로컬 Flask 서버는 계속 유지 가능

Supabase 배포 후에도 `app.py`는 로컬 개발용으로 그대로 사용할 수 있습니다.
(config.js의 URL만 바꾸면 로컬 ↔ Supabase 전환)
