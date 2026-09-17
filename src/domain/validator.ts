// domain/validator.ts
// Pure validation — NO external dependencies (§4 rule #1)
// Rejects: nonexistent class refs, duplicate names, invalid Java identifiers,
// cyclic inheritance

import type { UMLModel } from './uml-model';
import type { UMLCommand } from './uml-command';
import { applyCommand } from './applier';

/** Reserved Java keywords that cannot be used as identifiers */
const JAVA_RESERVED = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while',
]);

export interface ValidationError {
  field: string;
  message: string;
}

export function isValidJavaIdentifier(name: string): boolean {
  if (!name || name.length === 0) return false;
  if (JAVA_RESERVED.has(name)) return false;
  // Java identifier: starts with letter/_ /$, rest alphanumeric/_ /$
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
}

export function isValidClassName(name: string): boolean {
  if (!isValidJavaIdentifier(name)) return false;
  // Convention: PascalCase, first char uppercase
  return /^[A-Z]/.test(name);
}

/**
 * Detects cyclic inheritance in UML model.
 * Returns array of class IDs involved in a cycle if found, empty otherwise.
 */
export function detectInheritanceCycles(model: UMLModel): string[][] {
  const inheritanceEdges = model.relations
    .filter((r) => r.kind === 'inheritance' || r.kind === 'realization')
    .map((r) => ({ child: r.sourceClassId, parent: r.targetClassId }));

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string, path: string[]): void {
    visited.add(nodeId);
    recStack.add(nodeId);

    for (const edge of inheritanceEdges) {
      if (edge.child !== nodeId) continue;
      const nextId = edge.parent;

      if (!visited.has(nextId)) {
        dfs(nextId, [...path, nextId]);
      } else if (recStack.has(nextId)) {
        const cycleStart = path.indexOf(nextId);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        } else {
          cycles.push([...path, nextId]);
        }
      }
    }

    recStack.delete(nodeId);
  }

  for (const cls of model.classes) {
    if (!visited.has(cls.id)) {
      dfs(cls.id, [cls.id]);
    }
  }

  return cycles;
}

/**
 * Validates a single UMLCommand against the current model.
 * Returns validation errors (empty array means valid).
 */
