// Blueprint reference: javascript_database
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Allow server to start even without DATABASE_URL (for frontend-only mode)
// Initialize pool lazily to allow server to start even if DB connection fails initially
let poolInstance: Pool | null = null;
let dbInstance: ReturnType<typeof drizzle> | null = null;
let dbError: Error | null = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  if (dbError) {
    throw dbError;
  }
  if (!poolInstance) {
    try {
      // Create pool - connection is established lazily
    poolInstance = new Pool({ connectionString: process.env.DATABASE_URL });
      // Handle connection errors gracefully (these happen asynchronously)
      poolInstance.on('error', (err) => {
        console.error('Database connection error:', err.message);
        dbError = err as Error;
      });
    } catch (error) {
      dbError = error as Error;
      console.error('Failed to initialize database pool:', error);
      throw error;
    }
  }
  return poolInstance;
}

// Wrapper to catch errors when DB is accessed
function safeGetPool(): Pool | null {
  try {
    return getPool();
  } catch (error) {
    console.warn('Database not available:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

function getDb() {
  if (!dbInstance) {
    dbInstance = drizzle({ client: getPool(), schema });
  }
  return dbInstance;
}

export const pool = new Proxy({} as Pool, {
  get: (_target, prop) => {
    const pool = safeGetPool();
    if (!pool) {
      throw new Error('Database is not available');
    }
    return pool[prop as keyof Pool];
  }
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get: (_target, prop) => {
    return getDb()[prop as keyof ReturnType<typeof drizzle>];
  }
});
