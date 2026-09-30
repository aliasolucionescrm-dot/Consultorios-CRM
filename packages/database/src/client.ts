import 'dotenv/config';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
export const pool = new Pool({connectionString:process.env.DATABASE_URL, max:15, connectionTimeoutMillis:5000, statement_timeout:10000});
export const db = drizzle(pool,{schema});
export type Connection = Pool | PoolClient;
export async function query<T extends QueryResultRow = QueryResultRow>(sql:string, args:unknown[] = [], connection:Connection = pool):Promise<T[]> {
 return (await connection.query<T>(sql,args)).rows;
}
export async function transaction<T>(work:(connection:PoolClient)=>Promise<T>):Promise<T> {
 const client = await pool.connect();
 try { await client.query('BEGIN'); const value = await work(client); await client.query('COMMIT'); return value; }
 catch(error) {await client.query('ROLLBACK'); throw error;} finally {client.release();}
}
