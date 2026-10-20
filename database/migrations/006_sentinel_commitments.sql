-- ==============================================================================
-- 🛡️ AUREUS · MIGRATION 006: CENTINELA ANTI-MORAS (SENTINEL COMMITMENTS & CYCLES)
-- ==============================================================================

-- 0. TIPOS ENUM PERSONALIZADOS
CREATE TYPE commitment_frequency AS ENUM ('monthly', 'biweekly', 'weekly', 'yearly');
CREATE TYPE cycle_status AS ENUM ('pending', 'paid', 'overdue', 'dismissed');

-- ==============================================================================
-- 1. RECURRING COMMITMENTS (COMPROMISOS Y FACTURAS RECURRENTES)
-- ==============================================================================

CREATE TABLE recurring_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    expected_amount_cents BIGINT, -- Opcional si es monto variable (ej: factura de luz)
    currency currency_code NOT NULL DEFAULT 'DOP',
    frequency commitment_frequency NOT NULL DEFAULT 'monthly',
    due_day_of_month SMALLINT NOT NULL CHECK (due_day_of_month BETWEEN 1 AND 31),
    grace_period_days SMALLINT NOT NULL DEFAULT 0,
    estimated_late_fee_cents BIGINT NOT NULL DEFAULT 0, -- Mora o penalidad estimada
    reminder_days_before INT[] NOT NULL DEFAULT '{5, 2, 0}', -- Días de anticipación para alertar
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_household_commitment_name UNIQUE (household_id, name)
);

CREATE INDEX idx_commitments_household ON recurring_commitments(household_id, is_active);

-- ==============================================================================
-- 2. COMMITMENT CYCLES (INSTANCIAS MENSUALES DE VENCIMIENTO Y PAGO)
-- ==============================================================================

CREATE TABLE commitment_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commitment_id UUID NOT NULL REFERENCES recurring_commitments(id) ON DELETE CASCADE,
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    billing_period VARCHAR(7) NOT NULL, -- Formato 'YYYY-MM', ej: '2026-10'
    due_date DATE NOT NULL,
    status cycle_status NOT NULL DEFAULT 'pending',
    actual_amount_cents BIGINT,
    paid_entry_id UUID REFERENCES ledger_entries(id) ON DELETE SET NULL,
    paid_at TIMESTAMPTZ,
    alerts_sent_count INT NOT NULL DEFAULT 0,
    last_alert_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT uq_commitment_period UNIQUE (commitment_id, billing_period)
);

CREATE INDEX idx_cycles_pending ON commitment_cycles(status, due_date) 
    WHERE status IN ('pending', 'overdue');
CREATE INDEX idx_cycles_household_period ON commitment_cycles(household_id, billing_period);

-- ==============================================================================
-- 3. SEGURIDAD SUPABASE: ROW LEVEL SECURITY
-- ==============================================================================

ALTER TABLE recurring_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitment_cycles ENABLE ROW LEVEL SECURITY;
