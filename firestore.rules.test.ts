import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const rulesContent = fs.readFileSync('firestore.rules', 'utf8');
const blueprint = JSON.parse(fs.readFileSync('firebase-blueprint.json', 'utf8'));

test('firestore.rules starts with rules_version 2 and default-deny catch-all', () => {
  assert.match(rulesContent, /^rules_version = '2';/m);
  assert.match(rulesContent, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
});

test('every blueprint collection has an explicit match block and validation helper', () => {
  const firestorePaths = Object.keys(blueprint.firestore);
  assert.deepEqual(firestorePaths, [
    '/users/{userId}',
    '/tickets/{ticketId}',
    '/chatSessions/{sessionId}',
    '/chatSessions/{sessionId}/messages/{messageId}',
    '/auditVotes/{voteId}',
  ]);

  assert.match(rulesContent, /match \/users\/\{userId\}/);
  assert.match(rulesContent, /match \/tickets\/\{ticketId\}/);
  assert.match(rulesContent, /match \/chatSessions\/\{sessionId\}/);
  assert.match(rulesContent, /match \/messages\/\{messageId\}/);
  assert.match(rulesContent, /match \/auditVotes\/\{voteId\}/);
});

test('Dirty Dozen security invariants hold across rules', () => {
  // 1. Email verification check required
  assert.match(rulesContent, /request\.auth\.token\.email_verified == true/);
  // 2. Identity & ID poisoning guard
  assert.match(rulesContent, /function isValidId\(id\)/);
  // 3. Anti-shadow-field key allowlisting
  assert.match(rulesContent, /hasAll\(/);
  assert.match(rulesContent, /hasOnly\(/);
  // 4. Server timestamp checks on create and update
  assert.match(rulesContent, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesContent, /incoming\(\)\.updatedAt == request\.time/);
  // 5. Terminal state locking on verified tickets
  assert.match(rulesContent, /existing\(\)\.status != 'verified'/);
  // 6. Master gate on chat messages subcollection
  assert.match(
    rulesContent,
    /get\(\/databases\/\$\(database\)\/documents\/chatSessions\/\$\(sessionId\)\)\.data\.ownerUid == request\.auth\.uid/
  );
  // 7. List rules check resource.data directly with zero blanket isSignedIn() list
  assert.doesNotMatch(rulesContent, /allow list:\s*if\s*isSignedIn\(\)\s*;/);
});
