let columns = [];
let cards   = [];

// ── 초기화 ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // 인증 확인
  let user;
  try {
    user = await api.me();
  } catch (_) {
    location.href = 'index.html';
    return;
  }

  document.getElementById('user-badge').textContent = `${user.username}(${user.name})`;

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await api.logout();
    location.href = 'index.html';
  });

  document.getElementById('add-col-btn').addEventListener('click', () => openColModal());

  document.getElementById('col-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveColumn();
  });

  document.getElementById('card-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveCard();
  });

  // 모달 배경 클릭 닫기
  document.querySelectorAll('.modal-backdrop').forEach(el => {
    el.addEventListener('click', (e) => { if (e.target === el) closeModal(el.id); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape')
      document.querySelectorAll('.modal-backdrop.open').forEach(el => closeModal(el.id));
  });

  await loadBoard();
});

// ── 데이터 로드 & 렌더링 ──────────────────────────────────────────────────────

async function loadBoard() {
  [columns, cards] = await Promise.all([api.getColumns(), api.getCards()]);
  renderBoard();
}

function renderBoard() {
  const board = document.getElementById('board');
  board.innerHTML = '';

  [...columns]
    .sort((a, b) => a.position - b.position)
    .forEach(col => board.appendChild(buildColumn(col)));

  setupDnD();
}

// ── 컬럼 DOM 빌드 ────────────────────────────────────────────────────────────

function buildColumn(col) {
  const colCards = cards
    .filter(c => c.column_id === col.id)
    .sort((a, b) => a.position - b.position);

  const el = document.createElement('div');
  el.className = 'column';
  el.dataset.id = col.id;

  el.innerHTML = `
    <div class="col-header">
      <span class="col-title">${esc(col.title)}</span>
      <span class="col-count">${colCards.length}</span>
      <div class="col-actions">
        <button class="btn-icon" title="수정"   onclick="openColModal('${col.id}')">✎</button>
        <button class="btn-icon danger" title="삭제" onclick="removeColumn('${col.id}')">✕</button>
      </div>
    </div>
    <div class="card-list" data-col-id="${col.id}">
      ${colCards.map(buildCardHtml).join('')}
    </div>
    <button class="btn-add-card" onclick="openCardModal('${col.id}')">＋ 카드 추가</button>
  `;
  return el;
}

function buildCardHtml(card) {
  return `
    <div class="card" data-id="${card.id}">
      <div class="card-title">${esc(card.title)}</div>
      ${card.description ? `<div class="card-desc">${esc(card.description)}</div>` : ''}
      <div class="card-actions">
        <button class="btn-icon" title="수정"   onclick="openCardModal('${card.column_id}', '${card.id}')">✎</button>
        <button class="btn-icon danger" title="삭제" onclick="removeCard('${card.id}')">✕</button>
      </div>
    </div>`;
}

// ── 드래그앤드롭 ─────────────────────────────────────────────────────────────

function setupDnD() {
  const board = document.getElementById('board');

  // 컬럼 순서 변경
  Sortable.create(board, {
    animation: 150,
    handle: '.col-header',
    draggable: '.column',
    onEnd: async () => {
      const order = [...board.querySelectorAll('.column')].map((el, i) => ({
        id: el.dataset.id, position: i,
      }));
      order.forEach(({ id, position }) => {
        const col = columns.find(c => c.id === id);
        if (col) col.position = position;
      });
      await api.reorderColumns(order).catch(console.error);
    },
  });

  // 카드 이동 & 순서 변경
  document.querySelectorAll('.card-list').forEach(list => {
    Sortable.create(list, {
      group: 'cards',
      animation: 150,
      draggable: '.card',
      onEnd: async () => {
        const reorder = [];
        document.querySelectorAll('.card-list').forEach(lst => {
          const colId = lst.dataset.colId;
          lst.querySelectorAll('.card').forEach((cardEl, i) => {
            reorder.push({ id: cardEl.dataset.id, column_id: colId, position: i });
            const card = cards.find(c => c.id === cardEl.dataset.id);
            if (card) { card.column_id = colId; card.position = i; }
          });
        });

        // 카드 수 배지 즉시 업데이트
        document.querySelectorAll('.column').forEach(colEl => {
          colEl.querySelector('.col-count').textContent =
            colEl.querySelector('.card-list').querySelectorAll('.card').length;
        });

        await api.reorderCards(reorder).catch(console.error);
      },
    });
  });
}

// ── 컬럼 CRUD ────────────────────────────────────────────────────────────────

function openColModal(colId) {
  const col = colId ? columns.find(c => c.id === colId) : null;
  document.getElementById('col-modal-title').textContent = col ? '컬럼 수정' : '컬럼 추가';
  document.getElementById('col-modal-id').value    = col ? col.id : '';
  document.getElementById('col-title-input').value = col ? col.title : '';
  openModal('col-modal');
  document.getElementById('col-title-input').focus();
}

async function saveColumn() {
  const title = document.getElementById('col-title-input').value.trim();
  const colId = document.getElementById('col-modal-id').value;
  if (!title) return;

  try {
    if (colId) {
      const updated = await api.updateColumn(colId, { title });
      const idx = columns.findIndex(c => c.id === colId);
      if (idx !== -1) columns[idx] = updated;
    } else {
      columns.push(await api.createColumn({ title }));
    }
    closeModal('col-modal');
    renderBoard();
  } catch (err) { alert(err.message); }
}

async function removeColumn(colId) {
  if (!confirm('컬럼을 삭제하면 포함된 카드도 모두 삭제됩니다. 계속하시겠습니까?')) return;
  try {
    await api.deleteColumn(colId);
    columns = columns.filter(c => c.id !== colId);
    cards   = cards.filter(c => c.column_id !== colId);
    renderBoard();
  } catch (err) { alert(err.message); }
}

// ── 카드 CRUD ────────────────────────────────────────────────────────────────

function openCardModal(columnId, cardId) {
  const card = cardId ? cards.find(c => c.id === cardId) : null;
  document.getElementById('card-modal-title').textContent = card ? '카드 수정' : '카드 추가';
  document.getElementById('card-modal-id').value          = card ? card.id : '';
  document.getElementById('card-modal-col-id').value      = columnId;
  document.getElementById('card-title-input').value       = card ? card.title : '';
  document.getElementById('card-desc-input').value        = card ? (card.description || '') : '';
  openModal('card-modal');
  document.getElementById('card-title-input').focus();
}

async function saveCard() {
  const title    = document.getElementById('card-title-input').value.trim();
  const desc     = document.getElementById('card-desc-input').value.trim();
  const cardId   = document.getElementById('card-modal-id').value;
  const columnId = document.getElementById('card-modal-col-id').value;
  if (!title) return;

  try {
    if (cardId) {
      const updated = await api.updateCard(cardId, { title, description: desc });
      const idx = cards.findIndex(c => c.id === cardId);
      if (idx !== -1) cards[idx] = updated;
    } else {
      cards.push(await api.createCard({ title, description: desc, column_id: columnId }));
    }
    closeModal('card-modal');
    renderBoard();
  } catch (err) { alert(err.message); }
}

async function removeCard(cardId) {
  if (!confirm('카드를 삭제하시겠습니까?')) return;
  try {
    await api.deleteCard(cardId);
    cards = cards.filter(c => c.id !== cardId);
    renderBoard();
  } catch (err) { alert(err.message); }
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function openModal(id)  { document.getElementById(id).classList.add('open');    }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
