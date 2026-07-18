export interface EnvConfig {
    NODE_ENV: string;
    PORT: number;
    DB_HOST: string;
    DB_PORT: number;
    DB_NAME: string;
    DB_USER: string;
    DB_PASSWORD: string;
    DB_SSL: boolean;
    REDIS_HOST: string;
    REDIS_PORT: number;
    REDIS_PASSWORD: string;
    GEMINI_API_KEY: string;
    ALLOWED_ORIGINS: string[];
    REQUIRE_AUTH: boolean;
    RATE_LIMIT_WINDOW_MS: number;
    RATE_LIMIT_MAX_REQUESTS: number;
    DEFAULT_VENUE_ID: string;
    LOG_LEVEL: string;
    ENABLE_GEMINI_FORECASTING: boolean;
    ENABLE_WEBSOCKET: boolean;
    ENABLE_SCHEDULED_JOBS: boolean;
}
export declare function loadEnv(): EnvConfig;
export declare const env: EnvConfig;
//# sourceMappingURL=env.d.ts.map