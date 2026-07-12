import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  BulkEditRequest,
  Gender,
  GuidedTreeInput,
  LifeEvent,
  ParentRelationshipType,
  PersonIndexEntry,
  PersonStory,
  RelationshipRecord,
  TimelineEntry,
  TreeNode
} from '../models/tree-node.model';
import { AuthService, AuthUser } from './auth.service';

interface CloudTreeDocument {
  schemaVersion?: number;
  treeName?: string;
  rootNode?: TreeNode;
}

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

@Injectable({
  providedIn: 'root'
})
export class TreeService {
  private readonly localStorageKey = 'myFamilyTree_v2';
  private readonly onboardingStorageKey = 'myFamilyTree_onboarding_v1';
  private readonly maxHistory = 50;

  private readonly treeData = new BehaviorSubject<TreeNode>(this.getInitialTree());
  private readonly canUndoSubject = new BehaviorSubject<boolean>(false);
  private readonly canRedoSubject = new BehaviorSubject<boolean>(false);
  private readonly lastActionSubject = new BehaviorSubject<string>('Tree ready');
  private readonly syncStatusSubject = new BehaviorSubject<SyncStatus>('local');
  private readonly onboardingNeededSubject = new BehaviorSubject<boolean>(false);

  readonly tree$ = this.treeData.asObservable();
  readonly canUndo$ = this.canUndoSubject.asObservable();
  readonly canRedo$ = this.canRedoSubject.asObservable();
  readonly lastAction$ = this.lastActionSubject.asObservable();
  readonly syncStatus$ = this.syncStatusSubject.asObservable();
  readonly onboardingNeeded$ = this.onboardingNeededSubject.asObservable();

  private history: TreeNode[] = [];
  private future: TreeNode[] = [];
  private cloudSaveTimer?: ReturnType<typeof setTimeout>;

  constructor(private authService: AuthService) {
    const loadedExistingTree = this.loadFromStorage();
    const onboardingHandled = localStorage.getItem(this.onboardingStorageKey) === 'complete';
    this.onboardingNeededSubject.next(!loadedExistingTree && !onboardingHandled);

    this.authService.user$.subscribe(user => {
      void this.handleAuthChange(user);
    });
  }

