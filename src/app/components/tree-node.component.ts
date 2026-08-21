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
import { NodeCardComponent } from './node-card.component';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, NodeCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tree-branch" [class.tree-branch--root]="isRoot">
      <div class="tree-couple">
        <app-node-card
          [node]="node"
          [isRoot]="isRoot"
          [selected]="selectedPersonId === node.id"
          (onSelect)="onSelect.emit($event)"
          (onEdit)="onEdit.emit($event)"
          (onAddChild)="onAddChild.emit($event)"
          (onAddSpouse)="onAddSpouse.emit($event)"
          (onDelete)="onDelete.emit($event)">
        </app-node-card>

        <ng-container *ngIf="node.spouse">
          <div
            class="tree-couple__connector"
            [class.tree-couple__connector--former]="node.spouse.partnerRelationshipType === 'former_spouse'"
            role="img"
            [attr.aria-label]="partnerRelationshipDescription"
            [attr.title]="partnerRelationshipDescription">
            <span class="tree-couple__tab tree-couple__tab--left" aria-hidden="true"></span>
            <span class="tree-couple__rail" aria-hidden="true"></span>
            <span class="tree-couple__badge" aria-hidden="true">
              <i-lucide [name]="partnerRelationshipIcon" [size]="13"></i-lucide>
            </span>
            <span class="tree-couple__tab tree-couple__tab--right" aria-hidden="true"></span>
            <span class="tree-couple__label" aria-hidden="true">{{ partnerRelationshipLabel }}</span>
          </div>
          <app-node-card
            [node]="node.spouse"
            [selected]="selectedPersonId === node.spouse.id"
            (onSelect)="onSelect.emit($event)"
            (onEdit)="onEdit.emit($event)"
            (onAddChild)="onAddChild.emit($event)"
            (onAddSpouse)="onAddSpouse.emit($event)"
            (onDelete)="onDelete.emit($event)">
          </app-node-card>
        </ng-container>
      </div>

      <ng-container *ngIf="node.children.length">
        <button
          *ngIf="isCollapsed"
          type="button"
          class="tree-branch__expand"
          (click)="onToggleBranch.emit(node.id)">
          + {{ node.children.length }} {{ node.children.length === 1 ? 'person' : 'people' }}
        </button>
        <button
          *ngIf="!isCollapsed && !canShowChildren"
          type="button"
          class="tree-branch__expand tree-branch__expand--branch"
          [attr.aria-label]="'Open ' + node.name + ' branch'"
          (click)="onRevealBranch.emit(node.id)">
          Open {{ node.children.length === 1 ? 'branch' : node.children.length + ' branches' }}
        </button>

        <div *ngIf="!isCollapsed && canShowChildren" class="tree-children">
          <div class="tree-children__stem"></div>
          <div class="tree-children__row">
            <div
              *ngFor="let child of node.children; trackBy: trackByNode"
              class="tree-child">
              <app-tree-node
                [node]="child"
                [depth]="depth + 1"
                [maxRenderDepth]="maxRenderDepth"
                [selectedPersonId]="selectedPersonId"
                [collapsedNodeIds]="collapsedNodeIds"
                [expandedBranchIds]="expandedBranchIds"
                (onSelect)="onSelect.emit($event)"
                (onEdit)="onEdit.emit($event)"
                (onAddChild)="onAddChild.emit($event)"
                (onAddSpouse)="onAddSpouse.emit($event)"
                (onDelete)="onDelete.emit($event)"
                (onToggleBranch)="onToggleBranch.emit($event)"
                (onRevealBranch)="onRevealBranch.emit($event)">
              </app-tree-node>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    :host { display:block; }
    .tree-branch { display:flex; flex-direction:column; align-items:center; position:relative; min-width:max-content; }
    .tree-couple { display:flex; align-items:center; justify-content:center; gap:0; position:relative; z-index:2; }
    .tree-couple__connector { width:72px; height:58px; position:relative; flex:0 0 72px; display:flex; align-items:center; justify-content:center; color:#4338ca; }
    .tree-couple__rail { position:absolute; left:8px; right:8px; top:22px; height:5px; border-radius:999px; background:linear-gradient(90deg,#0d9488 0%,#4f46e5 50%,#0d9488 100%); box-shadow:0 2px 6px rgba(79,70,229,.2); }
    .tree-couple__tab { position:absolute; top:10px; width:13px; height:29px; border:2px solid #0d9488; background:#ecfdf5; box-shadow:0 3px 8px rgba(13,148,136,.18); }
    .tree-couple__tab::after { content:''; position:absolute; top:9px; width:5px; height:7px; border-radius:999px; background:#0d9488; }
    .tree-couple__tab--left { left:-1px; border-left:0; border-radius:0 9px 9px 0; }
    .tree-couple__tab--left::after { right:2px; }
    .tree-couple__tab--right { right:-1px; border-right:0; border-radius:9px 0 0 9px; }
    .tree-couple__tab--right::after { left:2px; }
    .tree-couple__badge { position:absolute; z-index:2; top:7px; left:50%; width:34px; height:34px; display:grid; place-items:center; border:4px solid #f3f6fa; border-radius:12px; color:white; background:linear-gradient(145deg,#4f46e5,#0d9488); box-shadow:0 5px 13px rgba(79,70,229,.28); transform:translateX(-50%) rotate(-5deg); }
    .tree-couple__badge svg { transform:rotate(5deg); }
    .tree-couple__label { position:absolute; z-index:3; left:50%; top:43px; max-width:68px; padding:2px 6px; overflow:hidden; border:1px solid #d9ddff; border-radius:999px; color:#4338ca; background:#f7f7ff; font-size:7px; font-weight:850; letter-spacing:.04em; line-height:1.25; text-overflow:ellipsis; text-transform:uppercase; white-space:nowrap; transform:translateX(-50%); }
    .tree-couple__connector--former .tree-couple__rail { height:3px; background:repeating-linear-gradient(90deg,#e11d48 0 7px,transparent 7px 11px); box-shadow:none; }
    .tree-couple__connector--former .tree-couple__tab { border-color:#e11d48; background:#fff1f2; box-shadow:none; }
    .tree-couple__connector--former .tree-couple__tab::after { background:#e11d48; }
    .tree-couple__connector--former .tree-couple__badge { background:linear-gradient(145deg,#f43f5e,#be123c); box-shadow:0 5px 13px rgba(225,29,72,.2); }
    .tree-couple__connector--former .tree-couple__label { border-color:#fecdd3; color:#be123c; background:#fff1f2; }
    .tree-children { position:relative; display:flex; flex-direction:column; align-items:center; margin-top:42px; isolation:isolate; animation:branch-in .2s ease-out; }
    .tree-children__stem { position:absolute; left:50%; top:-46px; z-index:0; width:2px; height:46px; border-radius:999px; background:#94a3b8; box-shadow:0 0 0 1px rgba(148,163,184,.18); }
    .tree-children__row { display:flex; align-items:flex-start; gap:30px; position:relative; padding-top:24px; }
    .tree-children__row::before { content:''; position:absolute; top:0; left:110px; right:110px; z-index:0; height:2px; border-radius:999px; background:#94a3b8; box-shadow:0 0 0 1px rgba(148,163,184,.13); }
    .tree-child { position:relative; z-index:1; padding:0 4px; content-visibility:auto; contain-intrinsic-size:260px 180px; }
    .tree-child::before { content:''; position:absolute; left:50%; top:-24px; z-index:0; width:2px; height:24px; border-radius:999px; background:#94a3b8; box-shadow:0 0 0 1px rgba(148,163,184,.13); }
    .tree-child:only-child + * { display:none; }
    .tree-children__row:has(.tree-child:only-child)::before { display:none; }
    .tree-branch__expand { margin-top:28px; min-height:34px; padding:8px 13px; border:1px solid #c7d2fe; border-radius:999px; color:#4338ca; background:#eef2ff; font:800 11px/1 inherit; cursor:pointer; box-shadow:0 4px 12px rgba(79,70,229,.12); transition:transform .16s ease, box-shadow .16s ease, background .16s ease; }
    .tree-branch__expand:hover, .tree-branch__expand:focus-visible { transform:translateY(-1px); background:#e5e7ff; box-shadow:0 8px 20px rgba(79,70,229,.16); outline:0; }
    .tree-branch__expand--branch { border-color:#b7efe6; color:#0f766e; background:#ecfdf5; box-shadow:0 4px 12px rgba(13,148,136,.12); }
    .tree-branch__expand--branch:hover, .tree-branch__expand--branch:focus-visible { background:#dffbf4; box-shadow:0 8px 20px rgba(13,148,136,.16); }
    @keyframes branch-in { from { opacity:0; transform:translateY(-8px) scale(.985); } to { opacity:1; transform:none; } }
  `]
})
export class TreeNodeComponent {
  @Input({ required: true }) node!: TreeNode;
  @Input() isRoot = false;
  @Input() depth = 0;
  @Input() maxRenderDepth = 2;
  @Input() selectedPersonId: string | null = null;
  @Input() collapsedNodeIds: ReadonlySet<string> = new Set<string>();
  @Input() expandedBranchIds: ReadonlySet<string> = new Set<string>();
  @Output() onSelect = new EventEmitter<TreeNode>();
  @Output() onEdit = new EventEmitter<TreeNode>();
  @Output() onAddChild = new EventEmitter<TreeNode>();
  @Output() onAddSpouse = new EventEmitter<TreeNode>();
  @Output() onDelete = new EventEmitter<string>();
  @Output() onToggleBranch = new EventEmitter<string>();
  @Output() onRevealBranch = new EventEmitter<string>();

  get isCollapsed(): boolean {
    return this.collapsedNodeIds.has(this.node.id);
  }

  get canShowChildren(): boolean {
    return this.depth < this.maxRenderDepth || this.expandedBranchIds.has(this.node.id);
  }

  get partnerRelationshipLabel(): string {
    switch (this.node.spouse?.partnerRelationshipType) {
      case 'spouse': return 'Married';
      case 'former_spouse': return 'Former';
      default: return 'Partners';
    }
  }

  get partnerRelationshipIcon(): string {
    return this.node.spouse?.partnerRelationshipType === 'former_spouse' ? 'unlink' : 'link-2';
  }

  get partnerRelationshipDescription(): string {
    if (!this.node.spouse) return '';
    const startYear = this.node.spouse.relationshipStartDate?.slice(0, 4);
    const timing = startYear ? ` since ${startYear}` : '';
    return `${this.node.name} and ${this.node.spouse.name}: ${this.partnerRelationshipLabel}${timing}`;
  }

  trackByNode(_index: number, node: TreeNode): string {
    return node.id;
  }
}
