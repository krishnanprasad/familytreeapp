import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GuidedTreeInput, TreeSummary } from './models/tree-node.model';
import { GeneratedTreeRequest, OnboardingComponent } from './components/onboarding.component';

type LandingHandoff =
  | { mode: 'guided'; input: GuidedTreeInput }
  | { mode: 'manual' }
  | { mode: 'import' }
  | { mode: 'generated'; request: GeneratedTreeRequest }
  | { mode: 'publicTree'; summary: TreeSummary };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [OnboardingComponent],
  template: `
    <app-onboarding
      (complete)="openGuidedTree($event)"
      (manual)="openManualTree()"
      (importRequested)="openImport()"
      (generatedTreeRequested)="openGeneratedTree($event)"
      (publicTreeRequested)="openPublicTree($event)">
    </app-onboarding>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LandingPageComponent {
  private readonly handoffStorageKey = 'myFamilyTree_landingHandoff_v1';

  openGuidedTree(input: GuidedTreeInput): void {
    this.openWorkspace({ mode: 'guided', input });
  }

  openManualTree(): void {
    this.openWorkspace({ mode: 'manual' });
  }

  openImport(): void {
    this.openWorkspace({ mode: 'import' });
  }

  openGeneratedTree(request: GeneratedTreeRequest): void {
    this.openWorkspace({ mode: 'generated', request });
  }

  openPublicTree(summary: TreeSummary): void {
    this.openWorkspace({ mode: 'publicTree', summary });
  }

  private openWorkspace(handoff: LandingHandoff): void {
    sessionStorage.setItem(this.handoffStorageKey, JSON.stringify(handoff));
    window.location.assign('/app');
  }
}
