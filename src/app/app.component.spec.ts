import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { appConfig } from './app.config';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: appConfig.providers
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
});
