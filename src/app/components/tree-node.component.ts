import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TreeNode } from '../models/tree-node.model';
import { NodeCardComponent } from './node-card.component';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [CommonModule, NodeCardComponent],
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
          <div class="tree-couple__line" [class.tree-couple__line--former]="node.spouse.partnerRelationshipType === 'former_spouse'"></div>
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
          *ngIf="!isCollapsed && depth >= maxRenderDepth"
          type="button"
          class="tree-branch__expand"
          (click)="onRevealMore.emit()">
          Show {{ node.children.length }} more
        </button>

        <div *ngIf="!isCollapsed && depth < maxRenderDepth" class="tree-children">
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
                (onSelect)="onSelect.emit($event)"
                (onEdit)="onEdit.emit($event)"
                (onAddChild)="onAddChild.emit($event)"
                (onAddSpouse)="onAddSpouse.emit($event)"
                (onDelete)="onDelete.emit($event)"
                (onToggleBranch)="onToggleBranch.emit($event)"
                (onRevealMore)="onRevealMore.emit()">
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
    .tree-couple { display:flex; align-items:center; justify-content:center; gap:22px; position:relative; z-index:2; }
    .tree-couple__line { width:22px; border-top:2px dashed #8da0b8; }
    .tree-couple__line--former { border-color:#e11d48; }
    .tree-children { position:relative; display:flex; flex-direction:column; align-items:center; margin-top:42px; }
    .tree-children__stem { position:absolute; left:50%; top:-42px; width:1px; height:42px; background:#b8c5d6; }
    .tree-children__row { display:flex; align-items:flex-start; gap:36px; position:relative; padding-top:24px; }
    .tree-children__row::before { content:''; position:absolute; top:0; left:calc(var(--edge-pad, 124px)); right:calc(var(--edge-pad, 124px)); height:1px; background:#b8c5d6; }
    .tree-child { position:relative; padding:0 4px; content-visibility:auto; contain-intrinsic-size:260px 180px; }
    .tree-child::before { content:''; position:absolute; left:50%; top:-24px; width:1px; height:24px; background:#b8c5d6; }
    .tree-child:only-child + * { display:none; }
    .tree-children__row:has(.tree-child:only-child)::before { display:none; }
    .tree-branch__expand { margin-top:32px; padding:7px 12px; border:1px solid #c7d2fe; border-radius:999px; color:#4338ca; background:#eef2ff; font:700 11px/1 inherit; cursor:pointer; box-shadow:0 4px 12px rgba(79,70,229,.12); }
  `]
})
export class TreeNodeComponent {
  @Input({ required: true }) node!: TreeNode;
  @Input() isRoot = false;
  @Input() depth = 0;
  @Input() maxRenderDepth = 4;
  @Input() selectedPersonId: string | null = null;
  @Input() collapsedNodeIds: ReadonlySet<string> = new Set<string>();
  @Output() onSelect = new EventEmitter<TreeNode>();
  @Output() onEdit = new EventEmitter<TreeNode>();
  @Output() onAddChild = new EventEmitter<TreeNode>();
  @Output() onAddSpouse = new EventEmitter<TreeNode>();
  @Output() onDelete = new EventEmitter<string>();
  @Output() onToggleBranch = new EventEmitter<string>();
  @Output() onRevealMore = new EventEmitter<void>();

  get isCollapsed(): boolean {
    return this.collapsedNodeIds.has(this.node.id);
  }

  trackByNode(_index: number, node: TreeNode): string {
    return node.id;
  }
}
