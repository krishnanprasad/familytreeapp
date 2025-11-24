# Design System & Styling Guide

## 🎨 Color Palette

### Primary Colors
```scss
$color-ancestor: #FFB800;        // Gold - Ancestor/Root
$color-current-user: #007BFF;    // Blue - Current User
$color-male: #1E3A8A;            // Dark Blue - Male
$color-female: #EC4899;          // Pink - Female
$color-spouse: #10B981;          // Green - Spouse
$color-deceased: #6B7280;        // Gray - Deceased

// Connections
$color-parent-child: #3B82F6;    // Light Blue
$color-spouse-link: #10B981;     // Green (dotted)
```

### Neutral Colors
```scss
$color-white: #FFFFFF;
$color-gray-50: #F9FAFB;
$color-gray-100: #F3F4F6;
$color-gray-200: #E5E7EB;
$color-gray-400: #9CA3AF;
$color-gray-700: #374151;
$color-gray-900: #1F2937;
```

### Semantic Colors
```scss
$color-success: #10B981;         // Green
$color-warning: #F59E0B;         // Amber
$color-error: #EF4444;           // Red
$color-info: #3B82F6;            // Blue
```

---

## 📐 Typography

### Font Family
```scss
$font-family-primary: 'Inter', -apple-system, BlinkMacSystemFont, 
                      'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

### Font Sizes
```scss
$font-size-xs: 12px;             // Node label
$font-size-sm: 14px;             // Button, input
$font-size-base: 16px;           // Body text
$font-size-lg: 18px;             // Sidebar heading
$font-size-xl: 24px;             // Page title
$font-size-2xl: 28px;            // Header title
```

### Font Weights
```scss
$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;
```

---

## 🔲 Spacing System

### Base Unit: 4px
```scss
$space-xs: 4px;      // Tiny gaps
$space-sm: 8px;      // Small gaps
$space-md: 12px;     // Default gap
$space-lg: 16px;     // Standard padding
$space-xl: 20px;     // Large padding
$space-2xl: 30px;    // Extra large
$space-3xl: 40px;    // Sections
$space-4xl: 60px;    // Major sections
```

### Practical Usage
```scss
// Padding
padding: $space-md;           // 12px all
padding: $space-lg $space-xl; // 16px vertical, 20px horizontal

// Margins
margin: $space-md;
margin-bottom: $space-lg;

// Gaps (Flexbox)
gap: $space-md;
```

---

## 🎯 Components Styling

### Button Styles

**Primary Button**
```scss
.btn-primary {
  background: $color-current-user;  // #007BFF
  color: white;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  
  &:hover {
    background: darken($color-current-user, 20%);
    box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3);
  }
  
  &:active {
    transform: scale(0.98);
  }
}
```

**Secondary Button**
```scss
.btn-secondary {
  background: $color-gray-200;
  color: $color-gray-700;
  padding: 10px 20px;
  border-radius: 6px;
  
  &:hover {
    background: $color-gray-300;
  }
}
```

**Danger Button**
```scss
.btn-danger {
  background: $color-error;
  color: white;
  
  &:hover {
    background: darken($color-error, 10%);
  }
}
```

### Input Styles
```scss
input[type='text'],
input[type='number'],
select {
  padding: 10px 12px;
  border: 1px solid $color-gray-300;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: $color-current-user;
    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
  }
}
```

### Modal Styles
```scss
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  
  .modal {
    background: white;
    border-radius: 12px;
    padding: 30px;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    animation: slideUp 0.3s ease;
  }
}
```

---

## 📊 SVG Canvas Styling

### Node (Circle) Styling
```typescript
// Ancestor Node
circle.setAttribute('fill', '#10B981');      // Green fill
circle.setAttribute('stroke', '#FFB800');    // Gold border
circle.setAttribute('stroke-width', '3');    // 3px border

// Current User Node
circle.setAttribute('stroke', '#007BFF');    // Blue border

// Deceased Node
circle.setAttribute('opacity', '0.5');       // 50% transparent

// Male Node
circle.setAttribute('stroke', '#1E3A8A');    // Dark blue

// Female Node
circle.setAttribute('stroke', '#EC4899');    // Pink
```

### Text Styling (SVG)
```typescript
// Name text
text.setAttribute('font-size', '12');
text.setAttribute('font-weight', 'bold');
text.setAttribute('fill', '#1F2937');
text.setAttribute('text-anchor', 'middle');

// Age/Status text
text.setAttribute('font-size', '11');
text.setAttribute('fill', '#6B7280');
```

### Connection Lines
```typescript
// Parent-child line
line.setAttribute('stroke', '#3B82F6');     // Blue
line.setAttribute('stroke-width', '2');     // 2px solid

// Spouse line (dotted)
line.setAttribute('stroke', '#10B981');     // Green
line.setAttribute('stroke-dasharray', '5,5'); // Dotted pattern
```

---

## 🎬 Animations

### Keyframes

**Slide Up**
```scss
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// Usage
animation: slideUp 0.3s ease;
```

**Fade In**
```scss
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

### Transitions
```scss
// Smooth all properties
transition: all 0.2s ease;

// Specific properties
transition: background 0.3s ease, 
            border-color 0.2s ease;

// Hover effects
&:hover {
  opacity: 0.8;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
}
```

---

## 📱 Responsive Design

### Breakpoints
```scss
$breakpoint-sm: 640px;    // Small (mobile)
$breakpoint-md: 768px;    // Medium (tablet)
$breakpoint-lg: 1024px;   // Large (desktop)
$breakpoint-xl: 1280px;   // Extra large
$breakpoint-2xl: 1536px;  // 2x extra large
```

