import { TestBed } from '@angular/core/testing';
import { appConfig } from '../app.config';
import { GuidedTreeInput, TreeNode } from '../models/tree-node.model';
import { OnboardingComponent } from './onboarding.component';

describe('OnboardingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [...appConfig.providers]
    }).compileComponents();
  });

  it('renders the private family-tree landing experience', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    expect(page.querySelector('h1')?.textContent).toContain('Build the family tree');
    expect(page.textContent).toContain('Private family tree · Free to begin');
    expect(page.textContent).toContain('Three names today');
    expect(page.querySelectorAll('.roll-card').length).toBe(20);
    expect(page.querySelectorAll('.category-card').length).toBe(8);
  });

  it('includes one hundred verified public people in the rolling scroller', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.verifiedPublicScrollerPeople.length).toBe(100);
    expect(component.verifiedPublicScrollerPeople.every(person => !!person.birthDate && !!person.photo)).toBeTrue();
    expect(component.verifiedPublicScrollerPeople.find(person => person.name === 'Sachin Tendulkar')?.birthDate).toBe('1973-04-24');
    expect(component.verifiedPublicScrollerPeople.find(person => person.name === 'Mary Kom')?.birthDate).toBe('1983-03-01');
    expect(component.verifiedPublicScrollerPeople.find(person => person.name === 'Dhirubhai Ambani')?.deathDate).toBe('2002-07-06');
  });

  it('opens generated family trees from archive search when available', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    let result: { focusNodeId: string; tree: { treeName?: string } } | undefined;
    component.generatedTreeRequested.subscribe(value => result = value);
    fixture.detectChanges();

    component.archiveQuery = 'Curie';
    component.submitArchiveSearch();
    fixture.detectChanges();

    expect(result?.focusNodeId).toBe('generated-marie-curie');
    expect(result?.tree.treeName).toBe('Curie Family');
    expect(component.archiveSearchStatus).toBe('Opening Curie Family. Computer generated from publicly known details.');
  });

  it('opens Sachin as a computer-generated tree chart from search', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    let result: { focusNodeId: string; tree: TreeNode } | undefined;
    component.generatedTreeRequested.subscribe(value => result = value);
    fixture.detectChanges();

    component.archiveQuery = 'Sachin';
    component.submitArchiveSearch();

    expect(result?.focusNodeId).toBe('generated-sachin-tendulkar');
    expect(result?.tree.treeName).toBe('Sachin Tendulkar Family');
    expect(result?.tree.children.length).toBe(4);
    const sachin = result?.tree.children.find(person => person.id === 'generated-sachin-tendulkar');
    expect(sachin?.socialProfiles?.length).toBe(4);
    expect(sachin?.socialProfiles?.every(profile => profile.isPublic)).toBeTrue();
  });

  it('opens the verified Karunanidhi tree with separate spouse branches', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    let result: { focusNodeId: string; tree: TreeNode } | undefined;
    const findNode = (node: TreeNode | undefined, id: string): TreeNode | undefined => {
      if (!node) return undefined;
      if (node.id === id) return node;
      return node.children.map(child => findNode(child, id)).find(Boolean);
    };
    component.generatedTreeRequested.subscribe(value => result = value);
    fixture.detectChanges();

    component.archiveQuery = 'Karunanidhi';
    component.submitArchiveSearch();

    const karunanidhi = findNode(result?.tree, 'generated-karunanidhi');
    const padmavathi = findNode(result?.tree, 'generated-padmavathi-ammal');
    const dayalu = findNode(result?.tree, 'generated-dayalu-ammal');
    const rajathi = findNode(result?.tree, 'generated-rajathi-ammal');
    const muthu = findNode(padmavathi, 'generated-mk-muthu');
    const maran = findNode(result?.tree, 'generated-murasoli-maran');

    expect(result?.focusNodeId).toBe('generated-karunanidhi');
    expect(result?.tree.treeName).toBe('Karunanidhi Family');
    expect(karunanidhi?.children.map(child => child.id)).toEqual([
      'generated-padmavathi-ammal',
      'generated-dayalu-ammal',
      'generated-rajathi-ammal'
    ]);
    expect(padmavathi?.type).toBe('spouse');
    expect(dayalu?.type).toBe('spouse');
    expect(rajathi?.type).toBe('spouse');
    expect(muthu?.birthDate).toBe('1948-01-14');
    expect(muthu?.deathDate).toBe('2025-07-19');
    expect(findNode(dayalu, 'generated-mk-stalin')?.birthDate).toBe('1953-03-01');
    expect(findNode(rajathi, 'generated-kanimozhi')?.birthDate).toBe('1968-01-05');
    expect(maran?.deathDate).toBe('2003-11-23');
  });

  it('wires every core family scroller card to a generated tree', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;

    expect(component.rollingFamilies.length).toBe(10);
    expect(component.rollingFamilies.every(family => !!family.generatedTreeId)).toBeTrue();
  });

  it('opens a cinematic discovery tunnel from a collection card', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;

    (page.querySelector('.category-card') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeDiscoveryCategory?.title).toBe('Kingdoms & dynasties');
    expect(page.querySelector('.story-tunnel')?.textContent).toContain('Cinematic story tunnel');

    (page.querySelectorAll('.tunnel-doors button')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.discoveryDepth).toBe(2);
    expect(page.querySelector('.tunnel-title-card')?.textContent).toContain('Marriage as map');
  });

  it('emits a usable three-name family-tree draft', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    let result: GuidedTreeInput | undefined;
    component.complete.subscribe(value => result = value);
    fixture.detectChanges();

    component.startGuidedSetup();
    component.form.selfName = 'Maya Rao';
    component.advance();
    component.form.parentOneName = 'Asha Rao';
    component.form.parentTwoName = 'Dev Rao';
    component.finish();

    expect(result).toBeDefined();
    expect(result?.selfName).toBe('Maya Rao');
    expect(result?.parentOneName).toBe('Asha Rao');
    expect(result?.parentTwoName).toBe('Dev Rao');
  });

  it('lets users add relatives later while preserving names already entered', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    let result: GuidedTreeInput | undefined;
    component.complete.subscribe(value => result = value);
    fixture.detectChanges();

    component.startGuidedSetup();
    component.form.selfName = 'Maya Rao';
    component.advance();
    component.form.parentOneName = 'Asha Rao';
    fixture.detectChanges();

    const laterButton = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find(button => button.textContent?.trim() === 'I’ll add them later') as HTMLButtonElement | undefined;

    expect(laterButton).toBeDefined();
    laterButton?.click();
    expect(result?.selfName).toBe('Maya Rao');
    expect(result?.parentOneName).toBe('Asha Rao');
    expect(result?.parentTwoName).toBeUndefined();
  });

  it('offers Google fast join while keeping the guest path available', () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.startGuidedSetup();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Continue with Google');
    expect(page.textContent).toContain('or continue without signing in');
    expect(page.textContent).toContain('Private by default');
    expect(page.querySelector('.google-join-button')).not.toBeNull();
  });

  it('prefills the starting person from an existing Google account', async () => {
    const fixture = TestBed.createComponent(OnboardingComponent);
    const component = fixture.componentInstance;
    component.startGuidedSetup();
    component.googleUser = {
      uid: 'google-user',
      displayName: 'Maya Rao',
      email: 'maya@example.com',
      photoURL: 'https://example.com/maya.jpg'
    };

    await component.continueWithGoogle();
    fixture.detectChanges();

    expect(component.step).toBe(2);
    expect(component.form.selfName).toBe('Maya Rao');
    expect(component.joinedWithGoogle).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Google profile connected');
  });
});
