# NagrikSeva Firestore Security Specification

## 1. Data Invariants
1. **Default-Deny Safety Net**: Every unspecified path under `/databases/{database}/documents` is denied read and write access.
2. **Email Verification Gate**: All authenticated reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Strict PII Isolation**: `/users/{userId}` holds citizen email and profile fields; reads, lists, and writes are strictly restricted to `request.auth.uid == userId`.
4. **Immutable Ownership & Timestamps**: Every document binds its owner (`uid` / `authorUid` / `ownerUid` / `userId`) to `request.auth.uid` on create, forbids changing ownership or `createdAt` on update, and requires `createdAt == request.time` and `updatedAt == request.time`.
5. **Anti-Shadow-Field & Size Hardening**: Every `create` validates exact `hasAll` + `hasOnly` key sets, string `.size()` bounds, ID regex `^[a-zA-Z0-9_\-]+$`, bounded arrays (`.size() <= 10`), and enum allowlists. Every `update` validates `isValid[Entity](incoming())` alongside explicit `affectedKeys().hasOnly(...)` action gates.
6. **Master Gate Subcollection Sync**: `/chatSessions/{sessionId}/messages/{messageId}` verifies via `get()` that the parent `/chatSessions/{sessionId}` exists and belongs to `request.auth.uid`.
7. **Terminal State Locking**: Once a ticket reaches `status == 'verified'`, client updates to that ticket document are locked against mutation.
8. **Query Enforcer**: Every `allow list` rule evaluates `resource.data` against `request.auth.uid` directly without `get()`/`exists()`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unverified Email Token Write**: Authenticated token with `email_verified: false` creating `/users/{uid}` -> **DENIED**.
2. **Identity Spoofing on Ticket Create**: Signed-in user `uidA` creating `/tickets/MBMC-2026-0900` with `authorUid: "uidB"` -> **DENIED**.
3. **Ghost / Shadow Field Injection**: Creating `/tickets/MBMC-2026-0900` with extra field `isAdminApproved: true` -> **DENIED** (`hasOnly` check).
4. **ID Poisoning Attack**: Writing `/tickets/` with a 1,500-character ID or invalid characters (`../admin`) -> **DENIED** (`isValidId` check).
5. **Cross-User PII Read**: Authenticated `uidA` calling `get` on `/users/uidB` -> **DENIED**.
6. **Blanket Collection Scraping**: Authenticated `uidA` calling `list` on `/tickets` without matching `authorUid == request.auth.uid` -> **DENIED**.
7. **Terminal State Mutation**: Attempting to update `confirmations` or `status` on a ticket where `existing().status == 'verified'` -> **DENIED**.
8. **Backdated Timestamp Spoofing**: Creating `/tickets/MBMC-2026-0900` with a client-supplied `createdAt` instead of server `request.time` -> **DENIED**.
9. **Immutable Ownership Hijack on Update**: Updating `/tickets/MBMC-2026-0900` attempting to modify `authorUid` or `createdAt` -> **DENIED** (`affectedKeys().hasOnly(...)`).
10. **Orphaned Subcollection Message**: Creating `/chatSessions/nonexistent/messages/msg-1` when parent `/chatSessions/nonexistent` does not exist or belongs to another UID -> **DENIED** (Master Gate `get()`).
11. **Unbounded Array / Resource Exhaustion**: Sending `auditTrail` with 15 elements or a 20,000-char `description` -> **DENIED** (`.size()` limits).
12. **Audit Vote Privilege Escalation**: Creating `/users/{uid}` with an injected `role: "admin"` or `isAdmin: true` field -> **DENIED** (`hasOnly` check).
