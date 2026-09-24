import { FinancialSummaryInput } from '../validators/schemas.js'

export interface CalculatedFinancialMetrics {
  totalIncome: number
  totalExpenses: number
  fixedExpenses: number
  variableExpenses: number
  cashWithdrawals: number
  netCashFlow: number
  savingsRatePercentage: number
  fixedCostRatioPercentage: number
  totalCreditLimit: number
  totalOutstandingBalance: number
  creditUtilizationPercentage: number
  categoryDistribution: {
    category: string
    totalAmount: number
    percentageOfTotal: number
  }[]
  healthScore: 'EXCELLENT' | 'STABLE' | 'WARNING' | 'CRITICAL'
}

export class AnalyticsService {
  public calculateSummary(input: FinancialSummaryInput): CalculatedFinancialMetrics {
    const totalIncome = input.incomes.reduce((acc, curr) => acc + curr.amount, 0)
    const fixedExpenses = input.expenses
      .filter((e) => e.type === 'fixed')
      .reduce((acc, curr) => acc + curr.amount, 0)
    const variableExpenses = input.expenses
      .filter((e) => e.type === 'variable')
      .reduce((acc, curr) => acc + curr.amount, 0)
    const totalExpenses = fixedExpenses + variableExpenses
    const cashWithdrawals = input.cashWithdrawals.reduce((acc, curr) => acc + curr.amount, 0)

    const netCashFlow = totalIncome - totalExpenses - cashWithdrawals
    const savingsRatePercentage = totalIncome > 0 ? Number(((netCashFlow / totalIncome) * 100).toFixed(2)) : 0
    const fixedCostRatioPercentage = totalIncome > 0 ? Number(((fixedExpenses / totalIncome) * 100).toFixed(2)) : 0

    const totalCreditLimit = input.creditCards.reduce((acc, curr) => acc + curr.credit_limit, 0)
    const totalOutstandingBalance = input.creditCards.reduce((acc, curr) => acc + curr.outstanding_balance, 0)
    const creditUtilizationPercentage =
      totalCreditLimit > 0 ? Number(((totalOutstandingBalance / totalCreditLimit) * 100).toFixed(2)) : 0

    // Categorización
    const categoryTotals: Record<string, number> = {}
    for (const exp of input.expenses) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount
    }

    const categoryDistribution = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        totalAmount: Number(amount.toFixed(2)),
        percentageOfTotal: totalExpenses > 0 ? Number(((amount / totalExpenses) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)

    // Health Score calculation (Fintech Risk Scoring Algorithm)
    let healthScore: CalculatedFinancialMetrics['healthScore'] = 'STABLE'
    if (savingsRatePercentage >= 25 && creditUtilizationPercentage < 30) {
      healthScore = 'EXCELLENT'
    } else if (savingsRatePercentage < 0 || creditUtilizationPercentage > 70) {
      healthScore = 'CRITICAL'
    } else if (savingsRatePercentage < 10 || creditUtilizationPercentage > 50) {
      healthScore = 'WARNING'
    }

    return {
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      fixedExpenses: Number(fixedExpenses.toFixed(2)),
      variableExpenses: Number(variableExpenses.toFixed(2)),
      cashWithdrawals: Number(cashWithdrawals.toFixed(2)),
      netCashFlow: Number(netCashFlow.toFixed(2)),
      savingsRatePercentage,
      fixedCostRatioPercentage,
      totalCreditLimit: Number(totalCreditLimit.toFixed(2)),
      totalOutstandingBalance: Number(totalOutstandingBalance.toFixed(2)),
      creditUtilizationPercentage,
      categoryDistribution,
      healthScore,
    }
  }
}

export const analyticsService = new AnalyticsService()
