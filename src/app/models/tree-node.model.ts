export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export type RelationType = 'blood' | 'spouse';

export const SOCIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'snapchat',
  'x',
  'linkedin',
  'youtube',
  'tiktok'
] as const;

export type SocialPlatform = typeof SOCIAL_PLATFORMS[number];

export interface SocialProfile {
  platform: SocialPlatform;
  /** A username/handle or a complete profile URL. */
  handle: string;
  /** Only public profiles are exposed in the person profile header. */
  isPublic: boolean;
}

export type SocialProfileForm = Record<SocialPlatform, {
  handle: string;
  isPublic: boolean;
}>;

export type ParentRelationshipType =
  | 'biological_parent'
  | 'adoptive_parent'
  | 'step_parent'
  | 'guardian'
  | 'unknown_parent';

export type PartnerRelationshipType = 'spouse' | 'partner' | 'former_spouse';

export type RelationshipType = ParentRelationshipType | PartnerRelationshipType;

export type LifeEventType =
  | 'birth'
  | 'marriage'
  | 'death'
  | 'migration'
  | 'residence'
  | 'education'
  | 'career'
  | 'custom';

export interface RelationshipRecord {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  type: RelationshipType;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface LifeEvent {
  id: string;
  type: LifeEventType;
  title: string;
  date: string;
  place?: string;
  description?: string;
}

export interface PersonStory {
  id: string;
  title: string;
  text: string;
  date?: string;
}

/**
 * The recursive shape stays backward compatible with existing local and
 * Firestore documents. New fields are optional and normalized by TreeService.
 */
export interface TreeNode {
  id: string;
  treeName?: string;
  treeOwnerName?: string;
  name: string;
  gender: Gender;
  age: number;
  email?: string;
  location: string;
  isAlive: boolean;
  type: RelationType;
  spouse: TreeNode | null;
  children: TreeNode[];
  alternateNames?: string[];
  birthDate?: string;
  deathDate?: string;
  birthPlace?: string;
  photoUrl?: string;
  socialProfiles?: SocialProfile[];
  notes?: string;
  tags?: string[];
  stories?: PersonStory[];
  events?: LifeEvent[];
  parentRelationshipType?: ParentRelationshipType;
  partnerRelationshipType?: PartnerRelationshipType;
  relationshipStartDate?: string;
  relationshipEndDate?: string;
  relationshipRecords?: RelationshipRecord[];
}

export interface FormData {
  name: string;
  age: string;
  email: string;
  gender: Gender;
  isAlive: boolean;
  location: string;
  alternateNames: string;
  birthDate: string;
  deathDate: string;
  birthPlace: string;
  notes: string;
  tags: string;
  photoUrl: string;
  socialProfiles: SocialProfileForm;
  parentRelationshipType: ParentRelationshipType;
  partnerRelationshipType: PartnerRelationshipType;
  relationshipStartDate: string;
  relationshipEndDate: string;
}

export type ActionType = 'add_parent' | 'add_child' | 'add_spouse' | 'edit';

export type TreeAccessRole = 'owner' | 'coOwner' | 'viewer' | 'branchViewer' | 'branchEditor';
export type TreeVisibility = 'private' | 'public';
export type TreeShareScope = 'tree' | 'branch';
export type ShareStatus = 'active' | 'pending' | 'accepted' | 'cancelled';

export interface TreeAccess {
  accessId?: string;
  treeId: string;
  ownerUid: string;
  memberUid?: string;
  memberEmail?: string;
  role: TreeAccessRole;
  scope: TreeShareScope;
  branchRootId?: string;
  branchRootName?: string;
  sourceShareCode?: string;
  status: 'active' | 'pending' | 'removed';
  acceptedAtLabel?: string;
  updatedAtLabel?: string;
}

export interface TreeSummary {
  treeId: string;
  routeId?: string;
  treeName: string;
  treeOwnerName: string;
  ownerUid: string;
  ownerEmail?: string;
  role: TreeAccessRole;
  visibility: TreeVisibility;
  source: 'created' | 'coOwned' | 'shared';
  personCount: number;
  updatedAtLabel: string;
  branchRootId?: string;
  branchRootName?: string;
  pendingInviteCount?: number;
  trashed?: boolean;
}

export interface ShareLinkRecord {
  code: string;
  secret?: string;
  secureInvite?: boolean;
  treeId: string;
  ownerUid: string;
  treeName: string;
  treeOwnerName: string;
  scope: TreeShareScope;
  role: TreeAccessRole;
  visibility: TreeVisibility;
  status: ShareStatus;
  recipientEmail?: string;
  slug?: string;
  branchRootId?: string;
  branchRootName?: string;
  inviterName?: string;
  expiresAtLabel?: string;
  maxClaims?: number;
  acceptedCount?: number;
  createdByUid?: string;
  createdByEmail?: string;
  createdAtLabel?: string;
  updatedAtLabel?: string;
}

export interface ShareLinkRequest {
  scope: TreeShareScope;
  role: TreeAccessRole;
  isPublic: boolean;
  recipientEmail?: string;
  branchRootId?: string;
  branchRootName?: string;
}

export type SharedTreeLoadStatus =
  | 'ready'
  | 'loaded'
  | 'signInRequired'
  | 'forbidden'
  | 'notFound'
  | 'cancelled'
  | 'expired'
  | 'claimed'
  | 'unavailable';

export type TreeRouteLoadStatus = 'loaded' | 'signInRequired' | 'forbidden' | 'notFound';

export interface TreeRouteLoadResult {
  status: TreeRouteLoadStatus;
}

export interface SharedTreeLoadResult {
  status: SharedTreeLoadStatus;
  share?: ShareLinkRecord;
  alreadyClaimed?: boolean;
}

export interface CurrentNode {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  email?: string;
  location: string;
  isAlive: boolean;
  type: RelationType;
}

export interface PersonIndexEntry {
  node: TreeNode;
  generation: number;
  parentId?: string;
  parentName?: string;
  branchName: string;
}

export interface TimelineEntry extends LifeEvent {
  personId: string;
  personName: string;
  generation: number;
  branchName: string;
  isDerived?: boolean;
}

export interface GuidedTreeInput {
  selfName: string;
  selfGender: Gender;
  selfBirthDate?: string;
  selfLocation?: string;
  selfPhotoUrl?: string;
  parentOneName?: string;
  parentTwoName?: string;
  siblingNames?: string[];
  partnerName?: string;
  childNames?: string[];
}

export interface BulkEditRequest {
  personIds: string[];
  location?: string;
  addTags?: string[];
  surnameFrom?: string;
  surnameTo?: string;
}
