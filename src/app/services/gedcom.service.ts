import { Injectable } from '@angular/core';
import {
  Gender,
  LifeEvent,
  ParentRelationshipType,
  PartnerRelationshipType,
  RelationshipRecord,
  TreeNode
} from '../models/tree-node.model';

export type GedcomDuplicateKind =
  | 'record_id'
  | 'possible_person'
  | 'family_reference';

export interface GedcomDuplicate {
  kind: GedcomDuplicateKind;
  ids: string[];
  label: string;
  reason: string;
}

export interface GedcomImportPreview {
  tree: TreeNode;
  peopleCount: number;
  familyCount: number;
  unsupportedTags: string[];
  warnings: string[];
  duplicates: GedcomDuplicate[];
}

interface GedcomNode {
  level: number;
  tag: string;
  value: string;
  xref?: string;
  lineNumber: number;
  children: GedcomNode[];
}

interface ParsedEvent {
  present: boolean;
  date?: string;
  place?: string;
  notes?: string;
}

interface ParsedFamilyLink {
  familyId: string;
  pedigree?: string;
}

interface ParsedIndividual {
  id: string;
  sourceId: string;
  name: string;
  alternateNames: string[];
  gender: Gender;
  birth: ParsedEvent;
  death: ParsedEvent;
  notes?: string;
  familyAsChild: ParsedFamilyLink[];
  familyAsSpouse: string[];
  order: number;
}

interface ParsedFamily {
  id: string;
  sourceId: string;
  husbands: string[];
  wives: string[];
  children: string[];
  marriage: ParsedEvent;
  notes?: string;
  order: number;
}

interface ParseContext {
  warnings: string[];
  warningSet: Set<string>;
  unsupportedTags: Set<string>;
  duplicates: GedcomDuplicate[];
}

interface PreviewGraph {
  relationships: RelationshipRecord[];
  relationshipsByPerson: Map<string, RelationshipRecord[]>;
  eventsByPerson: Map<string, LifeEvent[]>;
  partnersByPerson: Map<string, string[]>;
  childrenByParent: Map<string, string[]>;
  undirected: Map<string, Set<string>>;
  incomingParentCount: Map<string, number>;
}

const MONTH_NUMBERS: Record<string, string> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12'
};

/**
 * Parses a deliberately conservative GEDCOM subset into an import preview.
 * Parsing never writes to TreeService, localStorage, or Firestore.
 */
@Injectable({
  providedIn: 'root'
})
export class GedcomService {
  parse(source: string): GedcomImportPreview {
    const context: ParseContext = {
      warnings: [],
      warningSet: new Set<string>(),
      unsupportedTags: new Set<string>(),
      duplicates: []
    };

    const records = this.parseRecords(source, context);
    const individuals = this.parseIndividuals(records, context);
    const families = this.parseFamilies(records, context);

    if (individuals.length === 0) {
      throw new Error('GEDCOM import requires at least one INDI record.');
    }

    this.validateFamilyLinks(individuals, families, context);
    this.findPossibleDuplicatePeople(individuals, context);

    const graph = this.buildGraph(individuals, families, context);
    const tree = this.buildTreePreview(individuals, graph, context);

    return {
      tree,
      peopleCount: individuals.length,
      familyCount: families.length,
      unsupportedTags: Array.from(context.unsupportedTags).sort(),
      warnings: context.warnings,
      duplicates: context.duplicates
    };
  }

  createPreview(source: string): GedcomImportPreview {
    return this.parse(source);
  }

  parseGedcom(source: string): GedcomImportPreview {
    return this.parse(source);
  }

  private parseRecords(source: string, context: ParseContext): GedcomNode[] {
    const records: GedcomNode[] = [];
    const stack: GedcomNode[] = [];
    const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);

