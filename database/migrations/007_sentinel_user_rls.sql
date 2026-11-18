-- ==============================================================================
-- 🛡️ AUREUS · MIGRATION 007: SENTINEL COMMITMENTS PER-USER + RLS POLICIES
-- ==============================================================================
-- Tabla de compromisos recurrentes del Radar Centinela alineada al esquema
-- multi-usuario directo de Supabase (001-004) con aislamiento estricto por auth.uid().

CREATE TABLE IF NOT EXISTS public.sentinel_commitments (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    contract_number VARCHAR(50) NOT NULL DEFAULT 'Servicio Recurrente',
    category VARCHAR(20) NOT NULL DEFAULT 'other'
        CHECK (category IN ('electric', 'telecom', 'card', 'education', 'water', 'other')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    late_fee_avoided NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (late_fee_avoided >= 0),
    due_day SMALLINT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    due_date_str VARCHAR(30),
    status VARCHAR(15) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'urgent')),
    paid_period VARCHAR(7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentinel_commitments_user
    ON public.sentinel_commitments(user_id, created_at DESC);

ALTER TABLE public.sentinel_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sentinel commitments" ON public.sentinel_commitments;
CREATE POLICY "Users can view their own sentinel commitments" ON public.sentinel_commitments
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sentinel commitments" ON public.sentinel_commitments;
CREATE POLICY "Users can insert their own sentinel commitments" ON public.sentinel_commitments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sentinel commitments" ON public.sentinel_commitments;
CREATE POLICY "Users can update their own sentinel commitments" ON public.sentinel_commitments
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sentinel commitments" ON public.sentinel_commitments;
CREATE POLICY "Users can delete their own sentinel commitments" ON public.sentinel_commitments
    FOR DELETE USING (auth.uid() = user_id);
