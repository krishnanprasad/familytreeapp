import { TestBed } from '@angular/core/testing';
import { GedcomService } from './gedcom.service';

describe('GedcomService', () => {
  let service: GedcomService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GedcomService);
  });

  it('previews people, relationships and vital events before import', () => {
    const source = [
      '0 HEAD',
      '1 SOUR TEST',
      '0 @I1@ INDI',
      '1 NAME Meera /Rao/',
      '1 SEX F',
      '1 FAMS @F1@',
      '0 @I2@ INDI',
      '1 NAME Vikram /Rao/',
      '1 SEX M',
      '1 FAMS @F1@',
      '0 @I3@ INDI',
      '1 NAME Arun /Rao/',
      '1 BIRT',
      '2 DATE 15 JUN 1988',
      '2 PLAC Bengaluru, India',
      '1 FAMC @F1@',
      '0 @F1@ FAM',
      '1 WIFE @I1@',
      '1 HUSB @I2@',
      '1 CHIL @I3@',
      '0 TRLR'
    ].join('\n');

    const preview = service.parse(source);

    expect(preview.peopleCount).toBe(3);
    expect(preview.familyCount).toBe(1);
    expect(preview.tree.name).toBe('Meera Rao');
    expect(preview.tree.spouse?.name).toBe('Vikram Rao');
    expect(preview.tree.children[0].name).toBe('Arun Rao');
    expect(preview.tree.children[0].birthDate).toBe('1988-06-15');
    expect(preview.tree.relationshipRecords?.length).toBeGreaterThan(1);
  });
});
