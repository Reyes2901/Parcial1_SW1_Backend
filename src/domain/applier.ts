// domain/applier.ts
// Pure function: applies UMLCommand[] on a UMLModel, returns new model.
// NO side effects, NO external dependencies (§4 rule #1, #2)

import type { UMLModel, UMLAttribute, UMLClass, UMLRelation } from './uml-model';
import type { UMLCommand } from './uml-command';

let idCounter = 0;

/** Generate a simple unique ID (pure enough for domain use) */
function generateId(): string {
  idCounter++;
  return `${Date.now()}-${idCounter}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Applies a single UMLCommand to a UMLModel (pure, no side effects).
 * Returns a new UMLModel with the command applied.
 */
export function applyCommand(model: UMLModel, command: UMLCommand): UMLModel {
  switch (command.type) {
    case 'add_class': {
      const newClass: UMLClass = {
        id: generateId(),
        name: command.name,
        kind: command.kind ?? 'class',
        attributes: (command.attributes ?? []).map((a) => ({
          ...a,
          id: generateId(),
          visibility: a.visibility ?? 'private',
          isPrimaryKey: a.isPrimaryKey ?? false,
          isRequired: a.isRequired ?? false,
          isUnique: a.isUnique ?? false,
        })),
        methods: [],
        position: { x: 100, y: 100 },
      };
      return {
        ...model,
        version: model.version + 1,
        classes: [...model.classes, newClass],
      };
    }

    case 'rename_class': {
      return {
        ...model,
        version: model.version + 1,
        classes: model.classes.map((c) =>
          c.id === command.classId || c.name === command.classId
            ? { ...c, name: command.newName }
            : c
        ),
      };
    }

    case 'delete_class': {
      const targetClass = model.classes.find(
        (c) => c.id === command.classId || c.name === command.classId
      );
      if (!targetClass) return model;

      return {
        ...model,
        version: model.version + 1,
        classes: model.classes.filter((c) => c.id !== targetClass.id),
        relations: model.relations.filter(
          (r) =>
            r.sourceClassId !== targetClass.id &&
            r.targetClassId !== targetClass.id
        ),
      };
    }

    case 'add_attribute': {
      const newAttr: UMLAttribute = {
        id: generateId(),
        name: command.name,
        type: command.dataType,
        visibility: 'private',
        isPrimaryKey: command.isPrimaryKey ?? false,
        isRequired: command.isRequired ?? false,
        isUnique: false,
      };
      return {
        ...model,
        version: model.version + 1,
        classes: model.classes.map((c) =>
          c.id === command.classId || c.name === command.classId
            ? { ...c, attributes: [...c.attributes, newAttr] }
            : c
        ),
      };
    }

    case 'remove_attribute': {
      return {
        ...model,
        version: model.version + 1,
        classes: model.classes.map((c) =>
          c.id === command.classId || c.name === command.classId
            ? {
                ...c,
                attributes: c.attributes.filter(
                  (a) => a.id !== command.attributeId && a.name !== command.attributeId
                ),
              }
            : c
        ),
      };
    }

    case 'add_relation': {
      const sourceClass = model.classes.find(
        (c) => c.id === command.sourceClass || c.name === command.sourceClass
      );
      const targetClass = model.classes.find(
        (c) => c.id === command.targetClass || c.name === command.targetClass
      );

      const newRelation: UMLRelation = {
        id: generateId(),
        kind: command.kind,
        sourceClassId: sourceClass?.id ?? command.sourceClass,
        targetClassId: targetClass?.id ?? command.targetClass,
        sourceCardinality: command.sourceCardinality,
        targetCardinality: command.targetCardinality,
        name: command.name,
        attributes: command.attributes?.map((attr) => ({
          ...attr,
          id: generateId(),
        })),
      };
      return {
        ...model,
        version: model.version + 1,
        relations: [...model.relations, newRelation],
      };
    }

    case 'remove_relation': {
      return {
        ...model,
        version: model.version + 1,
        relations: model.relations.filter(
          (r) => r.id !== command.relationId
        ),
      };
    }

    case 'move_class': {
      return {
        ...model,
        version: model.version + 1,
        classes: model.classes.map((c) =>
          c.id === command.classId || c.name === command.classId
            ? { ...c, position: { x: command.x, y: command.y } }
            : c
        ),
      };
    }

    default:
      return model;
  }
}

/**
 * Applies a sequence of commands to a model.
 * Pure function — returns a new model (enables undo).
 */
export function applyCommands(
  model: UMLModel,
  commands: UMLCommand[]
): UMLModel {
  return commands.reduce(
    (currentModel, cmd) => applyCommand(currentModel, cmd),
    model
  );
}
