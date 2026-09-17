// modules/ai/tools.ts
// Tool calling schema for the LLM — maps to UMLCommand types (§7.3, §7.4)

import type { LLMToolDefinition } from './llm.provider';

export const UML_TOOLS: LLMToolDefinition[] = [
  {
    name: 'add_class',
    description: 'Add a new UML class to the diagram',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Class name (PascalCase, valid Java identifier)' },
        kind: {
          type: 'string',
          enum: ['class', 'abstract', 'interface', 'enumeration'],
          description: 'Kind of class',
        },
        attributes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              visibility: {
                type: 'string',
                enum: ['public', 'private', 'protected', 'package'],
              },
              isPrimaryKey: { type: 'boolean' },
              isRequired: { type: 'boolean' },
              isUnique: { type: 'boolean' },
              defaultValue: { type: 'string' },
            },
            required: ['name', 'type', 'visibility', 'isPrimaryKey', 'isRequired', 'isUnique'],
          },
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'rename_class',
    description: 'Rename an existing class',
    parameters: {
      type: 'object',
      properties: {
        classId: { type: 'string', description: 'ID of the class to rename' },
        newName: { type: 'string', description: 'New name for the class' },
      },
      required: ['classId', 'newName'],
    },
  },
  {
    name: 'delete_class',
    description: 'Delete a class from the diagram (DESTRUCTIVE — requires confirmation)',
    parameters: {
      type: 'object',
      properties: {
        classId: { type: 'string', description: 'ID of the class to delete' },
      },
      required: ['classId'],
    },
  },
  {
    name: 'add_attribute',
    description: 'Add an attribute to a class',
    parameters: {
      type: 'object',
      properties: {
        classId: { type: 'string', description: 'ID of the target class' },
        name: { type: 'string', description: 'Attribute name' },
        dataType: { type: 'string', description: 'Data type (String, Integer, Long, etc.)' },
        isPrimaryKey: { type: 'boolean' },
        isRequired: { type: 'boolean' },
      },
      required: ['classId', 'name', 'dataType'],
    },
  },
  {
    name: 'remove_attribute',
    description: 'Remove an attribute from a class',
    parameters: {
      type: 'object',
      properties: {
        classId: { type: 'string', description: 'ID of the class' },
        attributeId: { type: 'string', description: 'ID of the attribute to remove' },
      },
      required: ['classId', 'attributeId'],
    },
  },
  {
    name: 'add_relation',
    description: 'Add a relation between two classes',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['association', 'aggregation', 'composition', 'inheritance', 'realization', 'dependency'],
        },
        sourceClass: { type: 'string', description: 'Source class ID or name' },
        targetClass: { type: 'string', description: 'Target class ID or name' },
        sourceCardinality: {
          type: 'string',
          enum: ['1', '0..1', '1..*', '0..*', '*'],
        },
        targetCardinality: {
          type: 'string',
          enum: ['1', '0..1', '1..*', '0..*', '*'],
        },
      },
      required: ['kind', 'sourceClass', 'targetClass', 'sourceCardinality', 'targetCardinality'],
    },
  },
  {
    name: 'remove_relation',
    description: 'Remove a relation (DESTRUCTIVE — requires confirmation)',
    parameters: {
      type: 'object',
      properties: {
        relationId: { type: 'string', description: 'ID of the relation to remove' },
      },
      required: ['relationId'],
    },
  },
  {
    name: 'move_class',
    description: 'Move a class to a new position on the canvas',
    parameters: {
      type: 'object',
      properties: {
        classId: { type: 'string', description: 'ID of the class to move' },
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['classId', 'x', 'y'],
    },
  },
];

/** Destructive operations that require confirmation (§7.4) */
export const DESTRUCTIVE_OPERATIONS = new Set([
  'delete_class',
  'remove_relation',
]);
