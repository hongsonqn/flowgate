// BudgetGate deployed on Arc Testnet
export const BUDGET_GATE_ADDRESS = '0xc841890e086a9611c3e141cd34369a4f5fed0122';

export const BUDGET_GATE_ABI = [
  {
    type: 'function',
    name: 'createBudget',
    inputs: [
      { name: 'budgetId', type: 'bytes32' },
      { name: 'usdcToken', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'attester', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'addRecipient',
    inputs: [
      { name: 'budgetId', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'allocation', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'submitAttestation',
    inputs: [
      { name: 'budgetId', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'newEarned', type: 'uint256' },
      { name: 'attestationNonce', type: 'uint256' },
      { name: 'sig', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'withdraw',
    inputs: [{ name: 'budgetId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'reclaimUnspent',
    inputs: [{ name: 'budgetId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getBudget',
    inputs: [{ name: 'budgetId', type: 'bytes32' }],
    outputs: [
      { name: 'owner', type: 'address' },
      { name: 'usdcToken', type: 'address' },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'attester', type: 'address' },
      { name: 'totalEarned', type: 'uint256' },
      { name: 'totalWithdrawn', type: 'uint256' },
      { name: 'state', type: 'uint8' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRecipient',
    inputs: [
      { name: 'budgetId', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [
      { name: 'allocation', type: 'uint256' },
      { name: 'earned', type: 'uint256' },
      { name: 'withdrawn', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'BudgetCreated',
    inputs: [
      { name: 'budgetId', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'usdcToken', type: 'address', indexed: true },
      { name: 'totalAmount', type: 'uint256' },
      { name: 'startTime', type: 'uint256' },
      { name: 'endTime', type: 'uint256' },
      { name: 'attester', type: 'address' },
    ],
  },
  {
    type: 'event',
    name: 'RecipientAdded',
    inputs: [
      { name: 'budgetId', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'allocation', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'AttestationSubmitted',
    inputs: [
      { name: 'budgetId', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'newEarned', type: 'uint256' },
      { name: 'attestationNonce', type: 'uint256' },
      { name: 'signer', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawn',
    inputs: [
      { name: 'budgetId', type: 'bytes32', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    name: 'UnspentReclaimed',
    inputs: [
      { name: 'budgetId', type: 'bytes32', indexed: true },
      { name: 'owner', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'error',
    name: 'BudgetAlreadyExists',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BudgetNotFound',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotBudgetOwner',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidTimeRange',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidState',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AllocationExceeded',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidNonce',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NonMonotonicEarned',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NothingToWithdraw',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NothingToReclaim',
    inputs: [],
  },
  {
    type: 'error',
    name: 'TokenTransferFailed',
    inputs: [],
  },
] as const;
