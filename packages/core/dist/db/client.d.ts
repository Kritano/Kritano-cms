import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
export declare function getConnectionString(): string;
export declare function getClient(): ReturnType<typeof postgres>;
export declare function getDb(): ReturnType<typeof drizzle>;
export declare function closeConnection(): Promise<void>;
//# sourceMappingURL=client.d.ts.map