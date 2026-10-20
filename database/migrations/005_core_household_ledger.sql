-- ==============================================================================
-- 💰 AUREUS · MIGRATION 005: CORE HOUSEHOLD LEDGER, IDEMPOTENT INBOX & OUTBOX
-- ==============================================================================

-- 0. TIPOS ENUM PERSONALIZADOS
CREATE TYPE channel_provider AS ENUM ('telegram', 'whatsapp');
CREATE TYPE currency_code AS ENUM ('DOP', 'USD');
CREATE TYPE user_role AS ENUM ('admin', 'member');
CREATE TYPE inbox_status AS ENUM ('received', 'extracted', 'needs_review', 'processed', 'failed', 'ignored');
CREATE TYPE ledger_kind AS ENUM ('expense', 'income', 'reversal');
CREATE TYPE outbox_status AS ENUM ('pending', 'processing', 'sent', 'failed', 'dead');
CREATE TYPE categorization_source AS ENUM ('ai', 'user');

-- ==============================================================================
-- 1. IDENTIDAD, HOGARES Y CATEGORÍAS
-- ==============================================================================

CREATE TABLE households (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    default_currency currency_code NOT NULL DEFAULT 'DOP',
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Santo_Domingo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    full_name VARCHAR(120) NOT NULL,
    role user_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_users_id_household UNIQUE (id, household_id)
);

CREATE TABLE identity_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider channel_provider NOT NULL,
    external_user_id VARCHAR(100) NOT NULL, -- chat_id o phone emisor
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_channel_provider_external UNIQUE (provider, external_user_id)
);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    icon VARCHAR(30) NOT NULL DEFAULT 'tag',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_household_category UNIQUE (household_id, name)
);

-- ==============================================================================
-- 2. INBOX EVENTS (Ingesta Idempotente & Auditoría de IA)
-- ==============================================================================

CREATE TABLE inbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider channel_provider NOT NULL,
    external_update_id VARCHAR(100),            -- update_id único de Telegram
    external_chat_id VARCHAR(100) NOT NULL,      -- chat_id específico
    external_message_id VARCHAR(100) NOT NULL,   -- message_id dentro del chat
    sender_id VARCHAR(100) NOT NULL,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('text', 'audio', 'image')),
    raw_payload JSONB NOT NULL,
    
    status inbox_status NOT NULL DEFAULT 'received',
    error_message TEXT,
    
    extracted_data JSONB,
    ai_model VARCHAR(50),
    prompt_version VARCHAR(20),
    confidence_score NUMERIC(3, 2),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    CONSTRAINT uq_inbox_provider_chat_message UNIQUE (provider, external_chat_id, external_message_id)
);

CREATE INDEX idx_inbox_pending ON inbox_events(status, created_at) 
    WHERE status IN ('received', 'extracted');

-- ==============================================================================
-- 3. LEDGER ENTRIES (Inmutable / Append-Only)
-- ==============================================================================

CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL,
    source_event_id UUID REFERENCES inbox_events(id) ON DELETE RESTRICT,
    source_line SMALLINT NOT NULL DEFAULT 1,
    
    kind ledger_kind NOT NULL,
    reverses_id UUID REFERENCES ledger_entries(id) ON DELETE RESTRICT,
    
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
    currency currency_code NOT NULL DEFAULT 'DOP',
    description TEXT NOT NULL,
    
    transacted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_ledger_user_household FOREIGN KEY (user_id, household_id) 
        REFERENCES users (id, household_id),
    CONSTRAINT uq_ledger_source_line UNIQUE (source_event_id, source_line)
);

CREATE INDEX idx_ledger_household_transacted ON ledger_entries(household_id, transacted_at DESC);
CREATE UNIQUE INDEX uq_ledger_single_reversal ON ledger_entries(reverses_id) WHERE kind = 'reversal';

-- 3.1 Trigger para garantizar que ledger_entries sea ESTRICTAMENTE Append-Only
CREATE OR REPLACE FUNCTION trg_prevent_ledger_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ledger_entries is append-only: UPDATE and DELETE operations are forbidden.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_entries_immutable
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION trg_prevent_ledger_mutation();

-- 3.2 Trigger para validar reglas de Reversión Total
CREATE OR REPLACE FUNCTION trg_validate_reversal_rules()
RETURNS TRIGGER AS $$
DECLARE
    target_entry RECORD;
BEGIN
    IF NEW.kind = 'reversal' THEN
        IF NEW.reverses_id IS NULL THEN
            RAISE EXCEPTION 'Reversal entries must specify a reverses_id.';
        END IF;

        SELECT household_id, amount_cents, currency, kind
        INTO target_entry
        FROM ledger_entries
        WHERE id = NEW.reverses_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Target entry for reversal does not exist.';
        END IF;

        IF target_entry.kind = 'reversal' THEN
            RAISE EXCEPTION 'Cannot reverse an entry that is already a reversal.';
        END IF;

        IF target_entry.household_id <> NEW.household_id THEN
            RAISE EXCEPTION 'Reversal household_id must match the original entry.';
        END IF;

        IF target_entry.amount_cents <> NEW.amount_cents OR target_entry.currency <> NEW.currency THEN
            RAISE EXCEPTION 'Reversals must be total: amount_cents and currency must match exactly.';
        END IF;
    ELSE
        IF NEW.reverses_id IS NOT NULL THEN
            RAISE EXCEPTION 'Only entries with kind = reversal can reference a reverses_id.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_entries_reversal_check
BEFORE INSERT ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION trg_validate_reversal_rules();

-- ==============================================================================
-- 4. CLASIFICACIÓN DE ENTRADAS (Dataset & ML Feedback Loop)
-- ==============================================================================

CREATE TABLE entry_categorizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES ledger_entries(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    source categorization_source NOT NULL,
    ai_model VARCHAR(50),
    prompt_version VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categorizations_entry_latest ON entry_categorizations(entry_id, created_at DESC);

-- ==============================================================================
-- 5. OUTBOX MESSAGES (Garantía At-Least-Once y Bloqueos)
-- ==============================================================================

CREATE TABLE outbox_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_event_id UUID REFERENCES inbox_events(id) ON DELETE SET NULL,
    provider channel_provider NOT NULL,
    recipient_id VARCHAR(100) NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'interactive')),
    payload JSONB NOT NULL,
    
    status outbox_status NOT NULL DEFAULT 'pending',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 5,
    locked_until TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_queue ON outbox_messages(status, next_attempt_at) 
    WHERE status IN ('pending', 'failed');

-- ==============================================================================
-- 6. SEGURIDAD SUPABASE: ROW LEVEL SECURITY (Denegar acceso PostgREST directo)
-- ==============================================================================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_categorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_messages ENABLE ROW LEVEL SECURITY;
