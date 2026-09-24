-- ==============================================================================
-- 🧪 AUREUS · SEED FIXTURES FOR QA & INTEGRATION TESTING
-- ==============================================================================

-- Usuario de prueba QA (Mock UUID)
-- Para entornos locales o pruebas unitarias
DO $$
DECLARE
  qa_user_id UUID := '00000000-0000-0000-0000-000000000001';
  qa_card_id TEXT := 'card_qa_mastercard_01';
BEGIN
  -- 1. Incomes
  INSERT INTO public.incomes (id, user_id, period, description, amount, type, date)
  VALUES 
    ('inc_qa_01', qa_user_id, '2026-09', 'Salario Nómina Principal', 125000.00, 'salary', '2026-09-15'),
    ('inc_qa_02', qa_user_id, '2026-09', 'Consultoría Backend / Data', 45000.00, 'freelance', '2026-09-20')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Credit Card
  INSERT INTO public.credit_cards (id, user_id, name, bank, last_four_digits, credit_limit, cutoff_day, payment_due_day, interest_rate, color)
  VALUES 
    (qa_card_id, qa_user_id, 'BHD Black Mastercard', 'Banco BHD', '4589', 250000.00, 24, 15, 3.5, 'gold')
  ON CONFLICT (id) DO NOTHING;

  -- 3. Expenses
  INSERT INTO public.expenses (id, user_id, period, description, amount, category, type, payment_method, date)
  VALUES 
    ('exp_qa_01', qa_user_id, '2026-09', 'Alquiler Apartamento Torre', 38000.00, 'housing', 'fixed', 'bank_transfer', '2026-09-02'),
    ('exp_qa_02', qa_user_id, '2026-09', 'Supermercado Nacional', 18450.00, 'food', 'variable', 'credit_card', '2026-09-10'),
    ('exp_qa_03', qa_user_id, '2026-09', 'Combustible Shell', 6500.00, 'transport', 'variable', 'credit_card', '2026-09-14')
  ON CONFLICT (id) DO NOTHING;

  -- 4. Credit Card Transaction
  INSERT INTO public.credit_card_transactions (id, user_id, card_id, period, description, amount, category, date, installments, current_installment, is_paid)
  VALUES 
    ('tx_qa_01', qa_user_id, qa_card_id, '2026-09', 'Supermercado Nacional', 18450.00, 'food', '2026-09-10', 1, 1, false)
  ON CONFLICT (id) DO NOTHING;

  -- 5. Savings Goal
  INSERT INTO public.savings_goals (id, user_id, name, target_amount, current_amount, monthly_contribution, target_date, category, color, is_completed)
  VALUES 
    ('goal_qa_01', qa_user_id, 'Fondo de Emergencia 6M', 400000.00, 185000.00, 25000.00, '2026-12-31', 'emergency', '#10B981', false)
  ON CONFLICT (id) DO NOTHING;
END $$;
