import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FamilyTreeService } from '../services/family-tree.service';
import { Person, Gender } from '../models/person.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-tree-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tree-canvas.component.html',
  styleUrls: ['./tree-canvas.component.scss']
})
export class TreeCanvasComponent implements OnInit, OnDestroy {
  @ViewChild('svgCanvas', { static: false }) svgCanvas!: ElementRef<SVGSVGElement>;

  people: Person[] = [];
  selectedPerson: Person | null = null;
  isDragging = false;
  draggedPersonId: string | null = null;
  dragOffsetX = 0;
  dragOffsetY = 0;

  private destroy$ = new Subject<void>();

  // SVG Dimensions
  canvasWidth = 1200;
  canvasHeight = 800;
  nodeRadius = 60;
  levelHeight = 150;
  siblingsSpacing = 180;

  // Color scheme
  colors = {
    ancestor: '#FFB800',      // Gold
    currentUser: '#007BFF',   // Blue
    male: '#1E3A8A',          // Dark Blue
    female: '#EC4899',        // Pink
    spouse: '#10B981',        // Green
    deceased: '#6B7280',      // Gray
    connection: '#3B82F6',    // Light Blue
    spouseConnection: '#10B981' // Green
  };

  constructor(private familyTreeService: FamilyTreeService) {}

