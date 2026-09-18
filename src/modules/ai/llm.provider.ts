import { ValidationError } from '../../shared/errors';

export interface LLMToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMResponse {
  content: string;
  toolCalls: LLMToolCall[];
}

export interface ILLMProvider {
  chat(
    systemPrompt: string,
    userMessage: string,
    tools: LLMToolDefinition[]
  ): Promise<LLMResponse>;
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Concrete OpenAI-compatible LLM provider.
 * Supports any API with OpenAI-compatible chat completions.
 */
export class OpenAILLMProvider implements ILLMProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.LLM_API_KEY || '';
    this.baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
    this.model = process.env.LLM_MODEL || 'gpt-4o';
  }

  async chat(
    systemPrompt: string,
    userMessage: string,
    tools: LLMToolDefinition[]
  ): Promise<LLMResponse> {
    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      tools: tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      tool_choice: 'auto',
    };

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ValidationError(`LLM API error: ${response.status} ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          content: string | null;
          tool_calls?: Array<{
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const message = data.choices[0]?.message;
    const toolCalls: LLMToolCall[] = (message?.tool_calls ?? []).map((tc) => ({
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    return {
      content: message?.content ?? '',
      toolCalls,
    };
  }
}
