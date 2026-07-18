export declare function initializeRedis(): Promise<void>;
export declare const redis: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, ttlSeconds?: number) => Promise<string | null>;
    del: (key: string) => Promise<number>;
    exists: (key: string) => Promise<number>;
    quit: () => Promise<string>;
};
//# sourceMappingURL=redis.d.ts.map