  ngOnInit(): void {
    this.familyTreeService.people$
      .pipe(takeUntil(this.destroy$))
      .subscribe(people => {
        this.people = people;
        setTimeout(() => this.drawTree(), 100);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  drawTree(): void {
    if (!this.svgCanvas) return;

    const svg = this.svgCanvas.nativeElement;
    // Clear previous
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    if (this.people.length === 0) return;

    // Calculate positions
    this.calculatePositions();

    // Draw connections first (so they appear behind nodes)
    this.drawConnections(svg);

    // Draw nodes
    this.drawNodes(svg);
  }

  private calculatePositions(): void {
    const tree = this.familyTreeService['familyTree']?.value;
    if (!tree) return;

    const positionMap = new Map<string, { x: number; y: number }>();
    const levelMap = new Map<string, number>();

    // Find root (ancestor)
    const root = this.people.find(p => p.isAncestor);
    if (!root) return;

    // BFS to calculate levels
    const queue = [root.id];
    levelMap.set(root.id, 0);

    while (queue.length > 0) {
      const personId = queue.shift()!;
      const level = levelMap.get(personId)!;
      const person = tree.people.get(personId);

      if (person) {
        person.childrenIds.forEach(childId => {
          if (!levelMap.has(childId)) {
            levelMap.set(childId, level + 1);
            queue.push(childId);
          }
        });
      }
    }

    // Calculate X positions (by level groups)
    const levelGroups = new Map<number, string[]>();
    levelMap.forEach((level, personId) => {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(personId);
    });

    levelGroups.forEach((personIds, level) => {
      const levelWidth = (personIds.length - 1) * this.siblingsSpacing;
      const startX = (this.canvasWidth - levelWidth) / 2;

      personIds.forEach((personId, index) => {
        const x = startX + index * this.siblingsSpacing;
        const y = 100 + level * this.levelHeight;
        positionMap.set(personId, { x, y });

        const person = tree.people.get(personId);
        if (person) {
          person.positionX = x;
          person.positionY = y;
        }
      });
    });
  }

  private drawConnections(svg: SVGSVGElement): void {
    const tree = this.familyTreeService['familyTree']?.value;
    if (!tree) return;

    // Parent-child connections
    tree.people.forEach(person => {
      if (person.positionX !== undefined && person.positionY !== undefined) {
        // Draw lines from all parents to child
        person.parentIds?.forEach(parentId => {
          const parent = tree.people.get(parentId);
          if (parent && parent.positionX !== undefined && parent.positionY !== undefined) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', parent.positionX!.toString());
            line.setAttribute('y1', parent.positionY!.toString());
            line.setAttribute('x2', person.positionX!.toString());
            line.setAttribute('y2', person.positionY!.toString());
            line.setAttribute('stroke', this.colors.connection);
            line.setAttribute('stroke-width', '2');
            svg.appendChild(line);
          }
        });

        // Spouse connections (dotted)
        person.spouseIds.forEach(spouseId => {
          const spouse = tree.people.get(spouseId);
          if (spouse && spouse.positionX !== undefined && spouse.positionY !== undefined) {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', person.positionX!.toString());
            line.setAttribute('y1', person.positionY!.toString());
            line.setAttribute('x2', spouse.positionX!.toString());
            line.setAttribute('y2', spouse.positionY!.toString());
            line.setAttribute('stroke', this.colors.spouseConnection);
            line.setAttribute('stroke-width', '2');
            line.setAttribute('stroke-dasharray', '5,5');
            svg.appendChild(line);
          }
        });
      }
    });
  }

  private drawNodes(svg: SVGSVGElement): void {
    this.people.forEach(person => {
      if (person.positionX === undefined || person.positionY === undefined) return;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'person-node');
      g.setAttribute('data-id', person.id);

      // Determine border color
      let borderColor = this.colors.male;
      if (person.isAncestor) {
        borderColor = this.colors.ancestor;
      } else if (person.isCurrentUser) {
        borderColor = this.colors.currentUser;
      } else if (person.gender === Gender.FEMALE) {
        borderColor = this.colors.female;
      }

      // Background - Rectangle instead of circle
      const nodeWidth = 100;
      const nodeHeight = 80;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', (person.positionX - nodeWidth / 2).toString());
      rect.setAttribute('y', (person.positionY - nodeHeight / 2).toString());
      rect.setAttribute('width', nodeWidth.toString());
      rect.setAttribute('height', nodeHeight.toString());
      rect.setAttribute('rx', '8');
      rect.setAttribute('fill', this.colors.spouse);
      rect.setAttribute('stroke', borderColor);
      rect.setAttribute('stroke-width', '3');
      if (!person.isAlive) {
        rect.setAttribute('opacity', '0.5');
      }
      g.appendChild(rect);

      // Name text
      const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      nameText.setAttribute('x', person.positionX.toString());
      nameText.setAttribute('y', (person.positionY - 10).toString());
      nameText.setAttribute('text-anchor', 'middle');
      nameText.setAttribute('font-size', '12');
      nameText.setAttribute('font-weight', 'bold');
      nameText.setAttribute('fill', '#1F2937');
      nameText.textContent = person.name;
      g.appendChild(nameText);

      // Age and status
      const ageText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ageText.setAttribute('x', person.positionX.toString());
      ageText.setAttribute('y', person.positionY.toString());
      ageText.setAttribute('text-anchor', 'middle');
      ageText.setAttribute('font-size', '11');
      ageText.setAttribute('fill', '#6B7280');
      ageText.textContent = `${person.age} ${person.isAlive ? '✓' : '✗'}`;
      g.appendChild(ageText);

      // Event listeners
      g.addEventListener('click', () => this.selectPerson(person));
      g.addEventListener('mousedown', (e) => this.startDrag(e, person.id));
      g.addEventListener('mouseover', () => g.style.cursor = 'grab');
      g.addEventListener('mouseout', () => g.style.cursor = 'default');

      svg.appendChild(g);
    });

    // Add mouse move and up listeners
    document.addEventListener('mousemove', (e) => this.onDragMove(e));
    document.addEventListener('mouseup', () => this.stopDrag());
  }

  private selectPerson(person: Person): void {
    this.selectedPerson = person;
  }

  private startDrag(e: MouseEvent, personId: string): void {
    this.isDragging = true;
    this.draggedPersonId = personId;
    const person = this.people.find(p => p.id === personId);
    if (person && person.positionX !== undefined && person.positionY !== undefined) {
      this.dragOffsetX = e.clientX - person.positionX;
      this.dragOffsetY = e.clientY - person.positionY;
    }
  }

  private onDragMove(e: MouseEvent): void {
    if (!this.isDragging || !this.draggedPersonId) return;

    const person = this.people.find(p => p.id === this.draggedPersonId);
    if (person) {
      person.positionX = e.clientX - this.dragOffsetX;
      person.positionY = e.clientY - this.dragOffsetY;
      this.drawTree();
    }
  }

  private stopDrag(): void {
    this.isDragging = false;
    this.draggedPersonId = null;
    if (this.draggedPersonId) {
      this.familyTreeService.updatePerson(this.draggedPersonId, {
        positionX: this.people.find(p => p.id === this.draggedPersonId)?.positionX,
        positionY: this.people.find(p => p.id === this.draggedPersonId)?.positionY
      });
    }
  }
}
