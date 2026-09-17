// modules/ai/orchestrator.ts
// AI orchestrator — builds context, calls LLM, returns UMLCommand[] (§7.4)

import type { UMLModel } from '../../domain/uml-model';
import type { UMLCommand } from '../../domain/uml-command';
import type { ILLMProvider } from './llm.provider';
import { UML_TOOLS, DESTRUCTIVE_OPERATIONS } from './tools';

export interface AIOrchestratorResult {
  commands: UMLCommand[];
  message: string;
  requiresConfirmation: boolean;
  pendingConfirmation: UMLCommand[];
  autoApplied: UMLCommand[];
}

export class AIOrchestrator {
  constructor(private llmProvider: ILLMProvider) {}

  /** Serialize model into compact context for the LLM */
  private serializeModelContext(model: UMLModel): string {
    const classesDesc = model.classes
      .map((c) => {
        const attrs = c.attributes
          .map(
            (a) =>
              `    ${a.visibility} ${a.name}: ${a.type}${a.isPrimaryKey ? ' [PK]' : ''}${a.isRequired ? ' [REQUIRED]' : ''}`
          )
          .join('\n');
        const methods = c.methods
          .map((m) => `    ${m.visibility} ${m.name}(${m.parameters.map((p) => `${p.name}: ${p.type}`).join(', ')}): ${m.returnType}`)
          .join('\n');
        return `  ${c.kind} ${c.name} (id: ${c.id})\n${attrs}${methods ? '\n' + methods : ''}`;
      })
      .join('\n');

    const relationsDesc = model.relations
      .map(
        (r) =>
          `  ${r.id}: ${r.sourceClassId} --[${r.kind} ${r.sourceCardinality}..${r.targetCardinality}]--> ${r.targetClassId}`
      )
      .join('\n');

    return `Current UML Model "${model.name}" (version ${model.version}):\n\nClasses:\n${classesDesc || '  (none)'}\n\nRelations:\n${relationsDesc || '  (none)'}`;
  }

  async processCommand(
    model: UMLModel,
    userMessage: string
  ): Promise<AIOrchestratorResult> {
    const systemPrompt = `You are a UML class diagram modeling assistant. The user will give you instructions to modify a UML class diagram.

You MUST use the provided tools to make changes. Each tool call corresponds to a UML command.

Rules:
- Class names must be PascalCase valid Java identifiers
- Attribute names must be valid Java identifiers (camelCase)
- Supported types: String, Integer, Long, Double, BigDecimal, Boolean, LocalDate, LocalDateTime, UUID
- For relations, use class IDs (not names) when referencing existing classes
- For new classes being added in the same request, you can reference them by name

${this.serializeModelContext(model)}`;

    const response = await this.llmProvider.chat(systemPrompt, userMessage, UML_TOOLS);

    // Convert tool calls to UMLCommands
    const allCommands: UMLCommand[] = response.toolCalls.map((tc) => ({
      type: tc.name as UMLCommand['type'],
      ...tc.arguments,
    })) as UMLCommand[];

    // Separate destructive from safe commands
    const autoApplied = allCommands.filter(
      (cmd) => !DESTRUCTIVE_OPERATIONS.has(cmd.type)
    );
    const pendingConfirmation = allCommands.filter((cmd) =>
      DESTRUCTIVE_OPERATIONS.has(cmd.type)
    );

    return {
      commands: allCommands,
      message: response.content || 'Commands generated successfully.',
      requiresConfirmation: pendingConfirmation.length > 0,
      pendingConfirmation,
      autoApplied,
    };
  }
}
