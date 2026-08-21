import { ComponentFixture, TestBed } from '@angular/core/testing';
import { appConfig } from '../app.config';
import { Gender, TreeNode } from '../models/tree-node.model';
import { TreeNodeComponent } from './tree-node.component';

describe('TreeNodeComponent', () => {
  let fixture: ComponentFixture<TreeNodeComponent>;
  let component: TreeNodeComponent;

  const partner: TreeNode = {
    id: 'partner-1',
    name: 'Uma Nagarajan',
    gender: Gender.FEMALE,
    age: 60,
    location: '',
    isAlive: true,
    type: 'spouse',
    partnerRelationshipType: 'spouse',
    relationshipStartDate: '1988-05-14',
    spouse: null,
    children: []
  };

  const person: TreeNode = {
    id: 'person-1',
    name: 'Nagarajan',
    gender: Gender.MALE,
    age: 62,
    location: '',
    isAlive: true,
    type: 'blood',
    spouse: partner,
    children: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreeNodeComponent],
      providers: appConfig.providers
    }).compileComponents();

    fixture = TestBed.createComponent(TreeNodeComponent);
    component = fixture.componentInstance;
    component.node = person;
  });

  it('renders magnetic attachment tabs for a married couple', () => {
    fixture.detectChanges();

    const connector = fixture.nativeElement.querySelector('.tree-couple__connector') as HTMLElement;
    const tabs = fixture.nativeElement.querySelectorAll('.tree-couple__tab') as NodeListOf<HTMLElement>;

    expect(connector).toBeTruthy();
    expect(tabs.length).toBe(2);
    expect(connector.getAttribute('aria-label')).toBe('Nagarajan and Uma Nagarajan: Married since 1988');
    expect(connector.textContent).toContain('Married');
  });

  it('uses a visibly different detached connector for former spouses', () => {
    component.node = {
      ...person,
      spouse: { ...partner, partnerRelationshipType: 'former_spouse' }
    };
    fixture.detectChanges();

    const connector = fixture.nativeElement.querySelector('.tree-couple__connector') as HTMLElement;

    expect(connector.classList).toContain('tree-couple__connector--former');
    expect(connector.textContent).toContain('Former');
  });

  it('hides deep descendants behind a branch-specific reveal button', () => {
    const child: TreeNode = {
      ...baseTreeNode('child-1', 'Child Person'),
      parentRelationshipType: 'biological_parent'
    };
    component.node = { ...person, spouse: null, children: [child] };
    component.depth = 2;
    component.maxRenderDepth = 2;
    spyOn(component.onRevealBranch, 'emit');

    fixture.detectChanges();
    const revealButton = fixture.nativeElement.querySelector('.tree-branch__expand--branch') as HTMLButtonElement;

    expect(revealButton).toBeTruthy();
    expect(revealButton.textContent).toContain('Open branch');

    revealButton.click();

    expect(component.onRevealBranch.emit).toHaveBeenCalledWith('person-1');
    expect(fixture.nativeElement.textContent).not.toContain('Child Person');
  });

  it('renders a deep branch after that branch is explicitly expanded', () => {
    const child = baseTreeNode('child-1', 'Child Person');
    component.node = { ...person, spouse: null, children: [child] };
    component.depth = 2;
    component.maxRenderDepth = 2;
    component.expandedBranchIds = new Set(['person-1']);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Child Person');
  });
});

function baseTreeNode(id: string, name: string): TreeNode {
  return {
    id,
    name,
    gender: Gender.OTHER,
    age: 0,
    location: '',
    isAlive: true,
    type: 'blood',
    spouse: null,
    children: []
  };
}
