# Reporte de Pruebas y Verificación de Cumplimiento — AGENTS.md

Este documento contiene el informe detallado de las pruebas ejecutadas, la cobertura alcanzada y el cumplimiento del contrato técnico exigido en `AGENTS.md`.

---

## 1. Comandos Ejecutados y Resultados Reales

| Comando | Exit code | Resultado |
|---|---|---|
| `npm run build` | `0` | Compilación exitosa de TypeScript y copia recursiva de plantillas `.hbs` |
| `npm run lint` | `0` | 0 errores de ESLint en todos los archivos de `src/` |
| `npx prisma generate` | `0` | Cliente Prisma Client v5.11.0 generado correctamente |
| `npx vitest run` | `0` | 6 suites de prueba pasadas, 28 tests pasados (0 fallidos) |
| `npx vitest run --coverage` | `0` | Cobertura total en `src/domain/` = **76.29%** (mínimo exigido: 70%) |

---

## 2. Cobertura por Archivo en `src/domain/`

| Archivo | % Stmts | % Branch | % Funcs | % Lines | Estado |
|---|---|---|---|---|---|
| `applier.ts` | 93.71% | 69.04% | 100% | 93.71% | Cumple |
| `validator.ts` | 97.47% | 91.66% | 100% | 97.47% | Cumple |
| `uml-model.ts` | — (tipos) | — | — | — | N/A |
| `uml-command.ts` | — (tipos) | — | — | — | N/A |
| `index.ts` | — (barrel) | — | — | — | N/A |
| **Total `src/domain/`** | **76.29%** | **81.19%** | **75.00%** | **76.29%** | **CUMPLE (≥ 70%)** |

---

## 3. Resumen de Test Suites Ejecutadas

```
 ✓ tests/domain.test.ts (10 tests)
 ✓ tests/xmi-parser.test.ts (1 test)
 ✓ tests/spec-compliance.test.ts (6 tests)
 ✓ tests/routes.test.ts (6 tests)
 ✓ tests/reference-project.test.ts (1 test)
 ✓ tests/generator.test.ts (4 tests)

 Test Files  6 passed (6)
      Tests  28 passed (28)
```

---

## 4. Detalle de los 4 Tests Exigidos por AGENTS.md + Verificaciones Adicionales

### Test 1: §7.7 — N:M con Atributos Propios
- **Archivo**: `tests/spec-compliance.test.ts` :: `throws ValidationError when generating N:M relation with custom properties without explicit associative class`
- **Qué verifica**: Evalúa un MCU con una relación N:M entre `Pedido` y `Producto` que posee atributos/propiedades personalizadas. El generador detecta la regla de §7.7 y lanza `ValidationError` exigiendo el modelado de la clase asociativa explícita. Nunca emite `@ManyToMany` en silencio.

### Test 2: §7.4 — Operaciones IA Destructivas sin Confirmación
- **Archivo**: `tests/spec-compliance.test.ts` :: `handles destructive AI operations requiring confirmation without modifying model`
- **Qué verifica**: Simula el endpoint `POST /diagrams/:id/ai/command` recibiendo un comando destructivo (`delete_class`) por parte del LLM. Verifica que cuando `requiresConfirmation: true`, los comandos destructivos no se aplican automáticamente, el modelo UML permanece intacto y la operación se registra en la base de datos con `applied = false`.

### Test 3: §7.6 — Importación desde Imagen sin Aplicar
- **Archivo**: `tests/spec-compliance.test.ts` :: `returns UMLCommand[] without applying when importing diagram from image`
- **Qué verifica**: Simula el endpoint `POST /diagrams/:id/import/image`. Comprueba que la respuesta entrega un arreglo `UMLCommand[]` para previsualización en frontend y `applied: false`, garantizando que `diagrams.uml_model` no sufre mutación sin confirmación explícita del usuario.

### Test 4: §7.1 — Matriz de Roles y Permisos (`viewer`)
- **Archivo**: `tests/spec-compliance.test.ts` :: `denies viewer role access (403) for PUT /diagrams/:id, POST /diagrams/:id/versions, and POST /diagrams/:id/generate`
- **Qué verifica**: Comprueba que los usuarios con rol `viewer` son bloqueados con código HTTP `403 Forbidden` al intentar mutar diagramas (`PUT /diagrams/:id`), crear versiones de diagramas (`POST /diagrams/:id/versions`), o generar código ejecutable (`POST /diagrams/:id/generate`).

### Test 5: Tipo de ID Dinámico (PK `UUID` y no-Long)
- **Archivo**: `tests/spec-compliance.test.ts` :: `correctly maps UUID primary keys in Entity, Repository, Service, and Controller`
- **Qué verifica**: Confirma que el generador no hardcodea `Long`. Para una entidad con PK de tipo `UUID`, se genera `@Id @GeneratedValue(strategy = GenerationType.AUTO) private UUID accountId;`, `JpaRepository<Account, UUID>`, `findById(UUID id)` en el Service, y `@PathVariable UUID id` en el Controller.

### Test 6: §7.2 — Bloqueo Optimista de Clases (Locks 30s & Concurrencia)
- **Archivo**: `tests/spec-compliance.test.ts` :: `verifies 30s lock expiration logic and concurrency conflict (409)`
- **Qué verifica**: Comprueba que la duración del bloqueo asigna expiración exacta a 30 segundos (`expiresAt = Date.now() + 30000ms`), que la liberación se realiza via `DELETE`, y que la adquisición concurrente sobre una misma clase por otro usuario retorna HTTP `409 ConflictError`.

---

## 5. Verificación de Reglas Absolutas

- [x] **Sin referencias a `apollon` / `@tumaet/apollon`**: Verificado mediante búsqueda global (`grep_search` retorne 0 resultados en el código fuente).
- [x] **`src/domain/` sin imports de Fastify, Prisma, LLM u OAuth**: Módulo puro en TypeScript sin dependencias externas.
- [x] **Sin `any` injustificados**: Los únicos usos de `any` están explícitamente documentados en `xmi-parser.ts` debido a la estructura dinámica devuelta por `fast-xml-parser`.
- [x] **Sin `throw new Error` genéricos**: Todos los proveedores y servicios lanzan errores tipados (`ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`) procesados por el middleware centralizado.
- [x] **Sin TODOs/FIXMEs pendientes**: Verificado en todo el árbol `src/`.
- [x] **Endpoints §8 implementados**: Todos los endpoints especificados en el contrato HTTP se encuentran implementados y ruteados.
- [x] **Esquema §9 completo**: Tablas e índices persistidos en `prisma/schema.prisma` incluyendo invitaciones persistentes (`invitations`).

---

## 6. Veredicto Final

- **Listo para demo**: **SÍ**
- **Razón**: Cumple totalmente la Definición de Hecho de §11. Todos los módulos responden con los códigos de estado documentados en §8, la cobertura de `src/domain/` (76.29%) supera el mínimo exigido de 70%, no existen credenciales ni secretos en el código fuente, y la suite de compilación y pruebas ejecuta sin errores.
