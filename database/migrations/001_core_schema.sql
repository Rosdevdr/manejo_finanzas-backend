-- ==============================================================================
-- 💰 AUREUS · MIGRATION 001: CORE FINANCIAL SCHEMA
-- ==============================================================================

-- 1. TABLA: INGRESOS (incomes)
CREATE TABLE IF NOT EXISTS public.incomes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('salary', 'freelance', 'investment', 'extra')),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLA: GASTOS (expenses)
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL CHECK (category IN ('housing', 'food', 'transport', 'utilities', 'health', 'entertainment', 'education', 'debt', 'other')),
  type TEXT NOT NULL CHECK (type IN ('fixed', 'variable')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('bank_transfer', 'debit_card', 'credit_card', 'cash')),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. TABLA: RETIROS EN EFECTIVO (cash_withdrawals)
CREATE TABLE IF NOT EXISTS public.cash_withdrawals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (reason IN ('pocket_money', 'specific_service', 'leisure_nightout', 'emergency', 'unassigned')),
  note TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABLA: TARJETAS DE CRÉDITO (credit_cards)
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  last_four_digits VARCHAR(4) NOT NULL DEFAULT '0000' CHECK (last_four_digits ~ '^[0-9]{4}$'),
  credit_limit NUMERIC(12, 2) NOT NULL CHECK (credit_limit > 0),
  cutoff_day INTEGER NOT NULL CHECK (cutoff_day BETWEEN 1 AND 31),
  payment_due_day INTEGER NOT NULL CHECK (payment_due_day BETWEEN 1 AND 31),
  interest_rate NUMERIC(5, 2),
  color TEXT DEFAULT 'gold' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABLA: TRANSACCIONES DE TARJETA (credit_card_transactions)
CREATE TABLE IF NOT EXISTS public.credit_card_transactions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  date DATE NOT NULL,
  installments INTEGER DEFAULT 1 NOT NULL,
  current_installment INTEGER DEFAULT 1 NOT NULL,
  is_paid BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. TABLA: PRESUPUESTOS POR CATEGORÍA (category_budgets)
CREATE TABLE IF NOT EXISTS public.category_budgets (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('housing', 'food', 'transport', 'utilities', 'health', 'entertainment', 'education', 'debt', 'other')),
  limit_amount NUMERIC(12, 2) NOT NULL CHECK (limit_amount >= 0),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_user_period_category UNIQUE (user_id, period, category)
);

-- 7. TABLA: METAS DE AHORRO & FONDOS (savings_goals)
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL CHECK (current_amount >= 0),
  monthly_contribution NUMERIC(12, 2) DEFAULT 0,
  target_date DATE,
  category TEXT NOT NULL CHECK (category IN ('emergency', 'vacation', 'car', 'home', 'investment', 'education', 'tech', 'other')),
  color TEXT DEFAULT '#34D399',
  is_completed BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. TABLA: PERFILES & SUSCRIPCIONES (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'free' NOT NULL CHECK (plan IN ('free', 'personal', 'pro')),
  plan_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_incomes_user_period ON public.incomes(user_id, period);
CREATE INDEX IF NOT EXISTS idx_expenses_user_period ON public.expenses(user_id, period);
CREATE INDEX IF NOT EXISTS idx_cash_user_period ON public.cash_withdrawals(user_id, period);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user ON public.credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_card ON public.credit_card_transactions(user_id, card_id, is_paid);
