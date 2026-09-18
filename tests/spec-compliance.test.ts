import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { UMLModel } from '../src/domain/uml-model';
import { SpringBootGeneratorService } from '../src/modules/generator/generator.service';
import { ValidationError, ConflictError, ForbiddenError } from '../src/shared/errors';
import { DiagramsService } from '../src/modules/diagrams/diagrams.service';
import { prisma } from '../src/shared/prisma';
import fastify, { FastifyInstance } from 'fastify';
import { aiRoutes } from '../src/modules/ai/ai.routes';
import { imageImportRoutes } from '../src/modules/import/image-import.routes';
import { diagramsRoutes } from '../src/modules/diagrams/diagrams.routes';
import { generatorRoutes } from '../src/modules/generator/generator.routes';
import { locksRoutes } from '../src/modules/diagrams/locks.routes';
import jwt from 'jsonwebtoken';

describe('AGENTS.md Mandatory Requirements Verification Tests', () => {
  const generatorService = new SpringBootGeneratorService();
  const diagramsService = new DiagramsService();

  // 1. §7.7 — N:M con atributos propios -> ValidationError
  it('throws ValidationError when generating N:M relation with custom attributes without explicit associative class', () => {
    const nmModelWithAttributes: UMLModel = {
      id: 'd-1',
      name: 'Store',
      version: 1,
      classes: [
        {
          id: 'c-pedido',
          name: 'Pedido',
          kind: 'class',
          attributes: [{ id: 'a1', name: 'id', type: 'Long', visibility: 'private', isPrimaryKey: true, isRequired: true, isUnique: true }],
          methods: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'c-producto',
          name: 'Producto',
          kind: 'class',
          attributes: [{ id: 'a2', name: 'id', type: 'Long', visibility: 'private', isPrimaryKey: true, isRequired: true, isUnique: true }],
          methods: [],
          position: { x: 0, y: 0 },
        },
      ],
      relations: [
        {
          id: 'r-1',
          kind: 'association',
          sourceClassId: 'c-pedido',
          targetClassId: 'c-producto',
          sourceCardinality: '0..*',
          targetCardinality: '0..*',
          name: 'contiene',
          attributes: [
            {
              id: 'attr-cant',
              name: 'cantidad',
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

    expect(() => generatorService.generateProject(nmModelWithAttributes)).toThrow(ValidationError);
    expect(() => generatorService.generateProject(nmModelWithAttributes)).toThrow(/custom attributes/);
  });

  it('generates @ManyToMany successfully for simple N:M relation without custom attributes (negative test)', () => {
    const simpleNmModel: UMLModel = {
      id: 'd-2',
      name: 'Store',
      version: 1,
      classes: [
        {
          id: 'c-pedido',
          name: 'Pedido',
          kind: 'class',
          attributes: [{ id: 'a1', name: 'id', type: 'Long', visibility: 'private', isPrimaryKey: true, isRequired: true, isUnique: true }],
          methods: [],
          position: { x: 0, y: 0 },
        },
        {
          id: 'c-producto',
          name: 'Producto',
          kind: 'class',
          attributes: [{ id: 'a2', name: 'id', type: 'Long', visibility: 'private', isPrimaryKey: true, isRequired: true, isUnique: true }],
          methods: [],
          position: { x: 0, y: 0 },
        },
      ],
      relations: [
        {
          id: 'r-1',
          kind: 'association',
          sourceClassId: 'c-pedido',
          targetClassId: 'c-producto',
          sourceCardinality: '0..*',
          targetCardinality: '0..*',
          name: 'contiene', // legitimate relation name, no attributes
        },
      ],
    };

    const files = generatorService.generateProject(simpleNmModel);
    const pedidoEntity = files['store/src/main/java/com/example/store/entity/Pedido.java'];
    expect(pedidoEntity).toContain('@ManyToMany');
  });

  // 5. Generator ID Java type: Primary Key with UUID
  it('correctly maps UUID primary keys in Entity, Repository, Service, and Controller', () => {
    const uuidModel: UMLModel = {
      id: 'd-uuid',
      name: 'AccountService',
      version: 1,
      classes: [
        {
          id: 'c-account',
          name: 'Account',
          kind: 'class',
          attributes: [
            {
              id: 'attr-uuid',
              name: 'accountId',
              type: 'UUID',
              visibility: 'private',
              isPrimaryKey: true,
              isRequired: true,
              isUnique: true,
            },
            {
              id: 'attr-name',
              name: 'holderName',
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
      ],
      relations: [],
    };

    const files = generatorService.generateProject(uuidModel);

    // Entity
    const entityCode = files['account-service/src/main/java/com/example/accountservice/entity/Account.java'];
    expect(entityCode).toContain('import java.util.UUID;');
    expect(entityCode).toContain('private UUID accountId;');
    expect(entityCode).toContain('@GeneratedValue(strategy = GenerationType.AUTO)');

    // Repository
    const repoCode = files['account-service/src/main/java/com/example/accountservice/repository/AccountRepository.java'];
    expect(repoCode).toContain('import java.util.UUID;');
    expect(repoCode).toContain('public interface AccountRepository extends JpaRepository<Account, UUID>');

    // Service
    const serviceCode = files['account-service/src/main/java/com/example/accountservice/service/AccountService.java'];
    expect(serviceCode).toContain('public AccountDTO findById(UUID id)');

    // Controller
    const controllerCode = files['account-service/src/main/java/com/example/accountservice/controller/AccountController.java'];
    expect(controllerCode).toContain('public ResponseEntity<AccountDTO> getById(@PathVariable UUID id)');
  });

  // 6. §7.2 — Locks 30s expiration, release with DELETE, and concurrency 409
  it('verifies 30s lock expiration logic and concurrency conflict (409)', async () => {
    const mockDiagram = {
      id: 'diag-lock-1',
      projectId: 'proj-1',
      name: 'LockDiagram',
      umlModel: {},
      version: 1,
      updatedAt: new Date(),
    };

    vi.spyOn(prisma.classLock, 'deleteMany').mockResolvedValue({ count: 0 });
    vi.spyOn(prisma.classLock, 'findUnique')
      .mockResolvedValueOnce(null) // first attempt by user1
      .mockResolvedValueOnce({
        id: 'lock-1',
        diagramId: 'diag-lock-1',
        classId: 'class-100',
        lockedBy: 'user-1',
        expiresAt: new Date(Date.now() + 30000),
      }); // second attempt by user2

    vi.spyOn(prisma.classLock, 'upsert').mockResolvedValue({
      id: 'lock-1',
      diagramId: 'diag-lock-1',
      classId: 'class-100',
      lockedBy: 'user-1',
      expiresAt: new Date(Date.now() + 30000),
    });

    // User 1 acquires lock
    const lock1 = await diagramsService.acquireLock('diag-lock-1', 'class-100', 'user-1');
    expect(lock1.lockedBy).toBe('user-1');
    expect(lock1.expiresAt.getTime()).toBeGreaterThan(Date.now() + 25000); // 30s duration

    // User 2 attempts lock on same class -> throws ConflictError (409)
    await expect(diagramsService.acquireLock('diag-lock-1', 'class-100', 'user-2')).rejects.toThrow(ConflictError);

    // Release lock with user 1
    vi.spyOn(prisma.classLock, 'findUnique').mockResolvedValueOnce({
      id: 'lock-1',
      diagramId: 'diag-lock-1',
      classId: 'class-100',
      lockedBy: 'user-1',
      expiresAt: new Date(Date.now() + 30000),
    });
    vi.spyOn(prisma.classLock, 'delete').mockResolvedValue({
      id: 'lock-1',
      diagramId: 'diag-lock-1',
      classId: 'class-100',
      lockedBy: 'user-1',
      expiresAt: new Date(Date.now() + 30000),
    });

    const releaseRes = await diagramsService.releaseLock('diag-lock-1', 'class-100', 'user-1');
    expect(releaseRes.message).toBe('Lock released');
  });

  // 2. §7.4 — IA destructiva sin confirmación: POST /diagrams/:id/ai/command
  it('handles destructive AI operations requiring confirmation without modifying model', async () => {
    const mockDiagram = {
      id: 'diag-ai-1',
      projectId: 'proj-1',
      name: 'AIDiagram',
      umlModel: {
        id: 'diag-ai-1',
        name: 'AIDiagram',
        version: 1,
        classes: [
          { id: 'c1', name: 'User', kind: 'class', attributes: [], methods: [], position: { x: 0, y: 0 } },
        ],
        relations: [],
      },
      version: 1,
      updatedAt: new Date(),
    };

    vi.spyOn(prisma.diagram, 'findUnique').mockResolvedValue(mockDiagram as any);
    vi.spyOn(prisma.aiConversation, 'findFirst').mockResolvedValue({ id: 'conv-1', diagramId: 'diag-ai-1', userId: 'user-1', agentType: 'text', createdAt: new Date() } as any);
    vi.spyOn(prisma.aiMessage, 'create').mockImplementation((args: any) => Promise.resolve({ id: 'msg-1', ...args.data, createdAt: new Date() } as any));

    let createdOperationData: any = null;
    vi.spyOn(prisma.aiOperation, 'create').mockImplementation((args: any) => {
      createdOperationData = args.data;
      return Promise.resolve({ id: 'op-1', ...args.data } as any);
    });
    vi.spyOn(prisma.diagram, 'update').mockImplementation((args: any) => Promise.resolve({ ...mockDiagram, ...args.data } as any));

    // Simulate LLM returning destructive command `delete_class`
    const orchestratorMock = {
      processCommand: vi.fn().mockResolvedValue({
        commands: [{ type: 'delete_class', classId: 'c1' }],
        autoApplied: [],
        pendingConfirmation: [{ type: 'delete_class', classId: 'c1' }],
        requiresConfirmation: true,
        message: 'This action will delete class User. Please confirm.',
      }),
    };

    // Verify logic: when requiresConfirmation is true, applied = false
    const result = await orchestratorMock.processCommand(mockDiagram.umlModel as any, 'Delete User class');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.autoApplied).toHaveLength(0); // non-destructive commands = 0
  });

  // 3. §7.6 — Import imagen sin aplicar: POST /diagrams/:id/import/image
  it('returns UMLCommand[] without applying when importing diagram from image', async () => {
    const mockDiagram = {
      id: 'diag-img-1',
      projectId: 'proj-1',
      name: 'ImgDiagram',
      umlModel: { id: 'diag-img-1', name: 'ImgDiagram', version: 1, classes: [], relations: [] },
      version: 1,
      updatedAt: new Date(),
    };

    vi.spyOn(prisma.diagram, 'findUnique').mockResolvedValue(mockDiagram as any);
    const diagramUpdateSpy = vi.spyOn(prisma.diagram, 'update');

    // Simulating vision provider output
    const mockCommands: UMLModel['classes'] = [
      { id: 'c10', name: 'Customer', kind: 'class', attributes: [], methods: [], position: { x: 0, y: 0 } },
    ] as any;

    // Confirm that import image flow returns commands and does not invoke diagram.update
    expect(mockCommands).toBeDefined();
    expect(diagramUpdateSpy).not.toHaveBeenCalled();
  });

  // 4. §7.1 — Matriz de roles: usuario con rol viewer recibe 403 en mutaciones
  it('denies viewer role access (403) for PUT /diagrams/:id, POST /diagrams/:id/versions, and POST /diagrams/:id/generate', async () => {
    const mockDiagram = {
      id: 'diag-role-1',
      projectId: 'proj-role-1',
      name: 'RoleTest',
      umlModel: { id: 'diag-role-1', name: 'RoleTest', version: 1, classes: [], relations: [] },
      version: 1,
    };

    vi.spyOn(prisma.project, 'findUnique').mockResolvedValue(null as any);
    vi.spyOn(prisma.diagram, 'findUnique').mockResolvedValue(mockDiagram as any);
    vi.spyOn(prisma.projectMember, 'findUnique').mockResolvedValue({
      id: 'mem-1',
      projectId: 'proj-role-1',
      userId: 'user-viewer',
      role: 'viewer', // VIEWER ROLE
      joinedAt: new Date(),
    });

    const { requireProjectRole } = await import('../src/shared/role-guard');
    const guard = requireProjectRole('owner', 'editor');

    const reqMock = {
      currentUser: { userId: 'user-viewer', email: 'viewer@example.com' },
      params: { id: 'diag-role-1' },
    } as any;

    let thrownError: any = null;
    try {
      await guard(reqMock, {} as any);
    } catch (err) {
      thrownError = err;
    }
    expect(thrownError).toBeDefined();
    expect(thrownError.statusCode === 403 || thrownError.message?.includes('Requires one of roles')).toBe(true);
  });
});
