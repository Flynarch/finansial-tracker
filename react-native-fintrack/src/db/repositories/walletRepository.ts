import { executeSql, runSql } from '../database';

export interface WalletEntity {
  id: string;
  name: string;
  type: 'bank' | 'ewallet' | 'cash' | 'investment' | 'credit';
  balance: number;
  initial_balance: number;
  currency: string;
  custom_icon?: string | null;
  institution_id?: string | null;
  account_number?: string | null;
  color?: string | null;
  is_archived: number;
  created_at: number;
  updated_at: number;
}

export class WalletRepository {
  static async getAll(includeArchived = false): Promise<WalletEntity[]> {
    const query = includeArchived
      ? 'SELECT * FROM wallets ORDER BY created_at ASC'
      : 'SELECT * FROM wallets WHERE is_archived = 0 ORDER BY created_at ASC';
    return await executeSql<WalletEntity>(query);
  }

  static async getById(id: string): Promise<WalletEntity | null> {
    const rows = await executeSql<WalletEntity>(
      'SELECT * FROM wallets WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  static async insert(wallet: Omit<WalletEntity, 'created_at' | 'updated_at'>): Promise<void> {
    const now = Date.now();
    await runSql(
      `INSERT INTO wallets (id, name, type, balance, initial_balance, currency, custom_icon, institution_id, account_number, color, is_archived, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        wallet.id,
        wallet.name,
        wallet.type,
        wallet.balance,
        wallet.initial_balance,
        wallet.currency || 'IDR',
        wallet.custom_icon || null,
        wallet.institution_id || null,
        wallet.account_number || null,
        wallet.color || '#4A688A',
        wallet.is_archived || 0,
        now,
        now,
      ]
    );
  }

  static async updateBalance(id: string, newBalance: number): Promise<void> {
    await runSql(
      'UPDATE wallets SET balance = ?, updated_at = ? WHERE id = ?',
      [newBalance, Date.now(), id]
    );
  }

  static async delete(id: string): Promise<void> {
    await runSql('DELETE FROM wallets WHERE id = ?', [id]);
  }
}
