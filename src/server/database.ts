import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool, type PoolClient } from 'pg';

export function createDatabasePool(connectionString = process.env.DATABASE_URL): Pool | null {
  if (!connectionString) return null;
  return new Pool({ connectionString, max: 5, idleTimeoutMillis: 30000 });
}

export async function migrateDatabase(pool: Pool): Promise<void> {
  const migrationDirectory = path.resolve(process.cwd(), 'db/migrations');
  const migrationFiles = (await readdir(migrationDirectory)).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
  const sql = (await Promise.all(migrationFiles.map((file) => readFile(path.join(migrationDirectory, file), 'utf8')))).join('\n');
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
