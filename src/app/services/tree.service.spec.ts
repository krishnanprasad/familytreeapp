import { BehaviorSubject } from 'rxjs';
import { AuthService, AuthUser } from './auth.service';
import { TreeService } from './tree.service';
import { Gender } from '../models/tree-node.model';

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
});
