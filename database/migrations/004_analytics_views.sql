-- ==============================================================================
-- 📊 AUREUS · MIGRATION 004: DATA ENGINEERING & ANALYTICAL VIEWS
-- ==============================================================================

-- 1. Vista Analítica: Resumen Mensual Consolidado
CREATE OR REPLACE VIEW public.v_monthly_financial_summary AS
SELECT 
  COALESCE(i.user_id, e.user_id, c.user_id) AS user_id,
  COALESCE(i.period, e.period, c.period) AS period,
  COALESCE(i.total_income, 0) AS total_income,
  COALESCE(e.total_expenses, 0) AS total_expenses,
  COALESCE(e.fixed_expenses, 0) AS fixed_expenses,
  COALESCE(e.variable_expenses, 0) AS variable_expenses,
  COALESCE(c.total_cash_withdrawn, 0) AS total_cash_withdrawn,
  (COALESCE(i.total_income, 0) - COALESCE(e.total_expenses, 0) - COALESCE(c.total_cash_withdrawn, 0)) AS net_cash_flow,
  CASE 
    WHEN COALESCE(i.total_income, 0) > 0 
    THEN ROUND(((COALESCE(i.total_income, 0) - COALESCE(e.total_expenses, 0) - COALESCE(c.total_cash_withdrawn, 0)) / i.total_income) * 100, 2)
    ELSE 0 
  END AS savings_rate_percentage
FROM (
  SELECT user_id, period, SUM(amount) AS total_income
  FROM public.incomes
  GROUP BY user_id, period
) i
FULL OUTER JOIN (
  SELECT 
    user_id, 
    period, 
    SUM(amount) AS total_expenses,
    SUM(CASE WHEN type = 'fixed' THEN amount ELSE 0 END) AS fixed_expenses,
    SUM(CASE WHEN type = 'variable' THEN amount ELSE 0 END) AS variable_expenses
  FROM public.expenses
  GROUP BY user_id, period
) e ON i.user_id = e.user_id AND i.period = e.period
FULL OUTER JOIN (
  SELECT user_id, period, SUM(amount) AS total_cash_withdrawn
  FROM public.cash_withdrawals
  GROUP BY user_id, period
) c ON COALESCE(i.user_id, e.user_id) = c.user_id AND COALESCE(i.period, e.period) = c.period;

-- 2. Vista Analítica: Distribución de Gastos por Categoría
CREATE OR REPLACE VIEW public.v_category_spending_distribution AS
SELECT 
  user_id,
  period,
  category,
  SUM(amount) AS total_spent,
  COUNT(*) AS transaction_count,
  ROUND(AVG(amount), 2) AS average_ticket
FROM public.expenses
GROUP BY user_id, period, category;

-- 3. Vista Analítica: Utilización y Exposición de Tarjetas de Crédito
CREATE OR REPLACE VIEW public.v_credit_card_utilization AS
SELECT 
  cc.user_id,
  cc.id AS card_id,
  cc.name AS card_name,
  cc.bank,
  cc.credit_limit,
  COALESCE(tx.outstanding_balance, 0) AS outstanding_balance,
  (cc.credit_limit - COALESCE(tx.outstanding_balance, 0)) AS available_credit,
  CASE 
    WHEN cc.credit_limit > 0 
    THEN ROUND((COALESCE(tx.outstanding_balance, 0) / cc.credit_limit) * 100, 2)
    ELSE 0 
  END AS utilization_percentage
FROM public.credit_cards cc
LEFT JOIN (
  SELECT 
    user_id,
    card_id,
    SUM(amount) AS outstanding_balance
  FROM public.credit_card_transactions
  WHERE is_paid = false
  GROUP BY user_id, card_id
) tx ON cc.id = tx.card_id AND cc.user_id = tx.user_id;
