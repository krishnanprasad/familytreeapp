# 👨‍👩‍👧‍👦 My Family - Family Tree App

A beautiful, interactive Angular application for creating, managing, and visualizing your family tree. Store family member information with drag-and-drop node positioning, spouse and parent-child relationships, and persistent local storage.

## Features

✨ **Key Features:**

- 🌳 **Visual Family Tree**: Interactive SVG-based canvas for viewing your family structure
- 👥 **Family Member Management**: Add, edit, and delete family members with ease
- 💑 **Relationship Management**: Connect spouses and parent-child relationships
- 🎨 **Color-Coded Nodes**:
  - **Gold** - Ancestor (root of the tree)
  - **Blue** - Current User (highlighted in bright blue)
  - **Dark Blue** - Male family members
  - **Pink** - Female family members
  - **Green** - Spouses
  - **Gray & Transparent** - Deceased members (with ✓ or ✗ icons)
- 🖱️ **Drag & Drop**: Reposition nodes freely on the canvas
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 💾 **LocalStorage**: Data persists in your browser automatically
- 📥 **Export Options**: Download your tree as JSON or CSV
- 🔍 **Family List Sidebar**: Quick access to all family members with action buttons

## Tech Stack

- **Framework**: Angular 18+ (Standalone Components)
- **Language**: TypeScript
- **Styling**: SCSS
- **Visualization**: SVG with custom positioning
- **Storage**: Browser LocalStorage
- **Build Tool**: Angular CLI

## Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── tree-canvas.component.ts      # Canvas visualization
│   │   ├── tree-canvas.component.html
│   │   ├── tree-canvas.component.scss
│   │   ├── person-form.component.ts      # Add/Edit form
│   │   ├── person-form.component.html
│   │   └── person-form.component.scss
│   ├── models/
│   │   └── person.model.ts               # TypeScript interfaces
│   ├── services/
│   │   └── family-tree.service.ts        # Core business logic
│   ├── app.component.ts                  # Main app component
│   ├── app.component.html
│   ├── app.component.scss
│   └── app.config.ts
├── styles.scss                           # Global styles
└── index.html
```

## Getting Started

### Prerequisites

- Node.js v20.19.0+ or v22.12.0+
- npm 8.0.0+

### Installation

```bash
# Navigate to the project directory
cd familytreeapp

# Install dependencies
npm install
```

### Development Server

```bash
# Start the dev server
npm start

# Open your browser and navigate to http://localhost:4200/
```

### Building for Production

```bash
# Build the project
npm run build

# Output will be in dist/myfamily/
```

## Usage Guide

### 1. Create Your First Ancestor

1. Click **"🌳 Start Your Family Tree"** on the welcome screen
2. Enter the ancestor's name, gender, age, location, and status (alive/deceased)
3. Click **Save** to create the first node

### 2. Add Family Members

**Add Children:**
- Click the 👶 button on a family member in the sidebar
- Fill in the child's information
- Click **Save**

**Add Spouse:**
- Click the 💑 button on a family member
- Fill in the spouse's information
- Click **Save** (They'll be connected with a dotted green line)

**Edit Member:**
- Click the ✏️ button on a family member
- Modify their information
- Click **Save**

**Delete Member:**
- Click the 🗑️ button
- Confirm the deletion (deletes the person and their descendants)

### 3. Visualize Your Tree

- **Click nodes** on the canvas to view details
- **Drag nodes** to reposition them freely
- **View connections**:
  - Blue solid lines = Parent-child relationships
  - Green dotted lines = Spouse relationships

### 4. Set Current User

- Click the ⭐ button on a family member to highlight them as the "current user"
- The current user will be highlighted in bright blue

### 5. Export Your Data

**Export as JSON:**
- Click the **📥 JSON** button in the header
- This downloads your entire tree in JSON format

**Export as CSV:**
- Click the **📥 CSV** button
- Open in Excel or Google Sheets

**Future: Export as PDF** (Coming soon!)

### 6. Clear Data

- Click the **🗑️ Clear** button in the header
- Confirm to permanently delete all family data

## Data Model

### Person Interface

```typescript
interface Person {
  id: string;
  name: string;
  gender: Gender; // 'male' | 'female' | 'other'
  age: number;
  location: string;
  isAlive: boolean;
  parentId?: string;
  spouseIds: string[];
  childrenIds: string[];
  isAncestor: boolean;
  isCurrentUser: boolean;
  positionX?: number; // Canvas position
  positionY?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Storage Format

Your family tree is automatically saved to `localStorage` with the key `my-family-tree`. The data persists across browser sessions until you clear it.

## Features in Detail

### Smart Layout Algorithm

- Automatically calculates optimal positioning for family members
- Groups siblings and generations
- Maintains hierarchical structure (ancestor → generations)

### Responsive Design

- **Desktop**: Full sidebar + large canvas
- **Tablet**: Stacked layout with scrollable sidebar
- **Mobile**: Optimized touch interactions

### Color Scheme & Visual Hierarchy

| Element | Color | Purpose |
|---------|-------|---------|
| Ancestor | Gold (#FFB800) | Emphasizes root of tree |
| Current User | Blue (#007BFF) | Personal reference |
| Male | Dark Blue (#1E3A8A) | Gender differentiation |
| Female | Pink (#EC4899) | Gender differentiation |
| Spouse | Green (#10B981) | External relationship |
| Deceased | Gray (50% opacity) | Status indication |
| Connections | Blue solid | Parent-child |
| Spouse Links | Green dotted | Romantic relationship |

## Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome 90+ | ✅ Full |
| Firefox 88+ | ✅ Full |
| Safari 14+ | ✅ Full |
| Edge 90+ | ✅ Full |

## Troubleshooting

### Q: My data disappeared!
**A**: Check if you accidentally clicked "Clear" or cleared your browser's localStorage. Restore from your exported JSON file if available.

### Q: Why is the tree layout overlapping?
**A**: Drag nodes to reposition them. The auto-layout helps, but manual adjustment is sometimes needed for large trees.

### Q: Can I back up my tree?
**A**: Click **📥 JSON** to download your tree regularly. Keep these files safe!

## Future Enhancements

- 📄 PDF export with visual tree rendering
- 🔄 Undo/Redo functionality
- 🔍 Search and filter family members
- 📊 Family statistics
- 🌙 Dark mode
- 🗺️ Map view for location data
- 📤 Import from JSON/CSV
- 👤 User profiles with photos

## License

This project is open source and available under the MIT License.

---

**Made with ❤️ for families everywhere**

*Keep your family history alive and connected!*
