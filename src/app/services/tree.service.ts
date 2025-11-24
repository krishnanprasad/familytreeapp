import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TreeNode, Gender, RelationType } from '../models/tree-node.model';

@Injectable({
  providedIn: 'root'
})
export class TreeService {
  private treeData = new BehaviorSubject<TreeNode>(this.getInitialTree());
  public tree$ = this.treeData.asObservable();

  private localStorage_KEY = 'myFamilyTree_v2';

  constructor() {
    this.loadFromStorage();
  }

  private getInitialTree(): TreeNode {
    return {
      id: 'root-1',
      name: 'Great Ancestor',
      age: 85,
      gender: Gender.MALE,
      isAlive: true,
      location: 'Ancestral Home',
      type: 'blood',
      spouse: null,
      children: []
    };
  }

  // Get current tree
  getTree(): TreeNode {
    return this.treeData.value;
  }

  // Find a node in the tree
  findNode(node: TreeNode, targetId: string): TreeNode | null {
    if (node.id === targetId) return node;
    if (node.spouse?.id === targetId) return node.spouse;

    for (const child of node.children) {
      const found = this.findNode(child, targetId);
      if (found) return found;
    }
    return null;
  }

  // Add a child to a node
  addChild(parentId: string, childData: Omit<TreeNode, 'id' | 'spouse' | 'children'>): void {
    const newChild: TreeNode = {
      id: Date.now().toString(),
      ...childData,
      spouse: null,
      children: []
    };

    const updateTree = (node: TreeNode): TreeNode => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...node.children, newChild]
        };
      }

      if (node.spouse?.id === parentId) {
        return {
          ...node,
          spouse: {
            ...node.spouse,
            children: [...node.spouse.children, newChild]
          }
        };
      }

      return {
        ...node,
        children: node.children.map(child => updateTree(child))
      };
    };

    this.treeData.next(updateTree(this.treeData.value));
    this.saveToStorage();
  }

  // Add spouse to a node
  addSpouse(personId: string, spouseData: Omit<TreeNode, 'id' | 'spouse' | 'children'>): void {
    const newSpouse: TreeNode = {
      id: Date.now().toString(),
      ...spouseData,
      type: 'spouse',
      spouse: null,
      children: []
    };

    const updateTree = (node: TreeNode): TreeNode => {
      if (node.id === personId) {
        return {
          ...node,
          spouse: newSpouse,
          children: node.children // Spouse inherits children
        };
      }

      return {
        ...node,
        children: node.children.map(child => updateTree(child))
      };
    };

    this.treeData.next(updateTree(this.treeData.value));
    this.saveToStorage();
  }

  // Edit a node
  editNode(nodeId: string, updates: Partial<Omit<TreeNode, 'id' | 'spouse' | 'children'>>): void {
    const updateTree = (node: TreeNode): TreeNode => {
      if (node.id === nodeId) {
        return {
          ...node,
          ...updates
        };
      }

      let newSpouse = node.spouse;
      if (node.spouse?.id === nodeId) {
        newSpouse = {
          ...node.spouse,
          ...updates
        };
      }

      return {
        ...node,
        spouse: newSpouse,
        children: node.children.map(child => updateTree(child))
      };
    };

    this.treeData.next(updateTree(this.treeData.value));
    this.saveToStorage();
  }

  // Delete a node
  deleteNode(nodeId: string): void {
    if (nodeId === this.treeData.value.id) {
      alert('Cannot delete the Root Ancestor. Reset the tree instead.');
      return;
    }

    const deleteRecursive = (node: TreeNode): TreeNode | null => {
      if (node.id === nodeId) return null;

      let newSpouse = node.spouse;
      if (node.spouse?.id === nodeId) {
        newSpouse = null;
      }

      const newChildren = node.children
        .map(deleteRecursive)
        .filter((n): n is TreeNode => n !== null);

      return {
        ...node,
        spouse: newSpouse,
        children: newChildren
      };
    };

    const result = deleteRecursive(this.treeData.value);
    if (result) {
      this.treeData.next(result);
      this.saveToStorage();
    }
  }

  // Export tree as JSON
  exportToJSON(): string {
    return JSON.stringify(this.treeData.value, null, 2);
  }

  // Import from JSON
  importFromJSON(jsonString: string): boolean {
    try {
      const tree = JSON.parse(jsonString);
      this.treeData.next(tree);
      this.saveToStorage();
      return true;
    } catch (error) {
      console.error('Failed to import tree:', error);
      return false;
    }
  }

  // Save to localStorage
  private saveToStorage(): void {
    localStorage.setItem(this.localStorage_KEY, JSON.stringify(this.treeData.value));
  }

  // Load from localStorage
  private loadFromStorage(): void {
    const saved = localStorage.getItem(this.localStorage_KEY);
    if (saved) {
      try {
        const tree = JSON.parse(saved);
        this.treeData.next(tree);
      } catch (error) {
        console.error('Failed to load tree from storage:', error);
      }
    }
  }

  // Reset tree
  resetTree(): void {
    if (confirm('This will delete the entire family tree. Are you sure?')) {
      this.treeData.next(this.getInitialTree());
      this.saveToStorage();
    }
  }
}
