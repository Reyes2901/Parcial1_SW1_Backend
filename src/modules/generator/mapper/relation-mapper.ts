// modules/generator/mapper/relation-mapper.ts

import type { UMLModel } from '../../../domain/uml-model';
import { ValidationError } from '../../../shared/errors';
import { toCamelCase, toPascalCase, toSnakeCase } from './naming';

/**
 * Palabras reservadas de Java que NO pueden usarse como identificador.
 * Si un nombre cae aquí, se sufija con "Field" (ej: "class" -> "classField").
 */
const JAVA_RESERVED = new Set<string>([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class',
  'const', 'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final',
  'finally', 'float', 'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int',
  'interface', 'long', 'native', 'new', 'package', 'private', 'protected', 'public',
  'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
  'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while',
  'true', 'false', 'null',
]);

/**
 * Devuelve un nombre de campo seguro para Java.
 *   "class"  -> "classField"
 *   "int"    -> "intField"
 *   "nombre" -> "nombre"
 */
function safeFieldName(rawName: string): string {
  let name = String(rawName ?? '').replace(/[^a-zA-Z0-9_$]/g, '');
  if (!name) name = 'field';
  if (JAVA_RESERVED.has(name)) name = `${name}Field`;
  if (/^[0-9]/.test(name)) name = `_${name}`;
  return name;
}

/**
 * Nombre del campo Java que apunta a `className`.
 * Se usa consistentemente para `fieldName` Y para `mappedBy` del lado opuesto.
 *   "Usuario"  -> "usuario"
 *   "Class"    -> "classField"   (evita keyword)
 */
function fieldNameFor(className: string): string {
  return safeFieldName(toCamelCase(className));
}

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

    // ─── BUG FIX: el tipo Java SIEMPRE en PascalCase ───
    const otherClassName = toPascalCase(otherClass.name);

    // ─── BUG FIX: nombre del campo seguro (evita keywords como "class") ───
    const fieldName = fieldNameFor(otherClass.name);
    const oppositeFieldName = fieldNameFor(currentClass.name);

    // Handle Inheritance
    if (rel.kind === 'inheritance') {
      if (isSource) {
        extendsClass = otherClassName;
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
          fieldName,
          targetClassName: otherClassName,
          targetClassFieldName: oppositeFieldName,
          relationType: 'OneToOne',
          annotation: `@OneToOne\n    @JoinColumn(name = "${toSnakeCase(otherClass.name)}_id")`,
          joinColumnName: `${toSnakeCase(otherClass.name)}_id`,
          isOwner: true,
        });
      } else {
        fields.push({
          fieldName,
          targetClassName: otherClassName,
          targetClassFieldName: oppositeFieldName,
          relationType: 'OneToOne',
          annotation: `@OneToOne(mappedBy = "${oppositeFieldName}")`,
          mappedBy: oppositeFieldName,
          isOwner: false,
        });
      }
    }
    // 1 -> N (or N -> 1)
    else if (!sourceIsMany && targetIsMany) {
      if (isSource) {
        const isComposition = rel.kind === 'composition';
        fields.push({
          fieldName: `${fieldName}List`,
          targetClassName: otherClassName,
          targetClassFieldName: oppositeFieldName,
          relationType: 'OneToMany',
          annotation: isComposition
            ? `@OneToMany(mappedBy = "${oppositeFieldName}", cascade = CascadeType.ALL, orphanRemoval = true)`
            : `@OneToMany(mappedBy = "${oppositeFieldName}")`,
          mappedBy: oppositeFieldName,
          cascadeAll: isComposition,
          orphanRemoval: isComposition,
          isOwner: false,
        });
      } else {
        fields.push({
          fieldName,
          targetClassName: otherClassName,
          targetClassFieldName: `${oppositeFieldName}List`,
          relationType: 'ManyToOne',
          annotation: `@ManyToOne\n    @JoinColumn(name = "${toSnakeCase(otherClass.name)}_id")`,
          joinColumnName: `${toSnakeCase(otherClass.name)}_id`,
          isOwner: true,
        });
      }
    } else if (sourceIsMany && !targetIsMany) {
      if (isSource) {
        fields.push({
          fieldName,
          targetClassName: otherClassName,
          targetClassFieldName: `${oppositeFieldName}List`,
          relationType: 'ManyToOne',
          annotation: `@ManyToOne\n    @JoinColumn(name = "${toSnakeCase(otherClass.name)}_id")`,
          joinColumnName: `${toSnakeCase(otherClass.name)}_id`,
          isOwner: true,
        });
      } else {
        const isComposition = rel.kind === 'composition';
        fields.push({
          fieldName: `${fieldName}List`,
          targetClassName: otherClassName,
          targetClassFieldName: oppositeFieldName,
          relationType: 'OneToMany',
          annotation: isComposition
            ? `@OneToMany(mappedBy = "${oppositeFieldName}", cascade = CascadeType.ALL, orphanRemoval = true)`
            : `@OneToMany(mappedBy = "${oppositeFieldName}")`,
          mappedBy: oppositeFieldName,
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
          fieldName: `${fieldName}Set`,
          targetClassName: otherClassName,
          targetClassFieldName: `${oppositeFieldName}Set`,
          relationType: 'ManyToMany',
          annotation: `@ManyToMany\n    @JoinTable(\n        name = "${joinTableName}",\n        joinColumns = @JoinColumn(name = "${toSnakeCase(currentClass.name)}_id"),\n        inverseJoinColumns = @JoinColumn(name = "${toSnakeCase(otherClass.name)}_id")\n    )`,
          joinTableName,
          isOwner: true,
        });
      } else {
        fields.push({
          fieldName: `${fieldName}Set`,
          targetClassName: otherClassName,
          targetClassFieldName: `${oppositeFieldName}Set`,
          relationType: 'ManyToMany',
          annotation: `@ManyToMany(mappedBy = "${oppositeFieldName}Set")`,
          mappedBy: `${oppositeFieldName}Set`,
          isOwner: false,
        });
      }
    }
  }

  return { fields, extendsClass, inheritanceAnnotation };
}

/**
 * §7.7 Rule: An N:M relationship with custom attributes (e.g., Pedido-Producto with cantidad and precio)
 * cannot be generated as plain @ManyToMany. The user must model an explicit associative class instead.
 */
export function validateAssociativeClasses(model: UMLModel): void {
  for (const rel of model.relations) {
    const srcMany = rel.sourceCardinality === '1..*' || rel.sourceCardinality === '0..*' || rel.sourceCardinality === '*';
    const tgtMany = rel.targetCardinality === '1..*' || rel.targetCardinality === '0..*' || rel.targetCardinality === '*';

    if (srcMany && tgtMany) {
      if (rel.attributes && rel.attributes.length > 0) {
        const srcClass = model.classes.find((c) => c.id === rel.sourceClassId);
        const tgtClass = model.classes.find((c) => c.id === rel.targetClassId);
        const relNameStr = rel.name ? ` "${rel.name}"` : '';
        throw new ValidationError(
          `Relationship N:M${relNameStr} between "${srcClass?.name}" and "${tgtClass?.name}" has custom attributes. Model an explicit associative class instead of plain @ManyToMany.`
        );
      }
    }
  }
}