export interface Transaction {}

export interface TransactionManager {
  withTransaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T>;
}
