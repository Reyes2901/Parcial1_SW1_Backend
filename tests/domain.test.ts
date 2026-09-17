import { describe, it, expect } from 'vitest';
import type { UMLModel } from '../src/domain/uml-model';
import {
  isValidJavaIdentifier,
  isValidClassName,
  detectInheritanceCycles,
  validateCommand,
  validateCommands,
} from '../src/domain/validator';
import { applyCommand, applyCommands } from '../src/domain/applier';

describe('Domain - UML Model, Validator & Applier', () => {
  const initialModel: UMLModel = {
    id: 'diagram-1',
    name: 'ECommerce',
    version: 1,
    classes: [
      {
        id: 'class-1',
        name: 'User',
        kind: 'class',
        attributes: [
          {
            id: 'attr-1',
            name: 'email',
            type: 'String',
            visibility: 'private',
            isPrimaryKey: false,
            isRequired: true,
            isUnique: true,
          },
        ],
        methods: [],
        position: { x: 0, y: 0 },
      },
    ],
    relations: [],
  };

  it('validates Java identifiers and class names correctly', () => {
    expect(isValidJavaIdentifier('validVar')).toBe(true);
    expect(isValidJavaIdentifier('123invalid')).toBe(false);
    expect(isValidJavaIdentifier('class')).toBe(false); // reserved word

    expect(isValidClassName('User')).toBe(true);
    expect(isValidClassName('user')).toBe(false); // must start uppercase
  });

  it('validates add_class command', () => {
    const validCmd = {
      type: 'add_class' as const,
      name: 'Product',
      attributes: [
        {
          name: 'price',
          type: 'Double',
          visibility: 'private' as const,
          isPrimaryKey: false,
          isRequired: true,
          isUnique: false,
        },
      ],
    };

    const errors = validateCommand(initialModel, validCmd);
    expect(errors).toHaveLength(0);

    const dupCmd = {
      type: 'add_class' as const,
      name: 'User',
    };
    const dupErrors = validateCommand(initialModel, dupCmd);
    expect(dupErrors.length).toBeGreaterThan(0);
    expect(dupErrors[0].message).toContain('already exists');
  });

  it('applies add_class and rename_class commands immutably', () => {
    const addCmd = {
      type: 'add_class' as const,
      name: 'Product',
    };

    const modelAfterAdd = applyCommand(initialModel, addCmd);
    expect(modelAfterAdd.classes).toHaveLength(2);
    expect(modelAfterAdd.version).toBe(2);
    expect(initialModel.classes).toHaveLength(1); // immutability check

    const newClass = modelAfterAdd.classes.find((c) => c.name === 'Product');
    expect(newClass).toBeDefined();

    const renameCmd = {
      type: 'rename_class' as const,
      classId: newClass!.id,
      newName: 'Item',
    };

    const modelAfterRename = applyCommand(modelAfterAdd, renameCmd);
    expect(modelAfterRename.classes.find((c) => c.id === newClass!.id)?.name).toBe('Item');
  });

  it('detects cyclic inheritance', () => {
    const cyclicModel: UMLModel = {
      id: 'diagram-2',
      name: 'InheritanceTest',
      version: 1,
      classes: [
        { id: 'c1', name: 'A', kind: 'class', attributes: [], methods: [], position: { x: 0, y: 0 } },
        { id: 'c2', name: 'B', kind: 'class', attributes: [], methods: [], position: { x: 0, y: 0 } },
      ],
      relations: [
        {
          id: 'r1',
          kind: 'inheritance',
          sourceClassId: 'c1',
          targetClassId: 'c2',
          sourceCardinality: '1',
          targetCardinality: '1',
        },
        {
          id: 'r2',
          kind: 'inheritance',
          sourceClassId: 'c2',
          targetClassId: 'c1',
          sourceCardinality: '1',
          targetCardinality: '1',
        },
      ],
    };

    const cycles = detectInheritanceCycles(cyclicModel);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('validates and applies add_attribute and remove_attribute', () => {
    const addAttrCmd = {
      type: 'add_attribute' as const,
      classId: 'class-1',
      name: 'age',
      dataType: 'Integer',
      isRequired: false,
    };

    const errors = validateCommand(initialModel, addAttrCmd);
    expect(errors).toHaveLength(0);

    const modelWithAttr = applyCommand(initialModel, addAttrCmd);
    const updatedClass = modelWithAttr.classes.find((c) => c.id === 'class-1');
    expect(updatedClass?.attributes.some((a) => a.name === 'age')).toBe(true);

    // Duplicate attribute validation
    const dupErrors = validateCommand(modelWithAttr, addAttrCmd);
    expect(dupErrors.length).toBeGreaterThan(0);
    expect(dupErrors[0].message).toContain('already exists');

    // Remove attribute
    const attrToRemove = updatedClass!.attributes.find((a) => a.name === 'age')!;
    const removeAttrCmd = {
      type: 'remove_attribute' as const,
      classId: 'class-1',
      attributeId: attrToRemove.id,
    };

    const removeErrors = validateCommand(modelWithAttr, removeAttrCmd);
    expect(removeErrors).toHaveLength(0);

    const modelAfterRemove = applyCommand(modelWithAttr, removeAttrCmd);
    const finalClass = modelAfterRemove.classes.find((c) => c.id === 'class-1');
    expect(finalClass?.attributes.some((a) => a.name === 'age')).toBe(false);
  });

  it('validates and applies add_relation and remove_relation', () => {
    // Add second class first
    const modelWithTwoClasses = applyCommand(initialModel, {
      type: 'add_class',
      name: 'Order',
    });
    const orderClass = modelWithTwoClasses.classes.find((c) => c.name === 'Order')!;

    const addRelCmd = {
      type: 'add_relation' as const,
      kind: 'association' as const,
      sourceClass: 'class-1',
      targetClass: orderClass.id,
      sourceCardinality: '1' as const,
      targetCardinality: '0..*' as const,
    };

    const relErrors = validateCommand(modelWithTwoClasses, addRelCmd);
    expect(relErrors).toHaveLength(0);

    const modelWithRel = applyCommand(modelWithTwoClasses, addRelCmd);
    expect(modelWithRel.relations).toHaveLength(1);
    const relId = modelWithRel.relations[0].id;

    const removeRelCmd = {
      type: 'remove_relation' as const,
      relationId: relId,
    };

    const removeErrors = validateCommand(modelWithRel, removeRelCmd);
    expect(removeErrors).toHaveLength(0);

    const modelAfterRemove = applyCommand(modelWithRel, removeRelCmd);
    expect(modelAfterRemove.relations).toHaveLength(0);
  });

  it('validates and applies move_class and delete_class with cascade', () => {
    const moveCmd = {
      type: 'move_class' as const,
      classId: 'class-1',
      x: 250,
      y: 350,
    };

    const moveErrors = validateCommand(initialModel, moveCmd);
    expect(moveErrors).toHaveLength(0);

    const movedModel = applyCommand(initialModel, moveCmd);
    expect(movedModel.classes[0].position).toEqual({ x: 250, y: 350 });

    // Delete class cascades to attached relations
    const modelWithRel: UMLModel = {
      ...initialModel,
      classes: [
        ...initialModel.classes,
        { id: 'c-2', name: 'Profile', kind: 'class', attributes: [], methods: [], position: { x: 0, y: 0 } },
      ],
      relations: [
        {
          id: 'rel-test',
          kind: 'association',
          sourceClassId: 'class-1',
          targetClassId: 'c-2',
          sourceCardinality: '1',
          targetCardinality: '1',
        },
      ],
    };

    const deleteCmd = {
      type: 'delete_class' as const,
      classId: 'class-1',
    };

    const deleteErrors = validateCommand(modelWithRel, deleteCmd);
    expect(deleteErrors).toHaveLength(0);

    const afterDelete = applyCommand(modelWithRel, deleteCmd);
    expect(afterDelete.classes.find((c) => c.id === 'class-1')).toBeUndefined();
    expect(afterDelete.relations).toHaveLength(0); // cascaded
  });

  it('validates and applies sequential batches of commands', () => {
    const batch = [
      {
        type: 'add_class' as const,
        name: 'Author',
      },
      {
        type: 'add_class' as const,
        name: 'Article',
      },
      {
        type: 'add_relation' as const,
        kind: 'association' as const,
        sourceClass: 'Author',
        targetClass: 'Article',
        sourceCardinality: '1' as const,
        targetCardinality: '0..*' as const,
      },
    ];

    const validation = validateCommands(initialModel, batch);
    expect(validation.valid).toBe(true);

    const appliedModel = applyCommands(initialModel, batch);
    expect(appliedModel.classes).toHaveLength(3);
    expect(appliedModel.relations).toHaveLength(1);
    expect(appliedModel.version).toBe(initialModel.version + 3);
  });
});
