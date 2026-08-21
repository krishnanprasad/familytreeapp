'use strict';

const crypto = require('node:crypto');

const INVITE_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const INVITE_SECRET_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const PERSON_ID_PATTERN = /^[A-Za-z0-9_.:-]{1,160}$/;
const MAX_BRANCH_BYTES = 750 * 1024;
const MAX_BRANCH_DEPTH = 14;
const MAX_BRANCH_NODES = 1500;
const MAX_NEW_NODES_PER_SAVE = 50;

function createInviteCredentials(randomBytes = crypto.randomBytes) {
  const id = randomBytes(16).toString('base64url');
  const secret = randomBytes(32).toString('base64url');
  return { id, secret, tokenHash: hashInviteToken(id, secret) };
}

function validInviteCredentials(id, secret) {
  return INVITE_ID_PATTERN.test(id || '') && INVITE_SECRET_PATTERN.test(secret || '');
}

function hashInviteToken(id, secret) {
  return crypto.createHash('sha256').update(`${id}.${secret}`, 'utf8').digest('hex');
}

function inviteTokenMatches(invite, id, secret) {
  if (!validInviteCredentials(id, secret) || typeof invite?.tokenHash !== 'string') return false;
  const supplied = Buffer.from(hashInviteToken(id, secret), 'hex');
  const expected = Buffer.from(invite.tokenHash, 'hex');
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function inviteAvailability(invite, id, secret, options = {}) {
  if (!invite || !inviteTokenMatches(invite, id, secret)) return { status: 'unavailable' };
  if (invite.status === 'cancelled') return { status: 'cancelled' };

  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const expiresAt = firestoreDate(invite.expiresAt);
  if (!expiresAt || expiresAt.getTime() <= now.getTime()) return { status: 'expired' };

  const claimedByUids = Array.isArray(invite.claimedByUids) ? invite.claimedByUids : [];
  if (options.uid && claimedByUids.includes(options.uid)) return { status: 'ready', alreadyClaimed: true };

  const maxClaims = boundedInteger(invite.maxClaims, 1, 20, 1);
  const acceptedCount = boundedInteger(invite.acceptedCount, 0, maxClaims, 0);
  if (acceptedCount >= maxClaims || invite.status === 'accepted') return { status: 'claimed' };
  if (!['pending', 'active'].includes(invite.status)) return { status: 'unavailable' };
  return { status: 'ready', alreadyClaimed: false };
}

function validateBranchMutation(canonicalRoot, branchRootId, incomingBranch) {
  if (!canonicalRoot || !incomingBranch || typeof incomingBranch !== 'object') {
    throw new Error('A valid branch is required.');
  }
  if (!PERSON_ID_PATTERN.test(branchRootId || '') || incomingBranch.id !== branchRootId) {
    throw new Error('The submitted branch does not match the permitted branch.');
  }

  const canonicalInspection = inspectTree(canonicalRoot, { maxNodes: 5000, maxBytes: 1024 * 1024 });
  const existingBranch = findNode(canonicalRoot, branchRootId);
  if (!existingBranch) throw new Error('The permitted branch no longer exists.');

  const existingInspection = inspectTree(existingBranch);
  const incomingInspection = inspectTree(incomingBranch);

  for (const id of existingInspection.ids) {
    if (!incomingInspection.ids.has(id)) {
      throw new Error('Branch editors cannot delete existing relatives. Refresh and try again.');
    }
    if (existingInspection.parents.get(id) !== incomingInspection.parents.get(id)) {
      throw new Error('Branch editors cannot move existing relatives to another relationship.');
    }
  }

  const outsideIds = new Set([...canonicalInspection.ids].filter(id => !existingInspection.ids.has(id)));
  for (const id of incomingInspection.ids) {
    if (!existingInspection.ids.has(id) && outsideIds.has(id)) {
      throw new Error('A new relative reused an identifier from outside this branch.');
    }
  }

  const newNodeCount = incomingInspection.ids.size - existingInspection.ids.size;
  if (newNodeCount > MAX_NEW_NODES_PER_SAVE) {
    throw new Error(`Add no more than ${MAX_NEW_NODES_PER_SAVE} relatives in one save.`);
  }
  const resultingNodeCount = canonicalInspection.ids.size - existingInspection.ids.size + incomingInspection.ids.size;
  if (resultingNodeCount > MAX_BRANCH_NODES) throw new Error('This tree is too large for a branch update.');

  return { existingBranch, newNodeCount, resultingNodeCount };
}

function replaceBranch(canonicalRoot, branchRootId, incomingBranch) {
  const replace = node => {
    if (node.id === branchRootId) return preserveBranchBoundary(node, incomingBranch);

    let spouse = node.spouse ? replace(node.spouse) : null;
    const children = Array.isArray(node.children) ? node.children.map(replace) : [];
    return { ...node, spouse, children };
  };
  return replace(canonicalRoot);
}

function preserveBranchBoundary(existing, incoming) {
  const replacement = JSON.parse(JSON.stringify(incoming));
  replacement.id = existing.id;
  replacement.type = existing.type;
  replacement.parentRelationshipType = existing.parentRelationshipType;
  replacement.partnerRelationshipType = existing.partnerRelationshipType;

  if (Object.prototype.hasOwnProperty.call(existing, 'treeName')) replacement.treeName = existing.treeName;
  else delete replacement.treeName;
  if (Object.prototype.hasOwnProperty.call(existing, 'treeOwnerName')) replacement.treeOwnerName = existing.treeOwnerName;
  else delete replacement.treeOwnerName;
  if (Object.prototype.hasOwnProperty.call(existing, 'relationshipRecords')) {
    replacement.relationshipRecords = existing.relationshipRecords;
  } else {
    delete replacement.relationshipRecords;
  }
  return replacement;
}

function inspectTree(root, limits = {}) {
  const maxNodes = limits.maxNodes || MAX_BRANCH_NODES;
  const maxBytes = limits.maxBytes || MAX_BRANCH_BYTES;
  const encoded = JSON.stringify(root);
  if (!encoded || Buffer.byteLength(encoded, 'utf8') > maxBytes) throw new Error('The branch update is too large.');

  const ids = new Set();
  const parents = new Map();
  let count = 0;

  const visit = (node, parentKey, depth) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) throw new Error('A relative has an invalid shape.');
    if (depth > MAX_BRANCH_DEPTH) throw new Error('The branch is nested too deeply.');
    if (!PERSON_ID_PATTERN.test(node.id || '')) throw new Error('A relative has an invalid identifier.');
    if (ids.has(node.id)) throw new Error('The branch contains a duplicate relative identifier.');
    if (typeof node.name !== 'string' || !node.name.trim() || node.name.length > 120) {
      throw new Error('Every relative needs a valid name.');
    }
    if (!Array.isArray(node.children) || node.children.length > 100) throw new Error('A relative has too many direct children.');
    if (!(node.spouse === null || node.spouse === undefined || typeof node.spouse === 'object')) {
      throw new Error('A spouse relationship is invalid.');
    }

    validateJsonValue(node, 'relative', 0);
    ids.add(node.id);
    parents.set(node.id, parentKey);
    count += 1;
    if (count > maxNodes) throw new Error('The branch contains too many relatives.');

    if (node.spouse) visit(node.spouse, `spouse:${node.id}`, depth + 1);
    node.children.forEach(child => visit(child, `child:${node.id}`, depth + 1));
  };

  visit(root, 'branch-root', 0);
  return { ids, parents, count };
}

