// ==============================================================================
// 🏛️ AUREUS · APPLICATION PORT: UNIT OF WORK (FRONTERA TRANSACCIONAL ACID)
// ==============================================================================

export interface IUnitOfWork {
  /**
   * Ejecuta un bloque de trabajo dentro de una transacción atómica de base de datos.
   * Si el bloque finaliza sin errores, realiza COMMIT.
   * Si ocurre cualquier excepción, realiza ROLLBACK automático.
   */
  execute<T>(work: () => Promise<T>): Promise<T>
}
