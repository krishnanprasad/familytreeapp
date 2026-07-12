import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GuidedTreeInput, Gender } from '../models/tree-node.model';

type OnboardingStep = 0 | 1 | 2;

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="onboarding-backdrop" role="presentation">
      <section
        class="onboarding-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-description">

        <header class="dialog-header">
          <div class="brand" aria-label="My Family">
            <span class="brand-mark" aria-hidden="true">MF</span>
            <span>My Family</span>
          </div>

          <ol class="progress" aria-label="Onboarding progress">
            <li
              *ngFor="let item of steps; let index = index"
              [class.progress-complete]="index < step"
              [class.progress-current]="index === step"
              [attr.aria-current]="index === step ? 'step' : null">
              <span class="progress-dot" aria-hidden="true">{{ index < step ? '✓' : index + 1 }}</span>
              <span class="progress-label">{{ item }}</span>
            </li>
          </ol>
        </header>

        <form class="dialog-body" novalidate (ngSubmit)="advance()">
          <main class="step-content">
            <ng-container *ngIf="step === 0">
              <div class="welcome-art" aria-hidden="true">
                <span class="branch branch-left"></span>
                <span class="branch branch-right"></span>
                <span class="person person-one">Y</span>
                <span class="person person-two">P</span>
                <span class="person person-three">F</span>
              </div>

              <p class="eyebrow">A few details. A tree you can keep growing.</p>
              <h1 id="onboarding-title" #stepHeading tabindex="-1">Start your family tree</h1>
              <p id="onboarding-description" class="lead">
                Begin with yourself, then add the people closest to you. We will arrange the
                first branches automatically, and you can edit every detail later.
              </p>

              <div class="welcome-benefits" aria-label="What guided setup includes">
                <span><b aria-hidden="true">1</b> Add yourself</span>
                <span><b aria-hidden="true">2</b> Name close family</span>
                <span><b aria-hidden="true">3</b> See your first tree</span>
              </div>

              <div class="choice-grid">
                <button type="button" class="choice" (click)="manual.emit()">
                  <span class="choice-title">Build manually</span>
                  <span class="choice-copy">Open a blank workspace and add people your way.</span>
                </button>
                <button type="button" class="choice" (click)="importRequested.emit()">
                  <span class="choice-title">Import a tree</span>
                  <span class="choice-copy">Bring in an existing family-tree file or backup.</span>
                </button>
              </div>
            </ng-container>

            <ng-container *ngIf="step === 1">
              <p class="eyebrow">Step 2 of 3</p>
              <h1 id="onboarding-title" #stepHeading tabindex="-1">Let’s start with you</h1>
              <p id="onboarding-description" class="lead compact">
                You will be the starting point of this tree. Only your name and gender are
                required; the other details can be added whenever you are ready.
              </p>

              <div class="form-grid">
                <div class="field field-wide">
                  <label for="self-name">Your full name <span aria-hidden="true">*</span></label>
                  <input
                    id="self-name"
                    name="selfName"
                    type="text"
                    autocomplete="name"
                    required
                    maxlength="120"
                    placeholder="e.g. Maya Rao"
                    [(ngModel)]="form.selfName"
                    [attr.aria-invalid]="selfAttempted && !form.selfName.trim() ? 'true' : null"
                    [attr.aria-describedby]="selfAttempted && !form.selfName.trim() ? 'self-name-error' : null">
                  <small *ngIf="selfAttempted && !form.selfName.trim()" id="self-name-error" class="error" role="alert">
                    Enter your name to continue.
                  </small>
                </div>

                <div class="field">
                  <label for="self-gender">Gender <span aria-hidden="true">*</span></label>
                  <select
                    id="self-gender"
                    name="selfGender"
                    required
                    [(ngModel)]="form.selfGender"
                    [attr.aria-invalid]="selfAttempted && !form.selfGender ? 'true' : null"
                    [attr.aria-describedby]="selfAttempted && !form.selfGender ? 'self-gender-error' : null">
                    <option value="" disabled>Select an option</option>
                    <option *ngFor="let option of genderOptions" [ngValue]="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                  <small *ngIf="selfAttempted && !form.selfGender" id="self-gender-error" class="error" role="alert">
                    Select a gender to continue.
                  </small>
                </div>

                <div class="field">
                  <label for="self-birth-date">Birth date <span class="optional">Optional</span></label>
                  <input
                    id="self-birth-date"
                    name="selfBirthDate"
                    type="date"
                    autocomplete="bday"
                    [(ngModel)]="form.selfBirthDate">
                </div>

                <div class="field field-wide">
                  <label for="self-location">Current location <span class="optional">Optional</span></label>
                  <input
                    id="self-location"
                    name="selfLocation"
                    type="text"
                    autocomplete="address-level2"
                    maxlength="160"
                    placeholder="City, state, or country"
                    [(ngModel)]="form.selfLocation">
                </div>
              </div>
            </ng-container>

            <ng-container *ngIf="step === 2">
              <p class="eyebrow">Step 3 of 3</p>
              <h1 id="onboarding-title" #stepHeading tabindex="-1">Add your closest family</h1>
              <p id="onboarding-description" class="lead compact">
                These fields are optional. Add as much as you know now; each name will become a
                person you can complete later.
              </p>

              <fieldset class="family-section">
                <legend>Parents</legend>
                <p class="section-help">Add either, both, or leave them blank.</p>
                <div class="form-grid">
                  <div class="field">
                    <label for="parent-one">Parent 1</label>
                    <input id="parent-one" name="parentOneName" type="text" maxlength="120"
                      placeholder="Full name" [(ngModel)]="form.parentOneName">
                  </div>
                  <div class="field">
                    <label for="parent-two">Parent 2</label>
                    <input id="parent-two" name="parentTwoName" type="text" maxlength="120"
                      placeholder="Full name" [(ngModel)]="form.parentTwoName">
                  </div>
                </div>
              </fieldset>

              <fieldset class="family-section">
                <legend>Your generation</legend>
                <div class="form-grid">
                  <div class="field">
                    <label for="siblings">Siblings</label>
                    <input id="siblings" name="siblings" type="text" placeholder="Asha, Ravi, Noor"
                      [(ngModel)]="form.siblings">
                    <small>Separate multiple names with commas.</small>
                  </div>
                  <div class="field">
                    <label for="partner">Partner or spouse</label>
                    <input id="partner" name="partnerName" type="text" maxlength="120"
                      placeholder="Full name" [(ngModel)]="form.partnerName">
                  </div>
                </div>
              </fieldset>

              <fieldset class="family-section last-section">
                <legend>Children</legend>
                <div class="field">
                  <label for="children">Children’s names</label>
                  <input id="children" name="children" type="text" placeholder="Leela, Dev"
                    [(ngModel)]="form.children">
                  <small>Separate multiple names with commas.</small>
                </div>
              </fieldset>
            </ng-container>
          </main>

          <footer class="dialog-footer">
            <button *ngIf="step > 0" type="button" class="button button-secondary" (click)="back()">
              Back
            </button>
            <span *ngIf="step === 0" class="footer-note">About 2 minutes</span>

            <div class="footer-actions">
              <button *ngIf="step === 2" type="button" class="button button-quiet" (click)="finish()">
                Skip family details
              </button>
              <button type="submit" class="button button-primary">
                {{ primaryLabel }}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      color: #172033;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }

    .onboarding-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: grid;
      place-items: center;
      min-height: 100dvh;
      padding: 24px;
      overflow: auto;
      background:
        radial-gradient(circle at 12% 14%, rgba(129, 140, 248, .2), transparent 34%),
        radial-gradient(circle at 88% 84%, rgba(52, 211, 153, .15), transparent 32%),
        #f5f7fb;
    }

    .onboarding-dialog {
      width: min(780px, 100%);
      max-height: calc(100dvh - 48px);
      overflow: auto;
      border: 1px solid rgba(148, 163, 184, .32);
      border-radius: 24px;
      background: rgba(255, 255, 255, .97);
      box-shadow: 0 30px 90px rgba(30, 41, 59, .18), 0 4px 16px rgba(30, 41, 59, .06);
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 20px 28px;
      border-bottom: 1px solid #e8ebf1;
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: #202a44;
      font-size: 15px;
      font-weight: 750;
      text-decoration: none;
      white-space: nowrap;
    }

    .brand-mark {
      display: grid;
      place-items: center;
      width: 34px;
      height: 34px;
      border-radius: 11px;
      color: #fff;
      background: linear-gradient(145deg, #4f46e5, #6366f1);
      box-shadow: 0 5px 12px rgba(79, 70, 229, .25);
      font-size: 10px;
      letter-spacing: .04em;
    }

    .progress {
      display: flex;
      align-items: flex-start;
      gap: 0;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .progress li {
      position: relative;
      display: grid;
      justify-items: center;
      gap: 5px;
      width: 88px;
      color: #8a93a6;
      font-size: 11px;
      font-weight: 650;
    }

    .progress li:not(:last-child)::after {
      content: "";
      position: absolute;
      top: 13px;
      left: calc(50% + 15px);
      width: calc(100% - 30px);
      height: 2px;
      background: #e2e6ee;
    }

    .progress-dot {
      position: relative;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: 2px solid #d9dee8;
      border-radius: 50%;
      background: #fff;
      font-size: 11px;
    }

    .progress-current { color: #4338ca !important; }
    .progress-current .progress-dot { border-color: #4f46e5; box-shadow: 0 0 0 4px #eef2ff; }
    .progress-complete { color: #17785e !important; }
    .progress-complete .progress-dot { border-color: #34a681; color: #fff; background: #34a681; }
    .progress-complete:not(:last-child)::after { background: #79cdb3 !important; }

    .dialog-body { min-height: 530px; display: flex; flex-direction: column; }
    .step-content { flex: 1; padding: 34px 56px 28px; }
    .step-content:focus { outline: none; }

    .welcome-art {
      position: relative;
      width: 164px;
      height: 80px;
      margin: 0 auto 20px;
    }

    .person {
      position: absolute;
      z-index: 2;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border: 5px solid #fff;
      border-radius: 15px;
      color: #fff;
      box-shadow: 0 7px 18px rgba(30, 41, 59, .14);
      font-size: 12px;
      font-weight: 800;
    }

    .person-one { left: 60px; top: 0; background: #4f46e5; }
    .person-two { left: 13px; bottom: 0; background: #e9856d; }
    .person-three { right: 13px; bottom: 0; background: #2ea77d; }
    .branch { position: absolute; top: 35px; width: 55px; height: 2px; background: #cbd5e1; }
    .branch-left { left: 35px; transform: rotate(31deg); }
    .branch-right { right: 35px; transform: rotate(-31deg); }

    h1 {
      margin: 0;
      color: #172033;
      font-size: clamp(28px, 4vw, 38px);
      line-height: 1.12;
      letter-spacing: -.035em;
      text-align: center;
    }

    h1:focus { outline: none; }
    .eyebrow { margin: 0 0 9px; color: #4f46e5; font-size: 12px; font-weight: 800; letter-spacing: .1em; text-align: center; text-transform: uppercase; }
    .lead { max-width: 600px; margin: 16px auto 0; color: #647087; font-size: 16px; line-height: 1.65; text-align: center; }
    .lead.compact { max-width: 570px; margin-bottom: 26px; }

    .welcome-benefits {
      display: flex;
      justify-content: center;
      gap: 22px;
      margin: 25px 0;
      color: #4a556b;
      font-size: 13px;
      font-weight: 650;
    }

    .welcome-benefits span { display: inline-flex; align-items: center; gap: 7px; }
    .welcome-benefits b { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; color: #4f46e5; background: #eef2ff; font-size: 10px; }

    .choice-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 610px; margin: 0 auto; }
    .choice {
      padding: 15px 17px;
      border: 1px solid #dfe4ed;
      border-radius: 13px;
      color: #344057;
      background: #fafbfc;
      text-align: left;
      cursor: pointer;
      transition: border-color .16s ease, background .16s ease, transform .16s ease;
    }

    .choice:hover { border-color: #a5b4fc; background: #f5f7ff; transform: translateY(-1px); }
    .choice-title, .choice-copy { display: block; }
    .choice-title { margin-bottom: 4px; color: #28344c; font-size: 14px; font-weight: 750; }
    .choice-copy { color: #707b90; font-size: 12px; line-height: 1.45; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .field { display: flex; flex-direction: column; min-width: 0; }
    .field-wide { grid-column: 1 / -1; }
    label, legend { color: #344057; font-size: 13px; font-weight: 750; }
    label { margin-bottom: 7px; }
    label > span:not(.optional) { color: #c24158; }
    .optional { float: right; color: #929bad; font-size: 10px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }

    input, select {
      width: 100%;
      height: 44px;
      padding: 0 13px;
      border: 1px solid #d8dee8;
      border-radius: 10px;
      color: #202a44;
      background: #fff;
      font: inherit;
      font-size: 14px;
      transition: border-color .15s ease, box-shadow .15s ease;
    }

    input::placeholder { color: #a0a8b7; }
    input:hover, select:hover { border-color: #b8c1d1; }
    input:focus, select:focus { border-color: #6366f1; outline: 0; box-shadow: 0 0 0 3px rgba(99, 102, 241, .13); }
    input[aria-invalid="true"], select[aria-invalid="true"] { border-color: #dc5068; }
    small { margin-top: 6px; color: #7b8497; font-size: 11px; line-height: 1.35; }
    .error { color: #bd3450; font-weight: 650; }

    .family-section { margin: 0 0 20px; padding: 0 0 20px; border: 0; border-bottom: 1px solid #edf0f5; }
    .family-section legend { margin-bottom: 3px; font-size: 14px; }
    .section-help { margin: 0 0 13px; color: #7b8497; font-size: 12px; }
    .last-section { margin-bottom: 0; padding-bottom: 0; border-bottom: 0; }

    .dialog-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 28px;
      border-top: 1px solid #e8ebf1;
      background: #fbfcfe;
    }

    .footer-actions { display: flex; align-items: center; gap: 9px; margin-left: auto; }
    .footer-note { color: #8992a5; font-size: 12px; }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 9px;
      min-height: 42px;
      padding: 0 18px;
      border: 1px solid transparent;
      border-radius: 10px;
      font: inherit;
      font-size: 13px;
      font-weight: 750;
      cursor: pointer;
      transition: background .15s ease, border-color .15s ease, box-shadow .15s ease, transform .15s ease;
    }

    .button:active { transform: translateY(1px); }
    .button-primary { color: #fff; background: #4f46e5; box-shadow: 0 6px 14px rgba(79, 70, 229, .22); }
    .button-primary:hover { background: #4338ca; }
    .button-secondary { border-color: #d8dee8; color: #4a556b; background: #fff; }
    .button-secondary:hover { border-color: #b8c1d1; background: #f7f8fb; }
    .button-quiet { color: #687389; background: transparent; }
    .button-quiet:hover { color: #39445a; background: #eef1f6; }

    button:focus-visible, a:focus-visible { outline: 3px solid rgba(79, 70, 229, .3); outline-offset: 2px; }

    @media (max-width: 650px) {
      .onboarding-backdrop { display: block; padding: 0; background: #fff; }
      .onboarding-dialog { width: 100%; min-height: 100dvh; max-height: none; border: 0; border-radius: 0; box-shadow: none; }
      .dialog-header { align-items: flex-start; padding: 16px 18px; }
      .brand > span:last-child, .progress-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      .progress li { width: 46px; }
      .step-content { padding: 28px 20px 24px; }
      .dialog-body { min-height: calc(100dvh - 68px); }
      .form-grid, .choice-grid { grid-template-columns: 1fr; }
      .field-wide { grid-column: auto; }
      .welcome-benefits { align-items: flex-start; flex-direction: column; gap: 9px; width: fit-content; margin: 22px auto; }
      .dialog-footer { position: sticky; bottom: 0; padding: 14px 18px; }
      .footer-actions { gap: 5px; }
      .button { padding-inline: 14px; }
      .button-quiet { font-size: 12px; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
    }
  `]
})
export class OnboardingComponent implements AfterViewInit {
  @Output() complete = new EventEmitter<GuidedTreeInput>();
  @Output() manual = new EventEmitter<void>();
  @Output() importRequested = new EventEmitter<void>();

  @ViewChild('stepHeading') private stepHeading?: ElementRef<HTMLElement>;

  readonly steps = ['Welcome', 'Yourself', 'Family'];
  readonly genderOptions = [
    { value: Gender.FEMALE, label: 'Female' },
    { value: Gender.MALE, label: 'Male' },
    { value: Gender.OTHER, label: 'Other' }
  ];

  step: OnboardingStep = 0;
  selfAttempted = false;

  form: {
    selfName: string;
    selfGender: Gender | '';
    selfBirthDate: string;
    selfLocation: string;
    parentOneName: string;
    parentTwoName: string;
    siblings: string;
    partnerName: string;
    children: string;
  } = {
    selfName: '',
    selfGender: '',
    selfBirthDate: '',
    selfLocation: '',
    parentOneName: '',
    parentTwoName: '',
    siblings: '',
    partnerName: '',
    children: ''
  };

  get primaryLabel(): string {
    if (this.step === 0) return 'Start guided setup';
    if (this.step === 1) return 'Continue to family';
    return 'Create my tree';
  }

  ngAfterViewInit(): void {
    this.focusHeading();
  }

  advance(): void {
    if (this.step === 0) {
      this.setStep(1);
      return;
    }

    if (this.step === 1) {
      this.selfAttempted = true;
      if (!this.form.selfName.trim() || !this.form.selfGender) return;
      this.setStep(2);
      return;
    }

    this.finish();
  }

  back(): void {
    if (this.step === 2) {
      this.setStep(1);
    } else if (this.step === 1) {
      this.setStep(0);
    }
  }

  finish(): void {
    this.selfAttempted = true;
    if (!this.form.selfName.trim() || !this.form.selfGender) {
      this.setStep(1);
      return;
    }

    const payload: GuidedTreeInput = {
      selfName: this.form.selfName.trim(),
      selfGender: this.form.selfGender,
      selfBirthDate: this.optionalText(this.form.selfBirthDate),
      selfLocation: this.optionalText(this.form.selfLocation),
      parentOneName: this.optionalText(this.form.parentOneName),
      parentTwoName: this.optionalText(this.form.parentTwoName),
      siblingNames: this.nameList(this.form.siblings),
      partnerName: this.optionalText(this.form.partnerName),
      childNames: this.nameList(this.form.children)
    };

    this.complete.emit(payload);
  }

  private setStep(step: OnboardingStep): void {
    this.step = step;
    this.focusHeading();
  }

  private focusHeading(): void {
    window.setTimeout(() => this.stepHeading?.nativeElement.focus(), 0);
  }

  private optionalText(value: string): string | undefined {
    const cleanValue = value.trim();
    return cleanValue || undefined;
  }

  private nameList(value: string): string[] | undefined {
    const names = value
      .split(',')
      .map(name => name.trim())
      .filter(Boolean);

    return names.length ? names : undefined;
  }
}
