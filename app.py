import os
import sqlite3
from functools import wraps
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'kanban.db')

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
CORS(app, supports_credentials=True, origins='*')


# ── DB ──────────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    conn.execute('PRAGMA journal_mode = WAL')
    return conn


def init_db():
    conn = get_db()
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            username      TEXT UNIQUE NOT NULL,
            name          TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS columns (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id  INTEGER NOT NULL,
            title    TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS cards (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            column_id   INTEGER NOT NULL,
            user_id     INTEGER NOT NULL,
            title       TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            position    INTEGER NOT NULL DEFAULT 0,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (column_id) REFERENCES columns(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE CASCADE
        );
    ''')
    conn.commit()
    conn.close()


# ── 인증 미들웨어 ─────────────────────────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': '로그인이 필요합니다.'}), 401
        return f(*args, **kwargs)
    return decorated


# ── 정적 파일 서빙 ─────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/board.html')
def board():
    return send_from_directory(BASE_DIR, 'board.html')


# ── 인증 API ──────────────────────────────────────────────────────────────────

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    name = (data.get('name') or '').strip()
    password = data.get('password') or ''

    if not username or not name or not password:
        return jsonify({'error': '모든 필드를 입력해주세요.'}), 400
    if len(password) < 4:
        return jsonify({'error': '비밀번호는 4자 이상이어야 합니다.'}), 400

    conn = get_db()
    try:
        conn.execute(
            'INSERT INTO users (username, name, password_hash) VALUES (?, ?, ?)',
            (username, name, generate_password_hash(password))
        )
        user_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        for idx, title in enumerate(['할 일', '진행 중', '완료']):
            conn.execute(
                'INSERT INTO columns (user_id, title, position) VALUES (?, ?, ?)',
                (user_id, title, idx)
            )
        conn.commit()
        return jsonify({'message': '회원가입이 완료되었습니다.'}), 201
    except sqlite3.IntegrityError:
        return jsonify({'error': '이미 사용 중인 아이디입니다.'}), 409
    finally:
        conn.close()


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''

    conn = get_db()
    user = conn.execute(
        'SELECT * FROM users WHERE username = ?', (username,)
    ).fetchone()
    conn.close()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({'error': '아이디 또는 비밀번호가 올바르지 않습니다.'}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']
    session['name'] = user['name']
    return jsonify({'id': user['id'], 'username': user['username'], 'name': user['name']})


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': '로그아웃 되었습니다.'})


@app.route('/api/me', methods=['GET'])
@login_required
def me():
    return jsonify({
        'id': session['user_id'],
        'username': session['username'],
        'name': session['name'],
    })


# ── 컬럼 API ─────────────────────────────────────────────────────────────────

@app.route('/api/columns', methods=['GET'])
@login_required
def get_columns():
    conn = get_db()
    rows = conn.execute(
        'SELECT * FROM columns WHERE user_id = ? ORDER BY position', (session['user_id'],)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/columns', methods=['POST'])
@login_required
def create_column():
    title = (request.get_json().get('title') or '').strip()
    if not title:
        return jsonify({'error': '컬럼 이름을 입력해주세요.'}), 400

    conn = get_db()
    max_pos = conn.execute(
        'SELECT COALESCE(MAX(position), -1) FROM columns WHERE user_id = ?',
        (session['user_id'],)
    ).fetchone()[0]
    conn.execute(
        'INSERT INTO columns (user_id, title, position) VALUES (?, ?, ?)',
        (session['user_id'], title, max_pos + 1)
    )
    new_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    row = conn.execute('SELECT * FROM columns WHERE id = ?', (new_id,)).fetchone()
    conn.commit()
    conn.close()
    return jsonify(dict(row)), 201


@app.route('/api/columns/reorder', methods=['PUT'])
@login_required
def reorder_columns():
    items = request.get_json()
    conn = get_db()
    for item in items:
        conn.execute(
            'UPDATE columns SET position = ? WHERE id = ? AND user_id = ?',
            (item['position'], item['id'], session['user_id'])
        )
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


@app.route('/api/columns/<int:col_id>', methods=['PUT'])
@login_required
def update_column(col_id):
    conn = get_db()
    col = conn.execute(
        'SELECT * FROM columns WHERE id = ? AND user_id = ?',
        (col_id, session['user_id'])
    ).fetchone()
    if not col:
        conn.close()
        return jsonify({'error': '컬럼을 찾을 수 없습니다.'}), 404

    data = request.get_json()
    title = (data.get('title') or col['title']).strip()
    conn.execute('UPDATE columns SET title = ? WHERE id = ?', (title, col_id))
    conn.commit()
    row = conn.execute('SELECT * FROM columns WHERE id = ?', (col_id,)).fetchone()
    conn.close()
    return jsonify(dict(row))


@app.route('/api/columns/<int:col_id>', methods=['DELETE'])
@login_required
def delete_column(col_id):
    conn = get_db()
    col = conn.execute(
        'SELECT id FROM columns WHERE id = ? AND user_id = ?',
        (col_id, session['user_id'])
    ).fetchone()
    if not col:
        conn.close()
        return jsonify({'error': '컬럼을 찾을 수 없습니다.'}), 404
    conn.execute('DELETE FROM columns WHERE id = ?', (col_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


# ── 카드 API ─────────────────────────────────────────────────────────────────

@app.route('/api/cards', methods=['GET'])
@login_required
def get_cards():
    conn = get_db()
    rows = conn.execute(
        'SELECT * FROM cards WHERE user_id = ? ORDER BY column_id, position',
        (session['user_id'],)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route('/api/cards', methods=['POST'])
@login_required
def create_card():
    data = request.get_json()
    title = (data.get('title') or '').strip()
    column_id = data.get('column_id')
    description = (data.get('description') or '').strip()

    if not title or not column_id:
        return jsonify({'error': '카드 제목과 컬럼을 선택해주세요.'}), 400

    conn = get_db()
    col = conn.execute(
        'SELECT id FROM columns WHERE id = ? AND user_id = ?',
        (column_id, session['user_id'])
    ).fetchone()
    if not col:
        conn.close()
        return jsonify({'error': '컬럼을 찾을 수 없습니다.'}), 404

    max_pos = conn.execute(
        'SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?',
        (column_id,)
    ).fetchone()[0]
    conn.execute(
        'INSERT INTO cards (column_id, user_id, title, description, position) VALUES (?, ?, ?, ?, ?)',
        (column_id, session['user_id'], title, description, max_pos + 1)
    )
    new_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    row = conn.execute('SELECT * FROM cards WHERE id = ?', (new_id,)).fetchone()
    conn.commit()
    conn.close()
    return jsonify(dict(row)), 201


@app.route('/api/cards/reorder', methods=['PUT'])
@login_required
def reorder_cards():
    items = request.get_json()
    conn = get_db()
    for item in items:
        conn.execute(
            'UPDATE cards SET column_id = ?, position = ? WHERE id = ? AND user_id = ?',
            (item['column_id'], item['position'], item['id'], session['user_id'])
        )
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


@app.route('/api/cards/<int:card_id>', methods=['PUT'])
@login_required
def update_card(card_id):
    conn = get_db()
    card = conn.execute(
        'SELECT * FROM cards WHERE id = ? AND user_id = ?',
        (card_id, session['user_id'])
    ).fetchone()
    if not card:
        conn.close()
        return jsonify({'error': '카드를 찾을 수 없습니다.'}), 404

    data = request.get_json()
    title = (data.get('title') or card['title']).strip()
    description = (data.get('description') if data.get('description') is not None else card['description']).strip()
    conn.execute(
        'UPDATE cards SET title = ?, description = ? WHERE id = ?',
        (title, description, card_id)
    )
    conn.commit()
    row = conn.execute('SELECT * FROM cards WHERE id = ?', (card_id,)).fetchone()
    conn.close()
    return jsonify(dict(row))


@app.route('/api/cards/<int:card_id>', methods=['DELETE'])
@login_required
def delete_card(card_id):
    conn = get_db()
    card = conn.execute(
        'SELECT id FROM cards WHERE id = ? AND user_id = ?',
        (card_id, session['user_id'])
    ).fetchone()
    if not card:
        conn.close()
        return jsonify({'error': '카드를 찾을 수 없습니다.'}), 404
    conn.execute('DELETE FROM cards WHERE id = ?', (card_id,))
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


# ── 실행 ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
