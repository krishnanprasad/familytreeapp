'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

function functionBody(name) {
  const match = rules.match(new RegExp(`function\\s+${name}\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  assert.ok(match, `Expected Firestore helper ${name}`);
  return match[1];
}

test('branch roles cannot read the canonical private tree document', () => {
  const body = functionBody('canReadPrivateTree');
  assert.match(body, /"owner",\s*"coOwner",\s*"viewer"/);
  assert.doesNotMatch(body, /branchViewer|branchEditor/);
});

test('public visitors cannot read the canonical tree before server redaction', () => {
  const trees = rules.match(/match \/trees\/\{treeId\} \{([\s\S]*?)\n\s*match \/activity/);
  assert.ok(trees);
  const readRule = trees[1].match(/allow read:([\s\S]*?);/);
  assert.ok(readRule);
  assert.doesNotMatch(readRule[1], /visibility\s*==\s*"public"/);
});

test('branch roles can read metadata needed for My Trees', () => {
  const body = functionBody('canReadTreeSummary');
  assert.match(body, /branchViewer/);
  assert.match(body, /branchEditor/);
});

test('clients cannot mint private bearer invites directly', () => {
  const shares = rules.match(/match \/shares\/\{code\} \{([\s\S]*?)\n\s*\}/);
  assert.ok(shares);
  assert.match(shares[1], /allow create:[\s\S]*request\.resource\.data\.visibility == "public"/);
});

test('branch writes and audit writes remain server-only', () => {
  const wholeTreeWriter = functionBody('canWriteWholeTree');
  assert.match(wholeTreeWriter, /"owner",\s*"coOwner"/);
  assert.doesNotMatch(wholeTreeWriter, /branchEditor/);
  assert.match(rules, /match \/activity\/\{activityId\}[\s\S]*allow write: if false;/);
});
