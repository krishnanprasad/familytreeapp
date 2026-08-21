import { BehaviorSubject } from 'rxjs';
import { AuthService, AuthUser } from './auth.service';
import { TreeService } from './tree.service';
import { Gender, TreeNode } from '../models/tree-node.model';
import { AiFamilyOperation } from '../models/ai-family.model';

describe('TreeService history and validation', () => {
  let service: TreeService;

  beforeEach(() => {
    localStorage.clear();
    const userSubject = new BehaviorSubject<AuthUser | null>(null);
    const auth = {
      user$: userSubject.asObservable(),
      currentUser: null
    } as unknown as AuthService;
    service = new TreeService(auth);
  });

  it('undoes and redoes an added person without a cloud write', () => {
    const parent = service.getTree();
    service.addChild(parent.id, {
      name: 'Test Child',
      gender: Gender.OTHER,
      age: 0,
      location: '',
      isAlive: true,
      type: 'blood',
      parentRelationshipType: 'biological_parent'
    });

    expect(service.getTree().children.length).toBe(1);
    service.undo();
    expect(service.getTree().children.length).toBe(0);
    service.redo();
    expect(service.getTree().children[0].name).toBe('Test Child');
  });

  it('rejects syntactically valid JSON that is not a tree', () => {
    expect(service.importFromJSON('{"hello":"world"}')).toBeFalse();
  });

  it('keeps an editable owner on the root tree record', () => {
    expect(service.getTree().treeOwnerName).toBe('You');

    service.setTreeOwnerName('Krishnan');

    expect(service.getTree().treeOwnerName).toBe('Krishnan');
  });

  it('keeps a Google profile photo on the guided starting person', () => {
    const tree = service.createGuidedTree({
      selfName: 'Maya Rao',
      selfGender: Gender.OTHER,
      selfPhotoUrl: 'https://example.com/maya.jpg'
    });

    expect(tree.name).toBe('Maya Rao');
    expect(tree.photoUrl).toBe('https://example.com/maya.jpg');
  });

  it('creates a short stable URL id for each new tree', () => {
    service.createNewTree('Route Test Family');
    const routeId = service.currentRouteId;

    expect(routeId).toMatch(/^[a-f0-9]{4}(?:-[a-f0-9]{4}){3}$/);
    expect(localStorage.getItem(`myFamilyTree_routeId_v1:${service.currentTreeId}`)).toBe(routeId);
  });

  it('normalizes and preserves social-profile privacy in generated trees', () => {
    const generatedTree = {
      ...service.getTree(),
      socialProfiles: [
        { platform: 'instagram', handle: ' public-family ', isPublic: true },
        { platform: 'snapchat', handle: 'private-family', isPublic: false },
        { platform: 'instagram', handle: 'duplicate', isPublic: true }
      ]
    } as TreeNode;

    service.openGeneratedTree(generatedTree);

    expect(service.getTree().socialProfiles).toEqual([
      { platform: 'instagram', handle: 'public-family', isPublic: true },
      { platform: 'snapchat', handle: 'private-family', isPublic: false }
    ]);
  });

  it('adds a parent above the top person without losing descendants', () => {
    const root = service.getTree();
    root.name = 'Krishnamoorthi';
    const child = service.addChild(root.id, {
      name: 'Ramkumar',
      gender: Gender.MALE,
      age: 0,
      location: '',
      isAlive: true,
      type: 'blood',
      parentRelationshipType: 'biological_parent'
    });

    const newParent = service.addParent(root.id, {
      name: 'Krishnamoorthi Father',
      gender: Gender.MALE,
      age: 0,
      location: '',
      isAlive: false,
      type: 'blood',
      parentRelationshipType: 'biological_parent'
    });

    expect(newParent.name).toBe('Krishnamoorthi Father');
    expect(service.getTree().children[0].name).toBe('Krishnamoorthi');
    expect(service.findNode(service.getTree(), child.id)?.name).toBe('Ramkumar');
  });

  it('labels siblings as elder or younger by birth date', () => {
    const parent = service.getTree();
    const older = service.addChild(parent.id, {
      name: 'Older Brother',
      gender: Gender.MALE,
      age: 0,
      birthDate: '1980-01-01',
      location: '',
      isAlive: true,
      type: 'blood',
      parentRelationshipType: 'biological_parent'
    });
    const younger = service.addChild(parent.id, {
      name: 'Younger Sister',
      gender: Gender.FEMALE,
      age: 0,
      birthDate: '1990-01-01',
      location: '',
      isAlive: true,
      type: 'blood',
      parentRelationshipType: 'biological_parent'
    });

    const youngerRelatives = service.getRelatives(younger.id);
    const olderRelatives = service.getRelatives(older.id);

    expect(youngerRelatives.some(relative =>
      relative.person.id === older.id && relative.label === 'Elder brother'
    )).toBeTrue();
    expect(olderRelatives.some(relative =>
      relative.person.id === younger.id && relative.label === 'Younger sister'
    )).toBeTrue();
  });

  it('uses child order for sibling labels when birth dates are missing', () => {
    const parent = service.getTree();
    const first = service.addChild(parent.id, {
      name: 'First Child',
      gender: Gender.OTHER,
      age: 0,
      location: '',
      isAlive: true,
      type: 'blood',
      parentRelationshipType: 'biological_parent'
    });
    const second = service.addChild(parent.id, {
      name: 'Second Child',
      gender: Gender.OTHER,
      age: 0,
      location: '',
      isAlive: true,
      type: 'blood',
      parentRelationshipType: 'biological_parent'
    });

    const relatives = service.getRelatives(second.id);

    expect(relatives.some(relative =>
      relative.person.id === first.id && relative.label === 'Elder sibling'
    )).toBeTrue();
  });

  it('applies an AI change plan atomically and undoes the whole plan once', () => {
    const root = service.getTree();
    const result = service.applyAiOperations([
      aiOperation({
        type: 'update',
        targetId: root.id,
        providedFields: ['location'],
        fields: { location: 'Chennai, India' },
        summary: 'Moved You to Chennai'
      }),
      aiOperation({
        type: 'add',
        relation: 'child',
        targetId: root.id,
        providedFields: ['name', 'birthDate'],
        fields: { name: 'Ananya', birthDate: '2012-04-18', gender: Gender.FEMALE },
        summary: 'Added Ananya as a child'
      })
    ]);

    expect(result.changedCount).toBe(2);
    expect(service.getTree().location).toBe('Chennai, India');
    expect(service.getTree().children[0].name).toBe('Ananya');
    expect(service.canUndo).toBeTrue();

    service.undo();

    expect(service.getTree().location).toBe('');
    expect(service.getTree().children.length).toBe(0);
    expect(service.canUndo).toBeFalse();
  });

  it('does not apply a partial AI plan when a later operation is invalid', () => {
    const root = service.getTree();
    const originalName = root.name;

    expect(() => service.applyAiOperations([
      aiOperation({
        type: 'update',
        targetId: root.id,
        providedFields: ['name'],
        fields: { name: 'Changed name' },
        summary: 'Renamed the root person'
      }),
      aiOperation({
        type: 'update',
        targetId: 'missing-person-id',
        providedFields: ['location'],
        fields: { location: 'Chennai' },
        summary: 'Updated a missing person'
      })
    ])).toThrowError(/no longer in this tree/i);

    expect(service.getTree().name).toBe(originalName);
    expect(service.canUndo).toBeFalse();
  });
});

function aiOperation(overrides: {
  type: AiFamilyOperation['type'];
  targetId: string;
  relation?: AiFamilyOperation['relation'];
  providedFields?: AiFamilyOperation['providedFields'];
  fields?: Partial<AiFamilyOperation['fields']>;
  summary: string;
}): AiFamilyOperation {
  return {
    type: overrides.type,
    targetId: overrides.targetId,
    relation: overrides.relation ?? 'none',
    providedFields: overrides.providedFields ?? [],
    fields: {
      name: '',
      age: null,
      gender: 'unspecified',
      isAlive: null,
      location: '',
      email: '',
      alternateNames: [],
      birthDate: '',
      deathDate: '',
      birthPlace: '',
      notes: '',
      tags: [],
      parentRelationshipType: 'unspecified',
      partnerRelationshipType: 'unspecified',
      relationshipStartDate: '',
      relationshipEndDate: '',
      ...overrides.fields
    },
    summary: overrides.summary
  };
}
