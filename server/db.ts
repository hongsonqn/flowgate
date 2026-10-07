import pg from 'pg';

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/flowgate',
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
    });
  }
  return pool;
}

async function migrate() {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id BIGSERIAL PRIMARY KEY,
        budget_id_hex TEXT NOT NULL UNIQUE,
        owner_address TEXT NOT NULL,
        attester_address TEXT NOT NULL,
        usdc_token_address TEXT NOT NULL,
        total_amount TEXT NOT NULL,
        start_time BIGINT NOT NULL,
        end_time BIGINT NOT NULL,
        chain_id INTEGER NOT NULL,
        contract_address TEXT NOT NULL,
        tx_hash TEXT,
        name TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        tags TEXT[] NOT NULL DEFAULT '{}',
        -- Cached onchain state (rebuilt from events)
        total_earned TEXT NOT NULL DEFAULT '0',
        total_withdrawn TEXT NOT NULL DEFAULT '0',
        state TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_budgets_owner ON budgets(owner_address);
      CREATE INDEX IF NOT EXISTS idx_budgets_attester ON budgets(attester_address);
      CREATE INDEX IF NOT EXISTS idx_budgets_state ON budgets(state);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recipients (
        id BIGSERIAL PRIMARY KEY,
        budget_id_hex TEXT NOT NULL REFERENCES budgets(budget_id_hex) ON DELETE CASCADE,
        recipient_address TEXT NOT NULL,
        allocation TEXT NOT NULL DEFAULT '0',
        earned TEXT NOT NULL DEFAULT '0',
        withdrawn TEXT NOT NULL DEFAULT '0',
        label TEXT NOT NULL DEFAULT '',
        added_tx_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(budget_id_hex, recipient_address)
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recipients_budget ON recipients(budget_id_hex);
      CREATE INDEX IF NOT EXISTS idx_recipients_address ON recipients(recipient_address);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS attestations (
        id BIGSERIAL PRIMARY KEY,
        budget_id_hex TEXT NOT NULL REFERENCES budgets(budget_id_hex) ON DELETE CASCADE,
        recipient_address TEXT NOT NULL,
        new_earned TEXT NOT NULL,
        attestation_nonce BIGINT NOT NULL,
        attester_address TEXT NOT NULL,
        tx_hash TEXT,
        block_number BIGINT,
        status TEXT NOT NULL DEFAULT 'pending',
        idempotency_key TEXT NOT NULL UNIQUE,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_attestations_budget ON attestations(budget_id_hex);
      CREATE INDEX IF NOT EXISTS idx_attestations_recipient ON attestations(budget_id_hex, recipient_address);
      CREATE INDEX IF NOT EXISTS idx_attestations_status ON attestations(status);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id BIGSERIAL PRIMARY KEY,
        budget_id_hex TEXT NOT NULL REFERENCES budgets(budget_id_hex) ON DELETE CASCADE,
        recipient_address TEXT NOT NULL,
        amount TEXT NOT NULL,
        tx_hash TEXT NOT NULL UNIQUE,
        block_number BIGINT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_withdrawals_budget ON withdrawals(budget_id_hex);
      CREATE INDEX IF NOT EXISTS idx_withdrawals_recipient ON withdrawals(budget_id_hex, recipient_address);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id BIGSERIAL PRIMARY KEY,
        budget_id_hex TEXT,
        actor_address TEXT,
        event_type TEXT NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}',
        tx_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_activity_budget ON activity_log(budget_id_hex);
      CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_log(event_type);
      CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at DESC);
    `);

    await client.query('COMMIT');
    console.log('Schema migration complete');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  return getPool().query<T>(sql, params);
}

async function transaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export const db = { migrate, query, transaction, getPool };
