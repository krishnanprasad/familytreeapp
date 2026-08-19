import { TestBed } from '@angular/core/testing';
import { appConfig } from '../app.config';
import { ShareLinkRecord } from '../models/tree-node.model';
import { InviteLandingComponent } from './invite-landing.component';

describe('InviteLandingComponent', () => {
  const share: ShareLinkRecord = {
    code: 'invite-id',
    secureInvite: true,
    treeId: 'tree-1',
    ownerUid: 'owner-1',
    treeName: 'Prasad Family',
    treeOwnerName: 'Prasad',
    inviterName: 'Prasad',
    scope: 'branch',
    role: 'branchEditor',
    visibility: 'private',
    status: 'pending',
    branchRootId: 'krishnan',
    branchRootName: 'Krishnan',
    expiresAtLabel: '2030-01-10T00:00:00.000Z'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteLandingComponent],
      providers: [...appConfig.providers]
    }).compileComponents();
  });

  it('explains the selected branch and protected editor permissions', () => {
    const fixture = TestBed.createComponent(InviteLandingComponent);
    fixture.componentRef.setInput('share', share);
    fixture.componentRef.setInput('status', 'ready');
    fixture.componentRef.setInput('authReady', true);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Prasad invited you to complete');
    expect(text).toContain("Krishnan's branch");
    expect(text).toContain('Add and update relatives');
    expect(text).toContain('Existing relatives cannot be deleted');
    expect(text).toContain('Continue with Google & join');
  });

  it('emits join once from the primary action and disables repeat submission while busy', () => {
    const fixture = TestBed.createComponent(InviteLandingComponent);
    fixture.componentRef.setInput('share', share);
    fixture.componentRef.setInput('status', 'ready');
    fixture.componentRef.setInput('authReady', true);
    const joined = jasmine.createSpy('joined');
    fixture.componentInstance.join.subscribe(joined);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.invite-primary') as HTMLButtonElement;
    button.click();
    expect(joined).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();
    button.click();
    expect(joined).toHaveBeenCalledTimes(1);
  });

  it('does not expose branch details for an expired invitation state', () => {
    const fixture = TestBed.createComponent(InviteLandingComponent);
    fixture.componentRef.setInput('status', 'expired');
    fixture.componentRef.setInput('authReady', true);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('This invitation has expired');
    expect(text).not.toContain("Krishnan's branch");
    expect(fixture.nativeElement.querySelector('.invite-primary')).toBeNull();
  });
});