export function validateCommand(
  model: UMLModel,
  command: UMLCommand
): ValidationError[] {
  const errors: ValidationError[] = [];

  switch (command.type) {
    case 'add_class': {
      if (!isValidClassName(command.name)) {
        errors.push({
          field: 'name',
          message: `"${command.name}" is not a valid Java class name (must start with uppercase, no reserved words)`,
        });
      }
      const duplicate = model.classes.find(
        (c) => c.name.toLowerCase() === command.name.toLowerCase()
      );
      if (duplicate) {
        errors.push({
          field: 'name',
          message: `Class "${command.name}" already exists (duplicate name)`,
        });
      }
      if (command.attributes) {
        for (const attr of command.attributes) {
          if (!isValidJavaIdentifier(attr.name)) {
            errors.push({
              field: 'attributes',
              message: `Attribute "${attr.name}" is not a valid Java identifier`,
            });
          }
        }
      }
      break;
    }

    case 'rename_class': {
      const cls = model.classes.find((c) => c.id === command.classId);
      if (!cls) {
        errors.push({
          field: 'classId',
          message: `Class with id "${command.classId}" does not exist`,
        });
      }
      if (!isValidClassName(command.newName)) {
        errors.push({
          field: 'newName',
          message: `"${command.newName}" is not a valid Java class name`,
        });
      }
      const dup = model.classes.find(
        (c) =>
          c.id !== command.classId &&
          c.name.toLowerCase() === command.newName.toLowerCase()
      );
      if (dup) {
        errors.push({
          field: 'newName',
          message: `Class "${command.newName}" already exists`,
        });
      }
      break;
    }

    case 'delete_class': {
      const cls = model.classes.find((c) => c.id === command.classId);
      if (!cls) {
        errors.push({
          field: 'classId',
          message: `Class with id "${command.classId}" does not exist`,
        });
      }
      break;
    }

    case 'add_attribute': {
      const cls = model.classes.find((c) => c.id === command.classId || c.name === command.classId);
      if (!cls) {
        errors.push({
          field: 'classId',
          message: `Class "${command.classId}" does not exist`,
        });
      } else {
        const dupAttr = cls.attributes.find(
          (a) => a.name.toLowerCase() === command.name.toLowerCase()
        );
        if (dupAttr) {
          errors.push({
            field: 'name',
            message: `Attribute "${command.name}" already exists in class "${cls.name}"`,
          });
        }
      }
      if (!isValidJavaIdentifier(command.name)) {
        errors.push({
          field: 'name',
          message: `"${command.name}" is not a valid Java identifier`,
        });
      }
      break;
    }

    case 'remove_attribute': {
      const cls = model.classes.find((c) => c.id === command.classId || c.name === command.classId);
      if (!cls) {
        errors.push({
          field: 'classId',
          message: `Class "${command.classId}" does not exist`,
        });
      } else {
        const attr = cls.attributes.find(
          (a) => a.id === command.attributeId || a.name === command.attributeId
        );
        if (!attr) {
          errors.push({
            field: 'attributeId',
            message: `Attribute "${command.attributeId}" does not exist in class "${cls.name}"`,
          });
        }
      }
      break;
    }

    case 'add_relation': {
      const sourceClass = model.classes.find(
        (c) => c.id === command.sourceClass || c.name === command.sourceClass
      );
      const targetClass = model.classes.find(
        (c) => c.id === command.targetClass || c.name === command.targetClass
      );
      if (!sourceClass) {
        errors.push({
          field: 'sourceClass',
          message: `Source class "${command.sourceClass}" does not exist`,
        });
      }
      if (!targetClass) {
        errors.push({
          field: 'targetClass',
          message: `Target class "${command.targetClass}" does not exist`,
        });
      }
      // Check for cyclic inheritance if adding an inheritance relation
      if (
        sourceClass &&
        targetClass &&
        (command.kind === 'inheritance' || command.kind === 'realization')
      ) {
        const tempModel: UMLModel = {
          ...model,
          relations: [
            ...model.relations,
            {
              id: 'temp',
              kind: command.kind,
              sourceClassId: sourceClass.id,
              targetClassId: targetClass.id,
              sourceCardinality: command.sourceCardinality,
              targetCardinality: command.targetCardinality,
            },
          ],
        };
        const cycles = detectInheritanceCycles(tempModel);
        if (cycles.length > 0) {
          errors.push({
            field: 'kind',
            message: `Adding this ${command.kind} relation would create a cyclic inheritance`,
          });
        }
      }
      break;
    }

    case 'remove_relation': {
      const rel = model.relations.find(
        (r) => r.id === command.relationId
      );
      if (!rel) {
        errors.push({
          field: 'relationId',
          message: `Relation with id "${command.relationId}" does not exist`,
        });
      }
      break;
    }

    case 'move_class': {
      const cls = model.classes.find((c) => c.id === command.classId || c.name === command.classId);
      if (!cls) {
        errors.push({
          field: 'classId',
          message: `Class "${command.classId}" does not exist`,
        });
      }
      break;
    }

    default: {
      errors.push({
        field: 'type',
        message: `Unknown command type: ${(command as UMLCommand).type}`,
      });
    }
  }

  return errors;
}

/**
 * Validates a batch of commands sequentially, applying each valid command
 * before validating the next.
 */
export function validateCommands(
  model: UMLModel,
  commands: UMLCommand[]
): { valid: boolean; errors: { index: number; errors: ValidationError[] }[] } {
  const allErrors: { index: number; errors: ValidationError[] }[] = [];
  let currentModel = model;

  for (let i = 0; i < commands.length; i++) {
    const cmdErrors = validateCommand(currentModel, commands[i]);
    if (cmdErrors.length > 0) {
      allErrors.push({ index: i, errors: cmdErrors });
    } else {
      currentModel = applyCommand(currentModel, commands[i]);
    }
  }

  return { valid: allErrors.length === 0, errors: allErrors };
}
