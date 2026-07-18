import { PoolClient } from 'pg';
export declare function initializeDatabase(): Promise<void>;
export declare const db: {
    query: (text: string, params?: any[]) => Promise<import("pg").QueryResult<any>> | Promise<{
        rows: any[];
        rowCount: number;
    }>;
    transaction: <T>(callback: (client: PoolClient) => Promise<T>) => Promise<T>;
    end: () => Promise<void>;
};
//# sourceMappingURL=database.d.ts.map