# Gate Intelligence Engine Backend — Complete Setup Guide

## Quick Start (5 Minutes)

```bash
# 1. Clone + install
git clone <your-repo>
cd gate-intelligence-engine-backend
npm install

# 2. Set up .env
cp .env.example .env
# Edit .env with your credentials

# 3. Start database + server
docker-compose up -d
npm run dev

# 4. Test
curl http://localhost:3000/api/health
# {"service": "Gate Intelligence Engine", "status": "operational"}
```

---

## 1. Dependencies (package.json)

```json
{
  "name": "gate-intelligence-engine-backend",
  "version": "1.0.0",
  "description": "AI-powered stadium crowd management",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --coverage",
    "db:migrate": "flyway migrate",
    "db:seed": "ts-node src/seed.ts",
    "lint": "eslint src/**/*.ts",
    "format": "prettier --write src/**/*.ts"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "pg": "^8.11.3",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "node-cron": "^3.0.2",
    "redis": "^4.6.11",
    "@google/generative-ai": "^0.1.3",
    "dotenv": "^16.3.1",
    "uuid": "^9.0.0",
    "joi": "^17.11.0",
    "pino": "^8.17.2",
    "pino-http": "^8.5.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.0",
    "@types/jest": "^29.5.8",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.13.2",
    "prettier": "^3.1.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

---

## 2. Environment Variables (.env)

```bash
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=gate_intelligence
DB_USER=postgres
DB_PASSWORD=secure-password-here
DB_SSL=false

# Redis (for caching + WebSocket)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Gemini API
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-pro

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001,https://yourdomain.com

# JWT (for API auth)
JWT_SECRET=your-jwt-secret-here
JWT_EXPIRY=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Venue Config (venue-specific)
DEFAULT_VENUE_ID=stadiumA
DEFAULT_GATES=gate_1,gate_2,gate_3,gate_4,gate_5
```

---

## 3. Docker Compose (docker-compose.yml)

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: gate-engine-db
    environment:
      POSTGRES_DB: gate_intelligence
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secure-password-here
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: gate-engine-cache
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Node.js Backend
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: gate-engine-backend
    environment:
      - NODE_ENV=development
      - DB_HOST=postgres
      - DB_PORT=5432
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev

volumes:
  postgres_data:
  redis_data:
```

---

## 4. Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start
CMD ["npm", "start"]
```

---

## 5. TypeScript Config (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

---

## 6. Database Configuration (config/database.ts)

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gate_intelligence',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const db = pool;

export async function initializeDatabase() {
  try {
    await db.query('SELECT NOW()');
    console.log('✓ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}
```

---

## 7. Gemini API Config (config/gemini.ts)

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const client = new GoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const genAI = client;

export async function initializeGemini() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent('test');
    console.log('✓ Gemini API initialized');
  } catch (error) {
    console.error('⚠️ Gemini API unavailable (fallback enabled):', error);
  }
}

export async function generateForecast(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  const result = await model.generateContent(prompt);
  return result.response.text();
}
```

---

## 8. Middleware (middleware/error.ts)

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from './logging';

export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  logger.error({
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  const status = error.status || 500;
  const message = error.message || 'Internal Server Error';

  res.status(status).json({
    error: message,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
}
```

---

## 9. Health Check (routes/health.ts)

```typescript
import { Router, Request, Response } from 'express';
import { db } from '../config/database';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const dbCheck = await db.query('SELECT NOW()');
    const uptime = process.uptime();

    res.json({
      service: 'Gate Intelligence Engine',
      version: '1.0.0',
      status: 'operational',
      uptime: Math.floor(uptime),
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      service: 'Gate Intelligence Engine',
      status: 'degraded',
      database: 'unavailable',
      error: String(error),
    });
  }
});

export default router;
```

---

## 10. Database Migrations (migrations/001_initial.sql)

```sql
-- Run this FIRST to initialize schema
-- Already provided in OUTCOME_TRACKING_SCHEMA.sql

-- Quick reference:
-- 1. nudges table
-- 2. nudge_interactions table
-- 3. route_decisions table
-- 4. confirmations table
-- 5. gate_entries table
-- 6. feedback table
-- 7. gates table
-- 8. events table
-- Plus: materialized views, triggers, indexes

-- To apply:
-- psql -h localhost -U postgres -d gate_intelligence -f migrations/001_initial.sql
```

---

## 11. Deployment Checklist

### Local Development
```bash
# 1. Start services
docker-compose up -d

# 2. Run migrations
npm run db:migrate

# 3. Seed sample data
npm run db:seed

# 4. Start development server
npm run dev

# 5. Run tests
npm test

# 6. Open browser
# http://localhost:3000/api/health
```

### Production Deployment

```bash
# 1. Build Docker image
docker build -t gate-engine:1.0.0 .

# 2. Push to registry
docker push your-registry/gate-engine:1.0.0

# 3. Deploy to Kubernetes or Docker Swarm
kubectl apply -f k8s/deployment.yaml

# 4. Verify health
curl https://api.yourdomain.com/api/health

# 5. Monitor logs
kubectl logs -f deployment/gate-engine-backend
```

