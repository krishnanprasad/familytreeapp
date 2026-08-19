import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { collection, doc, getDoc, getDocs, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  BulkEditRequest,
  Gender,
  GuidedTreeInput,
  LifeEvent,
  ParentRelationshipType,
  PersonIndexEntry,
  PersonStory,
  RelationshipRecord,
  SOCIAL_PLATFORMS,
  ShareLinkRecord,
  ShareLinkRequest,
  SharedTreeLoadResult,
  SocialProfile,
  TreeAccess,
  TreeAccessRole,
  TimelineEntry,
  TreeNode,
  TreeSummary,
  TreeRouteLoadResult,
  TreeVisibility
} from '../models/tree-node.model';
import {
  AiApplyResult,
  AiFamilyOperation,
  AiPersonFields
} from '../models/ai-family.model';
import { AuthService, AuthUser } from './auth.service';

interface CloudTreeDocument {
  schemaVersion?: number;
  revision?: number;
  treeId?: string;
  routeId?: string;
  ownerUid?: string;
  treeName?: string;
  treeOwnerName?: string;
  visibility?: TreeVisibility;
  rootNode?: TreeNode;
}

interface SecureInviteFunctionResponse {
  status: SharedTreeLoadResult['status'];
  alreadyClaimed?: boolean;
  share?: ShareLinkRecord;
  rootNode?: TreeNode;
  routeId?: string;
  revision?: number;
  ownerUid?: string;
  role?: TreeAccessRole;
  visibility?: TreeVisibility;
}

interface TreeAccessViewResponse {
  status: 'loaded';
  treeId: string;
  ownerUid: string;
  routeId?: string;
  treeName?: string;
  treeOwnerName?: string;
  visibility: TreeVisibility;
  role: TreeAccessRole;
  scope: 'tree' | 'branch';
  branchRootId?: string;
  branchRootName?: string;
  revision: number;
  rootNode: TreeNode;
}

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

@Injectable({
  providedIn: 'root'
})
export class TreeService {
  private readonly localStorageKey = 'myFamilyTree_v2';
  private readonly activeTreeIdStorageKey = 'myFamilyTree_activeTreeId_v1';
  private readonly treeRouteStoragePrefix = 'myFamilyTree_routeId_v1:';
  private readonly onboardingStorageKey = 'myFamilyTree_onboarding_v1';
  private readonly maxHistory = 50;

  private readonly treeData = new BehaviorSubject<TreeNode>(this.getInitialTree());
  private readonly canUndoSubject = new BehaviorSubject<boolean>(false);
  private readonly canRedoSubject = new BehaviorSubject<boolean>(false);
  private readonly lastActionSubject = new BehaviorSubject<string>('Tree ready');
  private readonly syncStatusSubject = new BehaviorSubject<SyncStatus>('local');
  private readonly onboardingNeededSubject = new BehaviorSubject<boolean>(false);
  private readonly treeSummariesSubject = new BehaviorSubject<TreeSummary[]>([]);
  private readonly activeRoleSubject = new BehaviorSubject<TreeAccessRole>('owner');
  private readonly activeVisibilitySubject = new BehaviorSubject<TreeVisibility>('private');
  private readonly activeRouteIdSubject = new BehaviorSubject<string>('');

  readonly tree$ = this.treeData.asObservable();
  readonly canUndo$ = this.canUndoSubject.asObservable();
  readonly canRedo$ = this.canRedoSubject.asObservable();
  readonly lastAction$ = this.lastActionSubject.asObservable();
  readonly syncStatus$ = this.syncStatusSubject.asObservable();
  readonly onboardingNeeded$ = this.onboardingNeededSubject.asObservable();
  readonly treeSummaries$ = this.treeSummariesSubject.asObservable();
  readonly activeRole$ = this.activeRoleSubject.asObservable();
  readonly activeVisibility$ = this.activeVisibilitySubject.asObservable();
  readonly activeRouteId$ = this.activeRouteIdSubject.asObservable();

  private history: TreeNode[] = [];
  private future: TreeNode[] = [];
  private cloudSaveTimer?: ReturnType<typeof setTimeout>;
  private activeTreeId = localStorage.getItem(this.activeTreeIdStorageKey) || 'default';
  private activeTreeRouteId = localStorage.getItem(`${this.treeRouteStoragePrefix}${this.activeTreeId}`) || '';
  private activeTreeOwnerUid: string | null = null;
  private activeTreeRole: TreeAccessRole = 'owner';
  private activeTreeVisibility: TreeVisibility = 'private';
  private activeTreeIsPreviewOnly = false;
  private activeTreeRevision = 0;

