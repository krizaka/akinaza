/** What a transaction needs from the pool: one connection, given back after. */
export interface TransactionPool {
  connect(): Promise<{ query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[] }>; release: () => void }>;
}

/** A SQL runner on one connection of a transaction: the rows of a statement with its parameters. */
export type TransactionQuery = <R = Record<string, unknown>>(text: string, values?: unknown[]) => Promise<R[]>;

/**
 * Runs `work` in one transaction on one connection: COMMIT when it returns, ROLLBACK when it throws. A failed ROLLBACK never
 * hides why the work failed: the original error comes first in an `AggregateError`.
 */
export async function transactionOn<T>(source: TransactionPool, work: (run: TransactionQuery) => Promise<T>): Promise<T> {
  const client = await source.connect();
  try {
    await client.query("BEGIN");
    const out = await work(async (text, values) => (await client.query(text, values)).rows as never);
    await client.query("COMMIT");
    return out;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollback) {
      throw new AggregateError([error, rollback], "The transaction failed and could not be rolled back");
    }
    throw error;
  } finally {
    client.release();
  }
}
