import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { Observable, Subject, takeUntil } from 'rxjs';
import { TreeService, SyncStatus } from './services/tree.service';
import { AuthService, AuthUser } from './services/auth.service';
import { GooglePlacesService } from './services/google-places.service';
import { MediaService } from './services/media.service';
import { GedcomImportPreview, GedcomService } from './services/gedcom.service';
import {
  ActionType,
  FormData,
  Gender,
  GuidedTreeInput,
  LifeEventType,
  ParentRelationshipType,
  PartnerRelationshipType,
  PersonIndexEntry,
  TimelineEntry,
  TreeNode
} from './models/tree-node.model';
import { TreeNodeComponent } from './components/tree-node.component';
import { OnboardingComponent } from './components/onboarding.component';
import { PersonProfileComponent } from './components/person-profile.component';

type WorkspaceView = 'tree' | 'timeline';
type ToolsTab = 'import' | 'bulk';
type MissingFilter = '' | 'birthDate' | 'location' | 'photo' | 'stories';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    TreeNodeComponent,
    OnboardingComponent,
    PersonProfileComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('containerRef') containerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('locationInput') locationInput?: ElementRef<HTMLInputElement>;

  readonly user$: Observable<AuthUser | null>;
  readonly parentRelationshipOptions: Array<{ value: ParentRelationshipType; label: string }> = [
    { value: 'biological_parent', label: 'Biological parent' },
    { value: 'adoptive_parent', label: 'Adoptive parent' },
    { value: 'step_parent', label: 'Step-parent' },
    { value: 'guardian', label: 'Guardian' },
    { value: 'unknown_parent', label: 'Unknown parent' }
  ];
  readonly partnerRelationshipOptions: Array<{ value: PartnerRelationshipType; label: string }> = [
    { value: 'spouse', label: 'Spouse' },
    { value: 'partner', label: 'Partner' },
    { value: 'former_spouse', label: 'Former spouse' }
  ];
  readonly timelineTypeOptions: Array<{ value: LifeEventType | ''; label: string }> = [
    { value: '', label: 'All events' },
    { value: 'birth', label: 'Births' },
    { value: 'marriage', label: 'Relationships' },
    { value: 'death', label: 'Deaths' },
    { value: 'migration', label: 'Migrations' },
    { value: 'residence', label: 'Residences' },
    { value: 'education', label: 'Education' },
    { value: 'career', label: 'Careers' },
    { value: 'custom', label: 'Custom' }
  ];

  treeData: TreeNode | null = null;
  treeName = 'My Family';
  treeNameDraft = 'My Family';
  editingTreeName = false;
  personIndex: PersonIndexEntry[] = [];
  filteredPeople: PersonIndexEntry[] = [];
  generationOptions: number[] = [];
  selectedPerson: TreeNode | null = null;
  selectedPersonId: string | null = null;
  selectedRelatives: Array<{ label: string; person: TreeNode }> = [];
  contextualHints: string[] = [];
  dismissedHints = new Set<string>();

  workspaceView: WorkspaceView = 'tree';
  leftRailOpen = true;
  filtersOpen = false;
  onboardingVisible = false;
  modalOpen = false;
  advancedDetailsOpen = false;
  toolsOpen = false;
  toolsTab: ToolsTab = 'import';
  currentNode: TreeNode | null = null;
  actionType: ActionType = 'add_child';

  searchQuery = '';
  searchGeneration = '';
  searchRelationship = '';
  searchLocation = '';
  missingFilter: MissingFilter = '';

  timelineEntries: TimelineEntry[] = [];
  filteredTimeline: TimelineEntry[] = [];
  timelineQuery = '';
  timelineType: LifeEventType | '' = '';
  timelineLocation = '';
  timelineFrom = '';
  timelineTo = '';

  scale = 0.92;
  position = { x: 0, y: 10 };
  isDragging = false;
  dragStart = { x: 0, y: 0 };
  maxRenderDepth = 4;
  collapsedNodeIds = new Set<string>();

  formData: FormData = this.emptyForm();
  locationAutocompleteStatus = 'Start typing to search Google Places';
  isAuthBusy = false;
  canUndo = false;
  canRedo = false;
  syncStatus: SyncStatus = 'local';
  lastAction = 'Tree ready';
  toastMessage = '';

  importPreview: GedcomImportPreview | null = null;
  importFileName = '';
  importError = '';
  bulkSelectedIds = new Set<string>();
  bulkLocation = '';
  bulkTags = '';
  bulkSurnameFrom = '';
  bulkSurnameTo = '';

  private readonly destroy$ = new Subject<void>();
  private detachLocationAutocomplete?: () => void;
  private attachedLocationInput?: HTMLInputElement;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private treeService: TreeService,
    private authService: AuthService,
    private googlePlacesService: GooglePlacesService,
    private mediaService: MediaService,
    private gedcomService: GedcomService
  ) {
    this.user$ = this.authService.user$;
    this.loadDismissedHints();
  }

  ngOnInit(): void {
    if (window.innerWidth <= 860) this.leftRailOpen = false;
    this.treeService.tree$.pipe(takeUntil(this.destroy$)).subscribe(tree => {
      this.treeData = tree;
      this.rebuildDerivedState();
    });
    this.treeService.canUndo$.pipe(takeUntil(this.destroy$)).subscribe(value => this.canUndo = value);
    this.treeService.canRedo$.pipe(takeUntil(this.destroy$)).subscribe(value => this.canRedo = value);
    this.treeService.syncStatus$.pipe(takeUntil(this.destroy$)).subscribe(value => this.syncStatus = value);
    this.treeService.lastAction$.pipe(takeUntil(this.destroy$)).subscribe(value => this.lastAction = value);
    this.treeService.onboardingNeeded$.pipe(takeUntil(this.destroy$)).subscribe(value => this.onboardingVisible = value);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.detachPlacesAutocomplete();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  @HostListener('window:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isTyping = !!target?.closest('input, textarea, select, [contenteditable="true"]');
    if (event.key === 'Escape') {
      if (this.modalOpen) this.closeModal();
      else if (this.toolsOpen) this.closeTools();
      else if (this.selectedPerson) this.closeProfile();
      return;
    }
    if (isTyping || !(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 'z' && event.shiftKey) {
      event.preventDefault();
      this.redo();
    } else if (event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.undo();
    }
  }

  completeGuidedTree(input: GuidedTreeInput): void {
    const tree = this.treeService.createGuidedTree(input);
    this.onboardingVisible = false;
    this.selectPerson(tree, false);
    this.resetViewport();
    this.showToast('Your first family tree is ready');
  }

  startManualTree(): void {
    this.treeService.initializeManualTree();
    this.onboardingVisible = false;
    const root = this.treeService.getTree();
    this.selectPerson(root, false);
    this.openPersonForm(root, 'edit');
  }

  startOnboardingImport(): void {
    this.onboardingVisible = false;
    this.openTools('import');
  }

  reopenOnboarding(): void {
    this.closeProfile();
    this.treeService.reopenOnboarding();
  }

  openPersonForm(node: TreeNode, action: ActionType): void {
    // Avoid stacked modal dialogs: the profile drawer otherwise keeps focus
    // while the person form is open and can make the form appear read-only.
    if (this.selectedPerson) this.closeProfile();
    this.currentNode = node;
    this.actionType = action;
    this.advancedDetailsOpen = action === 'edit';
    this.formData = action === 'edit' ? this.formFromNode(node) : this.emptyForm();
    if (action === 'add_spouse') this.formData.partnerRelationshipType = 'partner';
    this.modalOpen = true;
    this.scheduleLocationAutocomplete();
  }

  handleNodeAction(_nodeId: string, action: ActionType, node: TreeNode): void {
    this.openPersonForm(node, action);
  }

  handleSubmit(): void {
    if (!this.formData.name.trim() || !this.currentNode) return;
    const email = this.formData.email.trim();
    if (email && !this.isValidEmail(email)) {
      this.showToast('Please enter a valid email address');
      return;
    }

    const fields = this.nodeFieldsFromForm();
    let addedPerson: TreeNode | null = null;
    const editedPersonId = this.actionType === 'edit' ? this.currentNode.id : null;
    if (this.actionType === 'add_child') {
      addedPerson = this.treeService.addChild(this.currentNode.id, { ...fields, type: 'blood' });
    } else if (this.actionType === 'add_spouse') {
      addedPerson = this.treeService.addSpouse(this.currentNode.id, { ...fields, type: 'spouse' });
    } else {
      this.treeService.editNode(this.currentNode.id, fields);
    }

    const sender = this.currentNode.name;
    this.closeModal();
    if (addedPerson) {
      this.selectPerson(addedPerson, true);
      if (addedPerson.email) this.promptNetworkNotification(addedPerson, sender);
    } else if (editedPersonId) {
      const updatedPerson = this.treeService.findNode(this.treeService.getTree(), editedPersonId);
      if (updatedPerson) this.selectPerson(updatedPerson, false);
    }
  }

  closeModal(): void {
    this.modalOpen = false;
    this.currentNode = null;
    this.detachPlacesAutocomplete();
  }

  deleteNode(nodeId: string): void {
    const person = this.treeService.findNode(this.treeService.getTree(), nodeId);
    if (!person) return;
    if (!confirm(`Delete ${person.name} and their descendants? You can undo this change.`)) return;
    if (!this.treeService.deleteNode(nodeId)) {
      this.showToast('The root person cannot be deleted');
      return;
    }
    if (this.selectedPersonId === nodeId) this.closeProfile();
    this.showToast(`${person.name} deleted — use Undo to restore`);
  }

  selectPerson(person: TreeNode, center = false): void {
    this.selectedPersonId = person.id;
    this.selectedPerson = this.treeService.findNode(this.treeService.getTree(), person.id) ?? person;
    this.selectedRelatives = this.treeService.getRelatives(person.id);
    this.contextualHints = this.buildHints(this.selectedPerson);
    if (window.innerWidth <= 860) this.leftRailOpen = false;
    if (center && this.workspaceView === 'tree') this.centerOnPerson(person.id);
  }

  focusRelative(personId: string): void {
    const person = this.treeService.findNode(this.treeService.getTree(), personId);
    if (person) this.selectPerson(person, true);
  }

  closeProfile(): void {
    this.selectedPerson = null;
    this.selectedPersonId = null;
    this.selectedRelatives = [];
    this.contextualHints = [];
  }

  dismissHint(hint: string): void {
    if (!this.selectedPersonId) return;
    this.dismissedHints.add(`${this.selectedPersonId}:${hint}`);
    localStorage.setItem('myFamilyTree_dismissedHints_v1', JSON.stringify([...this.dismissedHints]));
    this.contextualHints = this.buildHints(this.selectedPerson);
  }

  addStory(payload: { personId: string; title: string; text: string; date?: string }): void {
    this.treeService.addStory(payload.personId, {
      title: payload.title,
      text: payload.text,
      date: payload.date
    });
    this.showToast('Story added to the profile');
  }

  addEvent(payload: {
    personId: string;
    type: LifeEventType;
    title: string;
    date: string;
    place?: string;
    description?: string;
  }): void {
    this.treeService.addEvent(payload.personId, {
      type: payload.type,
      title: payload.title,
      date: payload.date,
      place: payload.place,
      description: payload.description
    });
    this.showToast('Life event added to the timeline');
  }

  async uploadProfilePhoto(payload: { personId: string; file: File }): Promise<void> {
    this.showToast('Uploading photo…');
    try {
      const url = await this.mediaService.uploadPersonPhoto(payload.personId, payload.file);
      this.treeService.updatePhoto(payload.personId, url);
      this.showToast(this.authService.currentUser ? 'Photo saved to Firebase Storage' : 'Photo saved in this browser');
    } catch (error) {
      this.showToast(error instanceof Error ? error.message : 'Photo upload failed');
    }
  }

  applySearch(): void {
    const query = this.normalizeText(this.searchQuery);
    const location = this.normalizeText(this.searchLocation);
    const generation = this.searchGeneration === '' ? null : Number(this.searchGeneration);

    this.filteredPeople = this.personIndex.filter(entry => {
      const person = entry.node;
      const searchable = this.normalizeText([
        person.name,
        ...(person.alternateNames ?? []),
        person.birthDate?.slice(0, 4) ?? '',
        person.location,
        person.birthPlace ?? ''
      ].join(' '));
      if (query && !searchable.includes(query)) return false;
      if (generation !== null && entry.generation !== generation) return false;
      if (location && !this.normalizeText(`${person.location} ${person.birthPlace ?? ''}`).includes(location)) return false;
      if (this.searchRelationship) {
        const relationship = person.type === 'spouse'
          ? person.partnerRelationshipType
          : person.parentRelationshipType;
        if (relationship !== this.searchRelationship) return false;
      }
      if (this.missingFilter === 'birthDate' && person.birthDate) return false;
      if (this.missingFilter === 'location' && person.location) return false;
      if (this.missingFilter === 'photo' && person.photoUrl) return false;
      if (this.missingFilter === 'stories' && person.stories?.length) return false;
      return true;
    });
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.searchGeneration = '';
    this.searchRelationship = '';
    this.searchLocation = '';
    this.missingFilter = '';
    this.applySearch();
  }

  setWorkspaceView(view: WorkspaceView): void {
    this.workspaceView = view;
    if (view === 'timeline') this.applyTimelineFilters();
  }

  applyTimelineFilters(): void {
    const query = this.normalizeText(this.timelineQuery);
    const location = this.normalizeText(this.timelineLocation);
    this.filteredTimeline = this.timelineEntries.filter(event => {
      if (this.timelineType && event.type !== this.timelineType) return false;
      if (this.timelineFrom && event.date < this.timelineFrom) return false;
      if (this.timelineTo && event.date > this.timelineTo) return false;
      if (location && !this.normalizeText(event.place ?? '').includes(location)) return false;
      if (query && !this.normalizeText(`${event.title} ${event.personName} ${event.description ?? ''}`).includes(query)) return false;
      return true;
    });
  }

  selectTimelineEntry(event: TimelineEntry): void {
    const person = this.treeService.findNode(this.treeService.getTree(), event.personId);
    if (person) this.selectPerson(person, false);
  }

  openTools(tab: ToolsTab = 'import'): void {
    this.toolsTab = tab;
    this.toolsOpen = true;
    if (tab === 'bulk' && !this.bulkSelectedIds.size) {
      this.filteredPeople.slice(0, 25).forEach(entry => this.bulkSelectedIds.add(entry.node.id));
      this.bulkSelectedIds = new Set(this.bulkSelectedIds);
    }
  }

  closeTools(): void {
    this.toolsOpen = false;
    if (this.treeService.onboardingNeeded) this.onboardingVisible = true;
  }

  handleImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importFileName = file.name;
    this.importPreview = null;
    this.importError = '';

    const reader = new FileReader();
    reader.onload = () => {
      const contents = String(reader.result ?? '');
      try {
        if (/\.(ged|gedcom)$/i.test(file.name)) {
          this.importPreview = this.gedcomService.parse(contents);
        } else if (/\.json$/i.test(file.name)) {
          if (!confirm('Replace the current tree with this JSON backup? You can undo after import.')) return;
          if (!this.treeService.importFromJSON(contents)) throw new Error('This is not a valid family-tree backup.');
          this.closeTools();
          this.showToast('JSON backup imported');
        } else {
          throw new Error('Choose a GEDCOM (.ged) or My Family JSON file.');
        }
      } catch (error) {
        this.importError = error instanceof Error ? error.message : 'Could not read this file.';
      } finally {
        input.value = '';
      }
    };
    reader.onerror = () => this.importError = 'Could not read this file.';
    reader.readAsText(file);
  }

  confirmGedcomImport(): void {
    if (!this.importPreview?.tree) return;
    this.treeService.replaceTree(this.importPreview.tree, `Imported ${this.importPreview.peopleCount} GEDCOM people`);
    this.importPreview = null;
    this.closeTools();
    this.selectPerson(this.treeService.getTree(), false);
    this.resetViewport();
    this.showToast('GEDCOM imported successfully');
  }

  toggleBulkSelection(personId: string): void {
    const next = new Set(this.bulkSelectedIds);
    next.has(personId) ? next.delete(personId) : next.add(personId);
    this.bulkSelectedIds = next;
  }

  selectAllFilteredForBulk(): void {
    this.bulkSelectedIds = new Set(this.filteredPeople.map(entry => entry.node.id));
  }

  clearBulkSelection(): void {
    this.bulkSelectedIds = new Set<string>();
  }

  applyBulkEdit(): void {
    if (!this.bulkSelectedIds.size) return;
    if (!this.bulkLocation.trim() && !this.bulkTags.trim() && !(this.bulkSurnameFrom.trim() && this.bulkSurnameTo.trim())) {
      this.showToast('Choose at least one bulk change');
      return;
    }
    if (!confirm(`Apply these changes to ${this.bulkSelectedIds.size} selected people? This creates one undo step.`)) return;
    const changed = this.treeService.bulkEdit({
      personIds: [...this.bulkSelectedIds],
      location: this.bulkLocation.trim() || undefined,
      addTags: this.splitList(this.bulkTags),
      surnameFrom: this.bulkSurnameFrom.trim() || undefined,
      surnameTo: this.bulkSurnameTo.trim() || undefined
    });
    this.closeTools();
    this.showToast(`${changed} ${changed === 1 ? 'person' : 'people'} updated`);
  }

  undo(): void {
    if (!this.canUndo) return;
    this.treeService.undo();
    this.showToast('Last change undone');
  }

  redo(): void {
    if (!this.canRedo) return;
    this.treeService.redo();
    this.showToast('Change restored');
  }

  async downloadTree(): Promise<void> {
    if (!this.authService.currentUser) {
      const shouldSignIn = confirm('Sign in with Google to sync this tree before downloading a backup?');
      if (shouldSignIn) await this.signInWithGoogle();
    }
    try {
      await this.treeService.saveCurrentTree();
    } catch (error) {
      console.error('Cloud save failed before backup:', error);
      this.showToast('Cloud sync failed; downloading a local backup');
    }
    const data = 'data:application/json;charset=utf-8,' + encodeURIComponent(this.treeService.exportToJSON());
    const link = document.createElement('a');
    link.href = data;
    link.download = `my-family-tree-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async signInWithGoogle(): Promise<void> {
    this.isAuthBusy = true;
    try {
      await this.authService.signInWithGoogle();
    } catch (error) {
      console.error('Google sign-in failed:', error);
      this.showToast('Google sign-in failed. Check Firebase Authentication settings.');
    } finally {
      this.isAuthBusy = false;
    }
  }

  async signOut(): Promise<void> {
    this.isAuthBusy = true;
    try {
      await this.authService.signOut();
      this.showToast('Signed out — this tree remains available locally');
    } catch (error) {
      console.error('Sign-out failed:', error);
      this.showToast('Sign-out failed');
    } finally {
      this.isAuthBusy = false;
    }
  }

  onPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea, article, a, label')) return;
    this.isDragging = true;
    this.dragStart = { x: event.clientX - this.position.x, y: event.clientY - this.position.y };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;
    this.position = { x: event.clientX - this.dragStart.x, y: event.clientY - this.dragStart.y };
  }

  onPointerUp(): void {
    this.isDragging = false;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -0.08 : 0.08;
    this.scale = Math.max(0.35, Math.min(1.65, this.scale + direction));
  }

  zoomIn(): void {
    this.scale = Math.min(1.65, this.scale + 0.1);
  }

  zoomOut(): void {
    this.scale = Math.max(0.35, this.scale - 0.1);
  }

  resetViewport(): void {
    this.scale = 0.92;
    this.position = { x: 0, y: 10 };
  }

  getZoomPercentage(): number {
    return Math.round(this.scale * 100);
  }

  toggleBranch(nodeId: string): void {
    const next = new Set(this.collapsedNodeIds);
    next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
    this.collapsedNodeIds = next;
  }

  revealMoreGenerations(): void {
    this.maxRenderDepth += 2;
    this.showToast(`Showing up to ${this.maxRenderDepth + 1} generations`);
  }

  openLocationInGoogleMaps(): void {
    const query = this.formData.location.trim();
    if (!query) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener');
  }

  getModalTitle(): string {
    if (!this.currentNode) return '';
    if (this.actionType === 'add_child') return `Add a child to ${this.currentNode.name}`;
    if (this.actionType === 'add_spouse') return `Add a partner for ${this.currentNode.name}`;
    return `Edit ${this.currentNode.name}`;
  }

  get syncLabel(): string {
    const labels: Record<SyncStatus, string> = {
      local: 'Saved locally', syncing: 'Syncing…', synced: 'Cloud synced', error: 'Sync needs attention'
    };
    return labels[this.syncStatus];
  }

  startEditingTreeName(): void {
    this.treeNameDraft = this.treeName;
    this.editingTreeName = true;
    setTimeout(() => document.querySelector<HTMLInputElement>('.tree-name-editor input')?.select());
  }

  saveTreeName(): void {
    if (!this.editingTreeName) return;
    const nextName = this.treeNameDraft.trim();
    this.editingTreeName = false;
    if (!nextName) {
      this.treeNameDraft = this.treeName;
      return;
    }
    this.treeService.setTreeName(nextName);
    this.showToast(`Tree renamed to ${nextName}`);
  }

  private rebuildDerivedState(): void {
    this.treeName = this.treeData?.treeName ?? `${this.treeData?.name ?? 'My'} Family`;
    if (!this.editingTreeName) this.treeNameDraft = this.treeName;
    this.personIndex = this.treeService.getPersonIndex();
    this.generationOptions = [...new Set(this.personIndex.map(entry => entry.generation))];
    this.applySearch();
    this.timelineEntries = this.treeService.getTimeline();
    this.applyTimelineFilters();
    if (this.selectedPersonId) {
      const refreshed = this.treeService.findNode(this.treeService.getTree(), this.selectedPersonId);
      if (refreshed) this.selectPerson(refreshed, false);
      else this.closeProfile();
    }
  }

  private centerOnPerson(personId: string): void {
    setTimeout(() => {
      const container = this.containerRef?.nativeElement;
      const element = container?.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(personId)}"]`);
      if (!container || !element) return;
      const canvasRect = container.getBoundingClientRect();
      const nodeRect = element.getBoundingClientRect();
      this.position = {
        x: this.position.x + canvasRect.left + canvasRect.width / 2 - nodeRect.left - nodeRect.width / 2,
        y: this.position.y + canvasRect.top + canvasRect.height / 2 - nodeRect.top - nodeRect.height / 2
      };
    });
  }

  private buildHints(person: TreeNode | null): string[] {
    if (!person) return [];
    const candidates: string[] = [];
    if (!person.birthDate) candidates.push('Add a birth date');
    if (!person.birthPlace) candidates.push('Add a birthplace');
    if (!person.photoUrl) candidates.push('Add a profile photo');
    if (!person.spouse && person.type === 'blood') candidates.push('Add a partner');
    if (!person.children.length && person.type === 'blood') candidates.push('Add a child or descendant');
    if (!person.stories?.length) candidates.push('Record a family story');
    return candidates
      .filter(hint => !this.dismissedHints.has(`${person.id}:${hint}`))
      .slice(0, 3);
  }

  private loadDismissedHints(): void {
    try {
      const saved = JSON.parse(localStorage.getItem('myFamilyTree_dismissedHints_v1') ?? '[]') as unknown;
      if (Array.isArray(saved)) this.dismissedHints = new Set(saved.filter((value): value is string => typeof value === 'string'));
    } catch {
      this.dismissedHints = new Set<string>();
    }
  }

  private scheduleLocationAutocomplete(): void {
    setTimeout(() => this.attachPlacesAutocomplete());
  }

  private attachPlacesAutocomplete(): void {
    const input = this.locationInput?.nativeElement;
    if (!this.modalOpen || !input) {
      this.detachPlacesAutocomplete();
      return;
    }
    if (this.attachedLocationInput === input) return;
    this.detachPlacesAutocomplete();
    this.attachedLocationInput = input;
    this.locationAutocompleteStatus = 'Loading place suggestions…';
    this.googlePlacesService.attachAutocomplete(input, location => {
      this.formData.location = location;
      this.locationAutocompleteStatus = 'Place selected';
    }).then(detach => {
      if (this.attachedLocationInput === input) {
        this.detachLocationAutocomplete = detach;
        this.locationAutocompleteStatus = 'Place suggestions ready';
      } else {
        detach();
      }
    }).catch(error => {
      console.error('Google Places autocomplete failed:', error);
      this.locationAutocompleteStatus = 'Type a location manually';
    });
  }

  private detachPlacesAutocomplete(): void {
    this.detachLocationAutocomplete?.();
    this.detachLocationAutocomplete = undefined;
    this.attachedLocationInput = undefined;
  }

  private emptyForm(): FormData {
    return {
      name: '', age: '', email: '', gender: Gender.OTHER, isAlive: true, location: '',
      alternateNames: '', birthDate: '', deathDate: '', birthPlace: '', notes: '', tags: '', photoUrl: '',
      parentRelationshipType: 'biological_parent', partnerRelationshipType: 'partner',
      relationshipStartDate: '', relationshipEndDate: ''
    };
  }

  private formFromNode(node: TreeNode): FormData {
    return {
      name: node.name,
      age: node.age ? String(node.age) : '',
      email: node.email ?? '',
      gender: node.gender,
      isAlive: node.isAlive,
      location: node.location,
      alternateNames: (node.alternateNames ?? []).join(', '),
      birthDate: node.birthDate ?? '',
      deathDate: node.deathDate ?? '',
      birthPlace: node.birthPlace ?? '',
      notes: node.notes ?? '',
      tags: (node.tags ?? []).join(', '),
      photoUrl: node.photoUrl ?? '',
      parentRelationshipType: node.parentRelationshipType ?? 'biological_parent',
      partnerRelationshipType: node.partnerRelationshipType ?? 'partner',
      relationshipStartDate: node.relationshipStartDate ?? '',
      relationshipEndDate: node.relationshipEndDate ?? ''
    };
  }

  private nodeFieldsFromForm(): Omit<TreeNode, 'id' | 'spouse' | 'children'> {
    return {
      name: this.formData.name.trim(),
      age: Number.parseInt(this.formData.age, 10) || 0,
      email: this.formData.email.trim() || undefined,
      gender: this.formData.gender,
      isAlive: this.formData.isAlive,
      location: this.formData.location.trim(),
      type: this.actionType === 'add_spouse' ? 'spouse' : (this.currentNode?.type ?? 'blood'),
      alternateNames: this.splitList(this.formData.alternateNames),
      birthDate: this.formData.birthDate || undefined,
      deathDate: this.formData.isAlive ? undefined : (this.formData.deathDate || undefined),
      birthPlace: this.formData.birthPlace.trim() || undefined,
      notes: this.formData.notes.trim() || undefined,
      tags: this.splitList(this.formData.tags),
      photoUrl: this.formData.photoUrl.trim() || undefined,
      parentRelationshipType: this.formData.parentRelationshipType,
      partnerRelationshipType: this.formData.partnerRelationshipType,
      relationshipStartDate: this.formData.relationshipStartDate || undefined,
      relationshipEndDate: this.formData.relationshipEndDate || undefined
    };
  }

  private splitList(value: string): string[] {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }

  private normalizeText(value: string): string {
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private showToast(message: string): void {
    this.toastMessage = message;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage = '', 3200);
  }

  private promptNetworkNotification(person: TreeNode, fallbackSenderName: string): void {
    const email = person.email?.trim();
    if (!email || !confirm(`Open an email invitation for ${person.name}?`)) return;
    const sender = this.authService.currentUser?.displayName
      || this.authService.currentUser?.email
      || fallbackSenderName
      || 'A family member';
    const subject = `${sender} added you to a family tree`;
    const body = `Hi ${person.name},\n\n${sender} added you to their family network in My Family.`;
    window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }
}
