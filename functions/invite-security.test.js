'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createInviteCredentials,
  hashInviteToken,
  inviteAvailability,
  inviteTokenMatches,
  replaceBranch,
  sanitizePublicTree,
  validateBranchMutation
} = require('./invite-security');

function person(id, name, children = [], spouse = null) {
  return { id, name, age: 0, gender: 'other', isAlive: true, location: '', type: 'blood', spouse, children };
}

test('creates high-entropy URL-safe invite credentials', () => {
  const credentials = createInviteCredentials(size => Buffer.alloc(size, 7));
  assert.match(credentials.id, /^[A-Za-z0-9_-]{16,64}$/);
  assert.match(credentials.secret, /^[A-Za-z0-9_-]{32,128}$/);
  assert.equal(credentials.tokenHash, hashInviteToken(credentials.id, credentials.secret));
  assert.equal(inviteTokenMatches(credentials, credentials.id, credentials.secret), true);
  assert.equal(inviteTokenMatches(credentials, credentials.id, `${credentials.secret}x`), false);
});

test('rejects expired, cancelled, claimed, and invalid invite tokens', () => {
  const credentials = createInviteCredentials();
  const base = {
    tokenHash: credentials.tokenHash,
    status: 'pending',
    expiresAt: new Date('2030-01-10T00:00:00Z'),
    maxClaims: 1,
    acceptedCount: 0
  };
  const options = { now: new Date('2030-01-01T00:00:00Z') };

  assert.equal(inviteAvailability(base, credentials.id, credentials.secret, options).status, 'ready');
  assert.equal(inviteAvailability(base, credentials.id, 'x'.repeat(43), options).status, 'unavailable');
  assert.equal(inviteAvailability({ ...base, status: 'cancelled' }, credentials.id, credentials.secret, options).status, 'cancelled');
  assert.equal(inviteAvailability({ ...base, expiresAt: new Date('2029-12-31T00:00:00Z') }, credentials.id, credentials.secret, options).status, 'expired');
  assert.equal(inviteAvailability({ ...base, acceptedCount: 1 }, credentials.id, credentials.secret, options).status, 'claimed');
});

test('allows an existing claimant to reopen a single-use invite', () => {
  const credentials = createInviteCredentials();
  const availability = inviteAvailability({
    tokenHash: credentials.tokenHash,
    status: 'accepted',
    expiresAt: new Date('2030-01-10T00:00:00Z'),
    maxClaims: 1,
    acceptedCount: 1,
    claimedByUids: ['krishnan']
  }, credentials.id, credentials.secret, { now: new Date('2030-01-01T00:00:00Z'), uid: 'krishnan' });
  assert.deepEqual(availability, { status: 'ready', alreadyClaimed: true });
});

test('accepts additions inside the permitted branch and preserves the rest of the tree', () => {
  const canonical = person('root', 'Prasad', [
    person('branch', 'Krishnan', [person('existing', 'Meena')]),
    person('outside', 'Outside relative')
  ]);
  canonical.treeName = 'Prasad Family';
  const incoming = person('branch', 'Krishnan', [
    person('existing', 'Meena updated'),
    person('new-child', 'New relative')
  ]);

  const result = validateBranchMutation(canonical, 'branch', incoming);
  assert.equal(result.newNodeCount, 1);
  const merged = replaceBranch(canonical, 'branch', incoming);
  assert.equal(merged.children[0].children.length, 2);
  assert.equal(merged.children[1].name, 'Outside relative');
  assert.equal(merged.treeName, 'Prasad Family');
});

test('blocks deletion, relationship moves, duplicate ids, and outside id reuse', () => {
  const canonical = person('root', 'Prasad', [
    person('branch', 'Krishnan', [person('existing', 'Meena')]),
    person('outside', 'Outside relative')
  ]);

  assert.throws(
    () => validateBranchMutation(canonical, 'branch', person('branch', 'Krishnan')),
    /cannot delete/i
  );
  assert.throws(
    () => validateBranchMutation(canonical, 'branch', person('branch', 'Krishnan', [], person('existing', 'Meena'))),
    /cannot move/i
  );
  assert.throws(
    () => validateBranchMutation(canonical, 'branch', person('branch', 'Krishnan', [
      person('existing', 'Meena'),
      person('existing', 'Duplicate')
    ])),
    /duplicate/i
  );
  assert.throws(
    () => validateBranchMutation(canonical, 'branch', person('branch', 'Krishnan', [
      person('existing', 'Meena'),
      person('outside', 'Collision')
    ])),
    /outside this branch/i
  );
});

test('blocks oversized embedded images and too many new relatives', () => {
  const canonical = person('root', 'Prasad', [person('branch', 'Krishnan')]);
  const tooMany = Array.from({ length: 51 }, (_, index) => person(`new-${index}`, `Relative ${index}`));
  assert.throws(
    () => validateBranchMutation(canonical, 'branch', person('branch', 'Krishnan', tooMany)),
    /no more than 50/i
  );

  const unsafeImage = person('branch', 'Krishnan');
  unsafeImage.photoUrl = 'javascript:alert(1)';
  assert.throws(
    () => validateBranchMutation(canonical, 'branch', unsafeImage),
    /profile image/i
  );
});

test('server-side public redaction removes living-person PII and private profiles', () => {
  const living = person('living', 'Krishnan');
  living.age = 42;
  living.email = 'private@example.com';
  living.location = 'Chennai';
  living.birthDate = '1984-01-02';
  living.photoUrl = 'https://example.com/private.jpg';
  living.notes = 'Private note';
  living.stories = [{ id: 's1', title: 'Private', text: 'Story' }];
  living.events = [{ id: 'e1', type: 'residence', title: 'Moved', date: '2020-01-01' }];
  living.socialProfiles = [
    { platform: 'instagram', handle: '@public', isPublic: true },
    { platform: 'facebook', handle: 'private-profile', isPublic: false }
  ];
  living.relationshipRecords = [{ id: 'r1', fromPersonId: 'living', toPersonId: 'child', type: 'biological_parent', notes: 'Private relationship note' }];
  living.children = [{ ...person('child', 'Child'), email: 'child@example.com' }];

  const publicTree = sanitizePublicTree(living);
  assert.equal(publicTree.email, undefined);
  assert.equal(publicTree.location, '');
  assert.equal(publicTree.age, 0);
  assert.equal(publicTree.birthDate, undefined);
  assert.equal(publicTree.photoUrl, undefined);
  assert.equal(publicTree.notes, undefined);
  assert.deepEqual(publicTree.stories, []);
  assert.deepEqual(publicTree.events, []);
  assert.deepEqual(publicTree.socialProfiles, [{ platform: 'instagram', handle: '@public', isPublic: true }]);
  assert.equal(publicTree.relationshipRecords[0].notes, undefined);
  assert.equal(publicTree.children[0].email, undefined);
});
