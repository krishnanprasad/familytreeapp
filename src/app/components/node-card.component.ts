import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TreeNode, ActionType } from '../models/tree-node.model';

@Component({
  selector: 'app-node-card',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="relative group flex flex-col items-center p-3 rounded-xl border-2 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-105 w-48"
      [ngClass]="{
        'border-emerald-500 bg-emerald-50/50': node.type === 'spouse',
        'border-blue-600 bg-white': node.type === 'blood'
      }">
      
      <!-- Alive/Dead Status Indicator -->
      <div class="absolute top-2 right-2">
        <ng-container *ngIf="node.isAlive">
          <i-lucide name="activity" [size]="16" class="text-emerald-500"></i-lucide>
        </ng-container>
        <ng-container *ngIf="!node.isAlive">
          <div class="flex items-center gap-1 bg-gray-100 px-1.5 rounded text-xs font-bold text-gray-500">
            <i-lucide name="skull" [size]="12"></i-lucide>
            RIP
          </div>
        </ng-container>
      </div>

      <!-- Content -->
      <div class="flex flex-col items-center gap-1 mt-1">
        <div class="p-2 rounded-full bg-gray-100"
          [ngClass]="node.gender === 'female' ? 'text-pink-600' : 'text-blue-600'">
          <i-lucide name="user" [size]="20"></i-lucide>
        </div>

        <h3 class="font-bold text-gray-900 text-center leading-tight">{{ node.name }}</h3>

        <div class="flex items-center gap-2 text-xs text-gray-500 font-medium">
          <span>{{ node.age }} yrs</span>
          <div *ngIf="node.location" class="flex items-center gap-0.5" [title]="node.location">
            <i-lucide name="map-pin" [size]="10"></i-lucide>
            <span class="max-w-[80px] truncate">{{ node.location }}</span>
          </div>
        </div>
      </div>

      <!-- Actions - Visible on Hover -->
      <div class="absolute -bottom-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity scale-90 flex-wrap justify-center">
        <button 
          (click)="onEdit.emit(node)"
          class="p-1.5 bg-gray-800 text-white rounded-full hover:bg-black shadow-sm transition-colors"
          title="Edit">
          <i-lucide name="user" [size]="12"></i-lucide>
        </button>

        <button 
          (click)="onAddChild.emit(node)"
          class="px-2 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-colors flex items-center gap-1 text-xs font-medium"
          title="Add Child">
          <i-lucide name="baby" [size]="12"></i-lucide>
          <span>Child</span>
        </button>

        <button 
          *ngIf="!node.spouse && node.type === 'blood'"
          (click)="onAddSpouse.emit(node)"
          class="px-2 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-1 text-xs font-medium"
          title="Add Spouse">
          <i-lucide name="heart" [size]="12"></i-lucide>
          <span>Spouse</span>
        </button>

        <button 
          *ngIf="!isRoot"
          (click)="onDelete.emit(node.id)"
          class="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm transition-colors"
          title="Delete">
          <i-lucide name="trash-2" [size]="12"></i-lucide>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class NodeCardComponent {
  @Input() node!: TreeNode;
  @Input() isRoot = false;
  @Output() onEdit = new EventEmitter<TreeNode>();
  @Output() onAddChild = new EventEmitter<TreeNode>();
  @Output() onAddSpouse = new EventEmitter<TreeNode>();
  @Output() onDelete = new EventEmitter<string>();
}
