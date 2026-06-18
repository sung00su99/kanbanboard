// Supabase 클라이언트 초기화 (config.js의 SUPABASE_URL, SUPABASE_KEY 사용)
const _db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function _uid() {
  const { data: { user } } = await _db.auth.getUser();
  return user?.id;
}

const api = {
  // ── 인증 ──────────────────────────────────────────────────
  // Supabase Auth는 이메일 기반이므로 아이디를 'username@kanban.app' 형태로 저장
  async signup({ name, username, password }) {
    const { error } = await _db.auth.signUp({
      email: `${username}@kanban.app`,
      password,
      options: { data: { username, name } },
    });
    if (error) throw new Error(error.message);
  },

  async login({ username, password }) {
    const { error } = await _db.auth.signInWithPassword({
      email: `${username}@kanban.app`,
      password,
    });
    if (error) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
  },

  async logout() {
    await _db.auth.signOut();
  },

  async me() {
    const { data: { user }, error } = await _db.auth.getUser();
    if (error || !user) throw new Error('로그인이 필요합니다.');
    const { data: profile, error: pe } = await _db
      .from('profiles')
      .select('username, name')
      .eq('id', user.id)
      .single();
    if (pe) throw new Error(pe.message);
    return { id: user.id, username: profile.username, name: profile.name };
  },

  // ── 컬럼 ──────────────────────────────────────────────────
  async getColumns() {
    const { data, error } = await _db.from('columns').select('*').order('position');
    if (error) throw new Error(error.message);
    return data;
  },

  async createColumn({ title }) {
    const userId = await _uid();
    const { data: last } = await _db.from('columns').select('position')
      .order('position', { ascending: false }).limit(1);
    const position = last?.length ? last[0].position + 1 : 0;
    const { data, error } = await _db.from('columns')
      .insert({ title, user_id: userId, position }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateColumn(id, { title }) {
    const { data, error } = await _db.from('columns')
      .update({ title }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteColumn(id) {
    const { error } = await _db.from('columns').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async reorderColumns(items) {
    await Promise.all(
      items.map(({ id, position }) =>
        _db.from('columns').update({ position }).eq('id', id)
      )
    );
  },

  // ── 카드 ──────────────────────────────────────────────────
  async getCards() {
    const { data, error } = await _db.from('cards').select('*').order('position');
    if (error) throw new Error(error.message);
    return data;
  },

  async createCard({ title, description, column_id }) {
    const userId = await _uid();
    const { data: last } = await _db.from('cards').select('position')
      .eq('column_id', column_id).order('position', { ascending: false }).limit(1);
    const position = last?.length ? last[0].position + 1 : 0;
    const { data, error } = await _db.from('cards')
      .insert({ title, description, column_id, user_id: userId, position }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateCard(id, { title, description }) {
    const { data, error } = await _db.from('cards')
      .update({ title, description }).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteCard(id) {
    const { error } = await _db.from('cards').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async reorderCards(items) {
    await Promise.all(
      items.map(({ id, column_id, position }) =>
        _db.from('cards').update({ column_id, position }).eq('id', id)
      )
    );
  },
};