function validateJsonValue(value, path, depth) {
  if (depth > 22) throw new Error('A family record is nested too deeply.');
  if (value === null || value === undefined || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('A family record contains an invalid number.');
    return;
  }
  if (typeof value === 'string') {
    const maxLength = path.endsWith('.photoUrl') ? 250000 : 4000;
    if (value.length > maxLength) throw new Error('A family record contains text that is too long.');
    if (path.endsWith('.photoUrl') && value && !safeImageUrl(value)) {
      throw new Error('A profile image must use HTTPS or a supported embedded image.');
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 200) throw new Error('A family record contains too many list items.');
    value.forEach((item, index) => validateJsonValue(item, `${path}[${index}]`, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length > 80 || keys.some(key => ['__proto__', 'constructor', 'prototype'].includes(key))) {
      throw new Error('A family record contains unsupported fields.');
    }
    keys.forEach(key => validateJsonValue(value[key], `${path}.${key}`, depth + 1));
    return;
  }
  throw new Error('A family record contains an unsupported value.');
}

function safeImageUrl(value) {
  if (/^https:\/\//i.test(value)) return value.length <= 2048;
  return /^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(value) && value.length <= 250000;
}

function findNode(node, targetId) {
  if (!node || typeof node !== 'object') return null;
  if (node.id === targetId) return node;
  if (node.spouse) {
    const spouse = findNode(node.spouse, targetId);
    if (spouse) return spouse;
  }
  for (const child of Array.isArray(node.children) ? node.children : []) {
    const found = findNode(child, targetId);
    if (found) return found;
  }
  return null;
}

function sanitizePublicTree(root) {
  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    throw new Error('A valid family tree is required.');
  }

  const sanitize = node => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      throw new Error('The family tree contains an invalid relative.');
    }

    const result = JSON.parse(JSON.stringify(node));
    result.spouse = node.spouse ? sanitize(node.spouse) : null;
    result.children = Array.isArray(node.children) ? node.children.map(sanitize) : [];

    // Email addresses are never part of a public family profile. Only social
    // profiles the person explicitly marked public survive server redaction.
    delete result.email;
    result.socialProfiles = Array.isArray(node.socialProfiles)
      ? node.socialProfiles
        .filter(profile => profile && profile.isPublic === true)
        .map(profile => ({
          platform: String(profile.platform || '').slice(0, 40),
          handle: String(profile.handle || '').slice(0, 500),
          isPublic: true
        }))
        .filter(profile => profile.platform && profile.handle)
      : [];

    if (Array.isArray(result.relationshipRecords)) {
      result.relationshipRecords = result.relationshipRecords.map(record => {
        if (!record || typeof record !== 'object') return record;
        const safeRecord = { ...record };
        delete safeRecord.notes;
        return safeRecord;
      });
    }

    // Living relatives expose only the minimum information needed to show
    // their place in the tree. This must happen before data reaches a browser.
    if (node.isAlive !== false) {
      result.age = 0;
      result.location = '';
      delete result.birthDate;
      delete result.deathDate;
      delete result.birthPlace;
      delete result.photoUrl;
      delete result.notes;
      result.stories = [];
      result.events = [];
    }

    return result;
  };

  return sanitize(root);
}

function firestoreDate(value) {
  if (value instanceof Date) return value;
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function boundedInteger(value, min, max, fallback) {
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

module.exports = {
  MAX_BRANCH_BYTES,
  MAX_BRANCH_DEPTH,
  MAX_BRANCH_NODES,
  MAX_NEW_NODES_PER_SAVE,
  createInviteCredentials,
  findNode,
  hashInviteToken,
  inspectTree,
  inviteAvailability,
  inviteTokenMatches,
  replaceBranch,
  sanitizePublicTree,
  validInviteCredentials,
  validateBranchMutation
};
