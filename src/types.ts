export interface RecipientInput {
  address: string;
  allocation: string;
  label: string;
}

export interface Budget {
  id: number;
  budget_id_hex: string;
  owner_address: string;
  attester_address: string;
  usdc_token_address: string;
  total_amount: string;
  start_time: number;
  end_time: number;
  chain_id: number;
  contract_address: string;
  tx_hash: string | null;
  name: string;
  description: string;
  tags: string[];
  total_earned: string;
  total_withdrawn: string;
  state: 'pending' | 'open' | 'active' | 'closed';
  created_at: string;
  updated_at: string;
  recipients?: RecipientRecord[];
}

export interface RecipientRecord {
  id: number;
  budget_id_hex: string;
  recipient_address: string;
  allocation: string;
  earned: string;
  withdrawn: string;
  label: string;
  added_tx_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttestationRecord {
  id: number;
  budget_id_hex: string;
  recipient_address: string;
  new_earned: string;
  attestation_nonce: number;
  attester_address: string;
  tx_hash: string | null;
  block_number: number | null;
  status: 'pending' | 'confirmed' | 'failed';
  idempotency_key: string;
  created_at: string;
}

export interface ActivityRecord {
  id: number;
  budget_id_hex: string;
  actor_address: string;
  event_type: string;
  payload: Record<string, unknown>;
  tx_hash: string | null;
  created_at: string;
}
