import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Person, Gender, Relationship, FamilyTree } from '../models/person.model';

@Injectable({
  providedIn: 'root'
})
export class FamilyTreeService {
  private familyTree = new BehaviorSubject<FamilyTree | null>(null);
  private people = new BehaviorSubject<Person[]>([]);
  private relationships = new BehaviorSubject<Relationship[]>([]);

  familyTree$ = this.familyTree.asObservable();
  people$ = this.people.asObservable();
  relationships$ = this.relationships.asObservable();

  private localStorage_KEY = 'my-family-tree';

  constructor() {
    this.loadFromStorage();
  }

  // Initialize with first ancestor
  initializeTree(ancestorName: string, gender: Gender, age: number, location: string): Person {
    const ancestor: Person = {
      id: this.generateId(),
      name: ancestorName,
      gender,
      age,
      location,
      isAlive: true,
      parentIds: [],
      spouseIds: [],
      childrenIds: [],
      isAncestor: true,
      isCurrentUser: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      positionX: 0,
      positionY: 0
    };

    const tree: FamilyTree = {
      id: this.generateId(),
      treeName: 'My Family',
      people: new Map([[ancestor.id, ancestor]]),
      relationships: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.familyTree.next(tree);
    this.updatePeopleList();
    this.saveToStorage();
    return ancestor;
  }

  // Add a new person
  addPerson(
    name: string,
    gender: Gender,
    age: number,
    location: string,
    isAlive: boolean,
    parentIds?: string[],
    spouseId?: string
  ): Person {
    const tree = this.familyTree.value;
    if (!tree) throw new Error('Tree not initialized');

    const person: Person = {
      id: this.generateId(),
      name,
      gender,
      age,
      location,
      isAlive,
      parentIds: parentIds || [],
      spouseIds: spouseId ? [spouseId] : [],
      childrenIds: [],
      isAncestor: false,
      isCurrentUser: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      positionX: Math.random() * 200,
      positionY: Math.random() * 200
    };

    tree.people.set(person.id, person);

    // Add to all parents' children
    if (parentIds && parentIds.length > 0) {
      parentIds.forEach(parentId => {
        const parent = tree.people.get(parentId);
        if (parent && !parent.childrenIds.includes(person.id)) {
          parent.childrenIds.push(person.id);
          parent.updatedAt = new Date();
        }
      });
    }

    // Create spouse relationship
    if (spouseId) {
      const spouse = tree.people.get(spouseId);
      if (spouse) {
        if (!spouse.spouseIds.includes(person.id)) {
          spouse.spouseIds.push(person.id);
          spouse.updatedAt = new Date();
        }
      }
      this.createRelationship(person.id, spouseId, 'spouse');
    }

    tree.updatedAt = new Date();
    this.familyTree.next(tree);
    this.updatePeopleList();
    this.saveToStorage();
    return person;
  }

  // Update a person
  updatePerson(id: string, updates: Partial<Person>): void {
    const tree = this.familyTree.value;
    if (!tree) return;

    const person = tree.people.get(id);
    if (!person) return;

    Object.assign(person, updates, { updatedAt: new Date() });
    tree.updatedAt = new Date();
    this.familyTree.next(tree);
    this.updatePeopleList();
    this.saveToStorage();
  }

  // Delete a person and cascade delete children
  deletePerson(id: string): void {
    const tree = this.familyTree.value;
    if (!tree) return;

    const person = tree.people.get(id);
    if (!person) return;

    // Recursively delete children
    const childrenToDelete = [...person.childrenIds];
    childrenToDelete.forEach(childId => this.deletePerson(childId));

    // Remove from all parents
    if (person.parentIds && person.parentIds.length > 0) {
      person.parentIds.forEach(parentId => {
        const parent = tree.people.get(parentId);
        if (parent) {
          parent.childrenIds = parent.childrenIds.filter(cid => cid !== id);
          parent.updatedAt = new Date();
        }
      });
    }

    // Remove spouse relationships
    person.spouseIds.forEach(spouseId => {
      const spouse = tree.people.get(spouseId);
      if (spouse) {
        spouse.spouseIds = spouse.spouseIds.filter(sid => sid !== id);
        spouse.updatedAt = new Date();
      }
    });

    // Remove all relationships
    tree.relationships = tree.relationships.filter(r => r.fromId !== id && r.toId !== id);

    tree.people.delete(id);
    tree.updatedAt = new Date();
    this.familyTree.next(tree);
    this.updatePeopleList();
    this.saveToStorage();
  }

  // Add spouse
  addSpouse(personId: string, spouseName: string, gender: Gender, age: number, location: string, isAlive: boolean): Person {
    const tree = this.familyTree.value;
    if (!tree) throw new Error('Tree not initialized');

    const person = tree.people.get(personId);
    if (!person) throw new Error('Person not found');

    const spouse = this.addPerson(spouseName, gender, age, location, isAlive, undefined, personId);
    return spouse;
  }

  // Add child
  addChild(parentIds: string[], childName: string, gender: Gender, age: number, location: string, isAlive: boolean): Person {
    return this.addPerson(childName, gender, age, location, isAlive, parentIds);
  }

  // Create relationship
  createRelationship(fromId: string, toId: string, type: 'parent-child' | 'spouse' | 'step-parent' | 'adopted'): void {
    const tree = this.familyTree.value;
    if (!tree) return;

    const relationship: Relationship = {
      id: this.generateId(),
      fromId,
      toId,
      type,
      createdAt: new Date()
    };

    tree.relationships.push(relationship);
    tree.updatedAt = new Date();
    this.familyTree.next(tree);
    this.relationships.next(tree.relationships);
    this.saveToStorage();
  }

  // Get person by ID
  getPerson(id: string): Person | undefined {
    return this.familyTree.value?.people.get(id);
  }

  // Get all people
  getAllPeople(): Person[] {
    return this.people.value;
  }

  // Get children of a person
  getChildren(parentId: string): Person[] {
    const tree = this.familyTree.value;
    if (!tree) return [];
    const parent = tree.people.get(parentId);
    if (!parent) return [];
    return parent.childrenIds
      .map(childId => tree.people.get(childId))
      .filter((p): p is Person => !!p);
  }

  // Get spouse
  getSpouses(personId: string): Person[] {
    const tree = this.familyTree.value;
    if (!tree) return [];
    const person = tree.people.get(personId);
    if (!person) return [];
    return person.spouseIds
      .map(spouseId => tree.people.get(spouseId))
      .filter((p): p is Person => !!p);
  }

  // Set current user
  setCurrentUser(personId: string): void {
    const tree = this.familyTree.value;
    if (!tree) return;

    tree.people.forEach(p => p.isCurrentUser = false);
    const currentUser = tree.people.get(personId);
    if (currentUser) {
      currentUser.isCurrentUser = true;
      tree.updatedAt = new Date();
      this.familyTree.next(tree);
      this.updatePeopleList();
      this.saveToStorage();
    }
  }

  // Export data to JSON
  exportToJSON(): string {
    const tree = this.familyTree.value;
    if (!tree) return '';

    const treeData = {
      id: tree.id,
      treeName: tree.treeName,
      people: Array.from(tree.people.values()),
      relationships: tree.relationships,
      createdAt: tree.createdAt,
      updatedAt: tree.updatedAt
    };

    return JSON.stringify(treeData, null, 2);
  }

  // Import data from JSON
  importFromJSON(jsonString: string): void {
    try {
      const treeData = JSON.parse(jsonString);
      const people = new Map<string, Person>();
      treeData.people.forEach((p: Person) => {
        people.set(p.id, { ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) });
      });

      const tree: FamilyTree = {
        id: treeData.id,
        treeName: treeData.treeName,
        people,
        relationships: treeData.relationships.map((r: Relationship) => ({ ...r, createdAt: new Date(r.createdAt) })),
        createdAt: new Date(treeData.createdAt),
        updatedAt: new Date(treeData.updatedAt)
      };

      this.familyTree.next(tree);
      this.updatePeopleList();
      this.saveToStorage();
    } catch (e) {
      console.error('Failed to import tree:', e);
    }
  }

  // Save to localStorage
  private saveToStorage(): void {
    const tree = this.familyTree.value;
    if (!tree) return;
    const data = this.exportToJSON();
    localStorage.setItem(this.localStorage_KEY, data);
  }

  // Load from localStorage
  private loadFromStorage(): void {
    const data = localStorage.getItem(this.localStorage_KEY);
    if (data) {
      this.importFromJSON(data);
    }
  }

  // Clear all data
  clearData(): void {
    this.familyTree.next(null);
    this.updatePeopleList();
    localStorage.removeItem(this.localStorage_KEY);
  }

  // Update people list observable
  private updatePeopleList(): void {
    const tree = this.familyTree.value;
    this.people.next(tree ? Array.from(tree.people.values()) : []);
  }

  // Helper: Generate unique ID
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
