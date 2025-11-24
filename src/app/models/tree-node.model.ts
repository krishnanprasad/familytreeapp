export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export type RelationType = 'blood' | 'spouse';

export interface TreeNode {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  location: string;
  isAlive: boolean;
  type: RelationType; // 'blood' or 'spouse'
  spouse: TreeNode | null;
  children: TreeNode[];
}

export interface FormData {
  name: string;
  age: string;
  gender: Gender;
  isAlive: boolean;
  location: string;
}

export type ActionType = 'add_child' | 'add_spouse' | 'edit';

export interface CurrentNode {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  location: string;
  isAlive: boolean;
  type: RelationType;
}
