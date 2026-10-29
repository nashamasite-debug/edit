/**
 * Firestore Security Rules Test Specification (Dirty Dozen Verification)
 * Verifies that all 12 adversarial payloads return PERMISSION_DENIED.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Unverified Email Spoof',
    collection: '/users/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: false },
    payload: { uid: 'user_1', displayName: 'Test', credits: 10 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Cross-User Profile Read',
    collection: '/users/victim_1',
    operation: 'get',
    auth: { uid: 'attacker_1', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'User Directory Enumeration',
    collection: '/users',
    operation: 'list',
    auth: { uid: 'attacker_1', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on User',
    collection: '/users/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { uid: 'user_1', displayName: 'Test', credits: 10, role: 'superadmin' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Identity Spoofing on Project Creation',
    collection: '/projects/proj_1',
    operation: 'create',
    auth: { uid: 'attacker_1', email_verified: true },
    payload: { ownerId: 'victim_1', name: 'Ad Poster', mode: 'single' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Orphaned Version Creation',
    collection: '/projects/missing_proj/versions/v_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { projectId: 'missing_proj', ownerId: 'user_1', imageUrl: 'https://example.com/1.png' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Cross-Tenant Version Creation',
    collection: '/projects/victim_proj/versions/v_1',
    operation: 'create',
    auth: { uid: 'attacker_1', email_verified: true },
    payload: { projectId: 'victim_proj', ownerId: 'attacker_1', imageUrl: 'https://example.com/1.png' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immortal Field Mutation on Project',
    collection: '/projects/proj_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_2', name: 'Renamed' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Terminal State Re-opening on Job',
    collection: '/jobs/job_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { status: 'processing' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Value Poisoning on Credits',
    collection: '/users/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email_verified: true },
    payload: { credits: -500 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Denial-of-Wallet Oversized String',
    collection: '/projects/proj_1',
    operation: 'create',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', name: 'A'.repeat(5000), mode: 'single' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Credit Transaction Audit Log Tampering',
    collection: '/credit_transactions/tx_1',
    operation: 'delete',
    auth: { uid: 'user_1', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
