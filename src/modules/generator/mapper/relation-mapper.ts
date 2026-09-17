// modules/generator/mapper/relation-mapper.ts
// Relation mapping rules per AGENTS.md §7.7

import type { UMLModel } from '../../../domain/uml-model';
import { toCamelCase, toSnakeCase } from './naming';

export interface MappedRelationField {
  fieldName: string;
  targetClassName: string;
  targetClassFieldName: string;
  relationType: 'OneToOne' | 'OneToMany' | 'ManyToOne' | 'ManyToMany';
  annotation: string;
  cascadeAll?: boolean;
  orphanRemoval?: boolean;
  joinColumnName?: string;
  joinTableName?: string;
  mappedBy?: string;
  isOwner: boolean;
}

export function mapRelationsForClass(
  classId: string,
  model: UMLModel
): { fields: MappedRelationField[]; extendsClass?: string; inheritanceAnnotation?: string } {
  const fields: MappedRelationField[] = [];
  let extendsClass: string | undefined;
  let inheritanceAnnotation: string | undefined;

  const currentClass = model.classes.find((c) => c.id === classId);
  if (!currentClass) return { fields };

  // Check if this class is a parent in an inheritance hierarchy
  const isInheritanceParent = model.relations.some(
    (r) => r.kind === 'inheritance' && r.targetClassId === classId
  );
  if (isInheritanceParent) {
    inheritanceAnnotation = '@Inheritance(strategy = InheritanceType.JOINED)';
  }

  for (const rel of model.relations) {
    const isSource = rel.sourceClassId === classId;
    const isTarget = rel.targetClassId === classId;

    if (!isSource && !isTarget) continue;

    const otherClassId = isSource ? rel.targetClassId : rel.sourceClassId;
    const otherClass = model.classes.find((c) => c.id === otherClassId);
    if (!otherClass) continue;

    // Handle Inheritance
    if (rel.kind === 'inheritance') {
      if (isSource) {
        // Source inherits from Target (extends target)
        extendsClass = otherClass.name;
      }
      continue;
    }

    const srcCard = rel.sourceCardinality;
    const tgtCard = rel.targetCardinality;

    const sourceIsMany = srcCard === '1..*' || srcCard === '0..*' || srcCard === '*';
    const targetIsMany = tgtCard === '1..*' || tgtCard === '0..*' || tgtCard === '*';

    // 1 -> 1
    if (!sourceIsMany && !targetIsMany) {
      if (isSource) {
        fields.push({
          fieldName: toCamelCase(otherClass.name),
          targetClassName: otherClass.name,
          targetClassFieldName: toCamelCase(currentClass.name),
          relationType: 'OneToOne',
          annotation: `@OneToOne\n    @JoinColumn(name = "${toSnakeCase(otherClass.name)}_id")`,
          joinColumnName: `${toSnakeCase(otherClass.name)}_id`,
          isOwner: true,
        });
      } else {
        fields.push({
          fieldName: toCamelCase(otherClass.name),
          targetClassName: otherClass.name,
          targetClassFieldName: toCamelCase(currentClass.name),
          relationType: 'OneToOne',
          annotation: `@OneToOne(mappedBy = "${toCamelCase(currentClass.name)}")`,
          mappedBy: toCamelCase(currentClass.name),
          isOwner: false,
        });
      }
    }
    // 1 -> N (or N -> 1)
    else if (!sourceIsMany && targetIsMany) {
      if (isSource) {
        const isComposition = rel.kind === 'composition';
        fields.push({
          fieldName: `${toCamelCase(otherClass.name)}List`,
          targetClassName: otherClass.name,
          targetClassFieldName: toCamelCase(currentClass.name),
          relationType: 'OneToMany',
          annotation: isComposition
            ? `@OneToMany(mappedBy = "${toCamelCase(currentClass.name)}", cascade = CascadeType.ALL, orphanRemoval = true)`
            : `@OneToMany(mappedBy = "${toCamelCase(currentClass.name)}")`,
          mappedBy: toCamelCase(currentClass.name),
          cascadeAll: isComposition,
          orphanRemoval: isComposition,
          isOwner: false,
        });
      } else {
        fields.push({
          fieldName: toCamelCase(otherClass.name),
          targetClassName: otherClass.name,
          targetClassFieldName: `${toCamelCase(currentClass.name)}List`,
          relationType: 'ManyToOne',
          annotation: `@ManyToOne\n    @JoinColumn(name = "${toSnakeCase(otherClass.name)}_id")`,
          joinColumnName: `${toSnakeCase(otherClass.name)}_id`,
          isOwner: true,
        });
      }
    } else if (sourceIsMany && !targetIsMany) {
      if (isSource) {
        fields.push({
          fieldName: toCamelCase(otherClass.name),
          targetClassName: otherClass.name,
          targetClassFieldName: `${toCamelCase(currentClass.name)}List`,
          relationType: 'ManyToOne',
          annotation: `@ManyToOne\n    @JoinColumn(name = "${toSnakeCase(otherClass.name)}_id")`,
          joinColumnName: `${toSnakeCase(otherClass.name)}_id`,
          isOwner: true,
        });
      } else {
        const isComposition = rel.kind === 'composition';
        fields.push({
          fieldName: `${toCamelCase(otherClass.name)}List`,
          targetClassName: otherClass.name,
          targetClassFieldName: toCamelCase(currentClass.name),
          relationType: 'OneToMany',
          annotation: isComposition
            ? `@OneToMany(mappedBy = "${toCamelCase(currentClass.name)}", cascade = CascadeType.ALL, orphanRemoval = true)`
            : `@OneToMany(mappedBy = "${toCamelCase(currentClass.name)}")`,
          mappedBy: toCamelCase(currentClass.name),
          cascadeAll: isComposition,
          orphanRemoval: isComposition,
          isOwner: false,
        });
      }
    }
    // N -> M
    else if (sourceIsMany && targetIsMany) {
      if (isSource) {
        const joinTableName = `${toSnakeCase(currentClass.name)}_${toSnakeCase(otherClass.name)}`;
        fields.push({
          fieldName: `${toCamelCase(otherClass.name)}Set`,
          targetClassName: otherClass.name,
          targetClassFieldName: `${toCamelCase(currentClass.name)}Set`,
          relationType: 'ManyToMany',
          annotation: `@ManyToMany\n    @JoinTable(\n        name = "${joinTableName}",\n        joinColumns = @JoinColumn(name = "${toSnakeCase(currentClass.name)}_id"),\n        inverseJoinColumns = @JoinColumn(name = "${toSnakeCase(otherClass.name)}_id")\n    )`,
          joinTableName,
          isOwner: true,
        });
      } else {
        fields.push({
          fieldName: `${toCamelCase(otherClass.name)}Set`,
          targetClassName: otherClass.name,
          targetClassFieldName: `${toCamelCase(currentClass.name)}Set`,
          relationType: 'ManyToMany',
          annotation: `@ManyToMany(mappedBy = "${toCamelCase(currentClass.name)}Set")`,
          mappedBy: `${toCamelCase(currentClass.name)}Set`,
          isOwner: false,
        });
      }
    }
  }

  return { fields, extendsClass, inheritanceAnnotation };
}

export function validateAssociativeClasses(model: UMLModel): void {
  for (const rel of model.relations) {
    const srcMany = rel.sourceCardinality === '1..*' || rel.sourceCardinality === '0..*' || rel.sourceCardinality === '*';
    const tgtMany = rel.targetCardinality === '1..*' || rel.targetCardinality === '0..*' || rel.targetCardinality === '*';

    if (srcMany && tgtMany) {
      if (rel.name && rel.name.trim().length > 0) {
        const srcClass = model.classes.find((c) => c.id === rel.sourceClassId);
        const tgtClass = model.classes.find((c) => c.id === rel.targetClassId);
        throw new Error(
          `Relationship N:M "${rel.name}" between "${srcClass?.name}" and "${tgtClass?.name}" has custom properties. Model an explicit associative class instead of plain @ManyToMany.`
        );
      }
    }
  }
}