    lines.forEach((rawLine, index) => {
      if (!rawLine.trim()) return;

      const match = rawLine.match(/^\s*(\d+)\s+(?:(@[^\s@]+@)\s+)?([^\s]+)(?:\s+(.*))?\s*$/);
      if (!match) {
        this.warn(context, `Line ${index + 1} could not be parsed and was skipped.`);
        return;
      }

      const node: GedcomNode = {
        level: Number(match[1]),
        xref: match[2],
        tag: match[3].toUpperCase(),
        value: (match[4] || '').trim(),
        lineNumber: index + 1,
        children: []
      };

      while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
        stack.pop();
      }

      const parent = stack[stack.length - 1];
      if (parent) {
        parent.children.push(node);
      } else {
        if (node.level !== 0) {
          this.warn(
            context,
            `Line ${node.lineNumber} starts at level ${node.level} without a parent record.`
          );
        }
        records.push(node);
      }

      stack.push(node);
    });

    for (const record of records) {
      if (record.tag !== 'INDI' && record.tag !== 'FAM' && record.tag !== 'HEAD' && record.tag !== 'TRLR') {
        context.unsupportedTags.add(record.tag);
      }
    }

    return records;
  }

  private parseIndividuals(records: GedcomNode[], context: ParseContext): ParsedIndividual[] {
    const individuals: ParsedIndividual[] = [];
    const firstBySourceId = new Map<string, ParsedIndividual>();
    const occurrenceCount = new Map<string, number>();

    for (const record of records.filter(item => item.tag === 'INDI')) {
      const fallbackId = `gedcom-person-${individuals.length + 1}`;
      const sourceId = this.pointerId(record.xref || '') || fallbackId;
      const occurrence = (occurrenceCount.get(sourceId) || 0) + 1;
      occurrenceCount.set(sourceId, occurrence);
      const id = occurrence === 1 ? sourceId : `${sourceId}__duplicate_${occurrence}`;

      if (!record.xref) {
        this.warn(
          context,
          `INDI record on line ${record.lineNumber} has no cross-reference ID; generated ${fallbackId}.`
        );
      }

      const nameNodes = record.children.filter(child => child.tag === 'NAME');
      const parsedNames = this.uniqueStrings(nameNodes.map(node => this.parseName(node)).filter(Boolean));
      const name = parsedNames[0] || `Unnamed person (${sourceId})`;

      if (parsedNames.length === 0) {
        this.warn(context, `Person ${this.displayPointer(sourceId)} has no NAME value.`);
      }

      const sexNode = record.children.find(child => child.tag === 'SEX');
      const birthNode = record.children.find(child => child.tag === 'BIRT');
      const deathNode = record.children.find(child => child.tag === 'DEAT');
      const familyAsChild = record.children
        .filter(child => child.tag === 'FAMC')
        .map(child => ({
          familyId: this.pointerId(child.value),
          pedigree: child.children.find(grandchild => grandchild.tag === 'PEDI')?.value.trim()
        }))
        .filter(link => Boolean(link.familyId));
      const familyAsSpouse = record.children
        .filter(child => child.tag === 'FAMS')
        .map(child => this.pointerId(child.value))
        .filter(Boolean);

      this.collectUnsupportedIndividualTags(record, context);

      const individual: ParsedIndividual = {
        id,
        sourceId,
        name,
        alternateNames: parsedNames.slice(1),
        gender: this.parseGender(sexNode?.value),
        birth: this.parseEvent(birthNode, context),
        death: this.parseEvent(deathNode, context),
        notes: this.joinNotes(record.children.filter(child => child.tag === 'NOTE')),
        familyAsChild,
        familyAsSpouse,
        order: individuals.length
      };

      const first = firstBySourceId.get(sourceId);
      if (first) {
        context.duplicates.push({
          kind: 'record_id',
          ids: [first.id, individual.id],
          label: name,
          reason: `The INDI cross-reference ${this.displayPointer(sourceId)} is declared more than once.`
        });
        this.warn(
          context,
          `Duplicate INDI cross-reference ${this.displayPointer(sourceId)}; family references resolve to its first declaration.`
        );
      } else {
        firstBySourceId.set(sourceId, individual);
      }

      individuals.push(individual);
    }

    return individuals;
  }

  private parseFamilies(records: GedcomNode[], context: ParseContext): ParsedFamily[] {
    const families: ParsedFamily[] = [];
    const firstBySourceId = new Map<string, ParsedFamily>();
    const occurrenceCount = new Map<string, number>();

    for (const record of records.filter(item => item.tag === 'FAM')) {
      const fallbackId = `gedcom-family-${families.length + 1}`;
      const sourceId = this.pointerId(record.xref || '') || fallbackId;
      const occurrence = (occurrenceCount.get(sourceId) || 0) + 1;
      occurrenceCount.set(sourceId, occurrence);
      const id = occurrence === 1 ? sourceId : `${sourceId}__duplicate_${occurrence}`;

      if (!record.xref) {
        this.warn(
          context,
          `FAM record on line ${record.lineNumber} has no cross-reference ID; generated ${fallbackId}.`
        );
      }

      const husbands = record.children
        .filter(child => child.tag === 'HUSB')
        .map(child => this.pointerId(child.value))
        .filter(Boolean);
      const wives = record.children
        .filter(child => child.tag === 'WIFE')
        .map(child => this.pointerId(child.value))
        .filter(Boolean);
      const children = record.children
        .filter(child => child.tag === 'CHIL')
        .map(child => this.pointerId(child.value))
        .filter(Boolean);

      this.recordRepeatedFamilyReferences(id, 'HUSB', husbands, context);
      this.recordRepeatedFamilyReferences(id, 'WIFE', wives, context);
      this.recordRepeatedFamilyReferences(id, 'CHIL', children, context);
      this.collectUnsupportedFamilyTags(record, context);

      const marriageNodes = record.children.filter(child => child.tag === 'MARR');
      if (marriageNodes.length > 1) {
        this.warn(context, `Family ${this.displayPointer(sourceId)} contains multiple MARR events; the first is used.`);
      }

      const family: ParsedFamily = {
        id,
        sourceId,
        husbands: this.uniqueStrings(husbands),
        wives: this.uniqueStrings(wives),
        children: this.uniqueStrings(children),
        marriage: this.parseEvent(marriageNodes[0], context),
        notes: this.joinNotes(record.children.filter(child => child.tag === 'NOTE')),
        order: families.length
      };

      const first = firstBySourceId.get(sourceId);
      if (first) {
        context.duplicates.push({
          kind: 'record_id',
          ids: [first.id, family.id],
          label: this.displayPointer(sourceId),
          reason: `The FAM cross-reference ${this.displayPointer(sourceId)} is declared more than once.`
        });
        this.warn(
          context,
          `Duplicate FAM cross-reference ${this.displayPointer(sourceId)}; individual family links resolve to its first declaration.`
        );
      } else {
        firstBySourceId.set(sourceId, family);
      }

      families.push(family);
    }

    return families;
  }

  private validateFamilyLinks(
    individuals: ParsedIndividual[],
    families: ParsedFamily[],
    context: ParseContext
  ): void {
    const personIds = new Set(individuals.map(person => person.sourceId));
    const familyIds = new Set(families.map(family => family.sourceId));

    for (const family of families) {
      for (const husbandId of family.husbands) {
        if (!personIds.has(husbandId)) {
          this.warn(
            context,
            `Family ${this.displayPointer(family.sourceId)} references missing husband ${this.displayPointer(husbandId)}.`
          );
        }
      }
      for (const wifeId of family.wives) {
        if (!personIds.has(wifeId)) {
          this.warn(
            context,
            `Family ${this.displayPointer(family.sourceId)} references missing wife ${this.displayPointer(wifeId)}.`
          );
        }
      }
      for (const childId of family.children) {
        if (!personIds.has(childId)) {
          this.warn(
            context,
            `Family ${this.displayPointer(family.sourceId)} references missing child ${this.displayPointer(childId)}.`
          );
        }
      }
    }

    for (const person of individuals) {
      for (const link of person.familyAsChild) {
        if (!familyIds.has(link.familyId)) {
          this.warn(
            context,
            `Person ${person.name} references missing parent family ${this.displayPointer(link.familyId)}.`
          );
        }
      }
      for (const familyId of person.familyAsSpouse) {
        if (!familyIds.has(familyId)) {
          this.warn(
            context,
            `Person ${person.name} references missing spouse family ${this.displayPointer(familyId)}.`
          );
        }
      }
    }
  }

  private findPossibleDuplicatePeople(individuals: ParsedIndividual[], context: ParseContext): void {
    const groups = new Map<string, ParsedIndividual[]>();

    for (const person of individuals) {
      const normalizedName = this.normalizeForComparison(person.name);
      const birthDate = person.birth.date || '';
      const birthPlace = this.normalizeForComparison(person.birth.place || '');

      if (!normalizedName || (!birthDate && !birthPlace)) continue;

      const key = `${normalizedName}|${birthDate}|${birthPlace}`;
      const group = groups.get(key) || [];
      group.push(person);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue;

      const ids = group.map(person => person.id);
      context.duplicates.push({
        kind: 'possible_person',
        ids,
        label: group[0].name,
        reason: 'These people share the same normalized name and birth detail.'
      });
      this.warn(
        context,
        `Possible duplicate people: ${group.map(person => `${person.name} (${this.displayPointer(person.id)})`).join(', ')}.`
      );
    }
  }

  private buildGraph(
    individuals: ParsedIndividual[],
    families: ParsedFamily[],
    context: ParseContext
  ): PreviewGraph {
    const canonicalPeople = new Map<string, ParsedIndividual>();
    for (const person of individuals) {
      if (!canonicalPeople.has(person.sourceId)) canonicalPeople.set(person.sourceId, person);
    }

    const relationships: RelationshipRecord[] = [];
    const relationshipsByPerson = new Map<string, RelationshipRecord[]>();
    const eventsByPerson = new Map<string, LifeEvent[]>();
    const partnersByPerson = new Map<string, string[]>();
    const childrenByParent = new Map<string, string[]>();
    const undirected = new Map<string, Set<string>>();
    const incomingParentCount = new Map<string, number>();
    const pedigreeByPersonAndFamily = new Map<string, ParentRelationshipType>();

    for (const person of canonicalPeople.values()) {
      undirected.set(person.id, new Set<string>());
      incomingParentCount.set(person.id, 0);
      eventsByPerson.set(person.id, this.createIndividualEvents(person));

      for (const link of person.familyAsChild) {
        pedigreeByPersonAndFamily.set(
          `${person.sourceId}|${link.familyId}`,
          this.parsePedigree(link.pedigree)
        );
      }
    }

    const appendRelationship = (relationship: RelationshipRecord): void => {
      relationships.push(relationship);
      const fromRelationships = relationshipsByPerson.get(relationship.fromPersonId) || [];
      fromRelationships.push(relationship);
      relationshipsByPerson.set(relationship.fromPersonId, fromRelationships);
      const toRelationships = relationshipsByPerson.get(relationship.toPersonId) || [];
      toRelationships.push(relationship);
      relationshipsByPerson.set(relationship.toPersonId, toRelationships);
    };

    for (const family of families.sort((a, b) => a.order - b.order)) {
      const husbandIds = family.husbands
        .map(id => canonicalPeople.get(id)?.id)
        .filter((id): id is string => Boolean(id));
      const wifeIds = family.wives
        .map(id => canonicalPeople.get(id)?.id)
        .filter((id): id is string => Boolean(id));
      const partnerIds = this.uniqueStrings([...husbandIds, ...wifeIds]);
      const childIds = family.children
        .map(id => canonicalPeople.get(id)?.id)
        .filter((id): id is string => Boolean(id));

      const partnerPairs: Array<[string, string]> = [];
      if (husbandIds.length > 0 && wifeIds.length > 0) {
        for (const husbandId of husbandIds) {
          for (const wifeId of wifeIds) partnerPairs.push([husbandId, wifeId]);
        }
      } else {
        for (let left = 0; left < partnerIds.length; left += 1) {
          for (let right = left + 1; right < partnerIds.length; right += 1) {
            partnerPairs.push([partnerIds[left], partnerIds[right]]);
          }
        }
      }

      partnerPairs.forEach(([fromPersonId, toPersonId], pairIndex) => {
        const relationship: RelationshipRecord = {
          id: `gedcom-rel-${family.id}-partner-${pairIndex + 1}`,
          fromPersonId,
          toPersonId,
          type: 'spouse',
          ...(family.marriage.date ? { startDate: family.marriage.date } : {}),
          ...((family.marriage.notes || family.notes)
            ? { notes: this.joinDefined([family.marriage.notes, family.notes]) }
            : {})
        };
        appendRelationship(relationship);
        this.connect(undirected, fromPersonId, toPersonId);
        this.appendUnique(partnersByPerson, fromPersonId, toPersonId);
        this.appendUnique(partnersByPerson, toPersonId, fromPersonId);
      });

      if (family.marriage.present) {
        for (const partnerId of partnerIds) {
          const events = eventsByPerson.get(partnerId) || [];
          events.push({
            id: `gedcom-event-${family.id}-marriage`,
            type: 'marriage',
            title: 'Marriage',
            date: family.marriage.date || '',
            ...(family.marriage.place ? { place: family.marriage.place } : {}),
            ...((family.marriage.notes || family.notes)
              ? { description: this.joinDefined([family.marriage.notes, family.notes]) }
              : {})
          });
          eventsByPerson.set(partnerId, events);
        }
      }

      childIds.forEach((childId, childIndex) => {
        for (const parentId of partnerIds) {
          const sourceChildId = canonicalPeople.get(childId)?.sourceId || childId;
          const relationshipType = pedigreeByPersonAndFamily.get(`${sourceChildId}|${family.sourceId}`)
            || 'biological_parent';
          appendRelationship({
            id: `gedcom-rel-${family.id}-parent-${childIndex + 1}-${parentId}`,
            fromPersonId: parentId,
            toPersonId: childId,
            type: relationshipType
          });
          this.connect(undirected, parentId, childId);
          this.appendUnique(childrenByParent, parentId, childId);
          incomingParentCount.set(childId, (incomingParentCount.get(childId) || 0) + 1);
        }
      });
    }

    for (const [personId, partners] of partnersByPerson.entries()) {
      if (partners.length > 1) {
        const person = individuals.find(candidate => candidate.id === personId);
        this.warn(
          context,
          `${person?.name || this.displayPointer(personId)} has ${partners.length} spouses or partners; all relationships are preserved, but the nested preview can display only one spouse card.`
        );
      }
    }

    return {
      relationships,
      relationshipsByPerson,
      eventsByPerson,
      partnersByPerson,
      childrenByParent,
      undirected,
      incomingParentCount
    };
  }

  private buildTreePreview(
    individuals: ParsedIndividual[],
    graph: PreviewGraph,
    context: ParseContext
  ): TreeNode {
    const canonicalPeople = individuals.filter(person => person.id === person.sourceId);
    const peopleById = new Map(canonicalPeople.map(person => [person.id, person]));
    const components = this.connectedComponents(canonicalPeople.map(person => person.id), graph.undirected)
      .sort((left, right) => right.length - left.length);
    const primaryComponent = new Set(components[0] || [canonicalPeople[0].id]);

    if (components.length > 1) {
      this.warn(
        context,
        `GEDCOM contains ${components.length} disconnected family groups. The nested preview shows the largest group (${primaryComponent.size} of ${canonicalPeople.length} people).`
      );
    }

    const rootCandidates = canonicalPeople
      .filter(person => primaryComponent.has(person.id))
      .filter(person => (graph.incomingParentCount.get(person.id) || 0) === 0);

    if (rootCandidates.length === 0) {
      this.warn(context, 'No parentless root was found; the GEDCOM may contain a relationship cycle.');
    }

    const rootGroups = this.countRootPartnerGroups(rootCandidates, graph.partnersByPerson);
    if (rootGroups > 1) {
      this.warn(
        context,
        `The primary family group has ${rootGroups} ancestral root branches. The nested preview anchors on one branch while typed relationships preserve the others.`
      );
    }

    const candidates = rootCandidates.length > 0
      ? rootCandidates
      : canonicalPeople.filter(person => primaryComponent.has(person.id));
    const root = candidates
      .slice()
      .sort((left, right) => {
        const descendantDifference = this.descendantCount(right.id, graph.childrenByParent)
          - this.descendantCount(left.id, graph.childrenByParent);
        return descendantDifference || left.order - right.order;
      })[0];

    const visited = new Set<string>();
    const repeatedReferences = new Set<string>();

    const buildNode = (
      personId: string,
      asSpouse = false,
      parentRelationshipType?: ParentRelationshipType,
      partnerRelationship?: RelationshipRecord
    ): TreeNode => {
      const person = peopleById.get(personId);
      if (!person) {
        throw new Error(`Unable to build GEDCOM preview for missing person ${personId}.`);
      }

      visited.add(personId);
      const node = this.createTreeNode(
        person,
        asSpouse,
        graph.relationshipsByPerson.get(personId) || [],
        graph.eventsByPerson.get(personId) || [],
        parentRelationshipType,
        partnerRelationship
      );

      if (asSpouse) return node;

      const spouseId = (graph.partnersByPerson.get(personId) || [])
        .find(candidateId => primaryComponent.has(candidateId) && !visited.has(candidateId));
      if (spouseId) {
        const relationship = graph.relationships.find(item =>
          item.type === 'spouse'
          && ((item.fromPersonId === personId && item.toPersonId === spouseId)
            || (item.fromPersonId === spouseId && item.toPersonId === personId))
        );
        node.spouse = buildNode(spouseId, true, undefined, relationship);
      }

      for (const childId of graph.childrenByParent.get(personId) || []) {
        if (!primaryComponent.has(childId)) continue;
        if (visited.has(childId)) {
          repeatedReferences.add(childId);
          continue;
        }

        const parentRelationship = graph.relationships.find(item =>
          item.fromPersonId === personId
          && item.toPersonId === childId
          && this.isParentRelationship(item.type)
        );
        node.children.push(
          buildNode(
            childId,
            false,
            parentRelationship?.type as ParentRelationshipType | undefined
          )
        );
      }

      return node;
    };

    const tree = buildNode(root.id);

    if (repeatedReferences.size > 0) {
      this.warn(
        context,
        `${repeatedReferences.size} repeated or cyclical person reference(s) were shown once in the nested preview; typed relationships remain attached to the people records.`
      );
    }

    const omittedFromPrimary = Array.from(primaryComponent).filter(personId => !visited.has(personId));
    if (omittedFromPrimary.length > 0) {
      this.warn(
        context,
        `${omittedFromPrimary.length} person(s) in the primary group cannot be represented from the selected root by the legacy nested tree shape.`
      );
    }

    return tree;
  }

  private createTreeNode(
    person: ParsedIndividual,
    asSpouse: boolean,
    relationships: RelationshipRecord[],
    events: LifeEvent[],
    parentRelationshipType?: ParentRelationshipType,
    partnerRelationship?: RelationshipRecord
  ): TreeNode {
    const birthYear = this.extractYear(person.birth.date);
    const deathYear = this.extractYear(person.death.date);
    const endYear = deathYear || new Date().getFullYear();
    const age = birthYear ? Math.max(0, endYear - birthYear) : 0;
    const hasDeath = person.death.present;
    const partnerType = partnerRelationship?.type as PartnerRelationshipType | undefined;

    return {
      id: person.id,
      name: person.name,
      gender: person.gender,
      age,
      location: person.birth.place || person.death.place || '',
      isAlive: !hasDeath,
      type: asSpouse ? 'spouse' : 'blood',
      spouse: null,
      children: [],
      ...(person.alternateNames.length > 0 ? { alternateNames: [...person.alternateNames] } : {}),
      ...(person.birth.date ? { birthDate: person.birth.date } : {}),
      ...(person.death.date ? { deathDate: person.death.date } : {}),
      ...(person.birth.place ? { birthPlace: person.birth.place } : {}),
      ...(person.notes ? { notes: person.notes } : {}),
      ...(events.length > 0 ? { events: events.map(event => ({ ...event })) } : {}),
      ...(parentRelationshipType ? { parentRelationshipType } : {}),
      ...(partnerType ? { partnerRelationshipType: partnerType } : {}),
      ...(partnerRelationship?.startDate
        ? { relationshipStartDate: partnerRelationship.startDate }
        : {}),
      ...(partnerRelationship?.endDate
        ? { relationshipEndDate: partnerRelationship.endDate }
        : {}),
      ...(relationships.length > 0
        ? { relationshipRecords: relationships.map(relationship => ({ ...relationship })) }
        : {})
    };
  }

  private createIndividualEvents(person: ParsedIndividual): LifeEvent[] {
    const events: LifeEvent[] = [];
    if (person.birth.present) {
      events.push({
        id: `gedcom-event-${person.id}-birth`,
        type: 'birth',
        title: 'Birth',
        date: person.birth.date || '',
        ...(person.birth.place ? { place: person.birth.place } : {}),
        ...(person.birth.notes ? { description: person.birth.notes } : {})
      });
    }
    if (person.death.present) {
      events.push({
        id: `gedcom-event-${person.id}-death`,
        type: 'death',
        title: 'Death',
        date: person.death.date || '',
        ...(person.death.place ? { place: person.death.place } : {}),
        ...(person.death.notes ? { description: person.death.notes } : {})
      });
    }
    return events;
  }

  private parseEvent(node: GedcomNode | undefined, context: ParseContext): ParsedEvent {
    if (!node) return { present: false };

    const dateNodes = node.children.filter(child => child.tag === 'DATE');
    const placeNodes = node.children.filter(child => child.tag === 'PLAC');
    if (dateNodes.length > 1) {
      this.warn(context, `Event on line ${node.lineNumber} has multiple DATE values; the first is used.`);
    }
    if (placeNodes.length > 1) {
      this.warn(context, `Event on line ${node.lineNumber} has multiple PLAC values; the first is used.`);
    }

    return {
      present: node.value.toUpperCase() !== 'N',
      ...(dateNodes[0]?.value ? { date: this.normalizeDate(dateNodes[0].value) } : {}),
      ...(placeNodes[0]?.value ? { place: placeNodes[0].value.trim() } : {}),
      ...(this.joinNotes(node.children.filter(child => child.tag === 'NOTE'))
        ? { notes: this.joinNotes(node.children.filter(child => child.tag === 'NOTE')) }
        : {})
    };
  }

  private parseName(node: GedcomNode): string {
    const inlineName = node.value.replace(/\//g, ' ').replace(/\s+/g, ' ').trim();
    if (inlineName) return inlineName;

    const given = node.children.find(child => child.tag === 'GIVN')?.value || '';
    const surname = node.children.find(child => child.tag === 'SURN')?.value || '';
    return `${given} ${surname}`.replace(/\s+/g, ' ').trim();
  }

  private parseGender(value: string | undefined): Gender {
    switch ((value || '').trim().toUpperCase()) {
      case 'M':
        return Gender.MALE;
      case 'F':
        return Gender.FEMALE;
      default:
        return Gender.OTHER;
    }
  }

  private parsePedigree(value: string | undefined): ParentRelationshipType {
    const normalized = (value || '').trim().toLowerCase();
    if (normalized.includes('adopt')) return 'adoptive_parent';
    if (normalized.includes('step')) return 'step_parent';
    if (normalized.includes('foster') || normalized.includes('guardian')) return 'guardian';
    if (normalized.includes('unknown')) return 'unknown_parent';
    return 'biological_parent';
  }

  private collectUnsupportedIndividualTags(record: GedcomNode, context: ParseContext): void {
    const directTags = new Set(['NAME', 'SEX', 'BIRT', 'DEAT', 'NOTE', 'FAMC', 'FAMS']);
    const nameTags = new Set(['GIVN', 'SURN', 'NPFX', 'NSFX', 'NICK', 'SPFX', 'CONT', 'CONC']);
    const eventTags = new Set(['DATE', 'PLAC', 'NOTE']);
    const noteTags = new Set(['CONT', 'CONC']);
    const familyLinkTags = new Set(['PEDI']);

    for (const child of record.children) {
      if (!directTags.has(child.tag)) {
        context.unsupportedTags.add(child.tag);
        continue;
      }

      const supportedChildren = child.tag === 'NAME'
        ? nameTags
        : child.tag === 'BIRT' || child.tag === 'DEAT'
          ? eventTags
          : child.tag === 'NOTE'
            ? noteTags
            : child.tag === 'FAMC'
              ? familyLinkTags
              : new Set<string>();

      for (const grandchild of child.children) {
        if (!supportedChildren.has(grandchild.tag)) context.unsupportedTags.add(grandchild.tag);
      }
    }
  }

  private collectUnsupportedFamilyTags(record: GedcomNode, context: ParseContext): void {
    const directTags = new Set(['HUSB', 'WIFE', 'CHIL', 'MARR', 'NOTE']);
    const eventTags = new Set(['DATE', 'PLAC', 'NOTE']);
    const noteTags = new Set(['CONT', 'CONC']);

    for (const child of record.children) {
      if (!directTags.has(child.tag)) {
        context.unsupportedTags.add(child.tag);
        continue;
      }

      const supportedChildren = child.tag === 'MARR'
        ? eventTags
        : child.tag === 'NOTE'
          ? noteTags
          : new Set<string>();
      for (const grandchild of child.children) {
        if (!supportedChildren.has(grandchild.tag)) context.unsupportedTags.add(grandchild.tag);
      }
    }
  }

  private joinNotes(nodes: GedcomNode[]): string | undefined {
    const notes = nodes
      .map(node => this.noteText(node))
      .map(note => note.trim())
      .filter(Boolean);
    return notes.length > 0 ? notes.join('\n\n') : undefined;
  }

  private noteText(node: GedcomNode): string {
    let text = node.value;
    for (const child of node.children) {
      if (child.tag === 'CONT') text += `\n${child.value}`;
      if (child.tag === 'CONC') text += child.value;
    }
    return text;
  }

  private normalizeDate(value: string): string {
    const trimmed = value.trim();
    const withoutCalendar = trimmed.replace(/^@#D[^@]+@\s*/i, '');
    const upper = withoutCalendar.toUpperCase();

    const fullDate = upper.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/);
    if (fullDate && MONTH_NUMBERS[fullDate[2]]) {
      return `${fullDate[3]}-${MONTH_NUMBERS[fullDate[2]]}-${fullDate[1].padStart(2, '0')}`;
    }

    const monthDate = upper.match(/^([A-Z]{3})\s+(\d{4})$/);
    if (monthDate && MONTH_NUMBERS[monthDate[1]]) {
      return `${monthDate[2]}-${MONTH_NUMBERS[monthDate[1]]}`;
    }

    if (/^\d{4}$/.test(upper)) return upper;
    return withoutCalendar;
  }

  private recordRepeatedFamilyReferences(
    familyId: string,
    role: 'HUSB' | 'WIFE' | 'CHIL',
    ids: string[],
    context: ParseContext
  ): void {
    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);

    for (const [id, count] of counts.entries()) {
      if (count < 2) continue;
      context.duplicates.push({
        kind: 'family_reference',
        ids: [familyId, id],
        label: this.displayPointer(id),
        reason: `Family ${this.displayPointer(familyId)} repeats ${this.displayPointer(id)} as ${role}.`
      });
      this.warn(
        context,
        `Family ${this.displayPointer(familyId)} repeats ${this.displayPointer(id)} as ${role}; it is imported once.`
      );
    }
  }

  private connectedComponents(personIds: string[], adjacency: Map<string, Set<string>>): string[][] {
    const remaining = new Set(personIds);
    const components: string[][] = [];

    while (remaining.size > 0) {
      const first = remaining.values().next().value as string;
      const component: string[] = [];
      const queue = [first];
      remaining.delete(first);

      while (queue.length > 0) {
        const current = queue.shift() as string;
        component.push(current);
        for (const neighbor of adjacency.get(current) || []) {
          if (!remaining.has(neighbor)) continue;
          remaining.delete(neighbor);
          queue.push(neighbor);
        }
      }

      components.push(component);
    }

    return components;
  }

  private countRootPartnerGroups(
    roots: ParsedIndividual[],
    partnersByPerson: Map<string, string[]>
  ): number {
    const rootIds = new Set(roots.map(root => root.id));
    const visited = new Set<string>();
    let groups = 0;

    for (const root of roots) {
      if (visited.has(root.id)) continue;
      groups += 1;
      const queue = [root.id];
      visited.add(root.id);
      while (queue.length > 0) {
        const current = queue.shift() as string;
        for (const partner of partnersByPerson.get(current) || []) {
          if (!rootIds.has(partner) || visited.has(partner)) continue;
          visited.add(partner);
          queue.push(partner);
        }
      }
    }

    return groups;
  }

  private descendantCount(personId: string, childrenByParent: Map<string, string[]>): number {
    const visited = new Set<string>();
    const queue = [...(childrenByParent.get(personId) || [])];
    while (queue.length > 0) {
      const childId = queue.shift() as string;
      if (visited.has(childId)) continue;
      visited.add(childId);
      queue.push(...(childrenByParent.get(childId) || []));
    }
    return visited.size;
  }

  private connect(adjacency: Map<string, Set<string>>, left: string, right: string): void {
    if (!adjacency.has(left)) adjacency.set(left, new Set<string>());
    if (!adjacency.has(right)) adjacency.set(right, new Set<string>());
    adjacency.get(left)?.add(right);
    adjacency.get(right)?.add(left);
  }

  private appendUnique(map: Map<string, string[]>, key: string, value: string): void {
    const values = map.get(key) || [];
    if (!values.includes(value)) values.push(value);
    map.set(key, values);
  }

  private isParentRelationship(type: RelationshipRecord['type']): boolean {
    return type === 'biological_parent'
      || type === 'adoptive_parent'
      || type === 'step_parent'
      || type === 'guardian'
      || type === 'unknown_parent';
  }

  private extractYear(value: string | undefined): number | undefined {
    const match = value?.match(/(?:^|\D)(\d{4})(?:\D|$)/);
    return match ? Number(match[1]) : undefined;
  }

  private pointerId(value: string): string {
    const trimmed = value.trim();
    const pointerMatch = trimmed.match(/^@(.+)@$/);
    return (pointerMatch ? pointerMatch[1] : trimmed).trim();
  }

  private displayPointer(id: string): string {
    return id.startsWith('@') && id.endsWith('@') ? id : `@${id}@`;
  }

  private uniqueStrings(values: string[]): string[] {
    const seen = new Set<string>();
    return values.filter(value => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  private joinDefined(values: Array<string | undefined>): string {
    return values.filter((value): value is string => Boolean(value)).join('\n\n');
  }

  private normalizeForComparison(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private warn(context: ParseContext, warning: string): void {
    if (context.warningSet.has(warning)) return;
    context.warningSet.add(warning);
    context.warnings.push(warning);
  }
}
