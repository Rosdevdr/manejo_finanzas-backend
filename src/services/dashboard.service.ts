import { incomesService } from './incomes.service.js'
import { expensesService } from './expenses.service.js'
import { cashService } from './cash.service.js'
import { creditService } from './credit.service.js'
import { budgetsService } from './budgets.service.js'
import { goalsService } from './goals.service.js'

export interface DashboardSummaryResponse {
  period: string
  // Totales del período
  totalIncome: number
  totalExpenses: number
  fixedExpenses: number
  variableExpenses: number
  cashWithdrawals: number
  netCashFlow: number

  // Acumulados y Liquidez
  carryOver: number
  availableBalance: number
  committedDebts: number
  unencumberedLiquidity: number

  // Ratios Financieros
  savingsRatePercentage: number
  fixedCostRatioPercentage: number
  creditLimitTotal: number
  creditOutstanding: number
  creditUtilizationPercentage: number
  debtCoverageRatio: number

  // Desgloses y Progreso
  categoryBreakdown: {
    category: string
    spent: number
    percentageOfExpenses: number
    budgetLimit: number
    budgetUsedPercentage: number
    status: 'OK' | 'WARNING' | 'EXCEEDED'
  }[]

  goalsProgress: {
    totalTarget: number
    totalSaved: number
    completionPercentage: number
    activeGoalsCount: number
    completedGoalsCount: number
  }

  // Asesor de Salud Financiera
  healthScore: 'EXCELLENT' | 'STABLE' | 'WARNING' | 'CRITICAL'
  advisorAdvice: string[]
}

