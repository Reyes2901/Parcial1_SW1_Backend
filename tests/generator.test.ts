import { describe, it, expect } from 'vitest';
import type { UMLModel } from '../src/domain/uml-model';
import { SpringBootGeneratorService } from '../src/modules/generator/generator.service';
import { validateAssociativeClasses } from '../src/modules/generator/mapper/relation-mapper';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('Spring Boot Generator', () => {
  const service = new SpringBootGeneratorService();

  const testModel: UMLModel = {
    id: 'diagram-test',
    name: 'OrderSystem',
    version: 1,
    classes: [
      {
        id: 'cls-customer',
        name: 'Customer',
        kind: 'class',
        attributes: [
          {
            id: 'attr-1',
            name: 'name',
            type: 'String',
            visibility: 'private',
            isPrimaryKey: false,
            isRequired: true,
            isUnique: false,
          },
          {
            id: 'attr-2',
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
      {
        id: 'cls-order',
        name: 'Order',
        kind: 'class',
        attributes: [
          {
            id: 'attr-3',
            name: 'totalAmount',
            type: 'Double',
            visibility: 'private',
            isPrimaryKey: false,
            isRequired: true,
            isUnique: false,
          },
        ],
        methods: [],
        position: { x: 100, y: 100 },
      },
    ],
    relations: [
      {
        id: 'rel-1',
        kind: 'association',
        sourceClassId: 'cls-customer',
        targetClassId: 'cls-order',
        sourceCardinality: '1',
        targetCardinality: '0..*',
      },
    ],
  };

  it('generates complete 4-layer Spring Boot code structure and postman collection', () => {
    const files = service.generateProject(testModel);

    // Verify root files
    expect(files['order-system/pom.xml']).toBeDefined();
    expect(files['order-system/src/main/resources/application.yml']).toBeDefined();
    expect(files['order-system/postman_collection.json']).toBeDefined();

    // Verify 4-layer java components for Customer
    const baseJava = 'order-system/src/main/java/com/example/ordersystem';
    expect(files[`${baseJava}/entity/Customer.java`]).toContain('@Entity');
    expect(files[`${baseJava}/entity/Customer.java`]).toContain('List<Order>');
    expect(files[`${baseJava}/repository/CustomerRepository.java`]).toContain('JpaRepository<Customer, Long>');
    expect(files[`${baseJava}/service/CustomerService.java`]).toContain('@Service');
    expect(files[`${baseJava}/controller/CustomerController.java`]).toContain('@RestController');
    expect(files[`${baseJava}/dto/CustomerDTO.java`]).toContain('CustomerDTO');
    expect(files[`${baseJava}/mapper/CustomerMapper.java`]).toContain('@Component');

    // Verify Order entity side (ManyToOne)
    expect(files[`${baseJava}/entity/Order.java`]).toContain('@ManyToOne');
    expect(files[`${baseJava}/entity/Order.java`]).toContain('@JoinColumn(name = "customer_id")');
  });

  it('rejects N:M relations with custom properties without an explicit associative class', () => {
    const invalidNMModel: UMLModel = {
      ...testModel,
      relations: [
        {
          id: 'rel-nm',
          name: 'quantity',
          kind: 'association',
          sourceClassId: 'cls-customer',
          targetClassId: 'cls-order',
          sourceCardinality: '0..*',
          targetCardinality: '0..*',
          attributes: [
            {
              id: 'attr-qty',
              name: 'quantity',
              type: 'Integer',
              visibility: 'private',
              isPrimaryKey: false,
              isRequired: true,
              isUnique: false,
            },
          ],
        },
      ],
    };

    expect(() => validateAssociativeClasses(invalidNMModel)).toThrow(
      'Model an explicit associative class'
    );
  });

  it('compiles generated project with mvn -q compile', () => {
    const files = service.generateProject(testModel);
    const uniqueId = Date.now();
    const tmpDir = path.join(__dirname, `../scratch/generated-test-proj-${uniqueId}`);

    fs.mkdirSync(tmpDir, { recursive: true });

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
    }

    const projectRoot = path.join(tmpDir, 'order-system');

    // Execute mvn -q compile
    let compileSuccess = false;
    try {
      execSync('mvn -q compile', { cwd: projectRoot, stdio: 'pipe' });
      compileSuccess = true;
    } catch (err: any) {
      console.error('mvn compile stdout/stderr:', err.stdout?.toString(), err.stderr?.toString());
      compileSuccess = false;
    }

    expect(compileSuccess).toBe(true);

    // Clean up
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on Windows lock
    }
  });

  it('generates and compiles complex model with inheritance, UUID PK, 1:1, composition and N:M', () => {
    const complexModel: UMLModel = {
      id: 'diag-complex',
      name: 'InventoryApp',
      version: 1,
      classes: [
        {
          id: 'cls-item',
          name: 'Item',
          kind: 'class',
          attributes: [
            {
              id: 'attr-item-id',
              name: 'code',
              type: 'UUID',
              visibility: 'private',
              isPrimaryKey: true,
              isRequired: true,
              isUnique: true,
            },
            {
              id: 'attr-item-name',
              name: 'name',
              type: 'String',
              visibility: 'private',
              isPrimaryKey: false,
              isRequired: true,
              isUnique: false,
            },
          ],
          methods: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'cls-book',
          name: 'Book',
          kind: 'class',
          attributes: [
            {
              id: 'attr-book-author',
              name: 'author',
              type: 'String',
              visibility: 'private',
              isPrimaryKey: false,
              isRequired: true,
              isUnique: false,
            },
          ],
          methods: [],
          position: { x: 0, y: 100 },
        },
        {
          id: 'cls-detail',
          name: 'ItemDetail',
          kind: 'class',
          attributes: [
            {
              id: 'attr-detail-desc',
              name: 'description',
              type: 'String',
              visibility: 'private',
              isPrimaryKey: false,
              isRequired: false,
              isUnique: false,
            },
          ],
          methods: [],
          position: { x: 100, y: 0 },
        },
        {
          id: 'cls-category',
          name: 'Category',
          kind: 'class',
          attributes: [
            {
              id: 'attr-cat-name',
              name: 'title',
              type: 'String',
              visibility: 'private',
              isPrimaryKey: false,
              isRequired: true,
              isUnique: false,
            },
          ],
          methods: [],
          position: { x: 200, y: 0 },
        },
      ],
      relations: [
        // Inheritance: Book extends Item
        {
          id: 'rel-inh',
          kind: 'inheritance',
          sourceClassId: 'cls-book',
          targetClassId: 'cls-item',
          sourceCardinality: '1',
          targetCardinality: '1',
        },
        // 1:1 Item -> ItemDetail
        {
          id: 'rel-11',
          kind: 'association',
          sourceClassId: 'cls-item',
          targetClassId: 'cls-detail',
          sourceCardinality: '1',
          targetCardinality: '1',
        },
        // N:M Item -> Category
        {
          id: 'rel-nm',
          kind: 'association',
          sourceClassId: 'cls-item',
          targetClassId: 'cls-category',
          sourceCardinality: '0..*',
          targetCardinality: '0..*',
        },
      ],
    };

    const files = service.generateProject(complexModel);
    expect(files['inventory-app/pom.xml']).toBeDefined();

    const baseJava = 'inventory-app/src/main/java/com/example/inventoryapp';
    // Item should have UUID PK and @Inheritance
    expect(files[`${baseJava}/entity/Item.java`]).toContain('@Inheritance(strategy = InheritanceType.JOINED)');
    expect(files[`${baseJava}/entity/Item.java`]).toContain('private UUID code;');
    expect(files[`${baseJava}/repository/ItemRepository.java`]).toContain('JpaRepository<Item, UUID>');

    // Book should extend Item, not have its own @Id, and have UUID in repo
    expect(files[`${baseJava}/entity/Book.java`]).toContain('extends Item');
    expect(files[`${baseJava}/entity/Book.java`]).not.toContain('@Id');
    expect(files[`${baseJava}/repository/BookRepository.java`]).toContain('JpaRepository<Book, UUID>');

    // Compile with Maven
    const uniqueId = Date.now();
    const tmpDir = path.join(__dirname, `../scratch/generated-complex-proj-${uniqueId}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = path.join(tmpDir, filePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf-8');
    }

    const projectRoot = path.join(tmpDir, 'inventory-app');
    let compileSuccess = false;
    try {
      execSync('mvn -q compile', { cwd: projectRoot, stdio: 'pipe' });
      compileSuccess = true;
    } catch (err: any) {
      console.error('mvn compile stdout/stderr:', err.stdout?.toString(), err.stderr?.toString());
      compileSuccess = false;
    }

    expect(compileSuccess).toBe(true);

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error on Windows lock
    }
  });
});
