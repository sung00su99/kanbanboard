-- ============================================================
-- 칸반보드 Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 전체 내용을 붙여넣고 Run 클릭
-- ============================================================


-- ── 1. profiles 테이블 ──────────────────────────────────────
-- Supabase Auth(auth.users)와 연결되며 아이디(username)와 이름(name)을 저장

CREATE TABLE IF NOT EXISTS public.profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username   TEXT UNIQUE NOT NULL,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);


-- ── 2. columns 테이블 ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.columns (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title      TEXT NOT NULL,
    position   INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);


-- ── 3. cards 테이블 ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cards (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    column_id   UUID NOT NULL REFERENCES public.columns(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT now()
);


-- ── 4. Row Level Security 활성화 ────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.columns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards    ENABLE ROW LEVEL SECURITY;


-- ── 5. profiles RLS 정책 ────────────────────────────────────

CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);


-- ── 6. columns RLS 정책 ─────────────────────────────────────

CREATE POLICY "columns_select" ON public.columns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "columns_insert" ON public.columns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "columns_update" ON public.columns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "columns_delete" ON public.columns
    FOR DELETE USING (auth.uid() = user_id);


-- ── 7. cards RLS 정책 ───────────────────────────────────────

CREATE POLICY "cards_select" ON public.cards
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "cards_insert" ON public.cards
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cards_update" ON public.cards
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "cards_delete" ON public.cards
    FOR DELETE USING (auth.uid() = user_id);


-- ── 8. 회원가입 시 profiles 자동 생성 트리거 ─────────────────
-- auth.users에 신규 사용자가 추가될 때 자동으로 profiles 행을 삽입
-- username과 name은 회원가입 시 raw_user_meta_data에 담아서 전달

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, name)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data ->> 'username',
        NEW.raw_user_meta_data ->> 'name'
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 9. 회원가입 시 기본 컬럼 3개 자동 생성 트리거 ───────────

CREATE OR REPLACE FUNCTION public.handle_new_user_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.columns (user_id, title, position) VALUES
        (NEW.id, '할 일',  0),
        (NEW.id, '진행 중', 1),
        (NEW.id, '완료',   2);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_columns();