export class DashboardService {
  async getSummary(userId: string, period: string): Promise<DashboardSummaryResponse> {
    // 1. Obtener todos los registros del usuario
    const [
      allIncomes,
      allExpenses,
      allCash,
      creditCards,
      allCreditTx,
      budgets,
      goals,
    ] = await Promise.all([
      incomesService.list(userId),
      expensesService.list(userId),
      cashService.list(userId),
      creditService.listCards(userId),
      creditService.listTransactions(userId),
      budgetsService.list(userId, period),
      goalsService.list(userId),
    ])

    // 2. Filtrar período actual
    const currentIncomes = allIncomes.filter((i: any) => i.period === period)
    const currentExpenses = allExpenses.filter((e: any) => e.period === period)
    const currentCash = allCash.filter((c: any) => c.period === period)
    const currentCreditTx = allCreditTx.filter((t: any) => t.period === period)

    // 3. Cálculos de flujo del período
    const totalIncome = currentIncomes.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)
    const fixedExpenses = currentExpenses
      .filter((e: any) => e.type === 'fixed')
      .reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)
    const variableExpenses = currentExpenses
      .filter((e: any) => e.type === 'variable')
      .reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)
    const totalExpenses = fixedExpenses + variableExpenses
    const cashWithdrawals = currentCash.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)
    const netCashFlow = totalIncome - totalExpenses - cashWithdrawals

    // 4. Cálculo de Arrastre (Carry-over) de períodos anteriores
    const priorIncomes = allIncomes.filter((i: any) => i.period < period)
    const priorExpenses = allExpenses.filter((e: any) => e.period < period)
    const priorCash = allCash.filter((c: any) => c.period < period)

    const priorTotalIncome = priorIncomes.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)
    const priorTotalExpenses = priorExpenses.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)
    const priorTotalCash = priorCash.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)
    const carryOver = priorTotalIncome - priorTotalExpenses - priorTotalCash

    // 5. Liquidez y Deudas Comprometidas
    const availableBalance = netCashFlow + carryOver
    const committedDebts = currentCreditTx
      .filter((t: any) => !t.is_paid)
      .reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)
    const unencumberedLiquidity = availableBalance - committedDebts

    // 6. Ratios Financieros
    const savingsRatePercentage = totalIncome > 0 ? Number(((netCashFlow / totalIncome) * 100).toFixed(2)) : 0
    const fixedCostRatioPercentage = totalIncome > 0 ? Number(((fixedExpenses / totalIncome) * 100).toFixed(2)) : 0

    const creditLimitTotal = creditCards.reduce((acc: number, c: any) => acc + Number(c.credit_limit || 0), 0)
    const allUnpaidTx = allCreditTx.filter((t: any) => !t.is_paid)
    const creditOutstanding = allUnpaidTx.reduce((acc: number, t: any) => acc + Number(t.amount || 0), 0)
    const creditUtilizationPercentage =
      creditLimitTotal > 0 ? Number(((creditOutstanding / creditLimitTotal) * 100).toFixed(2)) : 0
    const debtCoverageRatio = committedDebts > 0 ? Number((availableBalance / committedDebts).toFixed(2)) : 999

    // 7. Presupuestos y Desglose por Categoría
    const categoryTotals: Record<string, number> = {}
    for (const exp of currentExpenses) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + Number(exp.amount)
    }

    const budgetMap = new Map<string, number>()
    for (const b of budgets) {
      budgetMap.set(b.category, Number(b.limit_amount))
    }

    const allCategories = Array.from(new Set([...Object.keys(categoryTotals), ...budgetMap.keys()]))

    const categoryBreakdown = allCategories.map((category) => {
      const spent = Number((categoryTotals[category] || 0).toFixed(2))
      const budgetLimit = Number((budgetMap.get(category) || 0).toFixed(2))
      const percentageOfExpenses = totalExpenses > 0 ? Number(((spent / totalExpenses) * 100).toFixed(2)) : 0
      const budgetUsedPercentage = budgetLimit > 0 ? Number(((spent / budgetLimit) * 100).toFixed(2)) : 0

      let status: 'OK' | 'WARNING' | 'EXCEEDED' = 'OK'
      if (budgetLimit > 0) {
        if (spent > budgetLimit) status = 'EXCEEDED'
        else if (spent >= budgetLimit * 0.85) status = 'WARNING'
      }

      return {
        category,
        spent,
        percentageOfExpenses,
        budgetLimit,
        budgetUsedPercentage,
        status,
      }
    }).sort((a, b) => b.spent - a.spent)

    // 8. Progreso de Metas
    const totalTarget = goals.reduce((acc: number, g: any) => acc + Number(g.target_amount || 0), 0)
    const totalSaved = goals.reduce((acc: number, g: any) => acc + Number(g.current_amount || 0), 0)
    const completionPercentage = totalTarget > 0 ? Number(((totalSaved / totalTarget) * 100).toFixed(2)) : 0
    const completedGoalsCount = goals.filter((g: any) => g.is_completed || Number(g.current_amount) >= Number(g.target_amount)).length
    const activeGoalsCount = goals.length - completedGoalsCount

    // 9. Scoring Fintech AUREUS
    let healthScore: 'EXCELLENT' | 'STABLE' | 'WARNING' | 'CRITICAL' = 'STABLE'
    const advice: string[] = []

    if (savingsRatePercentage >= 25 && creditUtilizationPercentage < 30) {
      healthScore = 'EXCELLENT'
      advice.push('Tu ratio de ahorro supera el 25% y mantienes el crédito bajo control óptimo.')
    } else if (savingsRatePercentage < 0 || creditUtilizationPercentage > 75 || availableBalance < 0) {
      healthScore = 'CRITICAL'
      advice.push('Tus gastos y deudas superan tus ingresos del período. Revisa de inmediato los gastos variables.')
    } else if (savingsRatePercentage < 10 || creditUtilizationPercentage > 50 || fixedCostRatioPercentage > 60) {
      healthScore = 'WARNING'
      advice.push('Tus costos fijos o nivel de endeudamiento son elevados. Prioriza reducir deudas con alto interés.')
    } else {
      healthScore = 'STABLE'
      advice.push('Tus finanzas se encuentran en equilibrio operativo.')
    }

    if (unencumberedLiquidity < 0) {
      advice.push('Tu liquidez no gravada es negativa tras considerar compromisos de tarjeta de crédito.')
    }

    if (completedGoalsCount > 0) {
      advice.push(`Has completado exitosamente ${completedGoalsCount} meta(s) de ahorro.`)
    }

    return {
      period,
      totalIncome: Number(totalIncome.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      fixedExpenses: Number(fixedExpenses.toFixed(2)),
      variableExpenses: Number(variableExpenses.toFixed(2)),
      cashWithdrawals: Number(cashWithdrawals.toFixed(2)),
      netCashFlow: Number(netCashFlow.toFixed(2)),
      carryOver: Number(carryOver.toFixed(2)),
      availableBalance: Number(availableBalance.toFixed(2)),
      committedDebts: Number(committedDebts.toFixed(2)),
      unencumberedLiquidity: Number(unencumberedLiquidity.toFixed(2)),
      savingsRatePercentage,
      fixedCostRatioPercentage,
      creditLimitTotal: Number(creditLimitTotal.toFixed(2)),
      creditOutstanding: Number(creditOutstanding.toFixed(2)),
      creditUtilizationPercentage,
      debtCoverageRatio,
      categoryBreakdown,
      goalsProgress: {
        totalTarget: Number(totalTarget.toFixed(2)),
        totalSaved: Number(totalSaved.toFixed(2)),
        completionPercentage,
        activeGoalsCount,
        completedGoalsCount,
      },
      healthScore,
      advisorAdvice: advice,
    }
  }
}

export const dashboardService = new DashboardService()
