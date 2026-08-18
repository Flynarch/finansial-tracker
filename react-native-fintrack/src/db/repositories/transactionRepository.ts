import { executeSql, runSql } from '../database';

export interface TransactionEntity {
  id: string;
  wallet_id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  category_id: string;
  subcategory_id?: string | null;
  date: string;
  time?: string | null;
  notes?: string | null;
  receipt_image_uri?: string | null;
  destination_wallet_id?: string | null;
  fee_amount?: number;
  is_exclude_analytics: number;
  created_at: number;
  updated_at: number;
}

export class TransactionRepository {
  static async getAll(limit = 100, offset = 0): Promise<TransactionEntity[]> {
    return await executeSql<TransactionEntity>(
      'SELECT * FROM transactions ORDER BY date DESC, time DESC, created_at DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
  }

  static async getByMonth(yearMonth: string): Promise<TransactionEntity[]> {
    return await executeSql<TransactionEntity>(
      'SELECT * FROM transactions WHERE date LIKE ? ORDER BY date DESC, time DESC',
      [`${yearMonth}%`]
    );
  }

  static async insert(tx: Omit<TransactionEntity, 'created_at' | 'updated_at'>): Promise<void> {
    const now = Date.now();
    await runSql(
      `INSERT INTO transactions (id, wallet_id, type, amount, category_id, subcategory_id, date, time, notes, receipt_image_uri, destination_wallet_id, fee_amount, is_exclude_analytics, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id,
        tx.wallet_id,
        tx.type,
        tx.amount,
        tx.category_id,
        tx.subcategory_id || null,
        tx.date,
        tx.time || null,
        tx.notes || null,
        tx.receipt_image_uri || null,
        tx.destination_wallet_id || null,
        tx.fee_amount || 0,
        tx.is_exclude_analytics || 0,
        now,
        now,
      ]
    );
  }

  static async delete(id: string): Promise<void> {
    await runSql('DELETE FROM transactions WHERE id = ?', [id]);
  }
}
