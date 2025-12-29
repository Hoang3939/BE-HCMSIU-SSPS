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
    // Additional options to improve connection reliability
    abortTransactionOnError: false,
    useUTC: true,
    // Enable TCP keep-alive to maintain connection
    tdsVersion: '7_4',
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
    // Increase acquire timeout for better connection handling
    acquireTimeoutMillis: 60000,
  },
};

// Create connection pool
let pool: sql.ConnectionPool | null = null;

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Connect to database with retry mechanism
 * @param retries Number of retry attempts (default: 3)
 * @param retryDelay Delay between retries in milliseconds (default: 2000)
 * @returns Connection pool
 */
export async function connectDB(retries: number = 3, retryDelay: number = 2000): Promise<sql.ConnectionPool> {
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
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

      if (attempt === 1) {
        console.log('[database]: Attempting to connect to database...');
        console.log(`[database]: Server: ${dbConfig.server}:${dbConfig.port}`);
        console.log(`[database]: Database: ${dbConfig.database}`);
        console.log(`[database]: User: ${dbConfig.user}`);
        console.log(`[database]: Connection timeout: ${dbConfig.connectionTimeout}ms`);
      } else {
        console.log(`[database]: Retry attempt ${attempt}/${retries}...`);
      }

      // Create new connection pool
      pool = new sql.ConnectionPool(dbConfig);
      
      // Handle connection errors
      pool.on('error', (err) => {
        console.error('[database]: Connection pool error:', err);
        // Reset pool on error
        pool = null;
      });

      await pool.connect();
      console.log('[database]: ✅ Connected to SQL Server successfully');
      
      return pool;
      } catch (error: any) {
      lastError = error;
      pool = null; // Reset pool on error
      
      // Extract more detailed error information
      const errorCode = error.code || error.number || 'UNKNOWN';
      const errorMessage = error.message || String(error);
      const isNetworkError = errorCode === 'ESOCKET' || 
                           errorCode === 'ETIMEOUT' || 
                           errorCode === 'ECONNREFUSED' ||
                           errorMessage.includes('Could not connect') ||
                           errorMessage.includes('sequence');
      
      if (attempt < retries) {
        console.error(`[database]: Connection attempt ${attempt} failed: ${errorMessage}`);
        if (errorCode !== 'UNKNOWN') {
          console.error(`[database]: Error code: ${errorCode}`);
        }
        console.log(`[database]: Retrying in ${retryDelay}ms...`);
        await sleep(retryDelay);
        // Exponential backoff: increase delay for each retry
        retryDelay *= 1.5;
      } else {
        // Last attempt failed, show detailed error
        console.error('[database]: ❌ Database connection error:', errorMessage);
        if (errorCode !== 'UNKNOWN') {
          console.error(`[database]: Error code: ${errorCode}`);
        }
        
        if (isNetworkError) {
          console.error('\n[database]: ⚠️  NETWORK CONNECTION ERROR DETECTED');
          console.error('═══════════════════════════════════════════════════════════');
          console.error(`[database]: Target: ${dbConfig.server}:${dbConfig.port}`);
          console.error(`[database]: Database: ${dbConfig.database}`);
          console.error(`[database]: User: ${dbConfig.user}`);
          console.error(`[database]: Attempted: ${retries} times`);
          console.error(`[database]: Error: ${errorMessage}`);
          console.error('\n[database]: 🔍 POSSIBLE CAUSES:');
          console.error('  1. ❌ SQL Server is not running or unavailable');
          console.error('  2. 🔥 Firewall is blocking port 1433');
          console.error('  3. 🔌 SQL Server TCP/IP protocol is not enabled');
          console.error('  4. 📍 Incorrect IP address or port');
          console.error('  5. 🌐 SQL Server does not allow remote connections');
          console.error('  6. 🔐 Network/VPN connectivity issues');
          console.error('  7. ⏱️  Connection timeout (server too slow to respond)');
          console.error('\n[database]: 🛠️  TROUBLESHOOTING STEPS:');
          console.error('\n  1️⃣  Test Network Connectivity:');
          console.error(`     PowerShell: Test-NetConnection -ComputerName ${dbConfig.server} -Port ${dbConfig.port}`);
          console.error(`     CMD: telnet ${dbConfig.server} ${dbConfig.port}`);
          console.error(`     Ping: ping ${dbConfig.server}`);
          console.error('\n  2️⃣  Check SQL Server Status (on server machine):');
          console.error('     - Open SQL Server Configuration Manager');
          console.error('     - SQL Server Services > Verify "SQL Server (MSSQLSERVER)" is Running');
          console.error('     - If stopped, right-click > Start');
          console.error('\n  3️⃣  Enable TCP/IP Protocol (on server machine):');
          console.error('     - SQL Server Configuration Manager');
          console.error('     - SQL Server Network Configuration > Protocols for MSSQLSERVER');
          console.error('     - Right-click TCP/IP > Enable');
          console.error('     - Restart SQL Server service');
          console.error('\n  4️⃣  Configure SQL Server to Listen on Port 1433:');
          console.error('     - SQL Server Configuration Manager');
          console.error('     - SQL Server Network Configuration > Protocols > TCP/IP');
          console.error('     - Properties > IP Addresses tab');
          console.error('     - Scroll to "IPAll" section');
          console.error('     - Set "TCP Dynamic Ports" to empty');
          console.error('     - Set "TCP Port" to 1433');
          console.error('     - Restart SQL Server service');
          console.error('\n  5️⃣  Configure Windows Firewall (on server machine):');
          console.error('     - Windows Defender Firewall > Advanced Settings');
          console.error('     - Inbound Rules > New Rule');
          console.error('     - Port > TCP > Specific: 1433');
          console.error('     - Allow connection > Apply to all profiles');
          console.error('\n  6️⃣  Enable SQL Server Authentication:');
          console.error('     - SQL Server Management Studio (SSMS)');
          console.error('     - Right-click server > Properties > Security');
          console.error('     - Select "SQL Server and Windows Authentication mode"');
          console.error('     - Restart SQL Server service');
          console.error('     - Enable sa account: Security > Logins > sa > Properties > Status > Enabled');
          console.error('\n  7️⃣  Check SQL Server Error Log:');
          console.error('     - SSMS > Management > SQL Server Logs');
          console.error('     - Look for connection-related errors');
          console.error('\n  8️⃣  Alternative: Use Connection String with Instance Name:');
          console.error(`     - If using named instance: ${dbConfig.server}\\INSTANCENAME`);
          console.error('     - Update DB_SERVER in .env file');
          console.error('═══════════════════════════════════════════════════════════\n');
        }
      }
    }
  }
  
  throw lastError;
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

