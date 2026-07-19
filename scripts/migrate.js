#!/usr/bin/env node

require('dotenv/config');

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const migrationsDir = path.resolve(__dirname, '..', 'migrations');
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

if (migrationFiles.length === 0) {
  throw new Error(`No SQL migrations found in ${migrationsDir}`);
}

const connectionConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'gate_intelligence',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };

if (process.env.DB_SSL === 'true' || process.env.DB_SSL === '1') {
  connectionConfig.ssl = { rejectUnauthorized: false };
}

async function migrate() {
  const client = new Client(connectionConfig);

  try {
    await client.connect();
    await client.query('BEGIN');

    for (const file of migrationFiles) {
      console.log(`Applying ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
    }

    await client.query('COMMIT');
    console.log('Database migrations applied successfully.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('Database migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
}

migrate();