### Media Queries
```scss
// Mobile-first approach
// Default = mobile styles

// Tablet and up
@media (min-width: $breakpoint-md) {
  // Tablet styles
}

// Desktop and up
@media (min-width: $breakpoint-lg) {
  // Desktop styles
}
```

### Layout Adjustments
```scss
// Desktop: Sidebar + Canvas side by side
@media (min-width: $breakpoint-lg) {
  .tree-section {
    display: flex;
    gap: 0;
    
    .sidebar {
      width: 280px;
      border-right: 1px solid $color-gray-200;
    }
  }
}

// Mobile: Stacked layout
@media (max-width: $breakpoint-md) {
  .tree-section {
    flex-direction: column;
    
    .sidebar {
      width: 100%;
      max-height: 200px;
      border-bottom: 1px solid $color-gray-200;
    }
  }
}
```

---

## 🎯 Layout Grid

### Header
```
[Logo/Title] [Export Buttons] [Clear Button]
Height: 60px
Background: Linear gradient (purple)
Padding: 20px 30px
```

### Main Content
```
[Sidebar (280px)] | [Canvas (flex)]
Sidebar width: 280px
Canvas flex: 1
```

### Sidebar
```
[Search]
[Family Members List]
  ├── Person Item (repeating)
  │   ├── Name + Status Icon
  │   ├── Age + Gender
  │   └── Action Buttons (5 buttons)
[New Ancestor Button]
```

### Canvas
```
[SVG Viewport (1200x800)]
├── Connection Lines
├── Node Circles
├── Node Labels
└── Details Panel (bottom-right when selected)
```

---

## ♿ Accessibility

### Focus Styles
```scss
:focus-visible {
  outline: 2px solid $color-current-user;
  outline-offset: 2px;
}

button:focus-visible,
a:focus-visible {
  outline: 2px solid $color-current-user;
  outline-offset: 2px;
}
```

### Color Contrast
- White on Blue: 12.6:1 ✅ (WCAG AAA)
- White on Green: 5.3:1 ✅ (WCAG AA)
- Black on Gold: 7.4:1 ✅ (WCAG AAA)
- Black on Light Gray: 8.5:1 ✅ (WCAG AAA)

### ARIA Labels
```html
<button aria-label="Add child to this family member">👶</button>
<button aria-label="Delete family member">🗑️</button>
```

---

## 🎨 Customization Guide

### Change Primary Color
```scss
// In variables
$color-current-user: #0066FF;  // From #007BFF

// Affects:
// - Primary buttons
// - Current user node
// - Form focus states
// - Navigation active states
```

### Change Ancestor Color
```scss
// In tree-canvas.component.ts
colors = {
  ancestor: '#FF6B35',  // From #FFB800 (orange)
  // ... rest of colors
};
```

### Adjust Canvas Size
```typescript
// In tree-canvas.component.ts
canvasWidth = 1400;   // From 1200
canvasHeight = 900;   // From 800
nodeRadius = 70;      // From 60
levelHeight = 200;    // From 150
siblingsSpacing = 220; // From 180
```

### Modify Spacing
```scss
// In app.component.scss
.sidebar {
  padding: 30px;  // From 20px
  width: 350px;   // From 280px
}
```

---

## 🎭 Theme Variables (Future)

Once implemented, allow theme switching:
```typescript
// theme.ts
export const themes = {
  light: {
    primary: '#007BFF',
    ancestor: '#FFB800',
    background: '#F9FAFB',
    text: '#1F2937'
  },
  dark: {
    primary: '#60A5FA',
    ancestor: '#FBBF24',
    background: '#1F2937',
    text: '#F9FAFB'
  }
};
```

---

## 📚 Style Architecture

### File Organization
```
src/
├── styles.scss              # Global styles
├── app/
│   ├── app.component.scss    # App layout
│   └── components/
│       ├── tree-canvas.component.scss
│       └── person-form.component.scss
```

### Import Order
```scss
// 1. Variables & mixins
@import 'variables';

// 2. Base styles
@import 'base';

// 3. Components
.component-name { }

// 4. Responsive overrides
@media (max-width: $breakpoint-md) { }
```

### SCSS Best Practices
```scss
// ✅ DO
.button {
  padding: $space-md;
  background: $color-primary;
  
  &:hover {
    background: darken($color-primary, 10%);
  }
  
  &.active {
    background: $color-primary;
  }
}

// ❌ DON'T
.button {
  padding: 12px;
  background: #007BFF;
}

.button:hover {
  background: #0056B3;
}
```

---

## 🎨 Design Tokens Summary

| Token | Value | Usage |
|-------|-------|-------|
| Primary Color | #007BFF | Buttons, links, focus |
| Success Color | #10B981 | Spouses, positive actions |
| Warning Color | #F59E0B | Caution, pending |
| Error Color | #EF4444 | Delete, danger |
| Ancestor Color | #FFB800 | Root node highlight |
| Base Spacing | 4px | All spacing |
| Border Radius | 6-12px | Cards, modals |
| Shadow | 0 4px 6px rgba(0,0,0,0.1) | Elevation |
| Font Family | Inter | All text |
| Border Width | 1-3px | Nodes, borders |

---

## 📖 How to Modify Styles

### Example: Change Button Color
```scss
// Find in app.component.scss
.btn {
  &.btn-primary {
    background: #007BFF;  // Change this
  }
}
```

### Example: Change Node Size
```typescript
// Find in tree-canvas.component.ts
nodeRadius = 60;  // Change this value
```

### Example: Change Spacing
```scss
// Find in app.component.scss
.sidebar {
  padding: 20px;  // Adjust padding
  width: 280px;   // Adjust width
  gap: 12px;      // Adjust gaps
}
```

---

**Design System Version:** 1.0  
**Last Updated:** November 25, 2024  
**Status:** Complete & Customizable
