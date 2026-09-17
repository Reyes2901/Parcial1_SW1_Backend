// modules/import/xmi-parser.ts
// Parse XMI/XML files into UMLCommand[] (§7.5)
// Subset of XMI covering classes, typed attributes, associations, and inheritance
/* eslint-disable @typescript-eslint/no-explicit-any */
// Note: 'any' is justified here due to dynamic XML structure parsed by fast-xml-parser

import { XMLParser } from 'fast-xml-parser';
import type { UMLCommand } from '../../domain/uml-command';
import type { Visibility, ClassKind, RelationKind, Cardinality } from '../../domain/uml-model';

export interface XMIParseResult {
  commands: UMLCommand[];
  warnings: string[];
}

export interface XMINode {
  [key: string]: any;
}

export function parseXMI(xmlContent: string): XMIParseResult {
  const warnings: string[] = [];
  const commands: UMLCommand[] = [];

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) =>
      ['packagedElement', 'ownedAttribute', 'ownedOperation', 'ownedParameter', 'generalization'].includes(name),
  });

  let parsed: any;
  try {
    parsed = parser.parse(xmlContent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse XML: ${msg}`);
  }

  // Handle UML / XMI root
  const root =
    parsed['xmi:XMI'] ||
    parsed['uml:Model'] ||
    parsed['Model'] ||
    parsed;

  const modelNode = root['uml:Model'] || root['Model'] || root;
  const elements = modelNode.packagedElement || root.packagedElement || [];

  const elementsArray: XMINode[] = Array.isArray(elements) ? elements : [elements];

  const classIdToNameMap = new Map<string, string>();
  const datatypeMap = new Map<string, string>();

  // First pass: collect classes and datatypes
  for (const elem of elementsArray) {
    if (!elem) continue;
    const type = elem['@_xmi:type'] || elem['@_type'] || '';
    const id = elem['@_xmi:id'] || elem['@_id'];
    const name = elem['@_name'];

    if (type.includes('Class') || type === 'uml:Class' || (!type && name)) {
      if (name) {
        if (id) classIdToNameMap.set(id, name);
        classIdToNameMap.set(name, name);
      }
    } else if (type.includes('DataType') || type.includes('PrimitiveType')) {
      if (id && name) datatypeMap.set(id, name);
    }
  }

  // Second pass: process classes and attributes
  for (const elem of elementsArray) {
    if (!elem) continue;
    const type = elem['@_xmi:type'] || elem['@_type'] || '';
    const name = elem['@_name'];

    if (type.includes('Class') || type === 'uml:Class' || (!type && name)) {
      if (!name) continue;

      let kind: ClassKind = 'class';
      if (elem['@_isAbstract'] === 'true') {
        kind = 'abstract';
      }

      const attributes: {
        name: string;
        type: string;
        visibility: Visibility;
        isPrimaryKey: boolean;
        isRequired: boolean;
        isUnique: boolean;
      }[] = [];

      const ownedAttributes = elem.ownedAttribute || [];
      const ownedAttributesArray: XMINode[] = Array.isArray(ownedAttributes) ? ownedAttributes : [ownedAttributes];

      for (const attr of ownedAttributesArray) {
        if (!attr || attr['@_association']) continue;

        const attrName = attr['@_name'];
        if (!attrName) continue;

        let attrType = 'String';
        if (attr['@_type']) {
          const typeRef = attr['@_type'];
          attrType = datatypeMap.get(typeRef) || classIdToNameMap.get(typeRef) || typeRef;
          if (attrType.toLowerCase().includes('int')) attrType = 'Integer';
          else if (attrType.toLowerCase().includes('string')) attrType = 'String';
          else if (attrType.toLowerCase().includes('bool')) attrType = 'Boolean';
          else if (attrType.toLowerCase().includes('double') || attrType.toLowerCase().includes('float')) attrType = 'Double';
          else if (attrType.toLowerCase().includes('date')) attrType = 'LocalDate';
        } else if (attr.type && attr.type['@_href']) {
          const href = attr.type['@_href'];
          if (href.includes('Integer')) attrType = 'Integer';
          else if (href.includes('Boolean')) attrType = 'Boolean';
          else if (href.includes('String')) attrType = 'String';
          else if (href.includes('UnlimitedNatural')) attrType = 'Long';
        }

        const visibility: Visibility = (attr['@_visibility'] as Visibility) || 'private';
        const isPrimaryKey = attrName.toLowerCase() === 'id' || attrName.toLowerCase().endsWith('id');
        const isRequired = attr['@_lower'] ? attr['@_lower'] !== '0' : false;
        const isUnique = attr['@_isUnique'] === 'true';

        attributes.push({
          name: attrName,
          type: attrType,
          visibility,
          isPrimaryKey,
          isRequired,
          isUnique,
        });
      }

      commands.push({
        type: 'add_class',
        name,
        kind,
        attributes,
      });

      // Handle generalizations (inheritance)
      const generalizations = elem.generalization || [];
      const generalizationsArray: XMINode[] = Array.isArray(generalizations) ? generalizations : [generalizations];

      for (const gen of generalizationsArray) {
        if (!gen) continue;
        const generalId = gen['@_general'];
        const targetName = generalId ? classIdToNameMap.get(generalId) : undefined;

        if (targetName) {
          commands.push({
            type: 'add_relation',
            kind: 'inheritance',
            sourceClass: name,
            targetClass: targetName,
            sourceCardinality: '1',
            targetCardinality: '1',
          });
        } else if (generalId) {
          warnings.push(`Could not resolve general class ID "${generalId}" for inheritance of "${name}"`);
        }
      }
    } else if (type.includes('Association') || type === 'uml:Association') {
      const memberEnds = elem.ownedEnd || elem.memberEnd || [];
      const memberEndsArray: XMINode[] = Array.isArray(memberEnds) ? memberEnds : [memberEnds];

      if (memberEndsArray.length >= 2) {
        const end1 = memberEndsArray[0];
        const end2 = memberEndsArray[1];

        const srcTypeRef = end1['@_type'] || end1['@_typeId'];
        const tgtTypeRef = end2['@_type'] || end2['@_typeId'];

        const sourceClass = srcTypeRef ? (classIdToNameMap.get(srcTypeRef) || srcTypeRef) : undefined;
        const targetClass = tgtTypeRef ? (classIdToNameMap.get(tgtTypeRef) || tgtTypeRef) : undefined;

        if (sourceClass && targetClass) {
          let kind: RelationKind = 'association';
          if (end1['@_aggregation'] === 'composite' || end2['@_aggregation'] === 'composite') {
            kind = 'composition';
          } else if (end1['@_aggregation'] === 'shared' || end2['@_aggregation'] === 'shared') {
            kind = 'aggregation';
          }

          const parseCard = (end: XMINode): Cardinality => {
            const lower = end['@_lower'] ?? '1';
            const upper = end['@_upper'] ?? '1';
            if (upper === '*' || upper === '-1') {
              return lower === '0' ? '0..*' : '1..*';
            }
            if (lower === '0' && upper === '1') return '0..1';
            return '1';
          };

          commands.push({
            type: 'add_relation',
            kind,
            sourceClass,
            targetClass,
            sourceCardinality: parseCard(end1),
            targetCardinality: parseCard(end2),
          });
        }
      }
    }
  }

  return { commands, warnings };
}
