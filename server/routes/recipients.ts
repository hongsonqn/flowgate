import { Hono } from 'hono';
import { db } from '../db';

const router = new Hono();

// POST /recipients — add/update a recipient after onchain tx
router.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const {
      budget_id_hex,
      recipient_address,
      allocation,
      label = '',
      added_tx_hash,
    } = body;

    if (!budget_id_hex || !recipient_address || !allocation) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const { rows } = await db.query(
      `INSERT INTO recipients (budget_id_hex, recipient_address, allocation, label, added_tx_hash)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (budget_id_hex, recipient_address) DO UPDATE SET
         allocation = EXCLUDED.allocation,
         label = COALESCE(NULLIF(EXCLUDED.label,''), recipients.label),
         added_tx_hash = COALESCE(EXCLUDED.added_tx_hash, recipients.added_tx_hash),
         updated_at = NOW()
       RETURNING *`,
      [
        budget_id_hex.toLowerCase(),
        recipient_address.toLowerCase(),
        String(allocation),
        label,
        added_tx_hash || null,
      ]
    );

    await db.query(
      `INSERT INTO activity_log (budget_id_hex, actor_address, event_type, payload, tx_hash)
       VALUES ($1,$2,'recipient_added',$3,$4)`,
      [budget_id_hex.toLowerCase(), recipient_address.toLowerCase(), JSON.stringify({ allocation, label }), added_tx_hash || null]
    );

    return c.json(rows[0], 201);
  } catch (_err: unknown) {
    console.error('POST /recipients error:', _err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return c.json({ error: message }, 500);
  }
});

// PATCH /recipients/:budgetId/:address — sync earned/withdrawn from onchain
router.patch('/:budgetId/:address', async (c) => {
  const budgetId = c.req.param('budgetId').toLowerCase();
  const address = c.req.param('address').toLowerCase();
  try {
    const body = await c.req.json();
    const { earned, withdrawn } = body;

    await db.query(
      `UPDATE recipients SET earned=$1, withdrawn=$2, updated_at=NOW()
       WHERE budget_id_hex=$3 AND recipient_address=$4`,
      [String(earned || '0'), String(withdrawn || '0'), budgetId, address]
    );

    return c.json({ ok: true });
  } catch (_err: unknown) {
    return c.json({ error: 'Internal error' }, 500);
  }
});

// GET /recipients/:address/budgets — all budgets a recipient is in
router.get('/:address/budgets', async (c) => {
  const address = c.req.param('address').toLowerCase();
  try {
    const { rows } = await db.query(
      `SELECT b.*, r.allocation, r.earned, r.withdrawn, r.label
       FROM recipients r
       JOIN budgets b ON r.budget_id_hex = b.budget_id_hex
       WHERE r.recipient_address = $1
       ORDER BY b.created_at DESC`,
      [address]
    );
    return c.json(rows);
  } catch (_err: unknown) {
    return c.json({ error: 'Internal error' }, 500);
  }
});

export default router;
