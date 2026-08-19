import { TestBed } from '@angular/core/testing';
import { Gender, TreeNode } from '../models/tree-node.model';
import { PersonProfileComponent } from './person-profile.component';

describe('PersonProfileComponent social profiles', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonProfileComponent]
    }).compileComponents();
  });

  it('shows only public social profiles beneath the person name', () => {
    const fixture = TestBed.createComponent(PersonProfileComponent);
    fixture.componentInstance.person = personWithSocialProfiles();
    fixture.detectChanges();

    const links = fixture.nativeElement.querySelectorAll('.social-links a') as NodeListOf<HTMLAnchorElement>;
    expect(links.length).toBe(2);
    expect(links[0].textContent).toContain('Instagram');
    expect(links[0].textContent).toContain('@familytester');
    expect(links[0].href).toBe('https://www.instagram.com/familytester');
    expect(links[1].href).toContain('facebook.com/FamilyTester');
    expect(fixture.nativeElement.textContent).not.toContain('private-snap');
  });

  it('accepts a complete public profile URL without rewriting it', () => {
    const fixture = TestBed.createComponent(PersonProfileComponent);
    const person = personWithSocialProfiles();
    person.socialProfiles = [
      { platform: 'linkedin', handle: 'https://in.linkedin.com/in/family-tester', isPublic: true }
    ];
    fixture.componentInstance.person = person;
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('.social-links a') as HTMLAnchorElement;
    expect(link.href).toContain('in.linkedin.com/in/family-tester');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});

function personWithSocialProfiles(): TreeNode {
  return {
    id: 'social-profile-person',
    name: 'Family Tester',
    gender: Gender.OTHER,
    age: 30,
    location: 'Chennai, India',
    isAlive: true,
    type: 'blood',
    spouse: null,
    children: [],
    socialProfiles: [
      { platform: 'instagram', handle: '@familytester', isPublic: true },
      { platform: 'facebook', handle: 'FamilyTester', isPublic: true },
      { platform: 'snapchat', handle: 'private-snap', isPublic: false }
    ]
  };
}
