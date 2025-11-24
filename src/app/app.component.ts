import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { TreeService } from './services/tree.service';
import { TreeNode, Gender, ActionType, CurrentNode, FormData } from './models/tree-node.model';
import { TreeNodeComponent } from './components/tree-node.component';
import { ButtonComponent } from './components/button.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    TreeNodeComponent,
    ButtonComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  @ViewChild('containerRef') containerRef!: ElementRef;

  treeData: TreeNode | null = null;
  scale = 1;
  position = { x: 0, y: 0 };
  isDragging = false;
  dragStart = { x: 0, y: 0 };

  // Modal State
  modalOpen = false;
  currentNode: CurrentNode | null = null;
  actionType: ActionType = 'add_child';
  quickAddOpen = false; // inline toolbar quick-add panel

  // Form State
  formData: FormData = {
    name: '',
    age: '',
    gender: Gender.MALE,
    isAlive: true,
    location: ''
  };

  genders = [Gender.MALE, Gender.FEMALE, Gender.OTHER];

  constructor(private treeService: TreeService) {}

  ngOnInit(): void {
    this.treeService.tree$.subscribe(tree => {
      this.treeData = tree;
    });
  }

  // --- Node Actions ---

  handleNodeAction(nodeId: string, type: ActionType, nodeData: TreeNode): void {
    this.currentNode = {
      id: nodeData.id,
      name: nodeData.name,
      gender: nodeData.gender,
      age: nodeData.age,
      location: nodeData.location,
      isAlive: nodeData.isAlive,
      type: nodeData.type
    };
    this.actionType = type;

    if (type === 'edit') {
      this.formData = {
        name: nodeData.name,
        age: nodeData.age.toString(),
        gender: nodeData.gender,
        isAlive: nodeData.isAlive,
        location: nodeData.location
      };
    } else {
      this.resetForm();
    }
    this.modalOpen = true;
  }

  deleteNode(nodeId: string): void {
    if (confirm('Are you sure? This will delete this person and ALL their descendants!')) {
      this.treeService.deleteNode(nodeId);
    }
  }

  handleSubmit(): void {
    if (!this.formData.name.trim()) {
      alert('Name is required');
      return;
    }

    if (!this.currentNode) return;

    if (this.actionType === 'add_child') {
      this.treeService.addChild(this.currentNode.id, {
        name: this.formData.name,
        age: parseInt(this.formData.age) || 0,
        gender: this.formData.gender,
        isAlive: this.formData.isAlive,
        location: this.formData.location,
        type: 'blood'
      });
    } else if (this.actionType === 'add_spouse') {
      this.treeService.addSpouse(this.currentNode.id, {
        name: this.formData.name,
        age: parseInt(this.formData.age) || 0,
        gender: this.formData.gender,
        isAlive: this.formData.isAlive,
        location: this.formData.location,
        type: 'spouse'
      });
    } else if (this.actionType === 'edit') {
      this.treeService.editNode(this.currentNode.id, {
        name: this.formData.name,
        age: parseInt(this.formData.age) || 0,
        gender: this.formData.gender,
        isAlive: this.formData.isAlive,
        location: this.formData.location
      });
    }

    this.closeModal();
  }

  closeModal(): void {
    this.modalOpen = false;
    this.currentNode = null;
  }

  resetForm(): void {
    this.formData = {
      name: '',
      age: '',
      gender: Gender.MALE,
      isAlive: true,
      location: ''
    };
  }

  // --- File Operations ---

  downloadTree(): void {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(this.treeService.exportToJSON());
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', 'my_family_tree.json');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Open modal to add a member to the root (convenience toolbar action)
  openAddMember(): void {
    if (!this.treeData) return;
    // set currentNode to root so add_child will attach to it
    this.currentNode = {
      id: this.treeData.id,
      name: this.treeData.name,
      gender: this.treeData.gender,
      age: this.treeData.age,
      location: this.treeData.location,
      isAlive: this.treeData.isAlive,
      type: this.treeData.type
    };
    this.actionType = 'add_child';
    this.resetForm();
    this.modalOpen = true;
    // also open quick-add as a fallback for touch/devices
    this.quickAddOpen = true;
  }

  closeQuickAdd(): void {
    this.quickAddOpen = false;
  }

  uploadTree(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        if (this.treeService.importFromJSON(json)) {
          alert('Family tree loaded successfully!');
        } else {
          alert('Failed to load family tree');
        }
      } catch (error) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }

  // --- Pan/Zoom ---

  onMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.dragStart = { x: e.clientX - this.position.x, y: e.clientY - this.position.y };
  }

  onMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      this.position = { x: e.clientX - this.dragStart.x, y: e.clientY - this.dragStart.y };
    }
  }

  onMouseUp(): void {
    this.isDragging = false;
  }

  zoomIn(): void {
    this.scale = Math.min(2, this.scale + 0.1);
  }

  zoomOut(): void {
    this.scale = Math.max(0.2, this.scale - 0.1);
  }

  getZoomPercentage(): number {
    return Math.round(this.scale * 100);
  }

  // --- Modal Title ---

  getModalTitle(): string {
    if (!this.currentNode) return '';
    if (this.actionType === 'add_child') return `Add Child to ${this.currentNode.name}`;
    if (this.actionType === 'add_spouse') return `Add Spouse for ${this.currentNode.name}`;
    return 'Edit Person Details';
  }
}
