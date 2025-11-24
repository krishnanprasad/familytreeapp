import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Gender, Person } from '../models/person.model';
import { FamilyTreeService } from '../services/family-tree.service';

@Component({
  selector: 'app-person-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './person-form.component.html',
  styleUrls: ['./person-form.component.scss']
})
export class PersonFormComponent implements OnInit {
  @Input() isOpen = false;
  @Input() parentId?: string;
  @Input() mode: 'add' | 'edit' | 'add-spouse' | 'add-child-with-parents' = 'add';
  @Input() editingPerson?: Person;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<any>();

  form = {
    name: '',
    gender: Gender.MALE,
    age: 0,
    location: '',
    isAlive: true
  };

  genders = [Gender.MALE, Gender.FEMALE, Gender.OTHER];
  allPeople: Person[] = [];
  selectedSpouseId = '';

  constructor(private familyTreeService: FamilyTreeService) {}

  ngOnInit(): void {
    this.familyTreeService.people$.subscribe(people => {
      this.allPeople = people;
    });
  }

  ngOnChanges(): void {
    if (this.mode === 'edit' && this.editingPerson) {
      this.form = {
        name: this.editingPerson.name,
        gender: this.editingPerson.gender,
        age: this.editingPerson.age,
        location: this.editingPerson.location,
        isAlive: this.editingPerson.isAlive
      };
    } else {
      this.resetForm();
    }
  }

  onSubmit(): void {
    if (!this.form.name.trim()) {
      alert('Name is required');
      return;
    }

    if (this.mode === 'edit' && this.editingPerson) {
      this.save.emit({
        ...this.form,
        id: this.editingPerson.id
      });
    } else if (this.mode === 'add-spouse' && this.parentId) {
      this.save.emit({
        ...this.form,
        parentId: undefined,
        spouseId: this.parentId
      });
    } else {
      this.save.emit({
        ...this.form,
        parentId: this.parentId || undefined
      });
    }

    this.close.emit();
  }

  onClose(): void {
    this.close.emit();
  }

  private resetForm(): void {
    this.form = {
      name: '',
      gender: Gender.MALE,
      age: 0,
      location: '',
      isAlive: true
    };
    this.selectedSpouseId = '';
  }

  get modalTitle(): string {
    if (this.mode === 'edit') return 'Edit Person';
    if (this.mode === 'add-spouse') return 'Add Spouse';
    return 'Add Family Member';
  }
}
