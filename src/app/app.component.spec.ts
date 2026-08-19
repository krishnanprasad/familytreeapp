import { fakeAsync, flush, TestBed, tick } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { appConfig } from './app.config';
import { AuthService } from './services/auth.service';
import { GooglePlacesService } from './services/google-places.service';

describe('AppComponent', () => {
  let googlePlacesService: jasmine.SpyObj<GooglePlacesService>;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    googlePlacesService = jasmine.createSpyObj<GooglePlacesService>('GooglePlacesService', [
      'getPlaceSuggestions',
      'resetAutocompleteSession'
    ]);
    googlePlacesService.getPlaceSuggestions.and.resolveTo([]);

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        ...appConfig.providers,
        { provide: GooglePlacesService, useValue: googlePlacesService }
      ]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('My Family');
  });

  it('should use the simplified mobile navigation destinations', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.mobile-action span') as NodeListOf<HTMLElement>
    ).map(element => element.textContent?.trim());
    expect(labels).toEqual(['Tree', 'People', 'Add', 'Helper', 'More']);

    app.openMobileTab('helper');
    fixture.detectChanges();
    expect(app.familyHelperOpen).toBeTrue();
    expect(fixture.nativeElement.querySelector('[aria-label="Family helper"]')).toBeTruthy();
  });

  it('should provide a mobile people list with plain-language relationships', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app.openMobileTab('people');
    fixture.detectChanges();

    expect(app.workspaceView).toBe('list');
    const list = fixture.nativeElement.querySelector('.mobile-family-list') as HTMLElement;
    expect(list).toBeTruthy();
    expect(list.textContent).toContain('Starting person');
  });

  it('should start mobile at a readable zoom and allow a 40% overview', fakeAsync(() => {
    spyOnProperty(window, 'innerWidth', 'get').and.returnValue(390);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    expect(app.scale).toBe(0.9);
    expect(app.position).toEqual({ x: 0, y: 0 });

    for (let index = 0; index < 8; index += 1) app.zoomOut();
    tick(17);

    expect(app.scale).toBe(0.4);
    expect(fixture.nativeElement.textContent).toContain('Swipe to explore');
    fixture.destroy();
    flush();
  }));

  it('should move timeline and advanced mobile destinations into More', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app.openMobileTab('more');
    fixture.detectChanges();

    const sheet = fixture.nativeElement.querySelector('.mobile-more-sheet') as HTMLElement;
    expect(sheet).toBeTruthy();
    expect(sheet.textContent).toContain('Timeline');
    expect(sheet.textContent).toContain('My trees');
    expect(sheet.textContent).toContain('Guided setup');
    expect(sheet.textContent).toContain('Share & access');
  });

  it('should close the profile drawer before opening an editable person form', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const person = app.treeData!;

    app.selectPerson(person);
    expect(app.selectedPerson).toBeTruthy();

    app.openPersonForm(person, 'edit');
    fixture.detectChanges();

    expect(app.selectedPerson).toBeNull();
    expect(app.modalOpen).toBeTrue();
    const nameInput = fixture.nativeElement.querySelector('input[name="name"]') as HTMLInputElement;
    expect(nameInput.disabled).toBeFalse();
    expect(nameInput.readOnly).toBeFalse();
  });

  it('should save age, day-first birth date, and current location from the edit form', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const person = app.treeData!;

    app.openPersonForm(person, 'edit');
    app.formData.age = '44';
    app.formData.birthDate = '15-04-1982';
    app.formData.location = 'Salem, Tamil Nadu, India';
    app.handleSubmit();
    fixture.detectChanges();

    const updatedPerson = app.treeData!;
    expect(updatedPerson.age).toBe(44);
    expect(updatedPerson.birthDate).toBe('1982-04-15');
    expect(updatedPerson.location).toBe('Salem, Tamil Nadu, India');
  });

  it('should save social handles and expose only profiles marked public', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const person = app.treeData!;

    app.openPersonForm(person, 'edit');
    app.formData.socialProfiles.instagram = { handle: '@familytester', isPublic: true };
    app.formData.socialProfiles.snapchat = { handle: 'private-family-snap', isPublic: false };
    app.handleSubmit();
    fixture.detectChanges();

    expect(app.treeData?.socialProfiles).toEqual([
      { platform: 'instagram', handle: '@familytester', isPublic: true },
      { platform: 'snapchat', handle: 'private-family-snap', isPublic: false }
    ]);
    const profile = fixture.nativeElement.querySelector('.profile-drawer') as HTMLElement;
    expect(profile.textContent).toContain('@familytester');
    expect(profile.textContent).not.toContain('private-family-snap');
  });

  it('should change gender with the segmented control instead of a dropdown', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const person = app.treeData!;

    app.openPersonForm(person, 'edit');
    fixture.detectChanges();

    const genderButtons = fixture.nativeElement.querySelectorAll('.segmented-choice button') as NodeListOf<HTMLButtonElement>;
    expect(genderButtons.length).toBe(3);
    expect(fixture.nativeElement.querySelector('select[name="gender"]')).toBeNull();

    genderButtons[0].click();
    fixture.detectChanges();

    expect(app.formData.gender).toBe('female');
    expect(genderButtons[0].classList).toContain('active');
  });

  it('should show a clickable location suggestion dropdown', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app.openPersonForm(app.treeData!, 'edit');
    fixture.detectChanges();

    expect(app.locationAutocompleteStatus).toContain('Start typing');
    const locationInput = fixture.nativeElement.querySelector('input[name="location"]') as HTMLInputElement;
    expect(locationInput).toBeTruthy();
    expect(locationInput.autocomplete).toBe('off');
    expect(locationInput.getAttribute('list')).toBeNull();

    locationInput.dispatchEvent(new Event('focus'));
    fixture.detectChanges();

    let suggestionButtons = fixture.nativeElement.querySelectorAll('.location-suggestions button') as NodeListOf<HTMLButtonElement>;
    expect(suggestionButtons.length).toBeGreaterThan(0);
    expect(suggestionButtons[0].textContent).toContain('Salem, Tamil Nadu, India');

    app.formData.location = 'coim';
    app.onLocationInputChange();
    fixture.detectChanges();

    suggestionButtons = fixture.nativeElement.querySelectorAll('.location-suggestions button') as NodeListOf<HTMLButtonElement>;
    expect(suggestionButtons[0].textContent).toContain('Coimbatore, Tamil Nadu, India');
    expect(suggestionButtons[0].classList).toContain('active');

    suggestionButtons[0].click();
    fixture.detectChanges();

    expect(app.formData.location).toBe('Coimbatore, Tamil Nadu, India');
    expect(app.locationSuggestionsOpen).toBeFalse();
  });

  it('should focus the email input when its textbox is clicked', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app.openPersonForm(app.treeData!, 'edit');
    fixture.detectChanges();

    const emailInput = fixture.nativeElement.querySelector('input[name="email"]') as HTMLInputElement;
    emailInput.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

    expect(document.activeElement).toBe(emailInput);
    expect(emailInput.autocomplete).toBe('email');
  });

  it('should add live Google Maps results to the location dropdown', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    googlePlacesService.getPlaceSuggestions.and.resolveTo([
      'Srirangam, Tiruchirappalli, Tamil Nadu, India'
    ]);

    app.openPersonForm(app.treeData!, 'edit');
    app.formData.location = 'Srirangam';
    app.onLocationInputChange();
    tick(251);
    fixture.detectChanges();

    const suggestionButtons = fixture.nativeElement.querySelectorAll('.location-suggestions button') as NodeListOf<HTMLButtonElement>;
    expect(googlePlacesService.getPlaceSuggestions).toHaveBeenCalledWith('Srirangam');
    expect(suggestionButtons[0].textContent).toContain('Srirangam, Tiruchirappalli');
    expect(suggestionButtons[0].textContent).toContain('Google Maps');
  }));

  it('should search using the current location input value instead of the previous model value', fakeAsync(() => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app.openPersonForm(app.treeData!, 'edit');
    app.formData.location = 'Salem, Tamil Nadu, India';

    app.onLocationInputChange('Velachery');
    tick(251);

    expect(app.formData.location).toBe('Velachery');
    expect(googlePlacesService.getPlaceSuggestions).toHaveBeenCalledWith('Velachery');
    fixture.destroy();
    flush();
  }));

  it('should keep a typed location available when it does not match suggestions', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app.openPersonForm(app.treeData!, 'edit');
    app.formData.location = 'Pandurangan Street';
    app.onLocationInputChange();
    fixture.detectChanges();

    const suggestionButtons = fixture.nativeElement.querySelectorAll('.location-suggestions button') as NodeListOf<HTMLButtonElement>;
    const typedSuggestion = suggestionButtons[suggestionButtons.length - 1];
    expect(typedSuggestion.textContent).toContain('Use "Pandurangan Street"');

    typedSuggestion.click();
    fixture.detectChanges();

    expect(app.formData.location).toBe('Pandurangan Street');
  });

  it('should select location suggestions with the keyboard', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    app.openPersonForm(app.treeData!, 'edit');
    app.formData.location = 'coim';
    app.onLocationInputChange();
    app.onLocationInputKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();

    expect(app.formData.location).toBe('Coimbatore, Tamil Nadu, India');
    expect(app.locationSuggestionsOpen).toBeFalse();
  });

  it('should add a child from the person form', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const parent = app.treeData!;

    app.openPersonForm(parent, 'add_child');
    app.formData.name = 'Local Test Child';
    app.formData.gender = 'other' as typeof app.formData.gender;
    app.formData.location = 'Coimbatore, Tamil Nadu, India';
    app.handleSubmit();
    fixture.detectChanges();

    const child = app.treeData?.children.find(person => person.name === 'Local Test Child');
    expect(child).toBeTruthy();
    expect(child?.location).toBe('Coimbatore, Tamil Nadu, India');
    expect(app.selectedPerson?.id).toBe(child?.id);
  });

  it('should add a child below an existing child, not only from the first level', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const root = app.treeData!;

    app.openPersonForm(root, 'add_child');
    app.formData.name = 'Second Level Parent';
    app.formData.gender = 'other' as typeof app.formData.gender;
    app.handleSubmit();
    fixture.detectChanges();

    const secondLevel = app.treeData?.children.find(person => person.name === 'Second Level Parent');
    expect(secondLevel).toBeTruthy();

    app.openPersonForm(secondLevel!, 'add_child');
    app.formData.name = 'Third Level Child';
    app.formData.gender = 'other' as typeof app.formData.gender;
    app.handleSubmit();
    fixture.detectChanges();

    const refreshedSecondLevel = app.treeData?.children.find(person => person.id === secondLevel!.id);
    expect(refreshedSecondLevel?.children.some(person => person.name === 'Third Level Child')).toBeTrue();
  });

  it('should close the profile drawer and save location when editing from a selected profile', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const person = app.treeData!;

    app.selectPerson(person);
    app.openPersonForm(person, 'edit');
    fixture.detectChanges();

    expect(app.selectedPerson).toBeNull();
    app.formData.location = 'Madurai, Tamil Nadu, India';
    app.handleSubmit();
    fixture.detectChanges();

    expect(app.treeData?.location).toBe('Madurai, Tamil Nadu, India');
    expect(app.selectedPerson?.location).toBe('Madurai, Tamil Nadu, India');
  });

  it('should show and edit the family tree owner', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    expect(fixture.nativeElement.textContent).toContain('Owner: You');

    app.startEditingTreeOwnerName();
    app.treeOwnerNameDraft = 'Krishnan';
    app.saveTreeOwnerName();
    fixture.detectChanges();

    expect(app.treeData?.treeOwnerName).toBe('Krishnan');
    expect(fixture.nativeElement.textContent).toContain('Owner: Krishnan');
  });

  it('should explain Firebase unauthorized domain sign-in failures', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    spyOn(console, 'error');
    const signInSpy = spyOn(TestBed.inject(AuthService), 'signInWithGooglePopup')
      .and.rejectWith({ code: 'auth/unauthorized-domain' });

    await app.signInWithGoogle();
    fixture.detectChanges();

    expect(signInSpy).toHaveBeenCalled();
    expect(app.toastMessage).toContain('Add');
    expect(app.toastMessage).toContain('Firebase authorized domains');
  });

  it('should explain repeated Google popup requests', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    spyOn(console, 'error');
    spyOn(TestBed.inject(AuthService), 'signInWithGooglePopup')
      .and.rejectWith({ code: 'auth/cancelled-popup-request' });

    await app.signInWithGoogle();
    fixture.detectChanges();

    expect(app.toastMessage).toContain('already opening');
  });

  it('should build a WhatsApp-first secure branch invitation without an email address', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const share = {
      code: 'AbCdEfGhIjKlMnOpQrStUv',
      secret: 'abcdefghijklmnopqrstuvwxyzABCDEFGH123456789',
      secureInvite: true,
      treeId: 'tree-one',
      ownerUid: 'owner-one',
      treeName: 'Prasad Family',
      treeOwnerName: 'Prasad',
      inviterName: 'Prasad',
      scope: 'branch' as const,
      role: 'branchEditor' as const,
      visibility: 'private' as const,
      status: 'pending' as const,
      branchRootId: 'krishnan',
      branchRootName: 'Krishnan'
    };

    expect(app.shareUrl(share)).toContain(`/i/${share.code}/${share.secret}`);
    expect(app.defaultShareMessage(share)).toContain('Could you add the relatives from your side?');
    expect(app.defaultShareMessage(share)).toContain('single-use');
    expect(app.defaultShareMessage(share)).not.toContain('email');
  });

  it('should ignore duplicate Google sign-in clicks while auth is busy', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.isAuthBusy = true;
    const signInSpy = spyOn(TestBed.inject(AuthService), 'signInWithGooglePopup');

    await app.signInWithGoogle();
    fixture.detectChanges();

    expect(signInSpy).not.toHaveBeenCalled();
    expect(app.toastMessage).toContain('already opening');
  });

  it('should remember that Google sign-in was started before redirecting', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    spyOn(TestBed.inject(AuthService), 'signInWithGooglePopup').and.rejectWith({ code: 'auth/popup-blocked' });
    spyOn(TestBed.inject(AuthService), 'signInWithGoogleRedirect').and.resolveTo();

    await app.signInWithGoogle();

    const intent = JSON.parse(sessionStorage.getItem('myFamilyTree_googleSignInStarted_v1') ?? '{}');
    expect(intent.startedAt).toBeGreaterThan(0);
    expect(intent.reopenMyTrees).toBeFalse();
  });

  it('should use same-tab redirect in production and reopen My Trees after sign-in', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const authService = TestBed.inject(AuthService);
    app.myTreesOpen = true;
    spyOnProperty(authService, 'shouldUseRedirectSignIn', 'get').and.returnValue(true);
    const popupSpy = spyOn(authService, 'signInWithGooglePopup');
    const redirectSpy = spyOn(authService, 'signInWithGoogleRedirect').and.resolveTo();

    await app.signInWithGoogle();

    const intent = JSON.parse(sessionStorage.getItem('myFamilyTree_googleSignInStarted_v1') ?? '{}');
    expect(redirectSpy).toHaveBeenCalled();
    expect(popupSpy).not.toHaveBeenCalled();
    expect(intent.reopenMyTrees).toBeTrue();
  });

  it('should reopen My Trees and show success after returning signed in', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    const authService = TestBed.inject(AuthService) as unknown as {
      userSubject: { next: (user: unknown) => void };
    };
    sessionStorage.setItem('myFamilyTree_googleSignInStarted_v1', JSON.stringify({
      startedAt: Date.now(),
      reopenMyTrees: true
    }));
    authService.userSubject.next({
      uid: 'test-user',
      displayName: 'Krishnan',
      email: 'krishnan@example.com',
      photoURL: null
    });

    fixture.detectChanges();

    expect(app.myTreesOpen).toBeTrue();
    expect(app.toastMessage).toContain('Successfully signed in');
    expect(sessionStorage.getItem('myFamilyTree_googleSignInStarted_v1')).toBeNull();
  });

  it('should keep My Trees visible while a redirect sign-in is being checked', () => {
    sessionStorage.setItem('myFamilyTree_googleSignInStarted_v1', JSON.stringify({
      startedAt: Date.now(),
      reopenMyTrees: true
    }));
    const fixture = TestBed.createComponent(AppComponent);

    fixture.detectChanges();

    expect(fixture.componentInstance.myTreesOpen).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Checking your sign-in');
  });

  it('should explain when Google returns without a Firebase user', fakeAsync(() => {
    sessionStorage.setItem('myFamilyTree_googleSignInStarted_v1', JSON.stringify({
      startedAt: Date.now(),
      reopenMyTrees: true
    }));
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;

    fixture.detectChanges();
    tick(7001);
    fixture.detectChanges();

    expect(app.toastMessage).toContain('Google sign-in did not finish');
    expect(app.myTreesOpen).toBeTrue();
    expect(sessionStorage.getItem('myFamilyTree_googleSignInStarted_v1')).toBeNull();
    fixture.destroy();
  }));
});
