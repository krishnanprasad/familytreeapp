import {
  Component,
  ChangeDetectorRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { LucideAngularModule } from 'lucide-angular';
import { Observable, Subject, takeUntil } from 'rxjs';
import { TreeService, SyncStatus } from './services/tree.service';
import { AuthService, AuthUser } from './services/auth.service';
import { MediaService } from './services/media.service';
import { GedcomImportPreview, GedcomService } from './services/gedcom.service';
import { GooglePlacesService } from './services/google-places.service';
import {
  ActionType,
  FormData,
  Gender,
  GuidedTreeInput,
  LifeEventType,
  ParentRelationshipType,
  PartnerRelationshipType,
  PersonIndexEntry,
  ShareLinkRecord,
  SharedTreeLoadStatus,
  SocialPlatform,
  TreeAccess,
  TreeAccessRole,
  TreeShareScope,
  TreeSummary,
  TreeVisibility,
  TimelineEntry,
  TreeNode
} from './models/tree-node.model';
import { TreeNodeComponent } from './components/tree-node.component';
import { GeneratedTreeRequest, OnboardingComponent } from './components/onboarding.component';
import { PersonProfileComponent } from './components/person-profile.component';
import { FamilyChatComponent } from './components/family-chat.component';
import { InviteLandingComponent } from './components/invite-landing.component';
import { AiApplyResult } from './models/ai-family.model';

type WorkspaceView = 'tree' | 'list' | 'timeline';
type ToolsTab = 'import' | 'bulk';
type MissingFilter = '' | 'birthDate' | 'location' | 'photo' | 'stories';
type FirstRelativeKind = 'father' | 'mother' | 'spouse' | 'child';
type SearchIndexEntry = PersonIndexEntry & {
  searchableText: string;
  searchableLocation: string;
  relationship?: string;
  hasBirthDate: boolean;
  hasLocation: boolean;
  hasPhoto: boolean;
  hasStories: boolean;
};

interface PerformanceSnapshot {
  totalPeople: number;
  renderedPeople: number;
  hiddenPeople: number;
  maxRenderDepth: number;
  searchMs: number;
  derivedStateMs: number;
  viewportMs: number;
  lastMeasuredAt: string;
}

interface DuplicatePersonMatch {
  personId: string;
  name: string;
  context: string;
  reason: string;
  score: number;
}

type ShareMode = 'public' | 'invite';
interface FirstRelativeOption {
  kind: FirstRelativeKind;
  label: string;
  hint: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    TreeNodeComponent,
    OnboardingComponent,
    PersonProfileComponent,
    FamilyChatComponent,
    InviteLandingComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('containerRef') containerRef?: ElementRef<HTMLDivElement>;
  @ViewChild('locationInput') locationInput?: ElementRef<HTMLInputElement>;

  readonly Gender = Gender;
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
  readonly socialPlatformOptions: ReadonlyArray<{
    value: SocialPlatform;
    label: string;
    placeholder: string;
  }> = [
    { value: 'instagram', label: 'Instagram', placeholder: '@username or profile URL' },
    { value: 'facebook', label: 'Facebook', placeholder: 'Page name or profile URL' },
    { value: 'snapchat', label: 'Snapchat', placeholder: '@username or profile URL' },
    { value: 'x', label: 'X', placeholder: '@username or profile URL' },
    { value: 'linkedin', label: 'LinkedIn', placeholder: 'Username or profile URL' },
    { value: 'youtube', label: 'YouTube', placeholder: '@channel or channel URL' },
    { value: 'tiktok', label: 'TikTok', placeholder: '@username or profile URL' }
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
  readonly defaultLocationSuggestions = [
    'Salem, Tamil Nadu, India',
    'Chennai, Tamil Nadu, India',
    'Bengaluru, Karnataka, India',
    'Coimbatore, Tamil Nadu, India',
    'Madurai, Tamil Nadu, India'
  ];
  readonly shareScopeOptions: Array<{ value: TreeShareScope; label: string }> = [
    { value: 'tree', label: 'Full tree' },
    { value: 'branch', label: 'Selected branch' }
  ];
  readonly fullTreeShareRoleOptions: Array<{ value: TreeAccessRole; label: string }> = [
    { value: 'viewer', label: 'Viewer' },
    { value: 'coOwner', label: 'Co-owner' }
  ];
  readonly branchShareRoleOptions: Array<{ value: TreeAccessRole; label: string }> = [
    { value: 'branchViewer', label: 'Branch viewer' },
    { value: 'branchEditor', label: 'Branch editor' }
  ];
  readonly firstRelativeOptions: FirstRelativeOption[] = [
    { kind: 'father', label: 'Father', hint: 'Add parent', icon: 'user-round-plus' },
    { kind: 'mother', label: 'Mother', hint: 'Add parent', icon: 'user-round-plus' },
    { kind: 'spouse', label: 'Spouse', hint: 'Add partner', icon: 'heart' },
    { kind: 'child', label: 'Child', hint: 'Add child', icon: 'baby' }
  ];

  treeData: TreeNode | null = null;
  treeName = 'My Family';
  treeNameDraft = 'My Family';
  editingTreeName = false;
  treeOwnerName = 'You';
  treeOwnerNameDraft = 'You';
  editingTreeOwnerName = false;
  personIndex: PersonIndexEntry[] = [];
  filteredPeople: PersonIndexEntry[] = [];
  searchIndex: SearchIndexEntry[] = [];
  generationOptions: number[] = [];
  selectedPerson: TreeNode | null = null;
  selectedPersonId: string | null = null;
  selectedRelatives: Array<{ label: string; person: TreeNode }> = [];
  contextualHints: string[] = [];
  dismissedHints = new Set<string>();
  currentRole: TreeAccessRole = 'owner';
  currentVisibility: TreeVisibility = 'private';
  treeSummaries: TreeSummary[] = [];

  workspaceView: WorkspaceView = 'tree';
  leftRailOpen = true;
  mobileMoreOpen = false;
  familyHelperOpen = false;
  myTreesOpen = false;
  filtersOpen = false;
  onboardingVisible = false;
  modalOpen = false;
  firstRelativePromptLabel = '';
  shareOpen = false;
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
  locationSuggestions: string[] = [];
  googleLocationSuggestions: string[] = [];
  locationSuggestionsOpen = false;
  highlightedLocationSuggestionIndex = 0;
  timelineQuery = '';
  timelineType: LifeEventType | '' = '';
  timelineLocation = '';
  timelineFrom = '';
  timelineTo = '';

  scale = 0.86;
  position = { x: 0, y: 10 };
  isDragging = false;
  dragStart = { x: 0, y: 0 };
  maxRenderDepth = 2;
  collapsedNodeIds = new Set<string>();
  expandedBranchIds = new Set<string>();
  performancePanelOpen = false;
  performanceSnapshot: PerformanceSnapshot = {
    totalPeople: 0,
    renderedPeople: 0,
    hiddenPeople: 0,
    maxRenderDepth: 2,
    searchMs: 0,
    derivedStateMs: 0,
    viewportMs: 0,
    lastMeasuredAt: '--'
  };

  formData: FormData = this.emptyForm();
  locationAutocompleteStatus = 'Start typing, then choose a place or saved suggestion';
  isAuthBusy = false;
  isAuthReady = false;
  isSignedIn = false;
  signedInUserId = '';
  signedInUserLabel = 'Your account';
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

  shareMode: ShareMode = 'invite';
  shareScope: TreeShareScope = 'tree';
  shareRole: TreeAccessRole = 'viewer';
  shareRecipientEmail = '';
  shareSelectedPersonId = '';
  shareSelectedPersonName = '';
  shareLinks: ShareLinkRecord[] = [];
  shareAccess: TreeAccess[] = [];
  latestShareLink: ShareLinkRecord | null = null;
  shareBusy = false;
  treeListBusy = false;
  shareMessage = '';
  publicSharePromptVisible = false;
  inviteLandingVisible = false;
  inviteShare: ShareLinkRecord | null = null;
  inviteStatus: SharedTreeLoadStatus = 'ready';
  inviteBusy = false;
  inviteError = '';

  private readonly destroy$ = new Subject<void>();
  private toastTimer?: ReturnType<typeof setTimeout>;
  private locationLookupTimer?: ReturnType<typeof setTimeout>;
  private locationLookupRequestId = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private signInReturnTimer?: ReturnType<typeof setTimeout>;
  private viewportFrameId: number | null = null;
  private pendingViewportUpdate: { position?: { x: number; y: number }; scale?: number; startedAt: number } | null = null;
  private sharedRouteLoading = false;
  private routeLoadStarted = false;
  private readonly signInStartedStorageKey = 'myFamilyTree_googleSignInStarted_v1';
  private readonly pendingInviteJoinStorageKey = 'myFamilyTree_pendingInviteJoin_v1';
  private readonly landingHandoffStorageKey = 'myFamilyTree_landingHandoff_v1';
  private readonly firstRelativePromptDismissedStorageKey = 'myFamilyTree_firstRelativePromptDismissed_v1';
  private firstRelativePromptDismissedTreeIds = new Set<string>();

  constructor(
    private treeService: TreeService,
    private authService: AuthService,
    private mediaService: MediaService,
    private gedcomService: GedcomService,
    private googlePlacesService: GooglePlacesService,
    private titleService: Title,
    private changeDetector: ChangeDetectorRef
  ) {
    this.user$ = this.authService.user$;
    this.loadDismissedHints();
    this.loadFirstRelativePromptDismissals();
  }

  ngOnInit(): void {
    this.consumeLandingHandoff();
    const pendingSignIn = this.readGoogleSignInIntent();
    if (pendingSignIn?.reopenMyTrees) this.myTreesOpen = true;
    if (window.innerWidth <= 860) this.leftRailOpen = false;
    if (window.innerWidth <= 600) {
      this.scale = this.mobileViewportScale();
      this.position = this.defaultViewportPosition();
    }
    this.sharedRouteLoading = this.isRoutedPath();
    this.authService.authReady$.pipe(takeUntil(this.destroy$)).subscribe(ready => {
      this.isAuthReady = ready;
      this.changeDetector.markForCheck();
      if (!ready || this.routeLoadStarted) return;
      this.routeLoadStarted = true;
      void this.loadRequestedRouteIfPresent();
      this.scheduleIncompleteSignInNotice();
    });
    this.treeService.tree$.pipe(takeUntil(this.destroy$)).subscribe(tree => {
      this.treeData = tree;
      this.rebuildDerivedState();
      this.changeDetector.markForCheck();
    });
    this.treeService.treeSummaries$.pipe(takeUntil(this.destroy$)).subscribe(value => {
      this.treeSummaries = value;
      this.changeDetector.markForCheck();
    });
    this.treeService.activeRole$.pipe(takeUntil(this.destroy$)).subscribe(value => {
      this.currentRole = value;
      this.changeDetector.markForCheck();
    });
    this.treeService.activeVisibility$.pipe(takeUntil(this.destroy$)).subscribe(value => {
      this.currentVisibility = value;
      this.changeDetector.markForCheck();
    });
    this.treeService.activeRouteId$.pipe(takeUntil(this.destroy$)).subscribe(routeId => {
      if (routeId && !this.sharedRouteLoading) this.updateTreeUrl();
    });
    this.treeService.canUndo$.pipe(takeUntil(this.destroy$)).subscribe(value => {
      this.canUndo = value;
      this.changeDetector.markForCheck();
    });
    this.treeService.canRedo$.pipe(takeUntil(this.destroy$)).subscribe(value => {
      this.canRedo = value;
      this.changeDetector.markForCheck();
    });
    this.treeService.syncStatus$.pipe(takeUntil(this.destroy$)).subscribe(value => {
      this.syncStatus = value;
      this.changeDetector.markForCheck();
    });
    this.treeService.lastAction$.pipe(takeUntil(this.destroy$)).subscribe(value => {
      this.lastAction = value;
      this.changeDetector.markForCheck();
    });
    this.treeService.onboardingNeeded$.pipe(takeUntil(this.destroy$)).subscribe(value => {
      this.onboardingVisible = value && !this.sharedRouteLoading;
      this.changeDetector.markForCheck();
    });
    this.user$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      this.isSignedIn = !!user;
      this.signedInUserId = user?.uid ?? '';
      this.signedInUserLabel = user?.displayName || user?.email || 'Your account';
      if (user) {
        this.publicSharePromptVisible = false;
        const signInIntent = this.readGoogleSignInIntent();
        if (signInIntent) {
          sessionStorage.removeItem(this.signInStartedStorageKey);
          if (this.signInReturnTimer) clearTimeout(this.signInReturnTimer);
          this.myTreesOpen = signInIntent.reopenMyTrees;
          this.showToast(`Successfully signed in${user.displayName ? ' as ' + user.displayName : ''}`);
        }
        void this.refreshMyTrees();
        this.updateTreeUrl();
      }
      this.changeDetector.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.locationLookupTimer) clearTimeout(this.locationLookupTimer);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.signInReturnTimer) clearTimeout(this.signInReturnTimer);
    if (this.viewportFrameId !== null) cancelAnimationFrame(this.viewportFrameId);
  }

  private consumeLandingHandoff(): void {
    const rawHandoff = sessionStorage.getItem(this.landingHandoffStorageKey);
    if (!rawHandoff) return;
    sessionStorage.removeItem(this.landingHandoffStorageKey);

    try {
      const handoff = JSON.parse(rawHandoff) as {
        mode?: 'guided' | 'manual' | 'import' | 'generated' | 'publicTree';
        input?: GuidedTreeInput;
        request?: GeneratedTreeRequest;
        summary?: TreeSummary;
      };
      if (handoff.mode === 'guided' && handoff.input) {
        this.completeGuidedTree(handoff.input);
      } else if (handoff.mode === 'manual') {
        this.startManualTree();
      } else if (handoff.mode === 'import') {
        this.treeService.completeOnboarding();
        this.startOnboardingImport();
      } else if (handoff.mode === 'generated' && handoff.request) {
        this.openGeneratedTreeFromLanding(handoff.request);
      } else if (handoff.mode === 'publicTree' && handoff.summary) {
        void this.openPublicTreeFromLanding(handoff.summary);
      }
    } catch (error) {
      console.warn('Could not open the landing-page tree draft:', error);
    }
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

  openGeneratedTreeFromLanding(request: GeneratedTreeRequest): void {
    const tree = this.treeService.openGeneratedTree(request.tree);
    this.onboardingVisible = false;
    this.resetTreeRevealState();
    const focusedPerson = this.treeService.findNode(tree, request.focusNodeId) ?? tree;
    this.selectPerson(focusedPerson, false);
    this.resetViewport();
    this.publicSharePromptVisible = false;
    this.showToast(`${tree.treeName ?? tree.name} opened as a computer-generated public preview`);
  }

  async openPublicTreeFromLanding(summary: TreeSummary): Promise<void> {
    try {
      const tree = await this.treeService.openTree(summary, { previewOnly: true });
      if (!tree) {
        this.showToast('Could not open that public tree');
        return;
      }
      this.onboardingVisible = false;
      this.closeProfile();
      this.resetTreeRevealState();
      this.selectPerson(tree, false);
      this.resetViewport();
      this.publicSharePromptVisible = !this.authService.currentUser;
      this.showToast(`Opened public tree: ${summary.treeName}`);
    } catch (error) {
      console.error('Open public tree failed:', error);
      this.showToast('Could not open that public tree');
    }
  }

  reopenOnboarding(): void {
    this.closeProfile();
    this.treeService.reopenOnboarding();
  }

  get createdTrees(): TreeSummary[] {
    return this.treeSummaries.filter(tree => tree.source === 'created');
  }

  get coOwnedTrees(): TreeSummary[] {
    return this.treeSummaries.filter(tree => tree.source === 'coOwned');
  }

  get sharedTrees(): TreeSummary[] {
    return this.treeSummaries.filter(tree => tree.source === 'shared');
  }

  get canEditCurrentTree(): boolean {
    return this.treeService.canEditCurrentTree;
  }

  get activeTreeId(): string {
    return this.treeService.currentTreeId;
  }

  get canShareCurrentTree(): boolean {
    return this.treeService.canShareCurrentTree;
  }

  get currentTreeRoleLabel(): string {
    return this.roleLabel(this.currentRole);
  }

  get isReadOnlyTree(): boolean {
    return !this.canEditCurrentTree;
  }

  get isComputerGeneratedTree(): boolean {
    return this.treeOwnerName.trim().toLowerCase() === 'computer generated'
      || (this.treeData?.tags?.some(tag => tag.trim().toLowerCase() === 'computer generated') ?? false);
  }

  get visibleFirstRelativeOptions(): FirstRelativeOption[] {
    return this.firstRelativeOptions.filter(option => {
      if (option.kind === 'father' || option.kind === 'mother') {
        return this.currentRole !== 'branchEditor' && this.treeData ? this.treeService.canAddParent(this.treeData.id) : false;
      }
      return true;
    });
  }

  get showFirstRelativePrompt(): boolean {
    return this.workspaceView === 'tree'
      && !!this.treeData
      && this.canEditCurrentTree
      && !this.onboardingVisible
      && !this.modalOpen
      && !this.shareOpen
      && !this.myTreesOpen
      && !this.toolsOpen
      && !this.inviteLandingVisible
      && this.personIndex.length === 1
      && this.visibleFirstRelativeOptions.length > 0
      && !this.firstRelativePromptDismissedTreeIds.has(this.activeTreeId);
  }

  openMyTrees(): void {
    this.myTreesOpen = true;
    void this.refreshMyTrees();
  }

  closeMyTrees(): void {
    this.myTreesOpen = false;
  }

  async refreshMyTrees(): Promise<void> {
    if (!this.authService.currentUser) return;
    this.treeListBusy = true;
    try {
      await this.treeService.loadAccessibleTrees();
    } catch (error) {
      console.error('Could not load trees:', error);
      this.showToast('Could not load your tree list');
    } finally {
      this.treeListBusy = false;
    }
  }

  async openTreeFromList(summary: TreeSummary): Promise<void> {
    this.treeListBusy = true;
    try {
      await this.saveNow(false);
      const tree = await this.treeService.openTree(summary);
      if (!tree) {
        this.showToast('Could not open that tree');
        return;
      }
      this.closeProfile();
      this.myTreesOpen = false;
      this.resetTreeRevealState();
      this.selectPerson(tree, false);
      this.resetViewport();
      this.showToast(`Opened ${summary.treeName}`);
      this.updateTreeUrl();
    } catch (error) {
      console.error('Open tree failed:', error);
      this.showToast('Could not open that tree');
    } finally {
      this.treeListBusy = false;
    }
  }

  openPersonForm(node: TreeNode, action: ActionType): void {
    if (!this.canEditCurrentTree) {
      this.showToast('This shared tree is view-only for you');
      return;
    }
    if (action === 'add_parent' && !this.treeService.canAddParent(node.id)) {
      this.showToast('Add parent is available for the top person in this tree');
      return;
    }
    // Avoid stacked modal dialogs: the profile drawer otherwise keeps focus
    // while the person form is open and can make the form appear read-only.
    if (this.selectedPerson) this.closeProfile();
    this.currentNode = node;
    this.actionType = action;
    this.firstRelativePromptLabel = '';
    this.advancedDetailsOpen = action === 'edit';
    this.formData = action === 'edit' ? this.formFromNode(node) : this.emptyForm();
    if (action === 'add_spouse') this.formData.partnerRelationshipType = 'partner';
    this.modalOpen = true;
    this.googleLocationSuggestions = [];
    this.locationSuggestionsOpen = false;
    this.highlightedLocationSuggestionIndex = 0;
    this.locationAutocompleteStatus = 'Start typing, then choose a place or saved suggestion';
  }

  startFirstRelative(kind: FirstRelativeKind): void {
    if (!this.treeData) return;
    const action: ActionType = kind === 'spouse'
      ? 'add_spouse'
      : kind === 'child'
        ? 'add_child'
        : 'add_parent';
    this.openPersonForm(this.treeData, action);
    if (!this.modalOpen) return;

    const labels: Record<FirstRelativeKind, string> = {
      father: 'father',
      mother: 'mother',
      spouse: 'spouse',
      child: 'child'
    };
    this.firstRelativePromptLabel = labels[kind];
    if (kind === 'father') this.formData.gender = Gender.MALE;
    if (kind === 'mother') this.formData.gender = Gender.FEMALE;
    if (kind === 'spouse') this.formData.partnerRelationshipType = 'spouse';
  }

  handleNodeAction(_nodeId: string, action: ActionType, node: TreeNode): void {
    this.openPersonForm(node, action);
  }

  handleSubmit(): void {
    if (!this.formData.name.trim() || !this.currentNode) return;
    const age = this.parseAgeInput(this.formData.age);
    if (age === null) {
      this.showToast('Age must be a whole number from 0 to 130');
      return;
    }
    const dates = this.normalizedFormDates();
    if (!dates) return;
    const email = this.formData.email.trim();
    if (email && !this.isValidEmail(email)) {
      this.showToast('Please enter a valid email address');
      return;
    }

    const fields = this.nodeFieldsFromForm(age, dates);
    let addedPerson: TreeNode | null = null;
    const editedPersonId = this.actionType === 'edit' ? this.currentNode.id : null;
    if (this.actionType === 'add_parent') {
      addedPerson = this.treeService.addParent(this.currentNode.id, { ...fields, type: 'blood' });
    } else if (this.actionType === 'add_child') {
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

  /**
   * Advisory duplicate detection for new relationships. A match never blocks
   * saving: it gives the editor enough context to check the existing person.
   */
  get duplicatePersonMatches(): DuplicatePersonMatch[] {
    if (this.actionType === 'edit') return [];

    const name = this.normalizePersonIdentity(this.formData.name);
    const email = this.formData.email.trim().toLowerCase();
    if (name.length < 2 && !email) return [];

    const enteredNames = [name, ...this.splitList(this.formData.alternateNames)
      .map(value => this.normalizePersonIdentity(value))]
      .filter(Boolean);
    const birthDate = this.comparableDate(this.formData.birthDate);
    const age = this.validComparableAge(this.formData.age);
    const location = this.normalizePersonIdentity(this.formData.location);

    return this.personIndex
      .map(entry => {
        const person = entry.node;
        const existingNames = [person.name, ...(person.alternateNames ?? [])]
          .map(value => this.normalizePersonIdentity(value))
          .filter(Boolean);
        const exactName = enteredNames.some(value => existingNames.includes(value));
        const exactEmail = Boolean(email && person.email?.trim().toLowerCase() === email);
        const sameBirthDate = Boolean(birthDate && this.comparableDate(person.birthDate ?? '') === birthDate);
        const sameAge = age !== null && person.age > 0 && person.age === age;
        const existingLocation = this.normalizePersonIdentity(person.location);
        const sameLocation = Boolean(location && existingLocation && location === existingLocation);
        const supportingDetail = exactEmail || sameBirthDate || sameAge || sameLocation;
        const nearName = !exactName && name.length >= 5 && existingNames.some(value =>
          Math.abs(value.length - name.length) <= 1 && this.editDistanceAtMostOne(name, value)
        );

        if (!exactEmail && !exactName && !(nearName && supportingDetail)) return null;

        let score = exactEmail ? 100 : exactName ? 70 : 45;
        if (sameBirthDate) score += 20;
        if (sameAge) score += 10;
        if (sameLocation) score += 8;

        const reasonParts: string[] = [];
        if (exactEmail) reasonParts.push('same email');
        if (exactName) reasonParts.push('same name');
        else if (nearName) reasonParts.push('very similar name');
        if (sameBirthDate) reasonParts.push('same birth date');
        else if (sameAge) reasonParts.push('same age');
        if (sameLocation) reasonParts.push('same location');

        const contextParts = [
          person.age > 0 ? `${person.age} years` : '',
          person.location?.trim() ?? '',
          entry.generation > 0 ? `Generation ${entry.generation}` : 'Top generation'
        ].filter(Boolean);

        return {
          personId: person.id,
          name: person.name,
          context: contextParts.join(' · '),
          reason: reasonParts.join(', '),
          score
        } satisfies DuplicatePersonMatch;
      })
      .filter((match): match is DuplicatePersonMatch => match !== null)
      .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
      .slice(0, 3);
  }

  closeModal(): void {
    if (this.locationLookupTimer) clearTimeout(this.locationLookupTimer);
    this.locationLookupRequestId += 1;
    this.googleLocationSuggestions = [];
    this.googlePlacesService.resetAutocompleteSession();
    this.modalOpen = false;
    this.currentNode = null;
    this.firstRelativePromptLabel = '';
    this.locationSuggestionsOpen = false;
  }

  deleteNode(nodeId: string): void {
    const person = this.treeService.findNode(this.treeService.getTree(), nodeId);
    if (!person) return;
    if (!this.treeService.canDeleteInCurrentTree) {
      if (this.currentRole === 'coOwner') {
        void this.treeService.requestDeleteApproval(nodeId, person.name)
          .then(() => this.showToast(`Delete request sent to the owner for ${person.name}`))
          .catch(error => {
            console.error('Delete approval request failed:', error);
            this.showToast('Could not send delete request');
          });
      } else {
        this.showToast('Only the owner can delete from this tree');
      }
      return;
    }
    if (!confirm(`Delete ${person.name} and their descendants? You can undo this change.`)) return;
    if (!this.treeService.deleteNode(nodeId)) {
      this.showToast('The root person cannot be deleted');
      return;
    }
    if (this.selectedPersonId === nodeId) this.closeProfile();
    this.showToast(`${person.name} deleted — use Undo to restore`);
  }

  selectPerson(person: TreeNode, center = false): void {
    this.expandPathToPerson(person.id);
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

  handleAiApplied(result: AiApplyResult): void {
    const currentTree = this.treeService.getTree();
    if (this.selectedPersonId && !this.treeService.findNode(currentTree, this.selectedPersonId)) {
      this.closeProfile();
    }
    const person = result.affectedIds
      .map(id => this.treeService.findNode(currentTree, id))
      .find((value): value is TreeNode => !!value);
    if (person) this.selectPerson(person, true);
    this.showToast(`${result.changedCount} ${result.changedCount === 1 ? 'change' : 'changes'} applied by the family assistant`);
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
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = undefined;
    }
    const startedAt = performance.now();
    const query = this.normalizeText(this.searchQuery);
    const location = this.normalizeText(this.searchLocation);
    const generation = this.searchGeneration === '' ? null : Number(this.searchGeneration);

    this.filteredPeople = this.searchIndex.filter(entry => {
      if (query && !entry.searchableText.includes(query)) return false;
      if (generation !== null && entry.generation !== generation) return false;
      if (location && !entry.searchableLocation.includes(location)) return false;
      if (this.searchRelationship && entry.relationship !== this.searchRelationship) return false;
      if (this.missingFilter === 'birthDate' && entry.hasBirthDate) return false;
      if (this.missingFilter === 'location' && entry.hasLocation) return false;
      if (this.missingFilter === 'photo' && entry.hasPhoto) return false;
      if (this.missingFilter === 'stories' && entry.hasStories) return false;
      return true;
    });
    this.updatePerformanceSnapshot({
      searchMs: performance.now() - startedAt
    });
  }

  queueSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.applySearch();
      this.changeDetector.markForCheck();
    }, 160);
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
    if (window.innerWidth <= 860) this.leftRailOpen = false;
    this.mobileMoreOpen = false;
  }

  openMobileTab(tab: 'tree' | 'people' | 'helper' | 'more'): void {
    this.familyHelperOpen = tab === 'helper';
    if (tab === 'tree') {
      this.setWorkspaceView('tree');
      this.resetViewport();
      return;
    }
    if (tab === 'people') {
      this.setWorkspaceView('list');
      return;
    }
    if (tab === 'helper') {
      this.leftRailOpen = false;
      this.mobileMoreOpen = false;
      return;
    }
    this.leftRailOpen = false;
    this.mobileMoreOpen = true;
  }

  closeMobileMore(): void {
    this.mobileMoreOpen = false;
  }

  openTimelineFromMobileMore(): void {
    this.setWorkspaceView('timeline');
  }

  openMyTreesFromMobileMore(): void {
    this.closeMobileMore();
    this.openMyTrees();
  }

  reopenOnboardingFromMobileMore(): void {
    this.closeMobileMore();
    this.reopenOnboarding();
  }

  openShareFromMobileMore(): void {
    this.closeMobileMore();
    void this.openShareDialog();
  }

  openImportFromMobileMore(): void {
    this.closeMobileMore();
    this.openTools('import');
  }

  selectPersonFromMobileList(person: TreeNode): void {
    this.selectPerson(person, false);
  }

  mobileRelationshipLabel(entry: PersonIndexEntry): string {
    if (entry.node.id === this.treeData?.id) return 'Starting person';
    if (entry.node.type === 'spouse') {
      const relationship = entry.node.partnerRelationshipType === 'former_spouse'
        ? 'Former spouse'
        : entry.node.partnerRelationshipType === 'partner' ? 'Partner' : 'Spouse';
      return entry.parentName ? `${relationship} of ${entry.parentName}` : relationship;
    }
    return entry.parentName
      ? `Child of ${entry.parentName}`
      : `Generation ${entry.generation + 1}`;
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
    if (this.isReadOnlyTree) {
      this.showToast('This tree is view-only for you');
      return;
    }
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

  async openShareDialog(person?: TreeNode): Promise<void> {
    if (!this.canShareCurrentTree) {
      this.showToast('Only owners and co-owners can share this tree');
      return;
    }
    if (!this.authService.currentUser) {
      const shouldSignIn = confirm('Sign in with Google to share this tree?');
      if (!shouldSignIn) return;
      await this.signInWithGoogle();
    }

    this.shareOpen = true;
    this.latestShareLink = null;
    this.shareMessage = '';
    if (person) {
      this.shareMode = 'invite';
      this.shareRecipientEmail = '';
    }
    this.shareScope = person ? 'branch' : 'tree';
    this.shareSelectedPersonId = person?.id ?? this.selectedPersonId ?? this.treeData?.id ?? '';
    this.shareSelectedPersonName = person?.name ?? this.selectedPerson?.name ?? this.treeData?.name ?? '';
    this.shareRole = this.shareScope === 'branch' ? 'branchEditor' : 'viewer';
    await this.refreshShareLinks();
  }

  closeShareDialog(): void {
    this.shareOpen = false;
    this.latestShareLink = null;
  }

  onShareScopeChange(): void {
    if (this.shareScope === 'tree') {
      this.shareRole = this.shareRole === 'coOwner' ? 'coOwner' : 'viewer';
    } else {
      this.shareRole = this.shareRole === 'branchViewer' ? 'branchViewer' : 'branchEditor';
      if (!this.shareSelectedPersonId) {
        this.shareSelectedPersonId = this.selectedPersonId ?? this.treeData?.id ?? '';
        this.shareSelectedPersonName = this.selectedPerson?.name ?? this.treeData?.name ?? '';
      }
    }
    if (this.shareMode === 'public') this.shareRole = this.shareScope === 'branch' ? 'branchViewer' : 'viewer';
  }

  onShareBranchPersonChange(): void {
    const selected = this.personIndex.find(entry => entry.node.id === this.shareSelectedPersonId);
    this.shareSelectedPersonName = selected?.node.name ?? this.shareSelectedPersonName;
  }

  async createShare(): Promise<void> {
    if (this.shareBusy) return;
    if (this.shareScope === 'branch' && !this.shareSelectedPersonId) {
      this.showToast('Choose a branch person first');
      return;
    }

    this.shareBusy = true;
    try {
      const effectiveRole: TreeAccessRole = this.shareMode === 'public'
        ? (this.shareScope === 'branch' ? 'branchViewer' : 'viewer')
        : this.shareRole;
      const share = await this.treeService.createShareLink({
        scope: this.shareScope,
        role: effectiveRole,
        isPublic: this.shareMode === 'public',
        recipientEmail: this.shareMode === 'invite' && this.isValidEmail(this.shareRecipientEmail.trim())
          ? this.shareRecipientEmail.trim()
          : undefined,
        branchRootId: this.shareScope === 'branch' ? this.shareSelectedPersonId : undefined,
        branchRootName: this.shareScope === 'branch' ? this.shareSelectedPersonName : undefined
      });
      this.latestShareLink = share;
      this.shareMessage = this.defaultShareMessage(share);
      await this.refreshShareLinks();
      this.showToast(this.shareMode === 'public' ? 'Public share link created' : 'Invite link created');
    } catch (error) {
      console.error('Share failed:', error);
      this.showToast(error instanceof Error ? error.message : 'Could not create share link');
    } finally {
      this.shareBusy = false;
    }
  }

  async refreshShareLinks(): Promise<void> {
    if (!this.authService.currentUser) {
      this.shareLinks = [];
      this.shareAccess = [];
      return;
    }
    try {
      const [shareLinks, shareAccess] = await Promise.all([
        this.treeService.getCurrentTreeShares(),
        this.treeService.getCurrentTreeAccess()
      ]);
      this.shareLinks = shareLinks;
      this.shareAccess = shareAccess;
    } catch (error) {
      console.error('Could not load share access:', error);
      this.shareLinks = [];
      this.shareAccess = [];
    }
  }

  async cancelShare(code: string): Promise<void> {
    if (!confirm('Cancel this invite/share link?')) return;
    try {
      await this.treeService.cancelShare(code);
      await this.refreshShareLinks();
      this.showToast('Share link cancelled');
    } catch (error) {
      console.error('Cancel share failed:', error);
      this.showToast('Could not cancel share');
    }
  }

  async copyShareLink(share: ShareLinkRecord = this.latestShareLink!): Promise<void> {
    if (!share) return;
    const url = this.shareUrl(share);
    if (!url) {
      this.showToast('Secure links are shown only once. Create a new invite to share again.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.showToast('Share link copied');
    } catch {
      window.prompt('Copy this share link', url);
    }
  }

  emailShare(share: ShareLinkRecord = this.latestShareLink!): void {
    if (!share) return;
    const subject = `Family tree invitation: ${share.treeName}`;
    const body = this.defaultShareMessage(share);
    const recipient = share.recipientEmail ?? '';
    window.location.href = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  whatsappShare(share: ShareLinkRecord = this.latestShareLink!): void {
    if (!share) return;
    if (!this.shareUrl(share)) {
      this.showToast('Create a new secure invite to share again');
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(this.defaultShareMessage(share))}`, '_blank', 'noopener');
  }

  async nativeShare(share: ShareLinkRecord = this.latestShareLink!): Promise<void> {
    if (!share) return;
    const url = this.shareUrl(share);
    if (!url) {
      this.showToast('Create a new secure invite to share again');
      return;
    }
    if (!navigator.share) {
      this.whatsappShare(share);
      return;
    }
    try {
      await navigator.share({
        title: `${share.inviterName || this.signedInUserLabel} shared a family branch`,
        text: this.defaultShareMessage(share).replace(url, '').trim(),
        url
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      this.whatsappShare(share);
    }
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

  async saveNow(showFeedback = true): Promise<void> {
    if (this.isReadOnlyTree) {
      if (showFeedback) this.showToast('This public tree is view-only. Create your own tree to start.');
      return;
    }
    if (!this.authService.currentUser) {
      const shouldSignIn = confirm('Sign in with Google to save this tree to the cloud?');
      if (!shouldSignIn) {
        if (showFeedback) this.showToast('Tree is saved in this browser');
        return;
      }
      await this.signInWithGoogle();
    }

    try {
      await this.treeService.saveCurrentTree();
      if (showFeedback) this.showToast(this.authService.currentUser ? 'Tree saved to cloud' : 'Tree saved in this browser');
    } catch (error) {
      console.error('Manual save failed:', error);
      if (showFeedback) this.showToast('Save failed. Check Firebase rules or sign-in status.');
    }
  }

  async createNewTree(): Promise<void> {
    const currentName = this.treeName || 'this tree';
    const shouldCreate = confirm(this.isReadOnlyTree
      ? 'Create your own family tree from a blank workspace?'
      : `Create a new family tree? Your current tree "${currentName}" will be saved first.`);
    if (!shouldCreate) return;

    if (!this.isReadOnlyTree) {
      try {
        await this.treeService.saveCurrentTree();
      } catch (error) {
        console.error('Could not save current tree before creating a new one:', error);
        if (!confirm('The current tree could not be synced to cloud. Create a new local tree anyway?')) return;
      }
    }

    const requestedName = prompt('Name this new family tree', 'New Family Tree')?.trim();
    if (requestedName === undefined) return;
    const nextTree = this.treeService.createNewTree(requestedName || 'New Family Tree');
    this.selectPerson(nextTree, false);
    this.resetViewport();
    this.myTreesOpen = false;
    this.publicSharePromptVisible = false;
    void this.refreshMyTrees();
    this.showToast(`Created ${nextTree.treeName ?? nextTree.name}`);
    this.updateTreeUrl();
  }

  async createOwnTreeFromPublic(): Promise<void> {
    this.publicSharePromptVisible = false;
    if (!this.authService.currentUser) {
      await this.signInWithGoogle();
      if (!this.authService.currentUser) return;
    }
    const requestedName = prompt('Name your new family tree', 'My Family Tree')?.trim();
    if (requestedName === undefined) return;
    const nextTree = this.treeService.createNewTree(requestedName || 'My Family Tree');
    this.selectPerson(nextTree, false);
    this.resetViewport();
    this.myTreesOpen = false;
    void this.refreshMyTrees();
    this.showToast('Your own tree is ready');
    this.updateTreeUrl();
  }

  dismissPublicSharePrompt(): void {
    this.publicSharePromptVisible = false;
  }

  dismissFirstRelativePrompt(): void {
    this.firstRelativePromptDismissedTreeIds.add(this.activeTreeId);
    localStorage.setItem(
      this.firstRelativePromptDismissedStorageKey,
      JSON.stringify([...this.firstRelativePromptDismissedTreeIds])
    );
  }

  async signInFromPublicPrompt(): Promise<void> {
    this.publicSharePromptVisible = false;
    await this.signInWithGoogle();
  }

  async downloadTree(): Promise<void> {
    if (this.isReadOnlyTree) {
      this.showToast('This tree is view-only for you');
      return;
    }
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
    if (this.isAuthBusy) {
      this.showToast('Google sign-in is already opening');
      return;
    }
    const openedFromMyTrees = this.myTreesOpen;
    this.isAuthBusy = true;
    try {
      if (this.authService.shouldUseRedirectSignIn) {
        this.storeGoogleSignInIntent(openedFromMyTrees);
        await this.authService.signInWithGoogleRedirect();
        return;
      }

      sessionStorage.removeItem(this.signInStartedStorageKey);
      const user = await this.authService.signInWithGooglePopup();
      this.isSignedIn = true;
      this.signedInUserId = user.uid;
      this.signedInUserLabel = user.displayName || user.email || 'Your account';
      await this.refreshMyTrees();
      this.myTreesOpen = openedFromMyTrees;
      this.showToast(`Successfully signed in${user.displayName ? ' as ' + user.displayName : ''}`);
    } catch (error) {
      if (this.shouldFallbackToRedirectSignIn(error)) {
        this.storeGoogleSignInIntent(openedFromMyTrees);
        await this.authService.signInWithGoogleRedirect();
        return;
      }
      console.error('Google sign-in failed:', error);
      this.showToast(this.googleSignInErrorMessage(error));
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
    this.scheduleViewportUpdate({
      position: { x: event.clientX - this.dragStart.x, y: event.clientY - this.dragStart.y }
    });
  }

  onPointerUp(): void {
    this.isDragging = false;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const direction = event.deltaY > 0 ? -0.08 : 0.08;
    const currentScale = this.pendingViewportUpdate?.scale ?? this.scale;
    this.scheduleViewportUpdate({
      scale: Math.max(this.minimumViewportScale(), Math.min(1.65, currentScale + direction))
    });
  }

  zoomIn(): void {
    const currentScale = this.pendingViewportUpdate?.scale ?? this.scale;
    this.scheduleViewportUpdate({ scale: Math.min(1.65, currentScale + 0.1) });
  }

  zoomOut(): void {
    const currentScale = this.pendingViewportUpdate?.scale ?? this.scale;
    this.scheduleViewportUpdate({ scale: Math.max(this.minimumViewportScale(), currentScale - 0.1) });
  }

  resetViewport(): void {
    this.scheduleViewportUpdate({
      position: this.defaultViewportPosition(),
      scale: this.mobileViewportScale()
    });
  }

  getZoomPercentage(): number {
    return Math.round(this.scale * 100);
  }

  trackByPersonEntry(_index: number, entry: PersonIndexEntry): string {
    return entry.node.id;
  }

  trackByTreeId(_index: number, tree: TreeSummary): string {
    return tree.treeId;
  }

  trackByShareCode(_index: number, share: ShareLinkRecord): string {
    return share.code;
  }

  trackByAccessId(_index: number, access: TreeAccess): string {
    return access.accessId ?? `${access.memberUid ?? access.memberEmail ?? access.role}_${access.treeId}`;
  }

  roleLabel(role: TreeAccessRole): string {
    const labels: Record<TreeAccessRole, string> = {
      owner: 'Owner',
      coOwner: 'Co-owner',
      viewer: 'Viewer',
      branchViewer: 'Branch viewer',
      branchEditor: 'Branch editor'
    };
    return labels[role];
  }

  treeRoleBadgeClass(role: TreeAccessRole): string {
    if (role === 'owner') return 'role-owner';
    if (role === 'coOwner') return 'role-coowner';
    return 'role-viewer';
  }

  accessDisplayName(access: TreeAccess): string {
    if (access.role === 'owner') return this.treeOwnerName || access.memberEmail || 'Tree owner';
    if (access.memberEmail) return access.memberEmail;
    return access.memberUid ? 'Accepted member' : 'Shared member';
  }

  accessInitial(access: TreeAccess): string {
    const label = this.accessDisplayName(access).trim();
    return (label[0] || 'U').toUpperCase();
  }

  accessScopeLabel(access: TreeAccess): string {
    if (access.scope === 'branch') return access.branchRootName ? `${access.branchRootName}'s branch` : 'Selected branch';
    return 'Full tree';
  }

  accessUpdatedLabel(access: TreeAccess): string {
    const label = access.acceptedAtLabel ?? access.updatedAtLabel;
    if (!label) return 'Active access';
    return `Active since ${new Date(label).toLocaleDateString()}`;
  }

  visibilityLabel(visibility: TreeVisibility): string {
    return visibility === 'public' ? 'Public' : 'Private';
  }

  shareUrl(share: ShareLinkRecord): string {
    if (share.secureInvite) {
      return share.secret ? `${window.location.origin}/i/${share.code}/${share.secret}` : '';
    }
    if (share.visibility === 'public' && share.slug) {
      return `${window.location.origin}/app/${share.slug}`;
    }
    const path = share.scope === 'branch' ? 'b' : 't';
    return `${window.location.origin}/${path}/${share.code}`;
  }

  defaultShareMessage(share: ShareLinkRecord): string {
    const url = this.shareUrl(share);
    const inviter = share.inviterName || this.authService.currentUser?.displayName || this.treeOwnerName || 'A family member';
    const scope = share.scope === 'branch' && share.branchRootName ? `${share.branchRootName}'s branch` : share.treeName;
    const action = share.role === 'branchEditor' || share.role === 'coOwner'
      ? `Could you add the relatives from your side? I already selected ${scope}, so you can start immediately.`
      : `I shared ${scope} with you to view.`;
    const remembered = this.personIndex.length ? ` and added ${this.personIndex.length} ${this.personIndex.length === 1 ? 'person' : 'people'}` : '';
    return `Hi 👋\n\n${inviter} started our family tree${remembered}. ${action}\n\nTap to join securely:\n${url}\n\nThis private invitation is single-use and expires in 7 days.`;
  }

  toggleBranch(nodeId: string): void {
    const next = new Set(this.collapsedNodeIds);
    next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId);
    this.collapsedNodeIds = next;
    this.updatePerformanceSnapshot();
  }

  revealBranch(nodeId: string): void {
    const next = new Set(this.expandedBranchIds);
    next.add(nodeId);
    this.expandedBranchIds = next;
    this.updatePerformanceSnapshot();
    const person = this.treeService.findNode(this.treeService.getTree(), nodeId);
    this.showToast(`Opened ${person?.name ?? 'that'} branch`);
  }

  revealMoreGenerations(): void {
    this.maxRenderDepth += 1;
    this.updatePerformanceSnapshot();
    this.showToast(`Showing up to ${this.maxRenderDepth + 1} generations`);
  }

  openLocationInGoogleMaps(): void {
    const query = this.formData.location.trim();
    if (!query) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank', 'noopener');
  }

  onLocationInputFocus(): void {
    this.locationSuggestionsOpen = true;
    this.highlightedLocationSuggestionIndex = 0;
    this.locationAutocompleteStatus = 'Choose a suggestion or keep your typed address';
  }

  onLocationInputChange(value: string = this.formData.location): void {
    this.formData.location = value;
    if (this.locationLookupTimer) clearTimeout(this.locationLookupTimer);
    this.googleLocationSuggestions = [];
    this.locationSuggestionsOpen = true;
    this.highlightedLocationSuggestionIndex = 0;
    const query = value.trim();
    if (query.length < 2) {
      this.locationAutocompleteStatus = 'Type at least 2 characters to search Google Maps';
      return;
    }

    this.locationAutocompleteStatus = 'Searching Google Maps…';
    const requestId = ++this.locationLookupRequestId;
    this.locationLookupTimer = setTimeout(() => this.loadGoogleLocationSuggestions(query, requestId), 250);
  }

  onLocationInputBlur(): void {
    setTimeout(() => {
      this.locationSuggestionsOpen = false;
      this.locationAutocompleteStatus = this.formData.location.trim()
        ? 'Location ready'
        : 'Start typing, then choose a place or saved suggestion';
    }, 120);
  }

  onLocationInputKeydown(event: KeyboardEvent): void {
    const suggestions = this.locationOptionList;
    if (!suggestions.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.locationSuggestionsOpen = true;
      this.highlightedLocationSuggestionIndex = Math.min(this.highlightedLocationSuggestionIndex + 1, suggestions.length - 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.locationSuggestionsOpen = true;
      this.highlightedLocationSuggestionIndex = Math.max(this.highlightedLocationSuggestionIndex - 1, 0);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.selectLocationSuggestion(suggestions[this.highlightedLocationSuggestionIndex]);
    } else if (event.key === 'Escape') {
      this.locationSuggestionsOpen = false;
    }
  }

  selectLocationSuggestion(location: string): void {
    this.formData.location = location;
    this.googleLocationSuggestions = [];
    this.googlePlacesService.resetAutocompleteSession();
    this.locationSuggestionsOpen = false;
    this.locationAutocompleteStatus = 'Location selected';
  }

  get visibleLocationSuggestions(): string[] {
    const query = this.normalizeText(this.formData.location);
    const savedSuggestions = query
      ? this.locationSuggestions.filter(location => this.normalizeText(location).includes(query))
      : this.locationSuggestions;
    return Array.from(new Set([...this.googleLocationSuggestions, ...savedSuggestions])).slice(0, 6);
  }

  get locationOptionList(): string[] {
    const options = [...this.visibleLocationSuggestions];
    const typed = this.formData.location.trim();
    if (typed && this.canUseTypedLocation) options.push(typed);
    return options;
  }

  get canUseTypedLocation(): boolean {
    const typed = this.formData.location.trim();
    if (!typed) return false;
    return ![...this.googleLocationSuggestions, ...this.locationSuggestions]
      .some(location => this.normalizeText(location) === this.normalizeText(typed));
  }

  isGoogleLocationSuggestion(location: string): boolean {
    return this.googleLocationSuggestions.includes(location);
  }

  focusPersonFormControl(event: PointerEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.closest('button, [role="radio"], .living-toggle')) return;

    const control = target.matches('input, select, textarea')
      ? target
      : target.closest('.field')?.querySelector<HTMLElement>('input:not([type="checkbox"]), select, textarea');
    if (control && !control.hasAttribute('disabled')) control.focus({ preventScroll: true });
  }

  private async loadRequestedRouteIfPresent(): Promise<void> {
    if (/^\/i\//i.test(window.location.pathname)) {
      await this.loadSecureInviteRouteIfPresent();
      return;
    }
    if (/^\/tree\//i.test(window.location.pathname)) {
      await this.loadTreeRouteIfPresent();
      return;
    }
    await this.loadSharedRouteIfPresent();
  }

  private async loadSecureInviteRouteIfPresent(): Promise<void> {
    const credentials = this.secureInviteCredentialsFromPath();
    if (!credentials) return;
    this.myTreesOpen = false;
    this.onboardingVisible = false;
    this.inviteLandingVisible = true;
    this.inviteBusy = true;
    this.inviteError = '';

    try {
      const result = await this.treeService.getSecureInvitePreview(credentials.inviteId, credentials.secret);
      this.inviteStatus = result.status;
      this.inviteShare = result.share ?? null;
      this.sharedRouteLoading = false;
      if (result.share) {
        this.titleService.setTitle(`${result.share.inviterName || result.share.treeOwnerName} invited you | My Family`);
      }

      const pendingPath = sessionStorage.getItem(this.pendingInviteJoinStorageKey);
      if (result.status === 'ready' && this.authService.currentUser && pendingPath === window.location.pathname) {
        await this.acceptSecureInvite(credentials.inviteId, credentials.secret);
      }
    } catch (error) {
      console.error('Secure invite preview failed:', error);
      this.inviteStatus = this.inviteStatusFromError(error);
      this.inviteShare = null;
      this.sharedRouteLoading = false;
    } finally {
      this.inviteBusy = false;
      this.changeDetector.markForCheck();
    }
  }

  async joinSecureInvite(): Promise<void> {
    const credentials = this.secureInviteCredentialsFromPath();
    if (!credentials || this.inviteBusy) return;
    this.inviteError = '';

    if (!this.authService.currentUser) {
      sessionStorage.setItem(this.pendingInviteJoinStorageKey, window.location.pathname);
      await this.signInWithGoogle();
      if (!this.authService.currentUser) return;
    }
    await this.acceptSecureInvite(credentials.inviteId, credentials.secret);
  }

  leaveSecureInvite(): void {
    sessionStorage.removeItem(this.pendingInviteJoinStorageKey);
    this.inviteLandingVisible = false;
    this.inviteShare = null;
    this.inviteError = '';
    window.history.replaceState(window.history.state, '', '/');
    this.onboardingVisible = this.treeService.onboardingNeeded;
    this.titleService.setTitle('My Family | Explore History, Preserve Your Family Story');
  }

  private async acceptSecureInvite(inviteId: string, secret: string): Promise<void> {
    this.inviteBusy = true;
    this.inviteError = '';
    try {
      const result = await this.treeService.claimSecureInvite(inviteId, secret);
      if (result.status !== 'loaded') {
        this.inviteStatus = result.status;
        return;
      }

      sessionStorage.removeItem(this.pendingInviteJoinStorageKey);
      this.inviteLandingVisible = false;
      this.inviteShare = null;
      this.sharedRouteLoading = false;
      this.myTreesOpen = false;
      this.onboardingVisible = false;
      this.resetTreeRevealState();
      const root = this.treeService.getTree();
      this.selectPerson(root, false);
      this.resetViewport();
      this.replaceInviteUrlWithTreeUrl();
      this.showToast(result.share?.role === 'branchEditor'
        ? 'Your branch is ready — add the relatives you remember'
        : 'Private family tree opened');
    } catch (error) {
      console.error('Secure invite claim failed:', error);
      this.inviteStatus = this.inviteStatusFromError(error);
      if (this.inviteStatus === 'unavailable') {
        this.inviteError = this.secureInviteErrorMessage(error);
      }
    } finally {
      this.inviteBusy = false;
      this.changeDetector.markForCheck();
    }
  }

  private secureInviteCredentialsFromPath(): { inviteId: string; secret: string } | null {
    const match = window.location.pathname.match(/^\/i\/([A-Za-z0-9_-]{16,64})\/([A-Za-z0-9_-]{32,128})\/?$/);
    return match ? { inviteId: match[1], secret: match[2] } : null;
  }

  private replaceInviteUrlWithTreeUrl(): void {
    const routeId = this.treeService.currentRouteId;
    const path = routeId ? `/tree/${routeId}` : '/';
    window.history.replaceState(window.history.state, '', path);
  }

  private inviteStatusFromError(error: unknown): SharedTreeLoadStatus {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    if (code.endsWith('/deadline-exceeded')) return 'expired';
    if (code.endsWith('/already-exists')) return 'claimed';
    if (code.endsWith('/permission-denied')) return 'cancelled';
    return 'unavailable';
  }

  private secureInviteErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      const message = String((error as { message?: unknown }).message).replace(/^FirebaseError:\s*/i, '');
      if (message) return message;
    }
    return 'The invitation could not be accepted. Please try again.';
  }

  private async loadTreeRouteIfPresent(): Promise<void> {
    const match = window.location.pathname.match(/^\/tree\/([a-f0-9]{4}(?:-[a-f0-9]{4}){3})$/i);
    if (!match) return;
    this.myTreesOpen = false;
    try {
      const result = await this.treeService.loadTreeFromRouteId(match[1]);
      this.sharedRouteLoading = false;
      this.onboardingVisible = false;
      if (result.status === 'loaded') {
        this.myTreesOpen = false;
        this.resetViewport();
        this.updateTreeUrl();
        this.showToast('Family tree opened');
        return;
      }
      this.myTreesOpen = true;
      if (result.status === 'signInRequired') {
        this.showToast('Sign in to open this private family tree');
      } else if (result.status === 'forbidden') {
        this.showToast('You do not have permission to open this family tree');
      } else {
        this.showToast('This family tree URL is not available');
      }
    } catch (error) {
      console.error('Tree route failed:', error);
      this.sharedRouteLoading = false;
      this.onboardingVisible = false;
      this.myTreesOpen = true;
      this.showToast('Could not open this family tree');
    }
  }

  private async loadSharedRouteIfPresent(): Promise<void> {
    const match = window.location.pathname.match(/^\/([tb])\/([A-Z0-9]+)$/i);
    const publicSlug = this.publicAppSlugFromPath();
    if (!match && !publicSlug) return;
    this.myTreesOpen = false;
    try {
      let result = match
        ? await this.treeService.loadTreeFromShareCode(match[2].toUpperCase())
        : await this.treeService.loadTreeFromPublicSlug(publicSlug!);
      if (!match && publicSlug && result.status === 'notFound') {
        result = this.treeService.loadGeneratedPublicTreeFromSlug(publicSlug);
      }
      if (!match && publicSlug && result.status === 'notFound') {
        result = await this.treeService.loadPublicTreeFromSlug(publicSlug);
      }
      if (result.status === 'loaded') {
        this.sharedRouteLoading = false;
        this.myTreesOpen = false;
        this.onboardingVisible = false;
        this.publicSharePromptVisible = !!result.share && result.share.visibility === 'public' && !this.authService.currentUser;
        this.resetViewport();
        this.showToast(publicSlug ? 'Public family tree opened' : 'Shared family tree opened');
        return;
      }
      this.sharedRouteLoading = false;
      this.onboardingVisible = false;
      if (result.status === 'signInRequired') {
        this.myTreesOpen = true;
        this.showToast('Sign in with the invited email to open this private tree');
        return;
      }
      if (result.status === 'forbidden') {
        this.myTreesOpen = true;
        this.showToast('This invite belongs to another email address');
        return;
      }
      this.myTreesOpen = true;
      this.showToast('This share link is not available');
    } catch (error) {
      console.error('Shared route failed:', error);
      this.sharedRouteLoading = false;
      this.onboardingVisible = false;
      this.myTreesOpen = true;
      this.showToast('Could not open the shared tree');
    }
  }

  private isRoutedPath(): boolean {
    return /^\/i\/[A-Za-z0-9_-]{16,64}\/[A-Za-z0-9_-]{32,128}\/?$/.test(window.location.pathname)
      || /^\/([tb])\/([A-Z0-9]+)$/i.test(window.location.pathname)
      || /^\/tree\/[a-f0-9]{4}(?:-[a-f0-9]{4}){3}$/i.test(window.location.pathname)
      || this.publicAppSlugFromPath() !== null;
  }

  private publicAppSlugFromPath(): string | null {
    const match = window.location.pathname.match(/^\/app\/([^/?#]+)\/?$/i);
    if (!match) return null;
    const slug = decodeURIComponent(match[1]).trim().replace(/,+$/g, '').toLowerCase();
    return slug || null;
  }

  private updateTreeUrl(): void {
    const routeId = this.treeService.currentRouteId;
    if (!this.isSignedIn || !routeId || /^\/(?:[tbi])\//i.test(window.location.pathname)) return;
    const path = `/tree/${routeId}`;
    if (window.location.pathname === path) return;
    window.history.replaceState(window.history.state, '', `${path}${window.location.search}${window.location.hash}`);
  }

  private async loadGoogleLocationSuggestions(query: string, requestId: number): Promise<void> {
    try {
      const suggestions = await this.googlePlacesService.getPlaceSuggestions(query);
      if (requestId !== this.locationLookupRequestId || !this.modalOpen || this.formData.location.trim() !== query) return;
      this.googleLocationSuggestions = suggestions;
      this.locationSuggestionsOpen = true;
      this.locationAutocompleteStatus = suggestions.length
        ? 'Choose a Google Maps suggestion or use your typed address'
        : 'No Google Maps match. You can keep your typed address';
      this.changeDetector.detectChanges();
    } catch (error) {
      if (requestId !== this.locationLookupRequestId || !this.modalOpen) return;
      console.error('Google Places suggestion search failed:', error);
      this.googleLocationSuggestions = [];
      this.locationAutocompleteStatus = 'Google Maps unavailable for this URL. Check the API key allowed referrers';
      this.changeDetector.detectChanges();
    }
  }

  getModalTitle(): string {
    if (!this.currentNode) return '';
    if (this.firstRelativePromptLabel) return `Add ${this.firstRelativePromptLabel} for ${this.currentNode.name}`;
    if (this.actionType === 'add_parent') return `Add a parent for ${this.currentNode.name}`;
    if (this.actionType === 'add_child') return `Add a child to ${this.currentNode.name}`;
    if (this.actionType === 'add_spouse') return `Add a partner for ${this.currentNode.name}`;
    return `Edit ${this.currentNode.name}`;
  }

  canAddParent(person: TreeNode | null): boolean {
    return !!person && this.treeService.canAddParent(person.id);
  }

  get syncLabel(): string {
    const labels: Record<SyncStatus, string> = {
      local: 'Saved locally', syncing: 'Syncing…', synced: 'Cloud synced', error: 'Sync needs attention'
    };
    return labels[this.syncStatus];
  }

  startEditingTreeName(): void {
    if (this.isReadOnlyTree) {
      this.showToast('This tree is view-only for you');
      return;
    }
    this.treeNameDraft = this.treeName;
    this.editingTreeName = true;
    setTimeout(() => document.querySelector<HTMLInputElement>('.tree-name-editor input')?.select());
  }

  startEditingTreeOwnerName(): void {
    if (this.isReadOnlyTree) {
      this.showToast('This tree is view-only for you');
      return;
    }
    this.treeOwnerNameDraft = this.treeOwnerName;
    this.editingTreeOwnerName = true;
    setTimeout(() => document.querySelector<HTMLInputElement>('.tree-owner-editor input')?.select());
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

  saveTreeOwnerName(): void {
    if (!this.editingTreeOwnerName) return;
    const nextName = this.treeOwnerNameDraft.trim();
    this.editingTreeOwnerName = false;
    if (!nextName) {
      this.treeOwnerNameDraft = this.treeOwnerName;
      return;
    }
    this.treeService.setTreeOwnerName(nextName);
    this.showToast(`Tree owner set to ${nextName}`);
  }

  private rebuildDerivedState(): void {
    const startedAt = performance.now();
    this.treeName = this.treeData?.treeName ?? `${this.treeData?.name ?? 'My'} Family`;
    if (!this.editingTreeName) this.treeNameDraft = this.treeName;
    this.updateDocumentTitle();
    this.treeOwnerName = this.treeData?.treeOwnerName ?? this.treeData?.name ?? 'You';
    if (!this.editingTreeOwnerName) this.treeOwnerNameDraft = this.treeOwnerName;
    this.personIndex = this.treeService.getPersonIndex();
    this.searchIndex = this.buildSearchIndex();
    this.locationSuggestions = this.buildLocationSuggestions();
    this.generationOptions = [...new Set(this.personIndex.map(entry => entry.generation))];
    this.applySearch();
    this.timelineEntries = this.treeService.getTimeline();
    this.applyTimelineFilters();
    if (this.selectedPersonId) {
      const refreshed = this.treeService.findNode(this.treeService.getTree(), this.selectedPersonId);
      if (refreshed) this.selectPerson(refreshed, false);
      else this.closeProfile();
    }
    this.updatePerformanceSnapshot({
      derivedStateMs: performance.now() - startedAt
    });
  }

  private updateDocumentTitle(): void {
    const cleanTreeName = this.treeName.trim() || 'My Family';
    this.titleService.setTitle(`${cleanTreeName} Family Tree | Our Family Legacy`);
  }

  private buildSearchIndex(): SearchIndexEntry[] {
    return this.personIndex.map(entry => {
      const person = entry.node;
      const searchableText = this.normalizeText([
        person.name,
        ...(person.alternateNames ?? []),
        person.birthDate?.slice(0, 4) ?? '',
        person.deathDate?.slice(0, 4) ?? '',
        person.location,
        person.birthPlace ?? '',
        ...(person.tags ?? [])
      ].join(' '));

      return {
        ...entry,
        searchableText,
        searchableLocation: this.normalizeText(`${person.location} ${person.birthPlace ?? ''}`),
        relationship: person.type === 'spouse'
          ? person.partnerRelationshipType
          : person.parentRelationshipType,
        hasBirthDate: !!person.birthDate,
        hasLocation: !!person.location,
        hasPhoto: !!person.photoUrl,
        hasStories: !!person.stories?.length
      };
    });
  }

  private scheduleViewportUpdate(update: { position?: { x: number; y: number }; scale?: number }): void {
    this.pendingViewportUpdate = {
      position: update.position ?? this.pendingViewportUpdate?.position,
      scale: update.scale ?? this.pendingViewportUpdate?.scale,
      startedAt: this.pendingViewportUpdate?.startedAt ?? performance.now()
    };

    if (this.viewportFrameId !== null) return;
    this.viewportFrameId = requestAnimationFrame(() => {
      const pending = this.pendingViewportUpdate;
      this.viewportFrameId = null;
      this.pendingViewportUpdate = null;
      if (!pending) return;
      if (pending.position) this.position = pending.position;
      if (pending.scale !== undefined) this.scale = pending.scale;
      this.updatePerformanceSnapshot({
        viewportMs: performance.now() - pending.startedAt
      });
      this.changeDetector.markForCheck();
    });
  }

  private updatePerformanceSnapshot(updates: Partial<PerformanceSnapshot> = {}): void {
    const totalPeople = this.personIndex.length;
    const renderedPeople = this.treeData ? this.countRenderedPeople(this.treeData, 0) : 0;
    this.performanceSnapshot = {
      ...this.performanceSnapshot,
      totalPeople,
      renderedPeople,
      hiddenPeople: Math.max(totalPeople - renderedPeople, 0),
      maxRenderDepth: this.maxRenderDepth,
      lastMeasuredAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      ...updates
    };
  }

  private resetTreeRevealState(): void {
    this.maxRenderDepth = 2;
    this.collapsedNodeIds = new Set<string>();
    this.expandedBranchIds = new Set<string>();
    this.updatePerformanceSnapshot();
  }

  private mobileViewportScale(): number {
    if (window.innerWidth <= 600) return 0.9;
    if (window.innerWidth <= 860) return 0.82;
    return 0.86;
  }

  private minimumViewportScale(): number {
    return window.innerWidth <= 600 ? 0.4 : 0.35;
  }

  private defaultViewportPosition(): { x: number; y: number } {
    if (window.innerWidth <= 600) {
      return { x: 0, y: 0 };
    }
    return { x: 0, y: 10 };
  }

  private countRenderedPeople(node: TreeNode, depth: number): number {
    let count = 1 + (node.spouse ? 1 : 0);
    if (
      this.collapsedNodeIds.has(node.id)
      || (depth >= this.maxRenderDepth && !this.expandedBranchIds.has(node.id))
    ) return count;
    node.children.forEach(child => count += this.countRenderedPeople(child, depth + 1));
    return count;
  }

  private expandPathToPerson(personId: string): void {
    if (!this.treeData || this.treeData.id === personId) return;
    const path = this.findPathToPerson(this.treeData, personId);
    if (!path.length) return;
    const nextExpanded = new Set(this.expandedBranchIds);
    const nextCollapsed = new Set(this.collapsedNodeIds);
    path.slice(0, -1).forEach(id => {
      nextExpanded.add(id);
      nextCollapsed.delete(id);
    });
    this.expandedBranchIds = nextExpanded;
    this.collapsedNodeIds = nextCollapsed;
  }

  private findPathToPerson(node: TreeNode, personId: string, path: string[] = []): string[] {
    const nextPath = [...path, node.id];
    if (node.id === personId) return nextPath;
    if (node.spouse?.id === personId) return [...nextPath, node.spouse.id];
    for (const child of node.children) {
      const childPath = this.findPathToPerson(child, personId, nextPath);
      if (childPath.length) return childPath;
    }
    return [];
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

  private buildLocationSuggestions(): string[] {
    const savedLocations = this.personIndex
      .map(entry => entry.node.location?.trim())
      .filter((location): location is string => !!location);
    return Array.from(new Set([...savedLocations, ...this.defaultLocationSuggestions])).slice(0, 12);
  }

  private loadDismissedHints(): void {
    try {
      const saved = JSON.parse(localStorage.getItem('myFamilyTree_dismissedHints_v1') ?? '[]') as unknown;
      if (Array.isArray(saved)) this.dismissedHints = new Set(saved.filter((value): value is string => typeof value === 'string'));
    } catch {
      this.dismissedHints = new Set<string>();
    }
  }

  private loadFirstRelativePromptDismissals(): void {
    try {
      const saved = JSON.parse(localStorage.getItem(this.firstRelativePromptDismissedStorageKey) ?? '[]') as unknown;
      if (Array.isArray(saved)) {
        this.firstRelativePromptDismissedTreeIds = new Set(saved.filter((value): value is string => typeof value === 'string'));
      }
    } catch {
      this.firstRelativePromptDismissedTreeIds = new Set<string>();
    }
  }

  private emptyForm(): FormData {
    return {
      name: '', age: '', email: '', gender: Gender.OTHER, isAlive: true, location: '',
      alternateNames: '', birthDate: '', deathDate: '', birthPlace: '', notes: '', tags: '', photoUrl: '',
      socialProfiles: this.emptySocialProfileForm(),
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
      birthDate: this.dateForForm(node.birthDate),
      deathDate: this.dateForForm(node.deathDate),
      birthPlace: node.birthPlace ?? '',
      notes: node.notes ?? '',
      tags: (node.tags ?? []).join(', '),
      photoUrl: node.photoUrl ?? '',
      socialProfiles: this.socialProfileFormFromNode(node),
      parentRelationshipType: node.parentRelationshipType ?? 'biological_parent',
      partnerRelationshipType: node.partnerRelationshipType ?? 'partner',
      relationshipStartDate: this.dateForForm(node.relationshipStartDate),
      relationshipEndDate: this.dateForForm(node.relationshipEndDate)
    };
  }

  private nodeFieldsFromForm(
    age: number,
    dates: { birthDate?: string; deathDate?: string; relationshipStartDate?: string; relationshipEndDate?: string }
  ): Omit<TreeNode, 'id' | 'spouse' | 'children'> {
    return {
      name: this.formData.name.trim(),
      age,
      email: this.formData.email.trim() || undefined,
      gender: this.formData.gender,
      isAlive: this.formData.isAlive,
      location: this.formData.location.trim(),
      type: this.actionType === 'add_spouse'
        ? 'spouse'
        : this.actionType === 'edit'
          ? (this.currentNode?.type ?? 'blood')
          : 'blood',
      alternateNames: this.splitList(this.formData.alternateNames),
      birthDate: dates.birthDate,
      deathDate: this.formData.isAlive ? undefined : dates.deathDate,
      birthPlace: this.formData.birthPlace.trim() || undefined,
      notes: this.formData.notes.trim() || undefined,
      tags: this.splitList(this.formData.tags),
      photoUrl: this.formData.photoUrl.trim() || undefined,
      socialProfiles: this.socialPlatformOptions
        .map(option => ({
          platform: option.value,
          handle: this.formData.socialProfiles[option.value].handle.trim(),
          isPublic: this.formData.socialProfiles[option.value].isPublic
        }))
        .filter(profile => Boolean(profile.handle)),
      parentRelationshipType: this.formData.parentRelationshipType,
      partnerRelationshipType: this.formData.partnerRelationshipType,
      relationshipStartDate: dates.relationshipStartDate,
      relationshipEndDate: dates.relationshipEndDate
    };
  }

  private emptySocialProfileForm(): FormData['socialProfiles'] {
    return {
      instagram: { handle: '', isPublic: false },
      facebook: { handle: '', isPublic: false },
      snapchat: { handle: '', isPublic: false },
      x: { handle: '', isPublic: false },
      linkedin: { handle: '', isPublic: false },
      youtube: { handle: '', isPublic: false },
      tiktok: { handle: '', isPublic: false }
    };
  }

  private socialProfileFormFromNode(node: TreeNode): FormData['socialProfiles'] {
    const profiles = this.emptySocialProfileForm();
    for (const profile of node.socialProfiles ?? []) {
      profiles[profile.platform] = {
        handle: profile.handle,
        isPublic: profile.isPublic
      };
    }
    return profiles;
  }

  private parseAgeInput(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    if (!/^\d{1,3}$/.test(trimmed)) return null;
    const age = Number(trimmed);
    return age >= 0 && age <= 130 ? age : null;
  }

  private normalizedFormDates(): { birthDate?: string; deathDate?: string; relationshipStartDate?: string; relationshipEndDate?: string } | null {
    const fields = [
      ['birthDate', 'Birth date'],
      ['deathDate', 'Death date'],
      ['relationshipStartDate', 'Relationship began'],
      ['relationshipEndDate', 'Relationship ended']
    ] as const;

    const normalized: { birthDate?: string; deathDate?: string; relationshipStartDate?: string; relationshipEndDate?: string } = {};
    for (const [key, label] of fields) {
      const date = this.normalizeDateInput(this.formData[key], label);
      if (date === null) return null;
      normalized[key] = date;
    }
    return normalized;
  }

  private normalizeDateInput(value: string, label: string): string | undefined | null {
    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    const dayFirstMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    const match = isoMatch ?? dayFirstMatch;
    if (!match) {
      this.showToast(`${label} should be dd-mm-yyyy`);
      return null;
    }

    const year = isoMatch ? Number(match[1]) : Number(match[3]);
    const month = isoMatch ? Number(match[2]) : Number(match[2]);
    const day = isoMatch ? Number(match[3]) : Number(match[1]);
    const normalized = this.validDateParts(year, month, day);
    if (!normalized) {
      this.showToast(`${label} is not a valid date`);
      return null;
    }
    return normalized;
  }

  private validDateParts(year: number, month: number, day: number): string | null {
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() !== year ||
      candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day
    ) {
      return null;
    }
    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  private dateForForm(value?: string): string {
    if (!value) return '';
    const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch && this.validDateParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))) {
      return value;
    }

    // Keep previously entered day-first dates usable after upgrading the
    // field from free text to the browser's native ISO date control.
    const dayFirstMatch = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (!dayFirstMatch) return '';
    return this.validDateParts(
      Number(dayFirstMatch[3]),
      Number(dayFirstMatch[2]),
      Number(dayFirstMatch[1])
    ) ?? '';
  }

  private splitList(value: string): string[] {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }

  private normalizeText(value: string): string {
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private normalizePersonIdentity(value: string): string {
    return this.normalizeText(value)
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private comparableDate(value: string): string {
    const trimmed = value.trim();
    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    const dayFirst = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    return dayFirst ? `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}` : '';
  }

  private validComparableAge(value: string): number | null {
    const trimmed = value.trim();
    if (!/^\d{1,3}$/.test(trimmed)) return null;
    const age = Number(trimmed);
    return age >= 0 && age <= 130 ? age : null;
  }

  private editDistanceAtMostOne(left: string, right: string): boolean {
    if (left === right) return true;
    if (Math.abs(left.length - right.length) > 1) return false;

    let leftIndex = 0;
    let rightIndex = 0;
    let edits = 0;
    while (leftIndex < left.length && rightIndex < right.length) {
      if (left[leftIndex] === right[rightIndex]) {
        leftIndex += 1;
        rightIndex += 1;
        continue;
      }
      edits += 1;
      if (edits > 1) return false;
      if (left.length > right.length) leftIndex += 1;
      else if (right.length > left.length) rightIndex += 1;
      else {
        leftIndex += 1;
        rightIndex += 1;
      }
    }
    if (leftIndex < left.length || rightIndex < right.length) edits += 1;
    return edits <= 1;
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private googleSignInErrorMessage(error: unknown): string {
    const code = typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    if (code === 'auth/unauthorized-domain') {
      return `Add ${window.location.hostname} to Firebase authorized domains`;
    }
    if (code === 'auth/cancelled-popup-request') return 'Google sign-in is already opening. Try once more.';
    if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled';
    return 'Google sign-in failed. Check Firebase Authentication settings.';
  }

  private shouldFallbackToRedirectSignIn(error: unknown): boolean {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    return code === 'auth/popup-blocked'
      || code === 'auth/operation-not-supported-in-this-environment'
      || code === 'auth/web-storage-unsupported';
  }

  private scheduleIncompleteSignInNotice(): void {
    const intent = this.readGoogleSignInIntent();
    if (!intent) return;
    if (Date.now() - intent.startedAt > 120000) {
      sessionStorage.removeItem(this.signInStartedStorageKey);
      return;
    }
    if (this.authService.currentUser) return;
    if (this.signInReturnTimer) clearTimeout(this.signInReturnTimer);
    this.signInReturnTimer = setTimeout(() => {
      if (this.authService.currentUser || !sessionStorage.getItem(this.signInStartedStorageKey)) return;
      sessionStorage.removeItem(this.signInStartedStorageKey);
      this.myTreesOpen = intent.reopenMyTrees;
      this.showToast('Google sign-in did not finish. Please try again.');
      this.changeDetector.markForCheck();
    }, 7000);
  }

  private storeGoogleSignInIntent(reopenMyTrees: boolean): void {
    sessionStorage.setItem(this.signInStartedStorageKey, JSON.stringify({
      startedAt: Date.now(),
      reopenMyTrees
    }));
  }

  private readGoogleSignInIntent(): { startedAt: number; reopenMyTrees: boolean } | null {
    const stored = sessionStorage.getItem(this.signInStartedStorageKey);
    if (!stored) return null;

    try {
      const parsed = JSON.parse(stored) as { startedAt?: unknown; reopenMyTrees?: unknown } | number;
      if (typeof parsed === 'number') {
        return Number.isFinite(parsed) ? { startedAt: parsed, reopenMyTrees: false } : null;
      }
      const startedAt = Number(parsed.startedAt);
      if (!Number.isFinite(startedAt)) return null;
      return { startedAt, reopenMyTrees: parsed.reopenMyTrees === true };
    } catch {
      const startedAt = Number(stored);
      return Number.isFinite(startedAt) ? { startedAt, reopenMyTrees: false } : null;
    }
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