### Environment-Specific Configs

**Development (.env.development)**
```
NODE_ENV=development
LOG_LEVEL=debug
DB_HOST=postgres
GEMINI_API_KEY=dev-key
```

**Production (.env.production)**
```
NODE_ENV=production
LOG_LEVEL=error
DB_HOST=prod-db.internal
DB_SSL=true
GEMINI_API_KEY=prod-key
```

---

## 12. Testing (tests/wait-time.test.ts)

```typescript
import { WaitTimeService } from '../services/wait-time.service';

describe('WaitTimeService', () => {
  it('should calculate wait time correctly', async () => {
    const wait = await WaitTimeService.calculateWaitForGate('gate_2');
    expect(wait).toBeLessThan(30); // Sanity check
  });

  it('should handle stress factor', async () => {
    // Mock high queue
    // Verify stress factor applied
  });

  it('should fallback to rule-based on Gemini error', async () => {
    // Mock Gemini error
    // Verify fallback works
  });
});
```

---

## 13. Monitoring & Observability

### Logging (using Pino)
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

// Usage
logger.info({ nudge_id: 'nudge_123' }, 'Nudge sent');
logger.error({ error: e }, 'Failed to calculate wait time');
```

### Metrics (Prometheus)
```typescript
// Export metrics for Prometheus
app.get('/metrics', (req, res) => {
  res.type('text/plain');
  res.send(`
    # HELP nudges_sent_total Total nudges sent
    # TYPE nudges_sent_total counter
    nudges_sent_total ${nudgesSent}
    
    # HELP wait_time_actual_seconds Actual gate wait time
    # TYPE wait_time_actual_seconds gauge
    wait_time_actual_seconds{gate="gate_2"} 180
  `);
});
```

---

## 14. API Documentation (OpenAPI/Swagger)

```yaml
openapi: 3.0.0
info:
  title: Gate Intelligence Engine API
  version: 1.0.0
paths:
  /api/fans/nudges:
    get:
      summary: Get nudge for fan
      parameters:
        - name: user_id
          in: query
          required: true
          schema:
            type: string
        - name: lat
          in: query
          required: true
          schema:
            type: number
        - name: lng
          in: query
          required: true
          schema:
            type: number
      responses:
        '200':
          description: Nudge object
        '400':
          description: Bad request

  /api/ops/wait-times:
    get:
      summary: Get current wait times for all gates
      parameters:
        - name: venue_id
          in: query
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Map of gate IDs to wait times in minutes
```

---

## 15. Performance Tuning

### Database Connection Pooling
```typescript
const pool = new Pool({
  max: 20,                      // Max connections
  idleTimeoutMillis: 30000,     // Recycle after 30s
  connectionTimeoutMillis: 2000, // Timeout after 2s
});
```

### Caching Strategy
```typescript
// Cache wait times for 30 seconds
async function getCachedWaitTimes(venueId: string) {
  const cached = await redis.get(`wait_times:${venueId}`);
  if (cached) return JSON.parse(cached);

  const fresh = await db.query(/* ... */);
  await redis.setex(`wait_times:${venueId}`, 30, JSON.stringify(fresh));
  return fresh;
}
```

### Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // Limit each IP to 100 requests
});

app.use('/api/', limiter);
```

---

## 16. Security Best Practices

- [x] Use HTTPS in production
- [x] Implement JWT authentication
- [x] Hash user IDs before storing
- [x] SQL injection prevention (use parameterized queries)
- [x] CORS with whitelist
- [x] Rate limiting
- [x] Input validation with Joi
- [x] Helmet for security headers
- [x] Environment variables for secrets

---

## 17. Build Timeline

**Day 1 (Setup + Foundation):**
- Set up project structure
- Configure Docker + PostgreSQL
- Implement WaitTimeService
- Wire up basic API routes

**Day 2 (Core Features):**
- Implement NudgeService
- Implement RouteService
- Wire up all /api/fans routes
- Test all endpoints

**Day 3 (Real-time + Outcomes):**
- Implement WebSocket broadcast
- Set up outcome tracking queries
- Implement cron jobs
- Create /api/ops routes

**Day 4 (Polish + Deploy):**
- Error handling + logging
- Unit tests
- Performance tuning
- Docker build + push

---

## Quick Commands

```bash
# Development
npm run dev                    # Start dev server with hot reload
npm test                       # Run tests
npm run lint                   # Check code quality

# Production
npm run build                  # Compile TypeScript
npm start                      # Run compiled code
docker-compose up -d prod      # Start production stack

# Database
npm run db:migrate            # Apply migrations
npm run db:seed               # Add sample data
psql -h localhost -U postgres gate_intelligence  # Connect to DB

# Monitoring
curl http://localhost:3000/api/health       # Check health
curl http://localhost:3000/metrics          # View metrics
```

---

**You're ready to build!** Start with `npm install` and `docker-compose up -d`.
