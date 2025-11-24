import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button 
      [class]="buttonClass"
      [type]="type"
      [disabled]="disabled"
      (click)="onClick.emit($event)">
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    :host {
      --tw-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --tw-shadow-colored: 0 1px 2px 0 var(--tw-shadow-color);
    }

    button {
      @apply px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-sm active:scale-95;
      
      &:disabled {
        @apply opacity-50 cursor-not-allowed;
      }
    }
  `]
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = 'primary';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() className = '';
  onClick: any = { emit: () => {} };

  get buttonClass(): string {
    const baseStyle = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 shadow-sm active:scale-95";
    const variants = {
      primary: "bg-indigo-600 text-white hover:bg-indigo-700",
      secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
      danger: "bg-red-50 text-red-600 border border-red-100 hover:bg-red-100",
      success: "bg-emerald-600 text-white hover:bg-emerald-700"
    };

    return `${baseStyle} ${variants[this.variant]} ${this.className}`;
  }
}
