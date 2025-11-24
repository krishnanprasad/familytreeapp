export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  OTHER = 'other'
}

export interface Person {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  location: string;
  isAlive: boolean;
  parentIds: string[]; // both mother and father
  spouseIds: string[]; // can have multiple spouses (divorce scenario)
  childrenIds: string[];
  isAncestor: boolean; // marks the root ancestor
  isCurrentUser: boolean; // highlights current user
  positionX?: number; // for canvas dragging
  positionY?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Relationship {
  id: string;
  fromId: string;
  toId: string;
  type: 'parent-child' | 'spouse' | 'step-parent' | 'adopted';
  isDivorced?: boolean;
  createdAt: Date;
}

export interface FamilyTree {
  id: string;
  treeName: string;
  people: Map<string, Person>;
  relationships: Relationship[];
  createdAt: Date;
  updatedAt: Date;
}
