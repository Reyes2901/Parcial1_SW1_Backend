// modules/generator/generator.service.ts
// Spring Boot Code Generator core logic

import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import type { UMLModel } from '../../domain/uml-model';
import { toCamelCase, toPascalCase, toPluralSnakeCase, toSnakeCase } from './mapper/naming';
import { mapUMLTypeToJava } from './mapper/type-mapper';
import { mapRelationsForClass, validateAssociativeClasses } from './mapper/relation-mapper';
import { generatePostmanCollection } from './postman';
import type { GeneratedFileTree } from './zip';

// Register Handlebars helpers
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('or', (a, b) => a || b);

export class SpringBootGeneratorService {
  private templatesDir: string;

  constructor() {
    // Check both dist and src directory for templates
    const distPath = path.join(__dirname, 'templates');
    const srcPath = path.join(process.cwd(), 'src', 'modules', 'generator', 'templates');

    if (fs.existsSync(distPath)) {
      this.templatesDir = distPath;
    } else if (fs.existsSync(srcPath)) {
      this.templatesDir = srcPath;
    } else {
      this.templatesDir = distPath;
    }
  }

  private loadTemplate(fullName: string): Handlebars.TemplateDelegate {
    let filePath = path.join(this.templatesDir, `${fullName}.hbs`);
    if (!fs.existsSync(filePath)) {
      // Fallback check
      const altPath = path.join(process.cwd(), 'src', 'modules', 'generator', 'templates', `${fullName}.hbs`);
      if (fs.existsSync(altPath)) {
        filePath = altPath;
      }
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return Handlebars.compile(content);
  }

  generateProject(model: UMLModel): GeneratedFileTree {
    // Validate N:M relations with custom properties (§7.7 rule)
    validateAssociativeClasses(model);

    const files: GeneratedFileTree = {};
    const appName = toSnakeCase(model.name || 'demo_app').replace(/_/g, '-');
    const packageName = toSnakeCase(model.name || 'demo').replace(/_/g, '');
    const mainClassName = toPascalCase(model.name || 'Demo');
    const baseDir = `${appName}`;
    const javaBaseDir = `${baseDir}/src/main/java/com/example/${packageName}`;
    const resourcesDir = `${baseDir}/src/main/resources`;

    // 1. pom.xml
    const pomTpl = this.loadTemplate('pom.xml');
    files[`${baseDir}/pom.xml`] = pomTpl({
      artifactId: appName,
      projectName: model.name || 'Demo Project',
    });

    // 2. application.yml
    const appYmlTpl = this.loadTemplate('application.yml');
    files[`${resourcesDir}/application.yml`] = appYmlTpl({
      projectName: appName,
    });

    // 3. Application.java
    const appTpl = this.loadTemplate('Application.java');
    files[`${javaBaseDir}/${mainClassName}Application.java`] = appTpl({
      packageName,
      mainClassName,
    });

    // 4. GlobalExceptionHandler.java
    const exceptionTpl = this.loadTemplate('GlobalExceptionHandler.java');
    files[`${javaBaseDir}/exception/GlobalExceptionHandler.java`] = exceptionTpl({
      packageName,
    });

    // Templates for components
    const entityTpl = this.loadTemplate('Entity.java');
    const repoTpl = this.loadTemplate('Repository.java');
    const serviceTpl = this.loadTemplate('Service.java');
    const controllerTpl = this.loadTemplate('Controller.java');
    const dtoTpl = this.loadTemplate('Dto.java');
    const mapperTpl = this.loadTemplate('Mapper.java');

    // Generate 4-layer structure for each class
    for (const cls of model.classes) {
      const className = toPascalCase(cls.name);
      const tableName = toPluralSnakeCase(cls.name);
      const pluralKebabName = tableName.replace(/_/g, '-');

      const importsSet = new Set<string>();

      const { fields: relationFields, extendsClass, inheritanceAnnotation } = mapRelationsForClass(
        cls.id,
        model
      );

      // Determine ID details
      let idJavaType = 'Long';
      let idTypeImport: string | undefined;
      let idFieldName = 'id';
      let idPascalFieldName = 'Id';
      let idColumnName = 'id';
      let isIdGenerated = true;
      let idGenerationStrategy = 'IDENTITY';

      let pkAttr = cls.attributes.find((a) => a.isPrimaryKey);
      if (!pkAttr) {
        pkAttr = cls.attributes.find((a) => a.name.toLowerCase() === 'id');
      }

      if (extendsClass) {
        // Child entity inherits ID from parent entity
        const parentClass = model.classes.find((c) => c.name === extendsClass);
        if (parentClass) {
          const parentPk = parentClass.attributes.find((a) => a.isPrimaryKey) ||
            parentClass.attributes.find((a) => a.name.toLowerCase() === 'id');
          if (parentPk) {
            const pkType = mapUMLTypeToJava(parentPk.type);
            idJavaType = pkType.javaType;
            idTypeImport = pkType.importPackage;
            idFieldName = toCamelCase(parentPk.name);
            idPascalFieldName = toPascalCase(parentPk.name);
            idColumnName = toSnakeCase(parentPk.name);
          }
        }
        isIdGenerated = false;
      } else if (pkAttr) {
        const pkType = mapUMLTypeToJava(pkAttr.type);
        idJavaType = pkType.javaType;
        idTypeImport = pkType.importPackage;
        idFieldName = toCamelCase(pkAttr.name);
        idPascalFieldName = toPascalCase(pkAttr.name);
        idColumnName = toSnakeCase(pkAttr.name);
        if (idJavaType === 'UUID') {
          isIdGenerated = true;
          idGenerationStrategy = 'AUTO';
        } else if (idJavaType === 'Long' || idJavaType === 'Integer') {
          isIdGenerated = true;
          idGenerationStrategy = 'IDENTITY';
        } else {
          isIdGenerated = false;
        }
      }

      if (idTypeImport) {
        importsSet.add(idTypeImport);
      }

      const attributes = cls.attributes
        .filter((attr) => {
          if (pkAttr && attr.id === pkAttr.id) return false;
          if (!pkAttr && !extendsClass && attr.name.toLowerCase() === 'id') return false;
          return true;
        })
        .map((attr) => {
          const typeInfo = mapUMLTypeToJava(attr.type);
          if (typeInfo.importPackage) importsSet.add(typeInfo.importPackage);

          return {
            fieldName: toCamelCase(attr.name),
            pascalFieldName: toPascalCase(attr.name),
            columnName: toSnakeCase(attr.name),
            javaType: typeInfo.javaType,
            isPrimaryKey: attr.isPrimaryKey,
            isRequired: attr.isRequired,
            isUnique: attr.isUnique,
            isColumn: true,
          };
        });

      const templateContext = {
        packageName,
        className,
        tableName,
        pluralKebabName,
        attributes,
        relationFields,
        extendsClass,
        inheritanceAnnotation,
        idJavaType,
        idTypeImport,
        idFieldName,
        idPascalFieldName,
        idColumnName,
        isIdGenerated,
        idGenerationStrategy,
        imports: Array.from(importsSet),
      };

      // Entity
      files[`${javaBaseDir}/entity/${className}.java`] = entityTpl(templateContext);

      // Repository
      files[`${javaBaseDir}/repository/${className}Repository.java`] = repoTpl(templateContext);

      // Service
      files[`${javaBaseDir}/service/${className}Service.java`] = serviceTpl(templateContext);

      // Controller
      files[`${javaBaseDir}/controller/${className}Controller.java`] = controllerTpl(templateContext);

      // DTO
      files[`${javaBaseDir}/dto/${className}DTO.java`] = dtoTpl(templateContext);

      // Mapper
      files[`${javaBaseDir}/mapper/${className}Mapper.java`] = mapperTpl(templateContext);
    }

    // 5. Postman Collection
    const postmanCol = generatePostmanCollection(model);
    files[`${baseDir}/postman_collection.json`] = JSON.stringify(postmanCol, null, 2);

    return files;
  }
}
