import 'dotenv/config';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URLが設定されていません');
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
});