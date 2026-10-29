# Security Specification — AI Text Editor Studio

## 1. Data Invariants
1. **User Profile Ownership & PII Protection**: A user document `/users/{userId}` can only be read, created, or updated by `request.auth.uid == userId` with `email_verified == true`. No `list` operation is permitted on `/users`.
2. **Project Ownership**: A project `/projects/{projectId}` can only be created, read, or updated if `ownerId == request.auth.uid`. `ownerId` and `createdAt` are strictly immutable after creation.
3. **Version Relational Sync (Master Gate)**: A version `/projects/{projectId}/versions/{versionId}` can only be accessed or created if the parent `/projects/{projectId}` exists and its `ownerId == request.auth.uid`. Versions are immutable snapshots (`update` and `delete` are denied).
4. **Job Integrity & Terminal State Locking**: A job `/jobs/{jobId}` belongs exclusively to `ownerId == request.auth.uid`, references an existing `/projects/{projectId}` owned by the user, and cannot be modified once its `status` reaches `'completed'` or `'failed'`.
5. **Credit Transaction Immutability**: A credit transaction `/credit_transactions/{txId}` is an append-only audit log (`update` and `delete` are strictly forbidden) owned by `ownerId == request.auth.uid`.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unverified Email Spoof**: Authenticated user with `email_verified == false` attempts to create `/users/user_1`.
2. **Cross-User Profile Read (PII Scrape)**: User `attacker_1` attempts `get` on `/users/victim_1`.
3. **User Enumeration (`list` Attack)**: Authenticated user attempts `list` on `/users`.
4. **Shadow Field Injection on User**: User sends `{ uid: "user_1", displayName: "Ali", credits: 10, isAdmin: true, createdAt: request.time, updatedAt: request.time }`.
5. **Identity Spoofing on Project Creation**: User `attacker_1` creates `/projects/proj_1` with `ownerId: "victim_1"`.
6. **Orphaned Version Creation**: User creates `/projects/non_existent_proj/versions/v_1` where parent project does not exist.
7. **Cross-Tenant Version Creation**: User `attacker_1` creates a version under `/projects/victim_proj/versions/v_1`.
8. **Immortal Field Mutation**: Owner attempts to update `createdAt` or `ownerId` on `/projects/proj_1`.
9. **Terminal State Re-opening on Job**: Owner attempts to update `/jobs/job_1` after `status` is already `'completed'`.
10. **Value Poisoning on Credits**: User attempts to set `credits: "999999"` (string instead of int) or negative credits `credits: -50`.
11. **Denial-of-Wallet Oversized ID/String**: User attempts to create `/projects/proj_1` with a 50,000-character `name` or invalid path ID containing spaces/symbols.
12. **Audit Log Tampering**: User attempts to `update` or `delete` `/credit_transactions/tx_1`.
