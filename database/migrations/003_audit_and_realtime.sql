-- ==============================================================================
-- 🛡️ AUREUS · MIGRATION 003: AUDIT TRAIL & REALTIME REPLICATION
-- ==============================================================================

-- Tabla de Auditoría Inmutable para QA y Cumplimiento
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'CHECKOUT', 'WEBHOOK_EVENT')),
  table_name TEXT NOT NULL,
  record_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Configuración de réplica completa para CDC (Change Data Capture)
ALTER TABLE public.incomes REPLICA IDENTITY FULL;
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.cash_withdrawals REPLICA IDENTITY FULL;
ALTER TABLE public.credit_cards REPLICA IDENTITY FULL;
ALTER TABLE public.credit_card_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.category_budgets REPLICA IDENTITY FULL;
ALTER TABLE public.savings_goals REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Publicación Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.incomes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_withdrawals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_card_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.category_budgets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.savings_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
