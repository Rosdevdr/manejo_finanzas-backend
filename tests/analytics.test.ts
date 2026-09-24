import { describe, it, expect } from 'vitest'
import { analyticsService } from '../src/services/analytics.service.js'
import { FinancialSummaryInput } from '../src/validators/schemas.js'

describe('Data Engineering & QA: Financial Metrics Calculations', () => {
  const sampleInput: FinancialSummaryInput = {
    incomes: [
      { id: '1', amount: 100000, type: 'salary', period: '2026-09' },
      { id: '2', amount: 25000, type: 'freelance', period: '2026-09' },
    ],
    expenses: [
      { id: 'e1', amount: 30000, category: 'housing', type: 'fixed', period: '2026-09' },
      { id: 'e2', amount: 15000, category: 'food', type: 'variable', period: '2026-09' },
      { id: 'e3', amount: 5000, category: 'transport', type: 'variable', period: '2026-09' },
    ],
    cashWithdrawals: [
      { id: 'c1', amount: 5000, period: '2026-09' },
    ],
    creditCards: [
      { id: 'card1', credit_limit: 100000, outstanding_balance: 20000 },
    ],
  }

  it('Calcula correctamente el flujo neto de efectivo', () => {
    const summary = analyticsService.calculateSummary(sampleInput)

    // Total income = 125,000
    // Total expenses = 50,000 (30,000 fixed + 20,000 variable)
    // Cash withdrawals = 5,000
    // Net cash flow = 125,000 - 50,000 - 5,000 = 70,000
    expect(summary.totalIncome).toBe(125000)
    expect(summary.totalExpenses).toBe(50000)
    expect(summary.fixedExpenses).toBe(30000)
    expect(summary.variableExpenses).toBe(20000)
    expect(summary.cashWithdrawals).toBe(5000)
    expect(summary.netCashFlow).toBe(70000)
  })

  it('Calcula la tasa de ahorro y utilización crediticia', () => {
    const summary = analyticsService.calculateSummary(sampleInput)

    // Savings rate = (70,000 / 125,000) * 100 = 56%
    expect(summary.savingsRatePercentage).toBe(56)

    // Credit utilization = (20,000 / 100,000) * 100 = 20%
    expect(summary.creditUtilizationPercentage).toBe(20)

    // Fixed cost ratio = (30,000 / 125,000) * 100 = 24%
    expect(summary.fixedCostRatioPercentage).toBe(24)

    // Health score should be EXCELLENT (savings >= 25% and utilization < 30%)
    expect(summary.healthScore).toBe('EXCELLENT')
  })

  it('Agrupa y ordena correctamente el desglose por categorías', () => {
    const summary = analyticsService.calculateSummary(sampleInput)

    expect(summary.categoryDistribution).toHaveLength(3)
    // Highest category is housing (30,000)
    expect(summary.categoryDistribution[0].category).toBe('housing')
    expect(summary.categoryDistribution[0].totalAmount).toBe(30000)
    expect(summary.categoryDistribution[0].percentageOfTotal).toBe(60) // 30,000 / 50,000
  })
})
