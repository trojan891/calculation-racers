# Calculation Racer — Security Specification (Payload-First TDD)

## 1. Data Invariants

1. **Identity & Email Verification**: All standard write operations require `request.auth != null` and `request.auth.token.email_verified == true`.
2. **PII Split Isolation**: User emails are isolated in `/users_private/{userId}` and readable only by `isOwner(userId) || isAdmin()`. Public profiles in `/profiles/{userId}` never store emails.
3. **Zero Self-Assigned Admin**: Users cannot write to `/admins/{adminId}` unless they are already an authorized admin (`rizveemanger@gmail.com` with `email_verified == true` or existing `/admins/$(request.auth.uid)`). Users cannot set `isBanned` to `false` on their own profile once banned.
4. **Answer Key Protection**: `/question_keys/{questionId}` forbids `list` queries for non-admins so players cannot dump answer keys.
5. **Room Membership & Master Gate**: `/rooms/{roomCode}/players/{playerId}` and `/rooms/{roomCode}/submissions/{submissionId}` verify parent `/rooms/{roomCode}` existence (`exists()`) and validate `roomCode` path consistency.
6. **Single Answer Submission per Question**: `/rooms/{roomCode}/submissions/{submissionId}` enforces immutable creation (`allow update, delete: if false`) with `distanceDelta in [-5, 0, 10]` and `questionIndex >= 0 && questionIndex < 15`.
7. **Terminal State Locking**: Once a room reaches `status == 'finished'` or `status == 'abandoned'`, non-admin users cannot mutate the room. Race results (`/race_results/{resultId}`) are immutable after creation by non-admins.
8. **Query Enforcer on List Operations**: Every `allow list` rule evaluates `existing()` fields (`isPublicProfile == true`, `isActive == true`, `isPublic == true`, etc.) so security is never delegated to the client.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unverified Admin Email Spoof**: `{ auth: { uid: "attacker", token: { email: "rizveemanger@gmail.com", email_verified: false } } }` attempting to write to `/questions/q1`.
2. **PII Lateral Read**: Authenticated user `"userB"` attempting `get /users_private/userA`.
3. **Shadow Field Injection on Profile**: User `"userA"` updating `/profiles/userA` with `{ nickname: "Speedy", isAdmin: true }`.
4. **Self-Unban Escalation**: Banned user `"userA"` updating `/profiles/userA` with `{ isBanned: false }`.
5. **Cross-Player Position Tampering**: User `"userA"` updating `/rooms/AB12CD/players/userB` to set `distance: 0`.
6. **Out-of-Bounds Car Distance**: User `"userA"` updating `/rooms/AB12CD/players/userA` with `distance: 999` or `distance: -10`.
7. **Duplicate Answer Overwrite**: User `"userA"` attempting `update` on `/rooms/AB12CD/submissions/userA_q0` to flip `isCorrect: true`.
8. **Terminal Room Re-Opening**: Host `"userA"` attempting to update `/rooms/AB12CD` from `status: "finished"` back to `status: "racing"`.
9. **Orphaned Room Player Creation**: User `"userA"` creating `/rooms/NONEXT/players/userA` when `/rooms/NONEXT` does not exist.
10. **Client Timestamp Forgery**: User `"userA"` creating `/race_results/res1` with a past/future `createdAt` not matching `request.time`.
11. **Resource Poisoning (1MB ID/String)**: User `"userA"` creating a profile or report with a 5,000-character `reason` or invalid `roomCode`.
12. **Unfiltered Answer Key Dump**: Non-admin user `"userA"` executing `list /question_keys`.

## 3. Test Runner Reference

See `firestore.rules.test.ts` for the full test suite verifying that all 12 adversarial payloads return `PERMISSION_DENIED`.
