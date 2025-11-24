# Implementation Notes & Architecture

## Architecture Overview

### Core Components

#### 1. **FamilyTreeService** (`family-tree.service.ts`)
Central service managing all tree data and operations.

**Key Methods:**
- `initializeTree()` - Create first ancestor
- `addPerson()` - Add new family member
- `updatePerson()` - Modify person data
- `deletePerson()` - Remove person (cascades)
- `addSpouse()` - Link two people as spouses
- `addChild()` - Create parent-child relationship
- `getPerson()` - Retrieve person by ID
- `exportToJSON()` - Serialize tree
- `importFromJSON()` - Deserialize tree

**Observable Streams:**
- `familyTree$` - Current tree state
- `people$` - All people in tree
- `relationships$` - All connections

#### 2. **TreeCanvasComponent** (`tree-canvas.component.ts`)
Visual rendering engine for the family tree.

**Features:**
- SVG-based rendering
- Drag-and-drop positioning
- Auto-layout algorithm
- Node selection & details panel
- Color-coded visual hierarchy

**Layout Algorithm:**
1. Finds root ancestor using BFS
2. Calculates generation level for each person
3. Groups siblings by level
4. Distributes horizontally with spacing
5. Draws connections (parent-child, spouses)

#### 3. **PersonFormComponent** (`person-form.component.ts`)
Modal form for adding/editing family members.

**Modes:**
- `'add'` - Create new person
- `'edit'` - Modify existing person
- `'add-spouse'` - Link spouse relationship

#### 4. **AppComponent** (`app.component.ts`)
Main application shell managing UI state.

**Responsibilities:**
- Welcome vs. tree view logic
- Form modal state management
- Export/import operations
- Data deletion with confirmation

## Data Flow

```
User Action (UI)
    ↓
AppComponent (routes to handler)
    ↓
FamilyTreeService (updates state)
    ↓
Observable Update
    ↓
TreeCanvasComponent (re-renders)
    ↓
DOM Update (SVG nodes)
```

## Storage Strategy

### LocalStorage Key
```
my-family-tree → JSON string
```

### Data Structure
```json
{
  "id": "unique-tree-id",
  "treeName": "My Family",
  "people": [
    {
      "id": "person-id",
      "name": "John Doe",
      "gender": "male",
      "age": 65,
      "location": "New York",
      "isAlive": true,
      "spouseIds": ["spouse-id"],
      "childrenIds": ["child-id-1", "child-id-2"],
      "isAncestor": true,
      "positionX": 600,
      "positionY": 50,
      "createdAt": "2024-11-25T00:00:00.000Z",
      "updatedAt": "2024-11-25T00:00:00.000Z"
    }
  ],
  "relationships": [
    {
      "id": "rel-id",
      "fromId": "person-id",
      "toId": "spouse-id",
      "type": "spouse",
      "createdAt": "2024-11-25T00:00:00.000Z"
    }
  ]
}
```

## Color Scheme Constants

```typescript
colors = {
  ancestor: '#FFB800',        // Gold
  currentUser: '#007BFF',     // Blue
  male: '#1E3A8A',            // Dark Blue
  female: '#EC4899',          // Pink
  spouse: '#10B981',          // Green
  deceased: '#6B7280',        // Gray
  connection: '#3B82F6',      // Light Blue
  spouseConnection: '#10B981' // Green
};
```

## Canvas Dimensions

```typescript
canvasWidth = 1200;      // SVG width
canvasHeight = 800;      // SVG height
nodeRadius = 60;         // Circle radius
levelHeight = 150;       // Space between generations
siblingsSpacing = 180;   // Space between siblings
```

## Event Flow

### Adding a Child
```
1. User clicks 👶 on parent
2. AppComponent opens form with mode='add', parentId=X
3. User fills form and clicks Save
4. AppComponent calls service.addChild(parentId, ...)
5. Service updates tree data
6. Observable emits new people$ array
7. TreeCanvasComponent detects change and re-renders
8. Canvas shows new node with connecting line
9. Data auto-saves to localStorage
```

