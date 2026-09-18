// modules/import/vision.provider.ts
// Vision provider interface + concrete implementation (§4 rule #4, §7.6)

import type { UMLCommand } from '../../domain/uml-command';
import { ValidationError } from '../../shared/errors';
import { UML_TOOLS } from '../ai/tools';

export interface IVisionProvider {
  extractCommandsFromImage(imageBuffer: Buffer, mimeType: string): Promise<UMLCommand[]>;
}

export class OpenAIModuleVisionProvider implements IVisionProvider {
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.VISION_API_KEY || process.env.LLM_API_KEY || '';
    this.baseUrl = process.env.VISION_BASE_URL || process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
    this.model = process.env.VISION_MODEL || 'gpt-4o';
  }

  async extractCommandsFromImage(imageBuffer: Buffer, mimeType: string): Promise<UMLCommand[]> {
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const prompt = `Analyze this image of a UML class diagram. Extract all classes, their attributes, visibility, data types, and relationships.
Return the diagram structure ONLY by calling the provided tool functions (add_class, add_attribute, add_relation).`;

    const body = {
      model: this.model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      tools: UML_TOOLS.map((t) => ({
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
      const errorText = await response.text();
      throw new ValidationError(`Vision API error: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{
        message: {
          tool_calls?: Array<{
            function: { name: string; arguments: string };
          }>;
        };
      }>;
    };

    const toolCalls = data.choices[0]?.message?.tool_calls || [];
    const commands: UMLCommand[] = toolCalls.map((tc) => ({
      type: tc.function.name as UMLCommand['type'],
      ...JSON.parse(tc.function.arguments),
    })) as UMLCommand[];

    return commands;
  }
}