  getTree(): TreeNode {
    return this.treeData.value;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get onboardingNeeded(): boolean {
    return this.onboardingNeededSubject.value;
  }

  private getInitialTree(): TreeNode {
    return {
      id: this.generateId(),
      treeName: 'My Family',
      name: 'You',
      age: 0,
      gender: Gender.OTHER,
      isAlive: true,
      location: '',
      type: 'blood',
      spouse: null,
      children: [],
      alternateNames: [],
      tags: [],
      stories: [],
      events: [],
      relationshipRecords: []
    };
  }

  completeOnboarding(): void {
    localStorage.setItem(this.onboardingStorageKey, 'complete');
    this.onboardingNeededSubject.next(false);
  }

  setTreeName(treeName: string): void {
    const name = treeName.trim();
    if (!name || name === this.treeData.value.treeName) return;
    this.commit({ ...this.treeData.value, treeName: name }, `Renamed tree to ${name}`);
  }

  reopenOnboarding(): void {
    this.onboardingNeededSubject.next(true);
  }

  initializeManualTree(): void {
    const root = this.getInitialTree();
    root.name = 'Your first person';
    this.replaceTree(root, 'Started a blank tree');
    this.completeOnboarding();
  }

  createGuidedTree(input: GuidedTreeInput): TreeNode {
    const self = this.createPersonNode({
      name: input.selfName.trim() || 'You',
      gender: input.selfGender,
      birthDate: input.selfBirthDate,
      location: input.selfLocation,
      parentRelationshipType: 'biological_parent'
    });

    if (input.partnerName?.trim()) {
      self.spouse = this.createPersonNode({
        name: input.partnerName.trim(),
        gender: Gender.OTHER,
        type: 'spouse',
        partnerRelationshipType: 'partner'
      });
    }

    self.children = (input.childNames ?? [])
      .map(name => name.trim())
      .filter(Boolean)
      .map(name => this.createPersonNode({
        name,
        gender: Gender.OTHER,
        parentRelationshipType: 'biological_parent'
      }));

    const siblings = (input.siblingNames ?? [])
      .map(name => name.trim())
      .filter(Boolean)
      .map(name => this.createPersonNode({
        name,
        gender: Gender.OTHER,
        parentRelationshipType: 'biological_parent'
      }));

    let root = self;
    const firstParentName = input.parentOneName?.trim();
    const secondParentName = input.parentTwoName?.trim();
    if (firstParentName || secondParentName) {
      root = this.createPersonNode({
        name: firstParentName || secondParentName || 'Parent',
        gender: Gender.OTHER
      });
      if (firstParentName && secondParentName) {
        root.spouse = this.createPersonNode({
          name: secondParentName,
          gender: Gender.OTHER,
          type: 'spouse',
          partnerRelationshipType: 'partner'
        });
      }
      root.children = [self, ...siblings];
    }

    root.treeName = `${input.selfName.trim() || 'My'} Family`;

    this.replaceTree(root, 'Created your first family tree');
    this.completeOnboarding();
    return this.treeData.value;
  }

  findNode(node: TreeNode, targetId: string): TreeNode | null {
    if (node.id === targetId) return node;
    if (node.spouse?.id === targetId) return node.spouse;

    for (const child of node.children) {
      const found = this.findNode(child, targetId);
      if (found) return found;
    }
    return null;
  }

  getPersonIndex(): PersonIndexEntry[] {
    const people: PersonIndexEntry[] = [];

    const visit = (
      node: TreeNode,
      generation: number,
      parentId?: string,
      parentName?: string,
      inheritedBranch = 'Root family'
    ): void => {
      const branchName = generation === 1 ? node.name : inheritedBranch;
      people.push({ node, generation, parentId, parentName, branchName });
      if (node.spouse) {
        people.push({
          node: node.spouse,
          generation,
          parentId: node.id,
          parentName: node.name,
          branchName
        });
      }
      node.children.forEach(child => visit(
        child,
        generation + 1,
        node.id,
        node.name,
        branchName
      ));
    };

    visit(this.treeData.value, 0);
    return people;
  }

  getRelatives(personId: string): Array<{ label: string; person: TreeNode }> {
    const root = this.treeData.value;
    const records = root.relationshipRecords ?? this.buildRelationshipRecords(root);
    const result: Array<{ label: string; person: TreeNode }> = [];
    const seen = new Set<string>();

    const add = (label: string, id: string): void => {
      if (seen.has(id)) return;
      const person = this.findNode(root, id);
      if (!person) return;
      seen.add(id);
      result.push({ label, person });
    };

    records.forEach(record => {
      const isPartner = ['spouse', 'partner', 'former_spouse'].includes(record.type);
      if (record.fromPersonId === personId) {
        add(isPartner ? this.relationshipLabel(record.type) : 'Child', record.toPersonId);
      } else if (record.toPersonId === personId) {
        add(isPartner ? this.relationshipLabel(record.type) : this.relationshipLabel(record.type), record.fromPersonId);
      }
    });

    return result;
  }

  addChild(
    parentId: string,
    childData: Omit<TreeNode, 'id' | 'spouse' | 'children'>
  ): TreeNode {
    const newChild = this.createPersonNode({
      ...childData,
      type: 'blood',
      parentRelationshipType: childData.parentRelationshipType ?? 'biological_parent'
    });

    const nextTree = this.updateRecursive(this.treeData.value, node => {
      if (node.id === parentId || node.spouse?.id === parentId) {
        return { ...node, children: [...node.children, newChild] };
      }
      return null;
    });

    this.commit(nextTree, `Added ${newChild.name}`);
    return this.findNode(this.treeData.value, newChild.id) ?? newChild;
  }

  addSpouse(
    personId: string,
    spouseData: Omit<TreeNode, 'id' | 'spouse' | 'children'>
  ): TreeNode {
    const newSpouse = this.createPersonNode({
      ...spouseData,
      type: 'spouse',
      partnerRelationshipType: spouseData.partnerRelationshipType ?? 'spouse'
    });

    const nextTree = this.updateRecursive(this.treeData.value, node => {
      if (node.id !== personId) return null;
      return { ...node, spouse: newSpouse };
    });

    this.commit(nextTree, `Added ${newSpouse.name} as ${this.relationshipLabel(newSpouse.partnerRelationshipType ?? 'spouse').toLowerCase()}`);
    return this.findNode(this.treeData.value, newSpouse.id) ?? newSpouse;
  }

  editNode(
    nodeId: string,
    updates: Partial<Omit<TreeNode, 'id' | 'spouse' | 'children'>>
  ): void {
    const nextTree = this.updateRecursive(this.treeData.value, node => {
      if (node.id === nodeId) return { ...node, ...updates };
      if (node.spouse?.id === nodeId) {
        return { ...node, spouse: { ...node.spouse, ...updates } };
      }
      return null;
    });
    this.commit(nextTree, `Updated ${updates.name || 'person'}`);
  }

  deleteNode(nodeId: string): boolean {
    if (nodeId === this.treeData.value.id) return false;

    const person = this.findNode(this.treeData.value, nodeId);
    if (!person) return false;

    const deleteRecursive = (node: TreeNode): TreeNode | null => {
      if (node.id === nodeId) return null;

      const newSpouse = node.spouse?.id === nodeId ? null : node.spouse;
      const newChildren = node.children
        .map(deleteRecursive)
        .filter((child): child is TreeNode => child !== null);
      return { ...node, spouse: newSpouse, children: newChildren };
    };

    const result = deleteRecursive(this.treeData.value);
    if (!result) return false;
    this.commit(result, `Deleted ${person.name}`);
    return true;
  }

  addStory(personId: string, story: Omit<PersonStory, 'id'>): void {
    const person = this.findNode(this.treeData.value, personId);
    if (!person) return;
    const stories = [...(person.stories ?? []), { ...story, id: this.generateId() }];
    this.editNode(personId, { stories });
  }

  addEvent(personId: string, event: Omit<LifeEvent, 'id'>): void {
    const person = this.findNode(this.treeData.value, personId);
    if (!person) return;
    const events = [...(person.events ?? []), { ...event, id: this.generateId() }];
    this.editNode(personId, { events });
  }

  updatePhoto(personId: string, photoUrl: string): void {
    this.editNode(personId, { photoUrl });
  }

  bulkEdit(request: BulkEditRequest): number {
    const selected = new Set(request.personIds);
    if (!selected.size) return 0;
    let changed = 0;

    const editPerson = (person: TreeNode): TreeNode => {
      if (!selected.has(person.id)) return person;
      changed += 1;
      const tags = Array.from(new Set([...(person.tags ?? []), ...(request.addTags ?? [])]));
      let name = person.name;
      if (request.surnameFrom && request.surnameTo) {
        const escaped = request.surnameFrom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        name = name.replace(new RegExp(`${escaped}$`, 'i'), request.surnameTo);
      }
      return {
        ...person,
        name,
        location: request.location?.trim() || person.location,
        tags
      };
    };

    const visit = (node: TreeNode): TreeNode => {
      const edited = editPerson(node);
      return {
        ...edited,
        spouse: edited.spouse ? editPerson(edited.spouse) : null,
        children: edited.children.map(visit)
      };
    };

    const next = visit(this.treeData.value);
    if (changed) this.commit(next, `Bulk edited ${changed} people`);
    return changed;
  }

  getTimeline(): TimelineEntry[] {
    const entries: TimelineEntry[] = [];
    this.getPersonIndex().forEach(({ node, generation, branchName }) => {
      if (node.birthDate) {
        entries.push({
          id: `birth-${node.id}`,
          type: 'birth',
          title: `${node.name} was born`,
          date: node.birthDate,
          place: node.birthPlace,
          personId: node.id,
          personName: node.name,
          generation,
          branchName,
          isDerived: true
        });
      }
      if (node.deathDate) {
        entries.push({
          id: `death-${node.id}`,
          type: 'death',
          title: `${node.name} passed away`,
          date: node.deathDate,
          place: node.location,
          personId: node.id,
          personName: node.name,
          generation,
          branchName,
          isDerived: true
        });
      }
      (node.events ?? []).forEach(event => entries.push({
        ...event,
        personId: node.id,
        personName: node.name,
        generation,
        branchName
      }));
      if (node.spouse && node.spouse.relationshipStartDate) {
        entries.push({
          id: `relationship-${node.id}-${node.spouse.id}`,
          type: 'marriage',
          title: `${node.name} and ${node.spouse.name} began their partnership`,
          date: node.spouse.relationshipStartDate,
          place: node.location || node.spouse.location,
          personId: node.id,
          personName: node.name,
          generation,
          branchName,
          isDerived: true
        });
      }
    });

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }

  undo(): void {
    const previous = this.history.pop();
    if (!previous) return;
    this.future.push(this.clone(this.treeData.value));
    this.treeData.next(this.normalizeTree(previous));
    this.updateHistoryState();
    this.lastActionSubject.next('Undid last change');
    this.persist();
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.history.push(this.clone(this.treeData.value));
    this.treeData.next(this.normalizeTree(next));
    this.updateHistoryState();
    this.lastActionSubject.next('Redid change');
    this.persist();
  }

  replaceTree(tree: TreeNode, actionLabel = 'Replaced family tree'): void {
    this.commit(this.normalizeTree(tree), actionLabel);
    this.completeOnboarding();
  }

  exportToJSON(): string {
    return JSON.stringify(this.treeData.value, null, 2);
  }

  importFromJSON(jsonString: string): boolean {
    try {
      const parsed: unknown = JSON.parse(jsonString);
      if (!this.isTreeNodeCandidate(parsed)) return false;
      this.replaceTree(this.normalizeTree(parsed), 'Imported JSON backup');
      return true;
    } catch (error) {
      console.error('Failed to import tree:', error);
      return false;
    }
  }

  async saveCurrentTree(): Promise<void> {
    localStorage.setItem(this.localStorageKey, JSON.stringify(this.treeData.value));
    if (this.cloudSaveTimer) {
      clearTimeout(this.cloudSaveTimer);
      this.cloudSaveTimer = undefined;
    }
    const user = this.authService.currentUser;
    if (!user) {
      this.syncStatusSubject.next('local');
      return;
    }

    this.syncStatusSubject.next('syncing');
    try {
      await this.saveTreeToCloud(user.uid, this.treeData.value);
      this.syncStatusSubject.next('synced');
    } catch (error) {
      this.syncStatusSubject.next('error');
      throw error;
    }
  }

  resetTree(skipConfirmation = false): void {
    if (!skipConfirmation && !confirm('This will replace the entire family tree. Are you sure?')) return;
    this.replaceTree(this.getInitialTree(), 'Reset family tree');
    localStorage.removeItem(this.onboardingStorageKey);
    this.onboardingNeededSubject.next(true);
  }

  private createPersonNode(data: Partial<TreeNode> & Pick<TreeNode, 'name' | 'gender'>): TreeNode {
    return {
      id: this.generateId(),
      name: data.name,
      gender: data.gender,
      age: data.age ?? this.calculateAge(data.birthDate),
      email: data.email,
      location: data.location ?? '',
      isAlive: data.isAlive ?? true,
      type: data.type ?? 'blood',
      spouse: null,
      children: [],
      alternateNames: data.alternateNames ?? [],
      birthDate: data.birthDate,
      deathDate: data.deathDate,
      birthPlace: data.birthPlace,
      photoUrl: data.photoUrl,
      notes: data.notes,
      tags: data.tags ?? [],
      stories: data.stories ?? [],
      events: data.events ?? [],
      parentRelationshipType: data.parentRelationshipType,
      partnerRelationshipType: data.partnerRelationshipType,
      relationshipStartDate: data.relationshipStartDate,
      relationshipEndDate: data.relationshipEndDate
    };
  }

  private updateRecursive(
    node: TreeNode,
    updater: (node: TreeNode) => TreeNode | null
  ): TreeNode {
    const updated = updater(node);
    if (updated) return updated;
    return {
      ...node,
      children: node.children.map(child => this.updateRecursive(child, updater))
    };
  }

  private commit(nextTree: TreeNode, actionLabel: string): void {
    const normalized = this.normalizeTree(nextTree);
    if (JSON.stringify(normalized) === JSON.stringify(this.treeData.value)) return;
    this.history.push(this.clone(this.treeData.value));
    if (this.history.length > this.maxHistory) this.history.shift();
    this.future = [];
    this.treeData.next(normalized);
    this.updateHistoryState();
    this.lastActionSubject.next(actionLabel);
    this.persist();
  }

  private persist(): void {
    localStorage.setItem(this.localStorageKey, JSON.stringify(this.treeData.value));
    const user = this.authService.currentUser;
    if (!user) {
      this.syncStatusSubject.next('local');
      return;
    }

    if (this.cloudSaveTimer) clearTimeout(this.cloudSaveTimer);
    this.syncStatusSubject.next('syncing');
    this.cloudSaveTimer = setTimeout(() => {
      this.cloudSaveTimer = undefined;
      void this.saveTreeToCloud(user.uid, this.treeData.value)
        .then(() => this.syncStatusSubject.next('synced'))
        .catch(error => {
          console.error('Failed to save family tree to Firestore:', error);
          this.syncStatusSubject.next('error');
        });
    }, 700);
  }

  private loadFromStorage(): boolean {
    const saved = localStorage.getItem(this.localStorageKey);
    if (!saved) return false;
    try {
      const parsed: unknown = JSON.parse(saved);
      if (!this.isTreeNodeCandidate(parsed)) return false;
      this.treeData.next(this.normalizeTree(parsed));
      return true;
    } catch (error) {
      console.error('Failed to load tree from storage:', error);
      return false;
    }
  }

  private async handleAuthChange(user: AuthUser | null): Promise<void> {
    if (!user) {
      this.syncStatusSubject.next('local');
      return;
    }

    try {
      await this.saveUserProfile(user);
      const snapshot = await getDoc(this.getTreeDocRef(user.uid));
      if (snapshot.exists()) {
        const cloudTree = snapshot.data() as CloudTreeDocument;
        if (cloudTree.rootNode && this.isTreeNodeCandidate(cloudTree.rootNode)) {
          const normalized = this.normalizeTree(cloudTree.rootNode);
          this.treeData.next(normalized);
          localStorage.setItem(this.localStorageKey, JSON.stringify(normalized));
          this.completeOnboarding();
          this.history = [];
          this.future = [];
          this.updateHistoryState();
          this.syncStatusSubject.next('synced');
          return;
        }
      }

      await this.saveTreeToCloud(user.uid, this.treeData.value);
      this.syncStatusSubject.next('synced');
    } catch (error) {
      console.error('Failed to sync family tree with Firestore:', error);
      this.syncStatusSubject.next('error');
    }
  }

  private getTreeDocRef(uid: string) {
    return doc(this.authService.firestore, 'users', uid, 'trees', 'default');
  }

  private async saveTreeToCloud(uid: string, rootNode: TreeNode): Promise<void> {
    const sanitizedRoot = JSON.parse(JSON.stringify(rootNode)) as TreeNode;
    await setDoc(this.getTreeDocRef(uid), {
      schemaVersion: 3,
      treeName: rootNode.treeName ?? 'My Family',
      rootNode: sanitizedRoot,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  private async saveUserProfile(user: AuthUser): Promise<void> {
    await setDoc(doc(this.authService.firestore, 'users', user.uid), {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  private normalizeTree(raw: TreeNode): TreeNode {
    const normalizeNode = (candidate: TreeNode, isRoot = false): TreeNode => {
      const rawChildren = Array.isArray(candidate.children) ? candidate.children : [];
      const normalizedSpouse = candidate.spouse && this.isTreeNodeCandidate(candidate.spouse)
        ? normalizeNode(candidate.spouse)
        : null;
      const spouseChildren = normalizedSpouse?.children ?? [];
      if (normalizedSpouse) normalizedSpouse.children = [];
      const childIds = new Set<string>();
      const children = [...rawChildren, ...spouseChildren]
        .filter(child => this.isTreeNodeCandidate(child))
        .map(child => normalizeNode(child))
        .filter(child => {
          if (childIds.has(child.id)) return false;
          childIds.add(child.id);
          return true;
        });

      const gender = Object.values(Gender).includes(candidate.gender) ? candidate.gender : Gender.OTHER;
      const normalized: TreeNode = {
        id: typeof candidate.id === 'string' && candidate.id ? candidate.id : this.generateId(),
        treeName: isRoot
          ? (this.optionalString(candidate.treeName) ?? `${candidate.name || 'My'} Family`)
          : undefined,
        name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : 'Unnamed person',
        gender,
        age: Number.isFinite(Number(candidate.age)) ? Number(candidate.age) : 0,
        email: typeof candidate.email === 'string' ? candidate.email : undefined,
        location: typeof candidate.location === 'string' ? candidate.location : '',
        isAlive: candidate.isAlive !== false,
        type: candidate.type === 'spouse' ? 'spouse' : 'blood',
        spouse: normalizedSpouse,
        children,
        alternateNames: this.stringArray(candidate.alternateNames),
        birthDate: this.optionalString(candidate.birthDate),
        deathDate: this.optionalString(candidate.deathDate),
        birthPlace: this.optionalString(candidate.birthPlace),
        photoUrl: this.optionalString(candidate.photoUrl),
        notes: this.optionalString(candidate.notes),
        tags: this.stringArray(candidate.tags),
        stories: Array.isArray(candidate.stories)
          ? candidate.stories.filter(story => story && typeof story.title === 'string' && typeof story.text === 'string')
          : [],
        events: Array.isArray(candidate.events)
          ? candidate.events.filter(event => event && typeof event.title === 'string' && typeof event.date === 'string')
          : [],
        parentRelationshipType: this.parentRelationship(candidate.parentRelationshipType),
        partnerRelationshipType: candidate.partnerRelationshipType ?? (candidate.type === 'spouse' ? 'spouse' : undefined),
        relationshipStartDate: this.optionalString(candidate.relationshipStartDate),
        relationshipEndDate: this.optionalString(candidate.relationshipEndDate)
      };

      if (isRoot) normalized.relationshipRecords = [];
      return normalized;
    };

    const normalized = normalizeNode(raw, true);
    normalized.relationshipRecords = this.buildRelationshipRecords(normalized);
    return normalized;
  }

  private buildRelationshipRecords(root: TreeNode): RelationshipRecord[] {
    const records: RelationshipRecord[] = [];
    const visit = (node: TreeNode): void => {
      if (node.spouse) {
        records.push({
          id: `rel-${node.id}-${node.spouse.id}`,
          fromPersonId: node.id,
          toPersonId: node.spouse.id,
          type: node.spouse.partnerRelationshipType ?? 'spouse',
          startDate: node.spouse.relationshipStartDate,
          endDate: node.spouse.relationshipEndDate
        });
      }
      node.children.forEach(child => {
        records.push({
          id: `rel-${node.id}-${child.id}`,
          fromPersonId: node.id,
          toPersonId: child.id,
          type: child.parentRelationshipType ?? 'biological_parent'
        });
        if (node.spouse) {
          records.push({
            id: `rel-${node.spouse.id}-${child.id}`,
            fromPersonId: node.spouse.id,
            toPersonId: child.id,
            type: child.parentRelationshipType ?? 'biological_parent'
          });
        }
        visit(child);
      });
    };
    visit(root);
    return records;
  }

  private parentRelationship(value: ParentRelationshipType | undefined): ParentRelationshipType | undefined {
    const values: ParentRelationshipType[] = [
      'biological_parent',
      'adoptive_parent',
      'step_parent',
      'guardian',
      'unknown_parent'
    ];
    return value && values.includes(value) ? value : undefined;
  }

  private relationshipLabel(type: string): string {
    const labels: Record<string, string> = {
      biological_parent: 'Biological parent',
      adoptive_parent: 'Adoptive parent',
      step_parent: 'Step-parent',
      guardian: 'Guardian',
      unknown_parent: 'Parent',
      spouse: 'Spouse',
      partner: 'Partner',
      former_spouse: 'Former spouse'
    };
    return labels[type] ?? 'Relative';
  }

  private updateHistoryState(): void {
    this.canUndoSubject.next(this.history.length > 0);
    this.canRedoSubject.next(this.future.length > 0);
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string').map(entry => entry.trim()).filter(Boolean)
      : [];
  }

  private optionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private isTreeNodeCandidate(value: unknown): value is TreeNode {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Partial<TreeNode>;
    return typeof candidate.name === 'string' && Array.isArray(candidate.children);
  }

  private calculateAge(birthDate?: string): number {
    if (!birthDate) return 0;
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const month = today.getMonth() - birth.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
    return Math.max(age, 0);
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
