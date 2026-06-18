# 칸반보드

다중 사용자 지원 칸반보드 웹 애플리케이션.

## 기능

- **회원 가입 / 로그인** — 이름, 아이디, 비밀번호
- **사용자별 독립 보드** — 각 사용자의 데이터는 완전히 분리
- **컬럼 관리** — 추가, 수정, 삭제, 드래그로 순서 변경
- **카드 관리** — 추가, 수정, 삭제, 드래그로 이동 및 순서 변경

## 기술 스택

| 구분 | 기술 |
|---|---|
| Frontend | HTML, CSS, JavaScript (별도 파일) |
| Backend | Python / Flask |
| DB | SQLite |
| 드래그앤드롭 | SortableJS |

## 프로젝트 구조

```
kanbanboard/
├── index.html       # 로그인/회원가입 페이지 (시작점)
├── board.html       # 칸반 보드 페이지
├── css/
│   └── style.css    # 다크 테마 스타일
├── js/
│   ├── api.js       # API 클라이언트 (서버 통신)
│   ├── auth.js      # 로그인/회원가입 로직
│   └── board.js     # 보드 렌더링 + 드래그앤드롭
├── app.py           # Flask 백엔드 (REST API)
├── requirements.txt
└── kanban.db        # SQLite DB (최초 실행 시 자동 생성)
```

## 실행 방법

### 1. 가상환경 생성 및 패키지 설치

```bash
uv venv .venv
uv pip install -r requirements.txt
```

### 2. 서버 실행

```bash
.venv/bin/python app.py
```

서버가 시작되면 브라우저에서 http://localhost:5000 으로 접속합니다.

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | /api/signup | 회원가입 |
| POST | /api/login | 로그인 |
| POST | /api/logout | 로그아웃 |
| GET | /api/me | 현재 사용자 정보 |
| GET/POST | /api/columns | 컬럼 목록 조회 / 생성 |
| PUT/DELETE | /api/columns/:id | 컬럼 수정 / 삭제 |
| PUT | /api/columns/reorder | 컬럼 순서 변경 |
| GET/POST | /api/cards | 카드 목록 조회 / 생성 |
| PUT/DELETE | /api/cards/:id | 카드 수정 / 삭제 |
| PUT | /api/cards/reorder | 카드 이동 및 순서 변경 |

## 향후 배포 계획

- **Frontend** → GitHub Pages
- **Backend** → Supabase (api.js의 `API_BASE` 값만 변경)