### Drag & Drop
```
1. User mousedown on node
2. TreeCanvasComponent captures startDrag(person.id)
3. mousemove calculates new position
4. onDragMove updates person.positionX/Y
5. drawTree() re-renders (live feedback)
6. mouseup triggers stopDrag()
7. Service updatePerson() saves new position
```

### Deletion with Cascade
```
1. User clicks 🗑️ on person
2. AppComponent shows confirmation dialog
3. If confirmed: service.deletePerson(personId)
4. Service recursively deletes all children
5. Removes from parent's childrenIds array
6. Removes all related relationships
7. Updates observable state
8. TreeCanvasComponent re-renders without deleted nodes
9. Data persists to localStorage
```

## Performance Considerations

### Current Optimizations
- Single SVG element (vs. DOM elements per node)
- RxJS subjects for state management
- Change detection on observables only
- Lazy rendering of canvas

### Bottlenecks at Scale
- 100+ nodes: Layout recalculation slower
- 1000+ nodes: Canvas drawing noticeable lag
- Mobile: Touch event handling for drag

### Mitigation Strategies
1. Virtual scrolling for large families (future)
2. Canvas optimization (WebGL?) (future)
3. Relationship caching (current)
4. Batch updates for import (future)

## TypeScript Best Practices

### Type Safety
- Full TypeScript interfaces for data models
- Enum for Gender values
- Union types for form modes
- Optional properties for flexible data

### Standalone Components
- No NgModule dependencies
- Direct imports in components
- Better tree-shaking for bundle size

### RxJS Patterns
- BehaviorSubject for state
- takeUntil for memory leak prevention
- Observable subscriptions in templates with async pipe
- Proper unsubscribe in ngOnDestroy

## Testing Strategy (Future)

### Unit Tests
```typescript
- FamilyTreeService.addPerson()
- FamilyTreeService.deletePerson()
- TreeCanvasComponent.calculatePositions()
```

### Integration Tests
```typescript
- Create ancestor → add child → render
- Drag node → update position → verify
- Export → Import → verify equality
```

### E2E Tests
```typescript
- Full user flow: welcome → create → add → export
- localStorage persistence
- Form validation
- Responsive layout
```

## Future Enhancements

### Phase 2
- [ ] PDF export with html2canvas
- [ ] Search/filter family members
- [ ] Undo/Redo with history
- [ ] Import from JSON

### Phase 3
- [ ] Cloud sync (Firebase/Auth)
- [ ] Photo uploads
- [ ] Family statistics dashboard
- [ ] Dark mode

### Phase 4
- [ ] Mobile app (Ionic/React Native)
- [ ] Real-time collaboration
- [ ] Advanced relationships (step-parent, adoption)
- [ ] Timeline view

## Browser DevTools Tips

### View LocalStorage
1. Open F12
2. Application → Local Storage
3. Look for "my-family-tree" key
4. Copy to JSON viewer for inspection

### Debug Canvas
1. Open DevTools
2. Elements tab
3. Select SVG element
4. Inspect circle elements for node positions

### Performance
1. DevTools → Performance tab
2. Record while adding family members
3. Check for layout thrashing
4. Monitor memory usage

## Deployment Checklist

- [ ] Build passes: `npm run build`
- [ ] No console errors in production build
- [ ] localStorage key is stable ("my-family-tree")
- [ ] Export/Import tested with multiple trees
- [ ] Mobile responsive verified
- [ ] Cross-browser tested
- [ ] Accessibility features in place (focus styles)
- [ ] README & QUICKSTART updated
- [ ] Git history clean
- [ ] Assets optimized (favicon, etc.)

---

**Last Updated:** November 25, 2024
**Version:** 1.0.0-beta
**Status:** MVP Ready
