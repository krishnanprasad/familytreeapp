import { ComponentFixture, TestBed } from '@angular/core/testing';
import { appConfig } from '../app.config';
import { Gender, TreeNode } from '../models/tree-node.model';
import { NodeCardComponent } from './node-card.component';

describe('NodeCardComponent', () => {
  let fixture: ComponentFixture<NodeCardComponent>;
  let component: NodeCardComponent;

  const baseNode: TreeNode = {
    id: 'person-1',
    name: 'Test Person',
    gender: Gender.OTHER,
    age: 0,
    location: '',
    isAlive: true,
    type: 'blood',
    spouse: null,
    children: []
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NodeCardComponent],
      providers: appConfig.providers
    }).compileComponents();

    fixture = TestBed.createComponent(NodeCardComponent);
    component = fixture.componentInstance;
    component.node = { ...baseNode };
  });

  it('uses a male card accent and chip', () => {
    component.node = { ...baseNode, gender: Gender.MALE };
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.person-card') as HTMLElement;

    expect(card.classList).toContain('person-card--gender-male');
    expect(fixture.nativeElement.textContent).toContain('M');
    expect(component.genderLabel).toBe('Male');
  });

  it('uses a female card accent and chip', () => {
    component.node = { ...baseNode, gender: Gender.FEMALE };
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.person-card') as HTMLElement;

    expect(card.classList).toContain('person-card--gender-female');
    expect(fixture.nativeElement.textContent).toContain('F');
    expect(component.genderLabel).toBe('Female');
  });

  it('uses a neutral card accent when gender is other or unknown', () => {
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.person-card') as HTMLElement;

    expect(card.classList).toContain('person-card--gender-unknown');
    expect(fixture.nativeElement.textContent).toContain('U');
    expect(component.genderLabel).toBe('Gender not set or other');
  });
});
