import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_SQL } from './schema';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('fintrack.db');
    await dbInstance.execAsync(CREATE_TABLES_SQL);
  }
  return dbInstance;
}

export async function executeSql<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const db = await getDatabase();
  return await db.getAllAsync<T>(query, params);
}

export async function runSql(
  query: string,
  params: any[] = []
): Promise<SQLite.SQLiteRunResult> {
  const db = await getDatabase();
  return await db.runAsync(query, params);
}
