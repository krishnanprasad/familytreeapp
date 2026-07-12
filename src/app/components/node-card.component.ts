import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TreeNode } from '../models/tree-node.model';

@Component({
  selector: 'app-node-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="person-card group"
      [class.person-card--partner]="node.type === 'spouse'"
      [class.person-card--selected]="selected"
      [class.person-card--deceased]="!node.isAlive"
      [attr.data-node-id]="node.id"
      [attr.aria-label]="'Open profile for ' + node.name"
      tabindex="0"
      role="button"
      (click)="onSelect.emit(node)"
      (keydown.enter)="onSelect.emit(node)"
      (keydown.space)="selectWithKeyboard($event)">

      <div class="person-card__status" [class.person-card__status--alive]="node.isAlive">
        <span class="person-card__status-dot"></span>
        {{ node.isAlive ? 'Living' : 'Remembered' }}
      </div>

      <div class="person-card__identity">
        <div class="person-card__avatar" [class.person-card__avatar--photo]="node.photoUrl">
          <img *ngIf="node.photoUrl" [src]="node.photoUrl" [alt]="node.name" loading="lazy">
          <span *ngIf="!node.photoUrl">{{ initials }}</span>
        </div>
        <div class="person-card__copy">
          <h3>{{ node.name }}</h3>
          <p *ngIf="lifeSpan; else ageOnly">{{ lifeSpan }}</p>
          <ng-template #ageOnly><p>{{ node.age ? node.age + ' years' : 'Dates not added' }}</p></ng-template>
        </div>
      </div>

      <div class="person-card__meta">
        <span *ngIf="node.location">
          <i-lucide name="map-pin" [size]="12"></i-lucide>
          <span>{{ node.location }}</span>
        </span>
        <span class="person-card__relation" *ngIf="relationshipLabel">{{ relationshipLabel }}</span>
      </div>

      <div class="person-card__actions" (click)="$event.stopPropagation()">
        <button type="button" (click)="onEdit.emit(node)" [attr.aria-label]="'Edit ' + node.name" title="Edit profile">
          <i-lucide name="user" [size]="13"></i-lucide>
        </button>
        <button type="button" class="person-card__action-wide" (click)="onAddChild.emit(node)" [attr.aria-label]="'Add child to ' + node.name">
          <i-lucide name="baby" [size]="13"></i-lucide><span>Child</span>
        </button>
        <button
          *ngIf="!node.spouse && node.type === 'blood'"
          type="button"
          class="person-card__action-wide person-card__action--partner"
          (click)="onAddSpouse.emit(node)"
          [attr.aria-label]="'Add partner for ' + node.name">
          <i-lucide name="heart" [size]="13"></i-lucide><span>Partner</span>
        </button>
        <button
          *ngIf="!isRoot"
          type="button"
          class="person-card__action--danger"
          (click)="onDelete.emit(node.id)"
          [attr.aria-label]="'Delete ' + node.name"
          title="Delete">
          <i-lucide name="trash-2" [size]="13"></i-lucide>
        </button>
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; }
    .person-card {
      position: relative; width: 220px; min-height: 146px; padding: 15px 15px 44px;
      border: 1px solid #dbe3ef; border-top: 3px solid #4f46e5; border-radius: 16px;
      background: rgba(255,255,255,.98); box-shadow: 0 8px 24px rgba(15,23,42,.08);
      cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
      outline: none;
    }
    .person-card:hover, .person-card:focus-visible { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(15,23,42,.14); }
    .person-card:focus-visible { box-shadow: 0 0 0 4px rgba(79,70,229,.18), 0 14px 30px rgba(15,23,42,.14); }
    .person-card--partner { border-top-color: #0d9488; background: linear-gradient(145deg,#fff 65%,#f0fdfa); }
    .person-card--selected { border-color: #4f46e5; box-shadow: 0 0 0 5px rgba(79,70,229,.16), 0 16px 38px rgba(79,70,229,.2); }
    .person-card--deceased { background: linear-gradient(145deg,#fff 65%,#f8fafc); }
    .person-card__status { position:absolute; top:10px; right:11px; display:flex; align-items:center; gap:5px; color:#64748b; font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.07em; }
    .person-card__status-dot { width:6px; height:6px; border-radius:50%; background:#94a3b8; }
    .person-card__status--alive { color:#0f766e; }
    .person-card__status--alive .person-card__status-dot { background:#14b8a6; box-shadow:0 0 0 3px #ccfbf1; }
    .person-card__identity { display:flex; align-items:center; gap:11px; margin-top:11px; min-width:0; }
    .person-card__avatar { width:42px; height:42px; border-radius:13px; display:grid; place-items:center; flex:0 0 auto; overflow:hidden; color:#4338ca; background:#eef2ff; font-weight:850; font-size:13px; letter-spacing:.03em; }
    .person-card--partner .person-card__avatar { color:#0f766e; background:#ccfbf1; }
    .person-card__avatar img { width:100%; height:100%; object-fit:cover; }
    .person-card__copy { min-width:0; padding-right:24px; }
    .person-card__copy h3 { margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#172033; font-size:14px; line-height:1.25; font-weight:800; }
    .person-card__copy p { margin:4px 0 0; color:#78859a; font-size:11px; font-weight:600; }
    .person-card__meta { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:20px; margin-top:14px; color:#64748b; font-size:10px; }
    .person-card__meta > span:first-child { display:flex; align-items:center; gap:4px; min-width:0; }
    .person-card__meta > span:first-child span { max-width:110px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .person-card__relation { padding:3px 6px; border-radius:999px; background:#f1f5f9; color:#475569; white-space:nowrap; font-weight:700; }
    .person-card__actions { position:absolute; z-index:3; left:50%; bottom:10px; display:flex; gap:4px; opacity:0; pointer-events:none; transform:translate(-50%,4px); transition:.16s ease; }
    .person-card:hover .person-card__actions, .person-card:focus-within .person-card__actions { opacity:1; pointer-events:auto; transform:translate(-50%,0); }
    .person-card__actions button { height:29px; min-width:29px; padding:0 8px; display:flex; align-items:center; justify-content:center; gap:4px; border:0; border-radius:9px; color:#fff; background:#273449; box-shadow:0 5px 14px rgba(15,23,42,.2); font-size:10px; font-weight:750; cursor:pointer; }
    .person-card__actions .person-card__action-wide { background:#4f46e5; }
    .person-card__actions .person-card__action--partner { background:#0d9488; }
    .person-card__actions .person-card__action--danger { background:#e11d48; }
    @media (hover:none) { .person-card__actions { opacity:1; pointer-events:auto; transform:translate(-50%,0); } }
  `]
})
export class NodeCardComponent {
  @Input({ required: true }) node!: TreeNode;
  @Input() isRoot = false;
  @Input() selected = false;
  @Output() onSelect = new EventEmitter<TreeNode>();
  @Output() onEdit = new EventEmitter<TreeNode>();
  @Output() onAddChild = new EventEmitter<TreeNode>();
  @Output() onAddSpouse = new EventEmitter<TreeNode>();
  @Output() onDelete = new EventEmitter<string>();

  get initials(): string {
    return this.node.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';
  }

  get lifeSpan(): string {
    const birth = this.node.birthDate?.slice(0, 4);
    const death = this.node.deathDate?.slice(0, 4);
    if (birth || death) return `${birth || '?'} – ${death || 'Present'}`;
    return '';
  }

  get relationshipLabel(): string {
    const type = this.node.type === 'spouse'
      ? this.node.partnerRelationshipType
      : this.node.parentRelationshipType;
    const labels: Record<string, string> = {
      adoptive_parent: 'Adoptive', step_parent: 'Step', guardian: 'Guardian',
      unknown_parent: 'Parent', partner: 'Partner', former_spouse: 'Former', spouse: 'Spouse'
    };
    return type ? (labels[type] ?? '') : '';
  }

  selectWithKeyboard(event: Event): void {
    event.preventDefault();
    this.onSelect.emit(this.node);
  }
}
