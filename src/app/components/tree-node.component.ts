import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TreeNode, ActionType } from '../models/tree-node.model';
import { NodeCardComponent } from './node-card.component';

@Component({
  selector: 'app-tree-node',
  standalone: true,
  imports: [CommonModule, NodeCardComponent],
  template: `
    <div class="flex flex-col items-center">
      <!-- Couple Wrapper -->
      <div class="flex items-center relative z-10 gap-8">
        <!-- Main Person -->
        <app-node-card 
          [node]="node"
          [isRoot]="isRoot"
          (onEdit)="onEdit.emit($event)"
          (onAddChild)="onAddChild.emit($event)"
          (onAddSpouse)="onAddSpouse.emit($event)"
          (onDelete)="onDelete.emit($event)">
        </app-node-card>

        <!-- Spouse Connection Line (Dotted) -->
        <ng-container *ngIf="node.spouse">
          <div class="absolute left-1/2 top-1/2 w-8 h-0 border-t-2 border-dashed border-gray-400 -translate-y-1/2 translate-x-[65px]"></div>
          <app-node-card 
            [node]="node.spouse"
            (onEdit)="onEdit.emit($event)"
            (onAddChild)="onAddChild.emit($event)"
            (onAddSpouse)="onAddSpouse.emit($event)"
            (onDelete)="onDelete.emit($event)">
          </app-node-card>
        </ng-container>
      </div>

      <!-- Children Generation -->
      <div *ngIf="node.children && node.children.length > 0" class="relative flex flex-col items-center mt-8">
        <!-- Vertical Line from Parent to Children Bar -->
        <div class="w-px h-8 bg-gray-300 absolute -top-8 left-1/2 -translate-x-1/2"></div>

        <!-- Horizontal Bar connecting all children -->
        <div *ngIf="node.children.length > 1" class="absolute top-0 h-px bg-gray-300" 
          [style.width.calc]="'100% - 12rem'"></div>

        <div class="flex gap-8 pt-4 items-start relative">
          <style>
            .child-connector::before {
              content: '';
              position: absolute;
              top: -16px;
              left: 50%;
              transform: translateX(-50%);
              width: 1px;
              height: 16px;
              background-color: #d1d5db;
            }
            .child-branch {
              position: relative;
            }
            .child-branch::after {
              content: '';
              position: absolute;
              top: -16px;
              left: 0;
              right: 0;
              height: 1px;
              background-color: #d1d5db;
              z-index: -1;
            }
            .child-branch:first-child::after {
              left: 50%;
            }
            .child-branch:last-child::after {
              right: 50%;
            }
            .child-branch:only-child::after {
              display: none;
            }
          </style>

          <div *ngFor="let child of node.children" class="child-branch px-4">
            <div class="child-connector">
              <app-tree-node 
                [node]="child"
                (onEdit)="onEdit.emit($event)"
                (onAddChild)="onAddChild.emit($event)"
                (onAddSpouse)="onAddSpouse.emit($event)"
                (onDelete)="onDelete.emit($event)">
              </app-tree-node>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class TreeNodeComponent {
  @Input() node!: TreeNode;
  @Input() isRoot = false;
  @Output() onEdit = new EventEmitter<TreeNode>();
  @Output() onAddChild = new EventEmitter<TreeNode>();
  @Output() onAddSpouse = new EventEmitter<TreeNode>();
  @Output() onDelete = new EventEmitter<string>();
}
