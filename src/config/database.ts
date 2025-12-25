import sql from 'mssql';
import * as dotenv from 'dotenv';

dotenv.config();

// Validate các biến môi trường bắt buộc
const requiredEnvVars = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Cấu hình kết nối SQL Server
const dbConfig: sql.config = {
  server: process.env.DB_SERVER!,
  database: process.env.DB_DATABASE!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  port: parseInt(process.env.DB_PORT || '1433'),
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Tạo connection pool
let pool: sql.ConnectionPool | null = null;

/**
 * Kết nối đến database
 * @returns Connection pool
 */
export async function connectDB(): Promise<sql.ConnectionPool> {
  try {
    if (pool && pool.connected) {
      return pool;
    }

    pool = await sql.connect(dbConfig);
    console.log('[database]: Connected to SQL Server successfully');
    console.log(`[database]: Server: ${dbConfig.server}`);
    console.log(`[database]: Database: ${dbConfig.database}`);
    
    return pool;
  } catch (error) {
    console.error('[database]: Error connecting to database:', error);
    throw error;
  }
}

/**
 * Đóng kết nối database
 */
export async function closeDB(): Promise<void> {
  try {
    if (pool) {
      await pool.close();
      pool = null;
      console.log('[database]: Database connection closed');
    }
  } catch (error) {
    console.error('[database]: Error closing database connection:', error);
    throw error;
  }
}

/**
 * Test kết nối database
 */
export async function testConnection(): Promise<boolean> {
  try {
    const pool = await connectDB();
    const result = await pool.request().query('SELECT 1 as test');
    console.log('[database]: Connection test successful');
    return true;
  } catch (error) {
    console.error('[database]: Connection test failed:', error);
    return false;
  }
}

/**
 * Lấy connection pool hiện tại
 */
export function getPool(): sql.ConnectionPool | null {
  return pool;
}

export default dbConfig;

