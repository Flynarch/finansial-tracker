export const SCHEMA_VERSION = 1;

export const CREATE_TABLES_SQL = `
-- 1. Wallets / Accounts Table
CREATE TABLE IF NOT EXISTS wallets (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'bank' | 'ewallet' | 'cash' | 'investment' | 'credit'
  balance REAL NOT NULL DEFAULT 0.0,
  initial_balance REAL NOT NULL DEFAULT 0.0,
  currency TEXT NOT NULL DEFAULT 'IDR',
  custom_icon TEXT,
  institution_id TEXT,
  account_number TEXT,
  color TEXT DEFAULT '#4A688A',
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 2. Financial Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  wallet_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'income' | 'expense' | 'transfer'
  amount REAL NOT NULL,
  category_id TEXT NOT NULL,
  subcategory_id TEXT,
  date TEXT NOT NULL, -- 'YYYY-MM-DD'
  time TEXT, -- 'HH:mm'
  notes TEXT,
  receipt_image_uri TEXT,
  destination_wallet_id TEXT,
  fee_amount REAL DEFAULT 0.0,
  is_exclude_analytics INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'income' | 'expense'
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  is_system INTEGER NOT NULL DEFAULT 0,
  subcategories_json TEXT,
  created_at INTEGER NOT NULL
);

-- 4. Budgets Table
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL,
  limit_amount REAL NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  month_year TEXT NOT NULL,
  alert_threshold REAL NOT NULL DEFAULT 0.8,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 5. Savings Goals Table
CREATE TABLE IF NOT EXISTS savings_goals (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL NOT NULL DEFAULT 0.0,
  target_date TEXT,
  wallet_id TEXT,
  color TEXT DEFAULT '#6EE7B7',
  icon TEXT DEFAULT 'target',
  notes TEXT,
  is_completed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 6. Loans & Debts Table
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL, -- 'payable' | 'receivable'
  person_name TEXT NOT NULL,
  principal_amount REAL NOT NULL,
  remaining_amount REAL NOT NULL,
  due_date TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 7. Todos Table
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  amount REAL DEFAULT 0.0,
  due_date TEXT,
  is_completed INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 8. App Settings Key-Value Table
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- Indexes for ultra-fast query execution
CREATE INDEX IF NOT EXISTS idx_tx_wallet ON transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month_year);
`;
