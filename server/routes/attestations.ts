import { Hono } from 'hono';
import { db } from '../db';

const router = new Hono();

// POST /attestations — record an attestation after onchain submission
router.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const {
      budget_id_hex,
      recipient_address,
      new_earned,
      attestation_nonce,
      attester_address,
      tx_hash,
      block_number,
      idempotency_key,
    } = body;

    if (!budget_id_hex || !recipient_address || !new_earned || !idempotency_key) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const { rows } = await db.query(
      `INSERT INTO attestations
        (budget_id_hex, recipient_address, new_earned, attestation_nonce, attester_address,
         tx_hash, block_number, status, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed',$8)
       ON CONFLICT (idempotency_key) DO UPDATE SET
         status = EXCLUDED.status,
         tx_hash = COALESCE(EXCLUDED.tx_hash, attestations.tx_hash),
         block_number = COALESCE(EXCLUDED.block_number, attestations.block_number),
         updated_at = NOW()
       RETURNING *`,
      [
        budget_id_hex.toLowerCase(),
        recipient_address.toLowerCase(),
        String(new_earned),
        Number(attestation_nonce),
        (attester_address || '').toLowerCase(),
        tx_hash || null,
        block_number ? Number(block_number) : null,
        idempotency_key,
      ]
    );

    // Update recipient's earned in postgres cache
    await db.query(
      `UPDATE recipients SET earned=$1, updated_at=NOW()
       WHERE budget_id_hex=$2 AND recipient_address=$3 AND earned::numeric < $4::numeric`,
      [String(new_earned), budget_id_hex.toLowerCase(), recipient_address.toLowerCase(), String(new_earned)]
    );

    // Update budget's total_earned
    await db.query(
      `UPDATE budgets b SET
         total_earned = (
           SELECT COALESCE(SUM(r.earned::numeric), 0)::text FROM recipients r WHERE r.budget_id_hex = b.budget_id_hex
         ),
         updated_at = NOW()
       WHERE b.budget_id_hex = $1`,
      [budget_id_hex.toLowerCase()]
    );

    await db.query(
      `INSERT INTO activity_log (budget_id_hex, actor_address, event_type, payload, tx_hash)
       VALUES ($1,$2,'attestation_submitted',$3,$4)`,
      [
        budget_id_hex.toLowerCase(),
        attester_address?.toLowerCase() || '',
        JSON.stringify({ recipient_address, new_earned, attestation_nonce }),
        tx_hash || null,
      ]
    );

    return c.json(rows[0], 201);
  } catch (_err: unknown) {
    console.error('POST /attestations error:', _err);
    const message = err instanceof Error ? err.message : 'Internal error';
    return c.json({ error: message }, 500);
  }
});

// GET /attestations/:budgetId/:address — get attestation history
router.get('/:budgetId/:address', async (c) => {
  const budgetId = c.req.param('budgetId').toLowerCase();
  const address = c.req.param('address').toLowerCase();
  const limit = Math.min(50, parseInt(c.req.query('limit') || '20'));

  try {
    const { rows } = await db.query(
      `SELECT * FROM attestations
       WHERE budget_id_hex=$1 AND recipient_address=$2
       ORDER BY attestation_nonce DESC LIMIT $3`,
      [budgetId, address, limit]
    );
    return c.json(rows);
  } catch (_err: unknown) {
    return c.json({ error: 'Internal error' }, 500);
  }
});

export default router;