  constructor(private authService: AuthService) {
    this.activeRouteIdSubject.next(this.activeTreeRouteId);
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

  get currentTreeId(): string {
    return this.activeTreeId;
  }

  get currentRouteId(): string {
    return this.activeTreeRouteId;
  }

  get currentOwnerUid(): string | null {
    return this.activeTreeOwnerUid;
  }

  get currentRole(): TreeAccessRole {
    return this.activeTreeRole;
  }

  get currentVisibility(): TreeVisibility {
    return this.activeTreeVisibility;
  }

  get canEditCurrentTree(): boolean {
    return ['owner', 'coOwner', 'branchEditor'].includes(this.activeTreeRole);
  }

  get canShareCurrentTree(): boolean {
    return ['owner', 'coOwner'].includes(this.activeTreeRole);
  }

  get canDeleteInCurrentTree(): boolean {
    return this.activeTreeRole === 'owner';
  }

  private getInitialTree(): TreeNode {
    return {
      id: this.generateId(),
      treeName: 'My Family',
      treeOwnerName: 'You',
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

  setTreeOwnerName(ownerName: string): void {
    const name = ownerName.trim();
    if (!name || name === this.treeData.value.treeOwnerName) return;
    this.commit({ ...this.treeData.value, treeOwnerName: name }, `Updated tree owner`);
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

  createNewTree(treeName: string): TreeNode {
    if (this.cloudSaveTimer) {
      clearTimeout(this.cloudSaveTimer);
      this.cloudSaveTimer = undefined;
    }

    this.activeTreeIsPreviewOnly = false;
    this.activeTreeId = this.generateId();
    this.activeTreeRevision = 0;
    this.setActiveRouteId(this.generateRouteId());
    this.activeTreeOwnerUid = this.authService.currentUser?.uid ?? null;
    this.setActiveAccessState('owner', 'private');
    localStorage.setItem(this.activeTreeIdStorageKey, this.activeTreeId);
    this.history = [];
    this.future = [];
    this.updateHistoryState();

    const root = this.getInitialTree();
    root.treeName = treeName.trim() || 'New Family Tree';
    root.treeOwnerName = this.getCurrentOwnerName() ?? 'You';
    root.name = root.treeOwnerName === 'You' ? 'Starting person' : root.treeOwnerName;

    this.treeData.next(this.normalizeTree(root));
    this.lastActionSubject.next(`Created ${root.treeName}`);
    this.completeOnboarding();
    this.persist();
    return this.treeData.value;
  }

  createGuidedTree(input: GuidedTreeInput): TreeNode {
    const self = this.createPersonNode({
      name: input.selfName.trim() || 'You',
      gender: input.selfGender,
      birthDate: input.selfBirthDate,
      location: input.selfLocation,
      photoUrl: input.selfPhotoUrl,
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
    root.treeOwnerName = this.getCurrentOwnerName() || input.selfName.trim() || root.name;

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

    const parentFamily = this.findParentFamily(root, personId);
    if (parentFamily) {
      const personIndex = parentFamily.children.findIndex(child => child.id === personId);
      const person = parentFamily.children[personIndex];
      parentFamily.children.forEach((sibling, siblingIndex) => {
        if (sibling.id === personId) return;
        add(this.siblingLabel(person, personIndex, sibling, siblingIndex), sibling.id);
      });
    }

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

  canAddParent(personId: string): boolean {
    return this.treeData.value.id === personId && this.treeData.value.type === 'blood';
  }

  addParent(
    personId: string,
    parentData: Omit<TreeNode, 'id' | 'spouse' | 'children'>
  ): TreeNode {
    if (!this.canAddParent(personId)) {
      throw new Error('A parent can only be added above the top person in this tree.');
    }

    const currentRoot = this.treeData.value;
    const newParent = this.createPersonNode({
      ...parentData,
      type: 'blood',
      parentRelationshipType: undefined
    });
    const movedChild: TreeNode = {
      ...currentRoot,
      treeName: undefined,
      treeOwnerName: undefined,
      parentRelationshipType: parentData.parentRelationshipType ?? 'biological_parent'
    };
    const nextTree: TreeNode = {
      ...newParent,
      treeName: currentRoot.treeName,
      treeOwnerName: currentRoot.treeOwnerName,
      children: [movedChild]
    };

    this.commit(nextTree, `Added ${newParent.name} above ${currentRoot.name}`);
    return this.treeData.value;
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

  applyAiOperations(operations: AiFamilyOperation[]): AiApplyResult {
    if (!this.canEditCurrentTree) {
      throw new Error('This tree is view-only for you.');
    }
    if (!operations.length || operations.length > 8) {
      throw new Error('The assistant must propose between 1 and 8 changes.');
    }

    let nextTree = this.clone(this.treeData.value);
    const affectedIds: string[] = [];

    operations.forEach(operation => {
      const target = this.findNode(nextTree, operation.targetId);
      if (!target) throw new Error('A referenced person is no longer in this tree. Please ask again.');

      if (operation.type === 'add') {
        if (operation.relation === 'none') throw new Error('A new person needs a family relationship.');
        const newPerson = this.createPersonNode(this.aiPersonData(operation));

        if (operation.relation === 'child') {
          nextTree = this.updateRecursive(nextTree, node => {
            if (node.id !== target.id && node.spouse?.id !== target.id) return null;
            return { ...node, children: [...node.children, newPerson] };
          });
        } else if (operation.relation === 'spouse') {
          if (target.type === 'spouse') throw new Error(`Cannot attach another partner to ${target.name}.`);
          if (target.spouse) throw new Error(`${target.name} already has a partner in this tree.`);
          nextTree = this.updateRecursive(nextTree, node => node.id === target.id
            ? { ...node, spouse: newPerson }
            : null);
        } else {
          if (target.id !== nextTree.id) {
            throw new Error('A parent can only be added above the top person in this tree.');
          }
          const movedChild: TreeNode = {
            ...nextTree,
            treeName: undefined,
            treeOwnerName: undefined,
            parentRelationshipType: operation.fields.parentRelationshipType === 'unspecified'
              ? 'biological_parent'
              : operation.fields.parentRelationshipType
          };
          nextTree = {
            ...newPerson,
            type: 'blood',
            parentRelationshipType: undefined,
            treeName: nextTree.treeName,
            treeOwnerName: nextTree.treeOwnerName,
            children: [movedChild]
          };
        }
        affectedIds.push(newPerson.id);
        return;
      }

      if (operation.relation !== 'none') {
        throw new Error('Update and delete changes cannot add a relationship.');
      }

      if (operation.type === 'update') {
        const updates = this.aiPersonUpdates(operation, target);
        nextTree = this.updateRecursive(nextTree, node => {
          if (node.id === target.id) return { ...node, ...updates };
          if (node.spouse?.id === target.id) {
            return { ...node, spouse: { ...node.spouse, ...updates } };
          }
          return null;
        });
        affectedIds.push(target.id);
        return;
      }

      throw new Error('AI deletion is not supported. Delete people from their profile instead.');
    });

    if (JSON.stringify(this.normalizeTree(nextTree)) === JSON.stringify(this.treeData.value)) {
      throw new Error('Those details are already up to date.');
    }

    const summary = operations.length === 1
      ? operations[0].summary
      : `Applied ${operations.length} family updates`;
    this.commit(nextTree, summary);
    return { changedCount: operations.length, affectedIds, summary };
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
    this.activeTreeIsPreviewOnly = false;
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
    if (this.activeTreeIsPreviewOnly) {
      this.syncStatusSubject.next('local');
      return;
    }
    this.persistToLocalStorage(this.treeData.value);
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

  async loadAccessibleTrees(): Promise<TreeSummary[]> {
    const user = this.authService.currentUser;
    if (!user) {
      this.treeSummariesSubject.next([]);
      return [];
    }

    const summaries = new Map<string, TreeSummary>();
    const summaryCollection = collection(this.authService.firestore, 'treeSummaries');
    const accessCollection = collection(this.authService.firestore, 'treeAccess');

    const ownedSnapshot = await getDocs(query(summaryCollection, where('ownerUid', '==', user.uid)));
    ownedSnapshot.docs.forEach(snapshot => {
      const summary = this.summaryFromData(snapshot.id, snapshot.data(), 'owner');
      if (!summary.trashed) summaries.set(summary.treeId, summary);
    });

    const accessSnapshot = await getDocs(query(accessCollection, where('memberUid', '==', user.uid), where('status', '==', 'active')));
    for (const snapshot of accessSnapshot.docs) {
      const access = snapshot.data() as Partial<TreeAccess>;
      if (!access.treeId || summaries.has(access.treeId)) continue;
      const summarySnapshot = await getDoc(doc(this.authService.firestore, 'treeSummaries', access.treeId));
      if (!summarySnapshot.exists()) continue;
      const summary = this.summaryFromData(summarySnapshot.id, summarySnapshot.data(), access.role ?? 'viewer', access);
      if (!summary.trashed) summaries.set(summary.treeId, summary);
    }

    const sorted = [...summaries.values()].sort((a, b) => this.summarySortValue(b) - this.summarySortValue(a));
    this.treeSummariesSubject.next(sorted);
    return sorted;
  }

  async loadPublicTreeSummaries(): Promise<TreeSummary[]> {
    const summaryCollection = collection(this.authService.firestore, 'treeSummaries');
    const publicSnapshot = await getDocs(query(summaryCollection, where('visibility', '==', 'public')));
    return publicSnapshot.docs
      .map(snapshot => this.summaryFromData(snapshot.id, snapshot.data(), 'viewer'))
      .filter(summary => !summary.trashed)
      .sort((a, b) => this.summarySortValue(b) - this.summarySortValue(a))
      .slice(0, 20);
  }

  async openTree(summary: TreeSummary, options: { previewOnly?: boolean } = {}): Promise<TreeNode | null> {
    if (this.cloudSaveTimer) {
      clearTimeout(this.cloudSaveTimer);
      this.cloudSaveTimer = undefined;
    }

    let document: CloudTreeDocument;
    let effectiveSummary = summary;
    if (options.previewOnly && summary.visibility === 'public') {
      const view = await this.getPublicTreeView({ treeId: summary.treeId });
      document = {
        rootNode: view.rootNode,
        routeId: view.routeId,
        ownerUid: view.ownerUid,
        treeName: view.treeName,
        treeOwnerName: view.treeOwnerName,
        visibility: 'public',
        revision: view.revision
      };
      effectiveSummary = {
        ...summary,
        ownerUid: view.ownerUid,
        role: 'viewer',
        visibility: 'public'
      };
    } else if (!options.previewOnly && ['branchViewer', 'branchEditor'].includes(summary.role)) {
      const view = await this.getAuthorizedTreeView(summary.treeId);
      document = {
        rootNode: view.rootNode,
        routeId: view.routeId,
        ownerUid: view.ownerUid,
        treeName: view.treeName,
        treeOwnerName: view.treeOwnerName,
        visibility: view.visibility,
        revision: view.revision
      };
      effectiveSummary = {
        ...summary,
        ownerUid: view.ownerUid,
        role: view.role,
        visibility: view.visibility,
        branchRootId: view.branchRootId,
        branchRootName: view.branchRootName
      };
    } else {
      const treeSnapshot = await getDoc(this.getTreeDocRefFor(summary.ownerUid, summary.treeId));
      if (!treeSnapshot.exists()) return null;
      document = treeSnapshot.data() as CloudTreeDocument;
    }
    if (!document.rootNode || !this.isTreeNodeCandidate(document.rootNode)) return null;

    this.activeTreeId = effectiveSummary.treeId;
    this.setActiveRouteId(document.routeId ?? effectiveSummary.routeId ?? '');
    this.activeTreeOwnerUid = effectiveSummary.ownerUid;
    this.activeTreeIsPreviewOnly = options.previewOnly === true;
    this.activeTreeRevision = this.safeRevision(document.revision);
    this.setActiveAccessState(effectiveSummary.role, effectiveSummary.visibility);
    if (!this.activeTreeIsPreviewOnly) {
      localStorage.setItem(this.activeTreeIdStorageKey, this.activeTreeId);
    }

    const normalized = this.normalizeTree(document.rootNode);
    this.treeData.next(this.scopeTreeForRole(normalized, effectiveSummary));
    if (!this.activeTreeIsPreviewOnly) {
      this.persistToLocalStorage(this.treeData.value);
    }
    this.history = [];
    this.future = [];
    this.updateHistoryState();
    this.lastActionSubject.next(`Opened ${effectiveSummary.treeName}`);
    this.syncStatusSubject.next(this.activeTreeIsPreviewOnly ? 'local' : 'synced');
    return this.treeData.value;
  }

  openGeneratedTree(tree: TreeNode): TreeNode {
    if (this.cloudSaveTimer) {
      clearTimeout(this.cloudSaveTimer);
      this.cloudSaveTimer = undefined;
    }

    this.activeTreeIsPreviewOnly = true;
    this.activeTreeId = `generated-${this.slug(tree.treeName ?? tree.name)}`;
    this.setActiveRouteId('');
    this.activeTreeOwnerUid = null;
    this.activeTreeRevision = 0;
    this.setActiveAccessState('viewer', 'public');
    const normalized = this.normalizeTree(tree);
    this.treeData.next(normalized);
    this.history = [];
    this.future = [];
    this.updateHistoryState();
    this.lastActionSubject.next(`Opened ${tree.treeName ?? tree.name}`);
    this.syncStatusSubject.next('local');
    this.completeOnboarding();
    return this.treeData.value;
  }

  async loadTreeFromRouteId(routeId: string): Promise<TreeRouteLoadResult> {
    const normalizedRouteId = routeId.trim().toLowerCase();
    if (!this.isRouteId(normalizedRouteId)) return { status: 'notFound' };
    const user = this.authService.currentUser;
    if (!user) return { status: 'signInRequired' };

    try {
      const routeSnapshot = await getDoc(doc(this.authService.firestore, 'treeRoutes', normalizedRouteId));
      if (!routeSnapshot.exists()) return { status: 'notFound' };
      const routeData = routeSnapshot.data();
      const treeId = this.optionalString(routeData['treeId']);
      const ownerUid = this.optionalString(routeData['ownerUid']);
      if (!treeId || !ownerUid) return { status: 'notFound' };

      let role: TreeAccessRole = 'owner';
      let access: Partial<TreeAccess> | undefined;
      if (ownerUid !== user.uid) {
        const accessSnapshot = await getDoc(doc(
          this.authService.firestore,
          'treeAccess',
          this.accessDocId(user.uid, treeId)
        ));
        if (!accessSnapshot.exists()) return { status: 'forbidden' };
        const loadedAccess = this.accessFromData(accessSnapshot.id, accessSnapshot.data());
        if (loadedAccess.status !== 'active') return { status: 'forbidden' };
        role = loadedAccess.role;
        access = loadedAccess;
      }

      const summarySnapshot = await getDoc(doc(this.authService.firestore, 'treeSummaries', treeId));
      if (!summarySnapshot.exists()) return { status: 'notFound' };
      const summary = this.summaryFromData(treeId, summarySnapshot.data(), role, access);
      summary.routeId = normalizedRouteId;
      const tree = await this.openTree(summary);
      return { status: tree ? 'loaded' : 'notFound' };
    } catch (error) {
      console.error('Could not load tree route:', error);
      return { status: 'forbidden' };
    }
  }

  async createShareLink(request: ShareLinkRequest): Promise<ShareLinkRecord> {
    const user = this.authService.currentUser;
    if (!user) throw new Error('Sign in before sharing this tree.');
    if (!this.canShareCurrentTree) throw new Error('Only owners and co-owners can share this tree.');
    if (request.scope === 'branch' && !request.branchRootId) throw new Error('Choose a person before sharing a branch.');

    await this.saveCurrentTree();

    if (!request.isPublic) {
      const createInvite = httpsCallable<ShareLinkRequest & { treeId: string }, ShareLinkRecord>(
        this.authService.functions,
        'createTreeInvite'
      );
      const response = await createInvite({
        ...request,
        treeId: this.activeTreeId,
        isPublic: false
      });
      const share = response.data;
      if (!share?.code || !share.secret) throw new Error('The secure invitation could not be created.');
      await this.loadAccessibleTrees();
      return share;
    }

    const code = this.generateShareCode();
    const recipientEmail = this.normalizeEmail(request.recipientEmail);
    const visibility: TreeVisibility = request.isPublic ? 'public' : 'private';
    const status = request.isPublic ? 'active' : 'pending';
    const slug = request.isPublic
      ? await this.createPublicShareSlug(request.scope === 'branch' && request.branchRootName
        ? request.branchRootName
        : (this.treeData.value.treeName ?? this.treeData.value.name ?? 'family-tree'))
      : undefined;
    const share: ShareLinkRecord = {
      code,
      treeId: this.activeTreeId,
      ownerUid: this.activeTreeOwnerUid ?? user.uid,
      treeName: this.treeData.value.treeName ?? 'My Family',
      treeOwnerName: this.getTreeOwnerName(this.treeData.value),
      scope: request.scope,
      role: request.role,
      visibility,
      status,
      recipientEmail,
      slug,
      branchRootId: request.scope === 'branch' ? request.branchRootId : undefined,
      branchRootName: request.scope === 'branch' ? request.branchRootName : undefined,
      createdByUid: user.uid,
      createdByEmail: user.email ?? undefined
    };

    await setDoc(doc(this.authService.firestore, 'shares', code), this.withoutUndefined({
      ...share,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));

    if (request.isPublic) {
      await setDoc(doc(this.authService.firestore, 'publicSlugs', slug!), this.withoutUndefined({
        slug,
        code,
        treeId: this.activeTreeId,
        ownerUid: share.ownerUid,
        createdByUid: user.uid,
        visibility: 'public',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
      this.setActiveAccessState(this.activeTreeRole, 'public');
      await this.saveTreeToCloud(user.uid, this.treeData.value);
    }

    await this.loadAccessibleTrees();
    return share;
  }

  async getCurrentTreeShares(): Promise<ShareLinkRecord[]> {
    const user = this.authService.currentUser;
    if (!user) return [];
    const snapshot = await getDocs(query(collection(this.authService.firestore, 'shares'), where('treeId', '==', this.activeTreeId)));
    return snapshot.docs
      .map(document => this.shareFromData(document.id, document.data()))
      .filter(share => share.status !== 'cancelled')
      .sort((a, b) => (b.createdAtLabel ?? '').localeCompare(a.createdAtLabel ?? ''));
  }

  async getCurrentTreeAccess(): Promise<TreeAccess[]> {
    const user = this.authService.currentUser;
    if (!user) return [];
    const snapshot = await getDocs(query(collection(this.authService.firestore, 'treeAccess'), where('treeId', '==', this.activeTreeId)));
    return snapshot.docs
      .map(document => this.accessFromData(document.id, document.data()))
      .filter(access => access.status === 'active')
      .sort((a, b) => this.accessSortRank(a.role) - this.accessSortRank(b.role)
        || (a.memberEmail ?? '').localeCompare(b.memberEmail ?? ''));
  }

  async cancelShare(code: string): Promise<void> {
    const shareSnapshot = await getDoc(doc(this.authService.firestore, 'shares', code));
    const share = shareSnapshot.exists() ? this.shareFromData(code, shareSnapshot.data()) : null;
    await updateDoc(doc(this.authService.firestore, 'shares', code), {
      status: 'cancelled',
      updatedAt: serverTimestamp()
    });
    if (share?.slug) {
      await updateDoc(doc(this.authService.firestore, 'publicSlugs', share.slug), {
        status: 'cancelled',
        updatedAt: serverTimestamp()
      });
    }
  }

  async requestDeleteApproval(personId: string, personName: string): Promise<void> {
    const user = this.authService.currentUser;
    if (!user || this.activeTreeRole !== 'coOwner') return;
    const requestId = `${this.activeTreeId}_${personId}_${Date.now()}`;
    await setDoc(doc(this.authService.firestore, 'treeApprovals', requestId), this.withoutUndefined({
      requestId,
      treeId: this.activeTreeId,
      ownerUid: this.activeTreeOwnerUid ?? user.uid,
      requestedByUid: user.uid,
      requestedByEmail: user.email,
      type: 'delete_person',
      personId,
      personName,
      status: 'pending',
      createdAt: serverTimestamp()
    }));
  }

  async loadTreeFromShareCode(code: string): Promise<SharedTreeLoadResult> {
    let shareSnapshot;
    try {
      shareSnapshot = await getDoc(doc(this.authService.firestore, 'shares', code));
    } catch (error) {
      if (!this.authService.currentUser) return { status: 'signInRequired' };
      throw error;
    }
    if (!shareSnapshot.exists()) return { status: 'notFound' };

    const share = this.shareFromData(code, shareSnapshot.data());
    if (share.status === 'cancelled') return { status: 'cancelled', share };
    const isPublicShare = share.visibility === 'public';

    const user = this.authService.currentUser;
    if (!isPublicShare) {
      if (!user) return { status: 'signInRequired', share };
      if (share.recipientEmail && this.normalizeEmail(user.email) !== this.normalizeEmail(share.recipientEmail)) {
        return { status: 'forbidden', share };
      }
      await this.acceptShareForUser(share, user);
    }

    let document: CloudTreeDocument;
    if (isPublicShare) {
      const view = await this.getPublicTreeView({ shareCode: share.code });
      document = {
        rootNode: view.rootNode,
        routeId: view.routeId,
        ownerUid: view.ownerUid,
        treeName: view.treeName,
        treeOwnerName: view.treeOwnerName,
        visibility: 'public',
        revision: view.revision
      };
    } else if (['branchViewer', 'branchEditor'].includes(share.role)) {
      const view = await this.getAuthorizedTreeView(share.treeId);
      document = {
        rootNode: view.rootNode,
        routeId: view.routeId,
        ownerUid: view.ownerUid,
        visibility: view.visibility,
        revision: view.revision
      };
    } else {
      const treeSnapshot = await getDoc(this.getTreeDocRefFor(share.ownerUid, share.treeId));
      if (!treeSnapshot.exists()) return { status: 'notFound', share };
      document = treeSnapshot.data() as CloudTreeDocument;
    }
    if (!document.rootNode || !this.isTreeNodeCandidate(document.rootNode)) return { status: 'notFound', share };

    this.activeTreeId = share.treeId;
    this.setActiveRouteId(document.routeId ?? '');
    this.activeTreeOwnerUid = share.ownerUid;
    this.activeTreeRevision = this.safeRevision(document.revision);
    this.setActiveAccessState(share.role, share.visibility);
    if (!isPublicShare) {
      localStorage.setItem(this.activeTreeIdStorageKey, this.activeTreeId);
    }

    const normalized = this.normalizeTree(document.rootNode);
    const scoped = this.scopeTreeForShare(normalized, share);
    this.treeData.next(isPublicShare ? this.sanitizePublicTree(scoped) : scoped);
    if (isPublicShare) {
      this.onboardingNeededSubject.next(false);
    } else {
      this.persistToLocalStorage(this.treeData.value);
      this.completeOnboarding();
    }
    this.history = [];
    this.future = [];
    this.updateHistoryState();
    this.lastActionSubject.next(`Opened shared tree`);
    this.syncStatusSubject.next(isPublicShare ? 'local' : 'synced');
    return { status: 'loaded', share };
  }

  async getSecureInvitePreview(inviteId: string, secret: string): Promise<SharedTreeLoadResult> {
    const getPreview = httpsCallable<
      { inviteId: string; secret: string },
      SecureInviteFunctionResponse
    >(this.authService.functions, 'getTreeInvitePreview');
    const response = await getPreview({ inviteId, secret });
    return {
      status: response.data.status,
      share: response.data.share,
      alreadyClaimed: response.data.alreadyClaimed
    };
  }

  async claimSecureInvite(inviteId: string, secret: string): Promise<SharedTreeLoadResult> {
    const claimInvite = httpsCallable<
      { inviteId: string; secret: string },
      SecureInviteFunctionResponse
    >(this.authService.functions, 'claimTreeInvite');
    const response = await claimInvite({ inviteId, secret });
    const result = response.data;
    const share = result.share;
    if (result.status !== 'loaded' || !share || !result.rootNode || !this.isTreeNodeCandidate(result.rootNode)) {
      return { status: result.status ?? 'unavailable', share };
    }

    this.activeTreeId = share.treeId;
    this.setActiveRouteId(result.routeId ?? '');
    this.activeTreeOwnerUid = result.ownerUid ?? share.ownerUid;
    this.activeTreeRevision = this.safeRevision(result.revision);
    this.activeTreeIsPreviewOnly = false;
    this.setActiveAccessState(result.role ?? share.role, result.visibility ?? 'private');
    localStorage.setItem(this.activeTreeIdStorageKey, this.activeTreeId);

    const normalized = this.normalizeTree(result.rootNode);
    this.treeData.next(normalized);
    this.persistToLocalStorage(normalized);
    this.completeOnboarding();
    this.history = [];
    this.future = [];
    this.updateHistoryState();
    this.lastActionSubject.next(`Joined ${share.branchRootName ? share.branchRootName + "'s branch" : share.treeName}`);
    this.syncStatusSubject.next('synced');
    await this.loadAccessibleTrees();
    return { status: 'loaded', share };
  }

  async loadTreeFromPublicSlug(slug: string): Promise<SharedTreeLoadResult> {
    const normalizedSlug = this.slug(slug.replace(/,+$/g, ''));
    if (!normalizedSlug) return { status: 'notFound' };

    let slugSnapshot;
    try {
      slugSnapshot = await getDoc(doc(this.authService.firestore, 'publicSlugs', normalizedSlug));
    } catch (error) {
      console.warn('Could not read public slug pointer:', error);
      return { status: 'notFound' };
    }
    if (!slugSnapshot.exists()) return { status: 'notFound' };

    const data = slugSnapshot.data();
    if (data['status'] === 'cancelled') return { status: 'cancelled' };
    const code = this.optionalString(data['code']);
    if (!code) return { status: 'notFound' };

    return this.loadTreeFromShareCode(code);
  }

  loadGeneratedPublicTreeFromSlug(slug: string): SharedTreeLoadResult {
    const normalizedSlug = this.slug(slug.replace(/,+$/g, ''));
    if (!['karunanidhi', 'karunanidhi-family'].includes(normalizedSlug)) return { status: 'notFound' };
    this.openGeneratedTree(this.createGeneratedKarunanidhiTree());
    return { status: 'loaded' };
  }

  async loadPublicTreeFromSlug(slug: string): Promise<SharedTreeLoadResult> {
    const normalizedSlug = this.slug(slug.replace(/,+$/g, ''));
    const summaries = await this.loadPublicTreeSummaries();
    const summary = summaries.find(candidate => this.publicSummarySlugs(candidate).includes(normalizedSlug));
    if (!summary) return { status: 'notFound' };

    const tree = await this.openTree(summary, { previewOnly: true });
    if (!tree) return { status: 'notFound' };
    return { status: 'loaded' };
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

  private aiPersonData(operation: AiFamilyOperation): Omit<TreeNode, 'id' | 'spouse' | 'children'> {
    const fields = operation.fields;
    const name = fields.name.trim();
    if (!name) throw new Error('A new person needs a name.');

    const birthDate = this.aiDate(fields.birthDate, 'Birth date');
    const deathDate = this.aiDate(fields.deathDate, 'Death date');
    const age = fields.age === null ? this.calculateAge(birthDate) : this.aiAge(fields.age);
    const gender = fields.gender === 'unspecified' ? Gender.OTHER : fields.gender;

    return {
      name,
      age,
      gender,
      isAlive: fields.isAlive ?? !deathDate,
      location: fields.location.trim(),
      email: this.aiEmail(fields.email),
      type: operation.relation === 'spouse' ? 'spouse' : 'blood',
      alternateNames: this.stringArray(fields.alternateNames),
      birthDate,
      deathDate,
      birthPlace: this.optionalString(fields.birthPlace),
      notes: this.optionalString(fields.notes),
      tags: this.stringArray(fields.tags),
      parentRelationshipType: operation.relation === 'child'
        ? (fields.parentRelationshipType === 'unspecified' ? 'biological_parent' : fields.parentRelationshipType)
        : undefined,
      partnerRelationshipType: operation.relation === 'spouse'
        ? (fields.partnerRelationshipType === 'unspecified' ? 'partner' : fields.partnerRelationshipType)
        : undefined,
      relationshipStartDate: this.aiDate(fields.relationshipStartDate, 'Relationship start date'),
      relationshipEndDate: this.aiDate(fields.relationshipEndDate, 'Relationship end date')
    };
  }

  private aiPersonUpdates(
    operation: AiFamilyOperation,
    target: TreeNode
  ): Partial<Omit<TreeNode, 'id' | 'spouse' | 'children'>> {
    const fields = new Set(operation.providedFields);
    const values: AiPersonFields = operation.fields;
    const updates: Partial<Omit<TreeNode, 'id' | 'spouse' | 'children'>> = {};

    if (!fields.size) throw new Error(`No updates were supplied for ${target.name}.`);
    if (fields.has('name')) {
      const name = values.name.trim();
      if (!name) throw new Error('A person name cannot be blank.');
      updates.name = name;
    }
    if (fields.has('age')) {
      if (values.age === null) throw new Error('Age must be a number.');
      updates.age = this.aiAge(values.age);
    }
    if (fields.has('gender')) {
      if (values.gender === 'unspecified') throw new Error('Gender was not specified.');
      updates.gender = values.gender;
    }
    if (fields.has('isAlive')) {
      if (values.isAlive === null) throw new Error('Living status was not specified.');
      updates.isAlive = values.isAlive;
    }
    if (fields.has('location')) updates.location = values.location.trim();
    if (fields.has('email')) updates.email = this.aiEmail(values.email);
    if (fields.has('alternateNames')) updates.alternateNames = this.stringArray(values.alternateNames);
    if (fields.has('birthDate')) {
      updates.birthDate = this.aiDate(values.birthDate, 'Birth date');
      if (!fields.has('age')) updates.age = this.calculateAge(updates.birthDate);
    }
    if (fields.has('deathDate')) {
      updates.deathDate = this.aiDate(values.deathDate, 'Death date');
      if (updates.deathDate && !fields.has('isAlive')) updates.isAlive = false;
    }
    if (fields.has('birthPlace')) updates.birthPlace = this.optionalString(values.birthPlace);
    if (fields.has('notes')) updates.notes = this.optionalString(values.notes);
    if (fields.has('tags')) updates.tags = this.stringArray(values.tags);
    if (fields.has('parentRelationshipType')) {
      if (values.parentRelationshipType === 'unspecified') throw new Error('Parent relationship was not specified.');
      updates.parentRelationshipType = values.parentRelationshipType;
    }
    if (fields.has('partnerRelationshipType')) {
      if (values.partnerRelationshipType === 'unspecified') throw new Error('Partner relationship was not specified.');
      updates.partnerRelationshipType = values.partnerRelationshipType;
    }
    if (fields.has('relationshipStartDate')) {
      updates.relationshipStartDate = this.aiDate(values.relationshipStartDate, 'Relationship start date');
    }
    if (fields.has('relationshipEndDate')) {
      updates.relationshipEndDate = this.aiDate(values.relationshipEndDate, 'Relationship end date');
    }
    return updates;
  }

  private deleteFromTree(root: TreeNode, nodeId: string): TreeNode | null {
    if (root.id === nodeId) return null;
    return {
      ...root,
      spouse: root.spouse?.id === nodeId ? null : root.spouse,
      children: root.children
        .map(child => this.deleteFromTree(child, nodeId))
        .filter((child): child is TreeNode => child !== null)
    };
  }

  private aiAge(value: number): number {
    if (!Number.isInteger(value) || value < 0 || value > 130) {
      throw new Error('Age must be a whole number from 0 to 130.');
    }
    return value;
  }

  private aiDate(value: string, label: string): string | undefined {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (!match) throw new Error(`${label} must use YYYY-MM-DD.`);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error(`${label} is not a valid date.`);
    }
    return trimmed;
  }

  private aiEmail(value: string): string | undefined {
    const email = value.trim();
    if (!email) return undefined;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email address is not valid.');
    return email;
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
    this.persistToLocalStorage(this.treeData.value);
    if (this.activeTreeIsPreviewOnly) {
      this.syncStatusSubject.next('local');
      return;
    }
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
    const saved = localStorage.getItem(this.getLocalTreeStorageKey())
      ?? (this.activeTreeId === 'default' ? localStorage.getItem(this.localStorageKey) : null);
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
      this.treeSummariesSubject.next([]);
      return;
    }

    try {
      await this.saveUserProfile(user);
      await this.loadAccessibleTrees();
      if (this.activeTreeIsPreviewOnly) {
        this.syncStatusSubject.next('local');
        return;
      }
      if (this.isRouteOpeningPath()) {
        this.syncStatusSubject.next('synced');
        return;
      }
      this.activeTreeOwnerUid = this.activeTreeOwnerUid ?? user.uid;
      const snapshot = await getDoc(this.getTreeDocRef(user.uid));
      if (snapshot.exists()) {
        const cloudTree = snapshot.data() as CloudTreeDocument;
        this.setActiveRouteId(cloudTree.routeId ?? '');
        this.activeTreeOwnerUid = cloudTree.ownerUid ?? user.uid;
        this.activeTreeRevision = this.safeRevision(cloudTree.revision);
        this.setActiveAccessState(this.activeTreeOwnerUid === user.uid ? 'owner' : this.activeTreeRole, cloudTree.visibility ?? 'private');
        if (cloudTree.rootNode && this.isTreeNodeCandidate(cloudTree.rootNode)) {
          const normalized = this.normalizeTree(cloudTree.rootNode);
          this.treeData.next(normalized);
          this.persistToLocalStorage(normalized);
          this.completeOnboarding();
          this.history = [];
          this.future = [];
          this.updateHistoryState();
          if (!cloudTree.routeId) await this.saveTreeToCloud(user.uid, normalized);
          this.syncStatusSubject.next('synced');
          return;
        }
      }

      await this.saveTreeToCloud(user.uid, this.treeData.value);
      await this.loadAccessibleTrees();
      this.syncStatusSubject.next('synced');
    } catch (error) {
      console.error('Failed to sync family tree with Firestore:', error);
      this.syncStatusSubject.next('error');
    }
  }

  private getTreeDocRef(uid: string) {
    return this.getTreeDocRefFor(this.activeTreeOwnerUid ?? uid, this.activeTreeId);
  }

  private isRouteOpeningPath(): boolean {
    return /^\/(?:[tb]\/[A-Z0-9]+|i\/[A-Za-z0-9_-]{16,64}\/[A-Za-z0-9_-]{32,128}|tree\/[a-f0-9]{4}(?:-[a-f0-9]{4}){3})\/?$/i.test(window.location.pathname);
  }

  private getTreeDocRefFor(ownerUid: string, treeId: string) {
    return doc(this.authService.firestore, 'users', ownerUid, 'trees', treeId);
  }

  private async getAuthorizedTreeView(treeId: string): Promise<TreeAccessViewResponse> {
    const getTreeView = httpsCallable<{ treeId: string }, TreeAccessViewResponse>(
      this.authService.functions,
      'getTreeAccessView'
    );
    const response = await getTreeView({ treeId });
    if (response.data.status !== 'loaded' || !this.isTreeNodeCandidate(response.data.rootNode)) {
      throw new Error('The shared branch could not be loaded safely.');
    }
    return response.data;
  }

  private async getPublicTreeView(input: { shareCode?: string; treeId?: string }): Promise<TreeAccessViewResponse> {
    const getTreeView = httpsCallable<typeof input, TreeAccessViewResponse>(
      this.authService.functions,
      'getPublicTreeView'
    );
    const response = await getTreeView(input);
    if (response.data.status !== 'loaded' || response.data.visibility !== 'public'
      || !this.isTreeNodeCandidate(response.data.rootNode)) {
      throw new Error('The public family tree could not be loaded safely.');
    }
    return response.data;
  }

  private async saveTreeToCloud(uid: string, rootNode: TreeNode): Promise<void> {
    if (this.activeTreeRole === 'branchEditor') {
      const saveBranch = httpsCallable<
        { treeId: string; rootNode: TreeNode; expectedRevision: number },
        { status: 'saved'; revision: number; personCount: number }
      >(this.authService.functions, 'saveTreeBranch');
      const response = await saveBranch({
        treeId: this.activeTreeId,
        rootNode: JSON.parse(JSON.stringify(rootNode)) as TreeNode,
        expectedRevision: this.activeTreeRevision
      });
      this.activeTreeRevision = this.safeRevision(response.data.revision);
      return;
    }
    if (!['owner', 'coOwner'].includes(this.activeTreeRole)) {
      throw new Error('This tree is view-only for you.');
    }

    const ownerUid = this.activeTreeOwnerUid ?? uid;
    this.activeTreeOwnerUid = ownerUid;
    const routeId = await this.ensureTreeRoute(ownerUid);
    const sanitizedRoot = JSON.parse(JSON.stringify(rootNode)) as TreeNode;
    const treeRef = this.getTreeDocRef(uid);
    this.activeTreeRevision = await runTransaction(this.authService.firestore, async transaction => {
      const snapshot = await transaction.get(treeRef);
      const current = snapshot.exists() ? snapshot.data() as CloudTreeDocument : undefined;
      const revision = this.safeRevision(current?.revision) + 1;
      transaction.set(treeRef, {
        schemaVersion: 4,
        revision,
        treeId: this.activeTreeId,
        routeId,
        ownerUid,
        visibility: this.activeTreeVisibility,
        treeName: rootNode.treeName ?? 'My Family',
        treeOwnerName: this.getTreeOwnerName(rootNode),
        rootNode: sanitizedRoot,
        personCount: this.getPersonIndex().length,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return revision;
    });

    await setDoc(doc(this.authService.firestore, 'treeSummaries', this.activeTreeId), {
      treeId: this.activeTreeId,
      routeId,
      ownerUid,
      ...(ownerUid === this.authService.currentUser?.uid ? { ownerEmail: this.authService.currentUser?.email } : {}),
      treeName: rootNode.treeName ?? 'My Family',
      treeOwnerName: this.getTreeOwnerName(rootNode),
      visibility: this.activeTreeVisibility,
      personCount: this.getPersonIndex().length,
      trashed: false,
      updatedAt: serverTimestamp()
    }, { merge: true });

    const user = this.authService.currentUser;
    if (user) {
      await setDoc(doc(this.authService.firestore, 'treeAccess', this.accessDocId(user.uid, this.activeTreeId)), {
        treeId: this.activeTreeId,
        ownerUid,
        memberUid: user.uid,
        memberEmail: user.email,
        role: ownerUid === user.uid ? 'owner' : this.activeTreeRole,
        scope: 'tree',
        status: 'active',
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  }

  private setActiveAccessState(role: TreeAccessRole, visibility: TreeVisibility): void {
    this.activeTreeRole = role;
    this.activeTreeVisibility = visibility;
    this.activeRoleSubject.next(role);
    this.activeVisibilitySubject.next(visibility);
  }

  private setActiveRouteId(routeId: string): void {
    this.activeTreeRouteId = this.isRouteId(routeId) ? routeId.toLowerCase() : '';
    const storageKey = `${this.treeRouteStoragePrefix}${this.activeTreeId}`;
    if (this.activeTreeRouteId) localStorage.setItem(storageKey, this.activeTreeRouteId);
    else localStorage.removeItem(storageKey);
    this.activeRouteIdSubject.next(this.activeTreeRouteId);
  }

  private summaryFromData(treeId: string, data: Record<string, unknown>, role: TreeAccessRole, access?: Partial<TreeAccess>): TreeSummary {
    const source: TreeSummary['source'] = role === 'owner'
      ? 'created'
      : role === 'coOwner'
        ? 'coOwned'
        : 'shared';
    return {
      treeId,
      routeId: this.optionalString(data['routeId']),
      treeName: this.optionalString(data['treeName']) ?? 'Untitled family tree',
      treeOwnerName: this.optionalString(data['treeOwnerName']) ?? 'Unknown owner',
      ownerUid: this.optionalString(data['ownerUid']) ?? access?.ownerUid ?? '',
      ownerEmail: this.optionalString(data['ownerEmail']),
      role,
      visibility: data['visibility'] === 'public' ? 'public' : 'private',
      source,
      personCount: Number(data['personCount'] ?? 0),
      updatedAtLabel: this.formatFirestoreDate(data['updatedAt']),
      branchRootId: access?.branchRootId,
      branchRootName: access?.branchRootName,
      trashed: data['trashed'] === true
    };
  }

  private shareFromData(code: string, data: Record<string, unknown>): ShareLinkRecord {
    const scope = data['scope'] === 'branch' ? 'branch' : 'tree';
    const role = this.shareRole(data['role']);
    return {
      code,
      secureInvite: data['tokenVersion'] === 2,
      treeId: this.optionalString(data['treeId']) ?? '',
      ownerUid: this.optionalString(data['ownerUid']) ?? '',
      treeName: this.optionalString(data['treeName']) ?? 'Shared family tree',
      treeOwnerName: this.optionalString(data['treeOwnerName']) ?? 'Family owner',
      scope,
      role,
      visibility: data['visibility'] === 'public' ? 'public' : 'private',
      status: this.shareStatus(data['status']),
      recipientEmail: this.optionalString(data['recipientEmail']),
      slug: this.optionalString(data['slug']),
      branchRootId: this.optionalString(data['branchRootId']),
      branchRootName: this.optionalString(data['branchRootName']),
      inviterName: this.optionalString(data['inviterName']),
      expiresAtLabel: data['expiresAt'] ? this.formatFirestoreDate(data['expiresAt']) : undefined,
      maxClaims: Number.isInteger(data['maxClaims']) ? Number(data['maxClaims']) : undefined,
      acceptedCount: Number.isInteger(data['acceptedCount']) ? Number(data['acceptedCount']) : undefined,
      createdByUid: this.optionalString(data['createdByUid']),
      createdByEmail: this.optionalString(data['createdByEmail']),
      createdAtLabel: this.formatFirestoreDate(data['createdAt']),
      updatedAtLabel: this.formatFirestoreDate(data['updatedAt'])
    };
  }

  private accessFromData(accessId: string, data: Record<string, unknown>): TreeAccess {
    const status = data['status'] === 'pending' || data['status'] === 'removed' ? data['status'] : 'active';
    return {
      accessId,
      treeId: this.optionalString(data['treeId']) ?? '',
      ownerUid: this.optionalString(data['ownerUid']) ?? '',
      memberUid: this.optionalString(data['memberUid']),
      memberEmail: this.optionalString(data['memberEmail']),
      role: this.shareRole(data['role']),
      scope: data['scope'] === 'branch' ? 'branch' : 'tree',
      branchRootId: this.optionalString(data['branchRootId']),
      branchRootName: this.optionalString(data['branchRootName']),
      sourceShareCode: this.optionalString(data['sourceShareCode']),
      status,
      acceptedAtLabel: data['acceptedAt'] ? this.formatFirestoreDate(data['acceptedAt']) : undefined,
      updatedAtLabel: data['updatedAt'] ? this.formatFirestoreDate(data['updatedAt']) : undefined
    };
  }

  private async acceptShareForUser(share: ShareLinkRecord, user: AuthUser): Promise<void> {
    await setDoc(doc(this.authService.firestore, 'treeAccess', this.accessDocId(user.uid, share.treeId)), this.withoutUndefined({
      treeId: share.treeId,
      ownerUid: share.ownerUid,
      memberUid: user.uid,
      memberEmail: user.email,
      role: share.role,
      scope: share.scope,
      branchRootId: share.branchRootId,
      branchRootName: share.branchRootName,
      sourceShareCode: share.code,
      status: 'active',
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }), { merge: true });

    if (share.status === 'pending') {
      await updateDoc(doc(this.authService.firestore, 'shares', share.code), {
        status: 'accepted',
        acceptedByUid: user.uid,
        acceptedByEmail: user.email,
        updatedAt: serverTimestamp()
      });
    }
  }

  private scopeTreeForShare(root: TreeNode, share: ShareLinkRecord): TreeNode {
    if (share.scope !== 'branch' || !share.branchRootId) return root;
    const branchRoot = this.findNode(root, share.branchRootId);
    return this.clone(branchRoot ?? root);
  }

  private scopeTreeForRole(root: TreeNode, summary: TreeSummary): TreeNode {
    if (!summary.branchRootId || !['branchViewer', 'branchEditor'].includes(summary.role)) return root;
    const branchRoot = this.findNode(root, summary.branchRootId);
    return this.clone(branchRoot ?? root);
  }

  private sanitizePublicTree(root: TreeNode): TreeNode {
    const sanitize = (node: TreeNode): TreeNode => {
      const sanitizedChildren = node.children.map(sanitize);
      const sanitizedSpouse = node.spouse ? sanitize(node.spouse) : null;
      if (!node.isAlive) {
        return { ...node, spouse: sanitizedSpouse, children: sanitizedChildren };
      }

      return {
        ...node,
        age: 0,
        email: undefined,
        location: '',
        birthDate: undefined,
        deathDate: undefined,
        birthPlace: undefined,
        photoUrl: undefined,
        notes: undefined,
        stories: [],
        events: [],
        spouse: sanitizedSpouse,
        children: sanitizedChildren
      };
    };

    return sanitize(root);
  }

  private summarySortValue(summary: TreeSummary): number {
    const parsed = Date.parse(summary.updatedAtLabel);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private accessSortRank(role: TreeAccessRole): number {
    if (role === 'owner') return 0;
    if (role === 'coOwner') return 1;
    if (role === 'branchEditor') return 2;
    if (role === 'branchViewer') return 3;
    return 4;
  }

  private slug(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'tree';
  }

  private async createPublicShareSlug(label: string): Promise<string> {
    const baseSlug = this.slug(label);
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
      const existing = await getDoc(doc(this.authService.firestore, 'publicSlugs', candidate));
      if (!existing.exists() || existing.data()['status'] === 'cancelled') return candidate;
    }
    return `${baseSlug}-${Date.now().toString(36)}`;
  }

  private publicSummarySlugs(summary: TreeSummary): string[] {
    const treeNameSlug = this.slug(summary.treeName);
    const withoutFamily = this.slug(summary.treeName.replace(/\bfamily\b/gi, ''));
    return Array.from(new Set([treeNameSlug, withoutFamily].filter(Boolean)));
  }

  private createGeneratedKarunanidhiTree(): TreeNode {
    const root = this.generatedPublicPerson('generated-karunanidhi', 'M. Karunanidhi', Gender.MALE, {
      treeName: 'Karunanidhi Family',
      treeOwnerName: 'Computer Generated',
      birthDate: '1924-06-03',
      isAlive: false,
      photoUrl: this.commonsImage('Kalaignar_M._Karunanidhi.jpg'),
      notes: 'Computer-generated public preview from widely known family details. Please verify before publishing as a source-backed record.'
    });
    root.children = [
      this.generatedPublicPerson('generated-mk-muthu', 'M. K. Muthu', Gender.MALE, { parentRelationshipType: 'biological_parent' }),
      this.generatedPublicPerson('generated-mk-alagiri', 'M. K. Alagiri', Gender.MALE, { parentRelationshipType: 'biological_parent' }),
      this.generatedPublicPerson('generated-mk-stalin', 'M. K. Stalin', Gender.MALE, {
        parentRelationshipType: 'biological_parent',
        birthDate: '1953-03-01',
        photoUrl: this.commonsImage('Mkspicture.jpg')
      }),
      this.generatedPublicPerson('generated-selvi-karunanidhi', 'Selvi', Gender.FEMALE, { parentRelationshipType: 'biological_parent' }),
      this.generatedPublicPerson('generated-mk-tamilarasu', 'M. K. Tamilarasu', Gender.MALE, { parentRelationshipType: 'biological_parent' }),
      this.generatedPublicPerson('generated-kanimozhi', 'Kanimozhi Karunanidhi', Gender.FEMALE, { parentRelationshipType: 'biological_parent' })
    ];
    return root;
  }

  private generatedPublicPerson(id: string, name: string, gender: Gender, extra: Partial<TreeNode> = {}): TreeNode {
    return {
      id,
      treeName: extra.treeName,
      treeOwnerName: extra.treeOwnerName,
      name,
      gender,
      age: extra.age ?? 0,
      location: extra.location ?? '',
      isAlive: extra.isAlive ?? true,
      type: extra.type ?? 'blood',
      spouse: extra.spouse ?? null,
      children: extra.children ?? [],
      alternateNames: extra.alternateNames ?? [],
      tags: ['Computer Generated', 'Publicly known', 'Verify before publishing', ...(extra.tags ?? [])],
      stories: extra.stories ?? [],
      events: extra.events ?? [],
      parentRelationshipType: extra.parentRelationshipType ?? 'biological_parent',
      partnerRelationshipType: extra.partnerRelationshipType,
      birthDate: extra.birthDate,
      deathDate: extra.deathDate,
      birthPlace: extra.birthPlace,
      photoUrl: extra.photoUrl,
      notes: extra.notes,
      socialProfiles: extra.socialProfiles ?? []
    };
  }

  private commonsImage(fileName: string): string {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=640`;
  }

  private accessDocId(uid: string, treeId: string): string {
    return `${uid}_${treeId}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private async ensureTreeRoute(ownerUid: string): Promise<string> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const routeId = attempt === 0 && this.activeTreeRouteId
        ? this.activeTreeRouteId
        : this.generateRouteId();
      const routeRef = doc(this.authService.firestore, 'treeRoutes', routeId);
      const existing = await getDoc(routeRef);
      if (existing.exists()) {
        const data = existing.data();
        if (data['treeId'] === this.activeTreeId && data['ownerUid'] === ownerUid) {
          this.setActiveRouteId(routeId);
          return routeId;
        }
        continue;
      }

      try {
        await setDoc(routeRef, {
          routeId,
          treeId: this.activeTreeId,
          ownerUid,
          createdAt: serverTimestamp()
        });
        this.setActiveRouteId(routeId);
        return routeId;
      } catch (error) {
        if (attempt === 5) throw error;
      }
    }
    throw new Error('Could not create a unique tree URL. Please try saving again.');
  }

  private isRouteId(value: string): boolean {
    return /^[a-f0-9]{4}(?:-[a-f0-9]{4}){3}$/i.test(value);
  }

  private generateRouteId(): string {
    const bytes = new Uint8Array(8);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    return hex.match(/.{4}/g)?.join('-') ?? hex;
  }

  private generateShareCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const values = new Uint32Array(8);
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(values);
      values.forEach(value => code += alphabet[value % alphabet.length]);
      return code;
    }
    for (let index = 0; index < 8; index += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }

  private safeRevision(value: unknown): number {
    return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : 0;
  }

  private shareRole(value: unknown): TreeAccessRole {
    const roles: TreeAccessRole[] = ['owner', 'coOwner', 'viewer', 'branchViewer', 'branchEditor'];
    return typeof value === 'string' && roles.includes(value as TreeAccessRole)
      ? value as TreeAccessRole
      : 'viewer';
  }

  private shareStatus(value: unknown): ShareLinkRecord['status'] {
    const statuses: ShareLinkRecord['status'][] = ['active', 'pending', 'accepted', 'cancelled'];
    return typeof value === 'string' && statuses.includes(value as ShareLinkRecord['status'])
      ? value as ShareLinkRecord['status']
      : 'active';
  }

  private normalizeEmail(value?: string | null): string | undefined {
    return value?.trim().toLowerCase() || undefined;
  }

  private formatFirestoreDate(value: unknown): string {
    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      const date = value.toDate() as Date;
      return date.toISOString();
    }
    if (typeof value === 'string') return value;
    return new Date().toISOString();
  }

  private withoutUndefined<T extends Record<string, unknown>>(data: T): T {
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    ) as T;
  }

  private getLocalTreeStorageKey(treeId = this.activeTreeId): string {
    return `${this.localStorageKey}:${treeId}`;
  }

  private persistToLocalStorage(tree: TreeNode): void {
    const serialized = JSON.stringify(tree);
    localStorage.setItem(this.getLocalTreeStorageKey(), serialized);
    if (this.activeTreeId === 'default') {
      localStorage.setItem(this.localStorageKey, serialized);
    }
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
        treeOwnerName: isRoot
          ? (this.optionalString(candidate.treeOwnerName) ?? this.getCurrentOwnerName() ?? candidate.name ?? 'You')
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
        socialProfiles: this.socialProfiles(candidate.socialProfiles),
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
    normalized.treeOwnerName = this.getTreeOwnerName(normalized);
    normalized.relationshipRecords = this.buildRelationshipRecords(normalized);
    return normalized;
  }

  private getTreeOwnerName(rootNode: TreeNode): string {
    return this.optionalString(rootNode.treeOwnerName)
      ?? this.getCurrentOwnerName()
      ?? this.optionalString(rootNode.name)
      ?? 'You';
  }

  private getCurrentOwnerName(): string | undefined {
    const user = this.authService.currentUser;
    return user?.displayName?.trim() || user?.email?.trim() || undefined;
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

  private findParentFamily(node: TreeNode, childId: string): TreeNode | null {
    if (node.children.some(child => child.id === childId)) return node;
    for (const child of node.children) {
      const found = this.findParentFamily(child, childId);
      if (found) return found;
    }
    return null;
  }

  private siblingLabel(person: TreeNode, personIndex: number, sibling: TreeNode, siblingIndex: number): string {
    const siblingType = sibling.gender === Gender.MALE
      ? 'brother'
      : sibling.gender === Gender.FEMALE
        ? 'sister'
        : 'sibling';
    const order = this.siblingOrder(person, personIndex, sibling, siblingIndex);
    if (order === 'same') return `Twin ${siblingType}`;
    if (order === 'elder') return `Elder ${siblingType}`;
    if (order === 'younger') return `Younger ${siblingType}`;
    return siblingType.charAt(0).toUpperCase() + siblingType.slice(1);
  }

  private siblingOrder(
    person: TreeNode,
    personIndex: number,
    sibling: TreeNode,
    siblingIndex: number
  ): 'elder' | 'younger' | 'same' | 'unknown' {
    const personDate = this.isoDateValue(person.birthDate);
    const siblingDate = this.isoDateValue(sibling.birthDate);
    if (personDate && siblingDate) {
      if (siblingDate < personDate) return 'elder';
      if (siblingDate > personDate) return 'younger';
      return 'same';
    }
    if (siblingIndex < personIndex) return 'elder';
    if (siblingIndex > personIndex) return 'younger';
    return 'unknown';
  }

  private isoDateValue(value?: string): string | null {
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
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

  private socialProfiles(value: unknown): SocialProfile[] {
    if (!Array.isArray(value)) return [];

    const allowedPlatforms = new Set<string>(SOCIAL_PLATFORMS);
    const seenPlatforms = new Set<string>();
    return value
      .filter((profile): profile is Record<string, unknown> => Boolean(profile) && typeof profile === 'object')
      .map(profile => ({
        platform: typeof profile['platform'] === 'string' ? profile['platform'].toLowerCase() : '',
        handle: this.optionalString(profile['handle']),
        isPublic: profile['isPublic'] === true
      }))
      .filter(profile => {
        if (!allowedPlatforms.has(profile.platform) || !profile.handle || seenPlatforms.has(profile.platform)) {
          return false;
        }
        seenPlatforms.add(profile.platform);
        return true;
      })
      .map(profile => ({
        platform: profile.platform as SocialProfile['platform'],
        handle: profile.handle as string,
        isPublic: profile.isPublic
      }));
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
