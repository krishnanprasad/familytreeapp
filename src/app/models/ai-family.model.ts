import {
  Gender,
  ParentRelationshipType,
  PartnerRelationshipType
} from './tree-node.model';

export type AiFamilyOperationType = 'add' | 'update';
export type AiFamilyRelation = 'child' | 'spouse' | 'parent' | 'none';
export type AiFamilyPlanIntent = 'add' | 'update' | 'none';
export type AiFamilyTaskStatus = 'active' | 'ready' | 'completed' | 'cancelled';

export interface AiFamilyTask {
  intent: 'add' | 'update';
  status: AiFamilyTaskStatus;
  title: string;
  summary: string;
  knownDetails: string[];
  nextQuestion: string;
}

export type AiPersonField =
  | 'name'
  | 'age'
  | 'gender'
  | 'isAlive'
  | 'location'
  | 'email'
  | 'alternateNames'
  | 'birthDate'
  | 'deathDate'
  | 'birthPlace'
  | 'notes'
  | 'tags'
  | 'parentRelationshipType'
  | 'partnerRelationshipType'
  | 'relationshipStartDate'
  | 'relationshipEndDate';

export interface AiPersonFields {
  name: string;
  age: number | null;
  gender: Gender | 'unspecified';
  isAlive: boolean | null;
  location: string;
  email: string;
  alternateNames: string[];
  birthDate: string;
  deathDate: string;
  birthPlace: string;
  notes: string;
  tags: string[];
  parentRelationshipType: ParentRelationshipType | 'unspecified';
  partnerRelationshipType: PartnerRelationshipType | 'unspecified';
  relationshipStartDate: string;
  relationshipEndDate: string;
}

export interface AiFamilyOperation {
  type: AiFamilyOperationType;
  relation: AiFamilyRelation;
  targetId: string;
  providedFields: AiPersonField[];
  fields: AiPersonFields;
  summary: string;
}

export interface AiFamilyPlan {
  message: string;
  intent: AiFamilyPlanIntent;
  needsClarification: boolean;
  clarificationQuestion: string;
  clarificationQuestions?: string[];
  operations: AiFamilyOperation[];
  task?: Omit<AiFamilyTask, 'status'>;
  model?: string;
}

export interface AiChatContextMessage {
  role: 'user' | 'assistant';
  text: string;
  context?: 'create' | 'general';
  task?: AiFamilyTask;
}

export interface AiTreePersonContext {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  isAlive: boolean;
  location: string;
  birthDate: string;
  deathDate: string;
  parentId: string;
  spouseOfId: string;
  generation: number;
}

export interface AiFamilyCommandRequest {
  message: string;
  selectedPersonId: string;
  conversation: AiChatContextMessage[];
  activeTask: AiFamilyTask | null;
  tree: {
    treeName: string;
    rootPersonId: string;
    people: AiTreePersonContext[];
  };
}

export interface AiApplyResult {
  changedCount: number;
  affectedIds: string[];
  summary: string;
}
