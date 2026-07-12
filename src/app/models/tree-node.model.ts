export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export type RelationType = 'blood' | 'spouse';

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
  parentRelationshipType: ParentRelationshipType;
  partnerRelationshipType: PartnerRelationshipType;
  relationshipStartDate: string;
  relationshipEndDate: string;
}

export type ActionType = 'add_child' | 'add_spouse' | 'edit';

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
