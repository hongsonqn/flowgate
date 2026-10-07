import { Hono } from 'hono';
import { db } from '../db';

const router = new Hono();

// POST /budgets — register a new budget (after onchain tx)
router.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const {
      budget_id_hex,
      owner_address,
      attester_address,
      usdc_token_address,
      total_amount,
      start_time,
      end_time,
      chain_id,
      contract_address,
      tx_hash,
      name = '',
      description = '',
      tags = [],
    } = body;

    if (!budget_id_hex || !owner_address || !total_amount || !chain_id || !contract_address) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const { rows } = await db.query(
      `INSERT INTO budgets
        (budget_id_hex, owner_address, attester_address, usdc_token_address, total_amount,
         start_time, end_time, chain_id, contract_address, tx_hash, name, description, tags, state)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')
       ON CONFLICT (budget_id_hex) DO UPDATE SET
         tx_hash = EXCLUDED.tx_hash,
         state = EXCLUDED.state,
         updated_at = NOW()
       RETURNING *`,
      [
        budget_id_hex.toLowerCase(),
        owner_address.toLowerCase(),
        (attester_address || '').toLowerCase(),
        (usdc_token_address || '').toLowerCase(),
        String(total_amount),
        Number(start_time),
        Number(end_time),
        Number(chain_id),
        contract_address.toLowerCase(),
        tx_hash || null,
        name,
        description,
        tags,
      ]
    );

    await db.query(
      `INSERT INTO activity_log (budget_id_hex, actor_address, event_type, payload, tx_hash)
       VALUES ($1,$2,'budget_created',$3,$4)`,
      [budget_id_hex.toLowerCase(), owner_address.toLowerCase(), JSON.stringify({ name, total_amount }), tx_hash || null]
    );

    return c.json(rows[0], 201);
  } catch (_err: unknown) {
    console.error('POST /budgets error:', _err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return c.json({ error: message }, 500);
  }
});

// GET /budgets?owner=0x...&page=1&limit=20
router.get('/', async (c) => {
  const owner = c.req.query('owner')?.toLowerCase();
  const attester = c.req.query('attester')?.toLowerCase();
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20')));
  const offset = (page - 1) * limit;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (owner) {
      params.push(owner);
      conditions.push(`owner_address = $${params.length}`);
    }
    if (attester) {
      params.push(attester);
      conditions.push(`attester_address = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT * FROM budgets ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countParams = conditions.length ? params.slice(0, -2) : [];
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) as total FROM budgets ${where}`,
      countParams
    );

    return c.json({ budgets: rows, total: parseInt(countRows[0]?.total || '0'), page, limit });
  } catch (_err: unknown) {
    console.error('GET /budgets error:', _err);
    return c.json({ error: 'Internal error' }, 500);
  }
});

// GET /budgets/:id
router.get('/:id', async (c) => {
  const id = c.req.param('id').toLowerCase();
  try {
    const { rows } = await db.query(`SELECT * FROM budgets WHERE budget_id_hex = $1`, [id]);
    if (!rows[0]) return c.json({ error: 'Budget not found' }, 404);

    const { rows: recips } = await db.query(
      `SELECT * FROM recipients WHERE budget_id_hex = $1 ORDER BY created_at`,
      [id]
    );

    return c.json({ ...rows[0], recipients: recips });
  } catch (_err: unknown) {
    console.error('GET /budgets/:id error:', _err);
    return c.json({ error: 'Internal error' }, 500);
  }
});

// PATCH /budgets/:id — update cached state after onchain sync
router.patch('/:id', async (c) => {
  const id = c.req.param('id').toLowerCase();
  try {
    const body = await c.req.json();
    const { total_earned, total_withdrawn, state } = body;

    await db.query(
      `UPDATE budgets SET total_earned=$1, total_withdrawn=$2, state=$3, updated_at=NOW()
       WHERE budget_id_hex=$4`,
      [String(total_earned || '0'), String(total_withdrawn || '0'), state || 'active', id]
    );

    return c.json({ ok: true });
  } catch (_err: unknown) {
    console.error('PATCH /budgets/:id error:', _err);
    return c.json({ error: 'Internal error' }, 500);
  }
});

// GET /budgets/:id/activity
router.get('/:id/activity', async (c) => {
  const id = c.req.param('id').toLowerCase();
  const limit = Math.min(50, parseInt(c.req.query('limit') || '20'));
  try {
    const { rows } = await db.query(
      `SELECT * FROM activity_log WHERE budget_id_hex = $1 ORDER BY created_at DESC LIMIT $2`,
      [id, limit]
    );
    return c.json(rows);
  } catch (_err: unknown) {
    return c.json({ error: 'Internal error' }, 500);
  }
});

export default router;
