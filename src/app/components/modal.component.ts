import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, X } from 'lucide-angular';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div *ngIf="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 pointer-events-auto">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 class="text-lg font-bold text-gray-800">{{ title }}</h3>
          <button 
            (click)="onClose.emit()"
            class="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
            <i-lucide name="x" [size]="20"></i-lucide>
          </button>
        </div>
        <div class="p-6">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `
})
export class ModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Output() onClose = new EventEmitter<void>();
}
