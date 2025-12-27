import sql from 'mssql';
import * as dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['DB_SERVER', 'DB_DATABASE', 'DB_USER', 'DB_PASSWORD'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// SQL Server connection configuration
const dbConfig: sql.config = {
  server: process.env.DB_SERVER!,
  database: process.env.DB_DATABASE!,
  user: process.env.DB_USER!,
  password: process.env.DB_PASSWORD!,
  port: parseInt(process.env.DB_PORT || '1433'),
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '60000'), // 60 seconds
  requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '30000'), // 30 seconds
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== 'false',
    enableArithAbort: true,
    connectTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '60000'), // Additional connectTimeout
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Create connection pool
let pool: sql.ConnectionPool | null = null;

/**
 * Connect to database
 * @returns Connection pool
 */
export async function connectDB(): Promise<sql.ConnectionPool> {
  try {
    // Close existing pool if it exists but is not connected
    if (pool && !pool.connected) {
      try {
        await pool.close();
      } catch (e) {
        // Ignore close errors
      }
      pool = null;
    }

    if (pool && pool.connected) {
      return pool;
    }

    console.log('[database]: Attempting to connect to database...');
    console.log(`[database]: Server: ${dbConfig.server}:${dbConfig.port}`);
    console.log(`[database]: Database: ${dbConfig.database}`);
    console.log(`[database]: User: ${dbConfig.user}`);
    console.log(`[database]: Connection timeout: ${dbConfig.connectionTimeout}ms`);

    // Create new connection pool
    pool = new sql.ConnectionPool(dbConfig);
    
    // Handle connection errors
    pool.on('error', (err) => {
      console.error('[database]: Connection pool error:', err);
      // Reset pool on error
      pool = null;
    });

    await pool.connect();
    console.log('[database]: Connected to SQL Server successfully');
    
    return pool;
  } catch (error: any) {
    console.error('[database]: Database connection error:', error.message || error);
    
    if (error.code === 'ESOCKET' || error.code === 'ETIMEOUT') {
      console.error('\n[database]: Connection Error Diagnosis:');
      console.error('═══════════════════════════════════════════════════════════');
      console.error(`[database]: Connecting to: ${dbConfig.server}:${dbConfig.port}`);
      console.error(`[database]: Database: ${dbConfig.database}`);
      console.error(`[database]: User: ${dbConfig.user}`);
      console.error('\n[database]: Possible causes:');
      console.error('  1. SQL Server is not running or unavailable');
      console.error('  2. Firewall is blocking port 1433');
      console.error('  3. SQL Server TCP/IP protocol is not enabled');
      console.error('  4. Incorrect IP address or port');
      console.error('  5. SQL Server does not allow remote connections');
      console.error('  6. Network or VPN issues');
      console.error('\n[database]: Troubleshooting steps:');
      console.error('  1. Check if SQL Server is running:');
      console.error('     - Open SQL Server Configuration Manager');
      console.error('     - Verify SQL Server Services are running');
      console.error('  2. Check TCP/IP Protocol:');
      console.error('     - SQL Server Configuration Manager > SQL Server Network Configuration');
      console.error('     - Enable TCP/IP and restart SQL Server');
      console.error('  3. Check Firewall:');
      console.error('     - Allow port 1433 in Windows Firewall');
      console.error('     - Or temporarily disable firewall for testing');
      console.error('  4. Check network connectivity:');
      console.error(`     - Run: ping ${dbConfig.server}`);
      console.error(`     - Run: Test-NetConnection -ComputerName ${dbConfig.server} -Port ${dbConfig.port}`);
      console.error('  5. Check SQL Server Authentication:');
      console.error('     - Ensure SQL Server Authentication is enabled');
      console.error('     - Verify sa account is activated');
      console.error('═══════════════════════════════════════════════════════════\n');
    }
    
    throw error;
  }
}

/**
 * Close database connection
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
 * Test database connection
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
 * Get current connection pool with automatic reconnection
 * Get current connection pool
 * Get current connection pool with automatic reconnection
 */
export async function getPool(): Promise<sql.ConnectionPool> {
  // Check if pool exists and is connected
  if (pool && pool.connected) {
    try {
      // Test connection with a simple query
      await pool.request().query('SELECT 1');
      return pool;
    } catch (error) {
      // Connection is dead, reset pool
      console.log('[database]: Connection pool is dead, reconnecting...');
      pool = null;
    }
  }

  // Reconnect if pool is null or not connected
  if (!pool || !pool.connected) {
    console.log('[database]: Reconnecting to database...');
    pool = await connectDB();
  }

  return pool;
}

export default dbConfig;

