import { GoogleGenerativeAI } from '@google/generative-ai';
import type {
    UMLModel, ClassKind, RelationKind, Cardinality, Visibility,
} from '../../domain/uml-model';
import type { UMLCommand } from '../../domain/uml-command';
import { ValidationError } from '../../shared/errors';

// Lista de modelos: se lee de GEMINI_MODELS (plural, coma-separada).
// Fallback si no está definida. Incluye variantes -pro porque corren en
// pools de capacidad distintos y suelen responder cuando los -flash saturan.
const DEFAULT_MODELS =
    'gemini-3.8-flash,gemini-3.8-pro,gemini-3.7-flash,gemini-3.7-pro,gemini-3.6-flash,gemini-3.6-pro';

function getModelList(): string[] {
    const raw = process.env.GEMINI_MODELS || DEFAULT_MODELS;
    return raw.split(',').map((m) => m.trim()).filter(Boolean);
}

function getClient() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new ValidationError('GEMINI_API_KEY no configurada en .env');
    return new GoogleGenerativeAI(key);
}

/** Clasifica un error para decidir qué hacer con él. */
type ErrorKind =
    | 'retryable'    // 503, 429, 500, timeout → reintentar el mismo modelo
    | 'skip_model'   // 404 → este modelo no existe para esta cuenta, saltar al siguiente
    | 'fatal';       // 400, 401, 403, otro → abortar todo (config rota)

function classifyError(err: unknown): ErrorKind {
    const msg = String((err as Error)?.message ?? '');
    if (/503/.test(msg) || /429/.test(msg) || /500/.test(msg) || /timeout/i.test(msg)) {
        return 'retryable';
    }
    // Google devuelve este texto literal en el 404:
    // "model models/gemini-2.5-flash is no longer available to new users"
    if (/404/.test(msg) || /no longer available/i.test(msg) || /not found/i.test(msg)) {
        return 'skip_model';
    }
    return 'fatal';
}

/** Llama a la API con reintentos (hasta maxRetries) y espera exponencial. */
async function callModelWithRetry(
    genAI: GoogleGenerativeAI,
    modelName: string,
    parts: Array<Record<string, unknown>>,
    pass: number,
    maxRetries = 3,
): Promise<string> {
    const delays = [2000, 5000, 10000];
    let lastErr: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            console.log(`[Gemini] pass=${pass + 1}/2 model=${modelName} attempt=${attempt + 1}`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(parts as never);
            console.log(`[Gemini] pass=${pass + 1}/2 model=${modelName} OK`);
            return result.response.text();
        } catch (err) {
            lastErr = err;
            const kind = classifyError(err);
            const shortMsg = (err as Error)?.message?.slice(0, 120) ?? String(err);
            console.warn(
                `[Gemini] pass=${pass + 1}/2 model=${modelName} attempt=${attempt + 1} failed (${kind}): ${shortMsg}`
            );
            if (kind !== 'retryable') throw err; // 'skip_model' o 'fatal' → propagar
            if (attempt < maxRetries - 1) {
                await new Promise((res) => setTimeout(res, delays[attempt] ?? 2000));
            }
        }
    }
    throw lastErr;
}

/** Prueba cada modelo de la lista. Salta modelos con 404, reintenta los 503. */
async function callGemini(parts: Array<Record<string, unknown>>): Promise<string> {
    const models = getModelList();
    const genAI = getClient();
    const skippedModels = new Set<string>();
    let lastErr: unknown;

    for (let pass = 0; pass < 2; pass++) {
        for (const modelName of models) {
            if (skippedModels.has(modelName)) continue;
            try {
                return await callModelWithRetry(genAI, modelName, parts, pass);
            } catch (err) {
                lastErr = err;
                const kind = classifyError(err);
                if (kind === 'fatal') {
                    console.error(`[Gemini] fatal error on ${modelName}, aborting: ${(err as Error)?.message}`);
                    throw err;
                }
                if (kind === 'skip_model') {
                    skippedModels.add(modelName);
                    console.warn(`[Gemini] pass=${pass + 1}/2 skipping model ${modelName} (not available), trying next`);
                } else {
                    console.warn(`[Gemini] pass=${pass + 1}/2 model ${modelName} exhausted retries, trying next`);
                }
            }
        }
        if (pass === 0) {
            console.warn('[Gemini] pass 1/2 complete, waiting 15s before pass 2/2');
            await new Promise((r) => setTimeout(r, 15000));
        }
    }
    throw new Error(
        `All Gemini models exhausted after 2 passes. Last error: ${(lastErr as Error)?.message}`
    );
}

function serializeModel(model: UMLModel) {
    return {
        classes: model.classes.map((c) => ({
            id: c.id,
            name: c.name,
            kind: c.kind,
            position: c.position,
            attributes: c.attributes.map((a) => ({
                name: a.name,
                type: a.type,
                visibility: a.visibility,
                isPrimaryKey: a.isPrimaryKey,
                isRequired: a.isRequired,
                isUnique: a.isUnique,
            })),
            methods: c.methods.map((m) => ({
                name: m.name,
                returnType: m.returnType,
                parameters: m.parameters,
                visibility: m.visibility,
            })),
        })),
        relations: model.relations.map((r) => ({
            id: r.id,
            kind: r.kind,
            sourceClassId: r.sourceClassId,
            targetClassId: r.targetClassId,
            sourceCardinality: r.sourceCardinality,
            targetCardinality: r.targetCardinality,
            name: r.name,
        })),
    };
}

const SYSTEM_PROMPT = `You are a UML class diagram modeling assistant.

The user will give you an instruction (in Spanish or English) to modify a UML class diagram.

You MUST return ONLY a valid JSON object (no markdown, no explanation, no code fences) with this exact schema:

{
  "classes": [
    {
      "id": "existing id when the class already exists, or a new id like 'class_materia' for new classes",
      "name": "ClassName",
      "kind": "class" | "abstract" | "interface" | "enumeration",
      "position": { "x": <number>, "y": <number> },
      "attributes": [
        {
          "name": "attributeName",
          "type": "String" | "Integer" | "Long" | "Double" | "BigDecimal" | "Boolean" | "LocalDate" | "LocalDateTime" | "UUID",
          "visibility": "public" | "private" | "protected" | "package",
          "isPrimaryKey": <boolean>,
          "isRequired": <boolean>,
          "isUnique": <boolean>
        }
      ],
      "methods": []
    }
  ],
  "relations": [
    {
      "id": "existing id or a fresh id like 'rel_<source>_<target>'",
      "kind": "association" | "aggregation" | "composition" | "inheritance" | "realization" | "dependency",
      "sourceClassId": "id of source class",
      "targetClassId": "id of target class",
      "sourceCardinality": "1" | "0..1" | "1..*" | "0..*" | "*",
      "targetCardinality": "1" | "0..1" | "1..*" | "0..*" | "*"
    }
  ],
  "message": "brief description of what was changed"
}

RULES:
- PRESERVE all existing classes and relations the user did not ask to change. Keep their IDs EXACTLY as given.
- When adding a new class, choose a fresh id like "class_<lowercase_name>".
- When adding a new relation, choose a fresh id like "rel_<source_id>_<target_id>".
- Always include an "id" attribute of type "Long" with "isPrimaryKey": true for concrete classes, unless the class is abstract or an interface.
- Position new classes at reasonable coordinates (multiples of ~50) so they don't overlap existing ones.
- Return ONLY the JSON. Nothing else.`;

function extractJson(text: string): any {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced ? fenced[1] : text;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new ValidationError('Gemini no devolvió JSON válido');
    return JSON.parse(match[0]);
}

function diffToCommands(model: UMLModel, newState: any): UMLCommand[] {
    const commands: UMLCommand[] = [];

    const oldByName = new Map(model.classes.map((c) => [c.name.toLowerCase(), c]));
    const newClasses: any[] = Array.isArray(newState?.classes) ? newState.classes : [];

    // Añadir clases nuevas y atributos nuevos
    for (const nc of newClasses) {
        const existing = oldByName.get(String(nc.name || '').toLowerCase());
        if (!existing) {
            commands.push({
                type: 'add_class',
                name: nc.name,
                kind: (nc.kind as ClassKind) ?? 'class',
                attributes: (nc.attributes ?? []).map((a: any) => ({
                    name: a.name,
                    type: a.type ?? 'String',
                    visibility: (a.visibility as Visibility) ?? 'private',
                    isPrimaryKey: !!a.isPrimaryKey,
                    isRequired: !!a.isRequired,
                    isUnique: !!a.isUnique,
                })),
            });
        } else {
            const existingAttrs = new Set(existing.attributes.map((a) => a.name.toLowerCase()));
            for (const na of nc.attributes ?? []) {
                if (!existingAttrs.has(String(na.name).toLowerCase())) {
                    commands.push({
                        type: 'add_attribute',
                        classId: existing.id,
                        name: na.name,
                        dataType: na.type ?? 'String',
                        isPrimaryKey: !!na.isPrimaryKey,
                        isRequired: !!na.isRequired,
                    });
                }
            }
        }
    }

    // Eliminar clases que desaparecieron
    const newNames = new Set(newClasses.map((c: any) => String(c.name || '').toLowerCase()));
    for (const oc of model.classes) {
        if (!newNames.has(oc.name.toLowerCase())) {
            commands.push({ type: 'delete_class', classId: oc.id });
        }
    }

    // Relaciones
    const newRelations: any[] = Array.isArray(newState?.relations) ? newState.relations : [];
    const oldRelKeys = new Set(
        model.relations.map((r) => `${r.kind}|${r.sourceClassId}|${r.targetClassId}`)
    );
    for (const nr of newRelations) {
        const key = `${nr.kind}|${nr.sourceClassId}|${nr.targetClassId}`;
        if (!oldRelKeys.has(key)) {
            commands.push({
                type: 'add_relation',
                kind: (nr.kind as RelationKind) ?? 'association',
                sourceClass: nr.sourceClassId,
                targetClass: nr.targetClassId,
                sourceCardinality: (nr.sourceCardinality as Cardinality) ?? '1',
                targetCardinality: (nr.targetCardinality as Cardinality) ?? '0..*',
                name: nr.name,
            });
        }
    }

    return commands;
}

export const geminiClient = {
    async modifyFromText(model: UMLModel, prompt: string) {
        const context = JSON.stringify(serializeModel(model), null, 2);
        const fullPrompt = `${SYSTEM_PROMPT}\n\nCURRENT DIAGRAM:\n${context}\n\nUSER INSTRUCTION:\n${prompt}\n\nReturn ONLY the JSON.`;
        const text = await callGemini([{ text: fullPrompt }]);
        const parsed = extractJson(text);
        const commands = diffToCommands(model, parsed);
        return { commands, message: parsed.message || `Generados ${commands.length} cambio(s).` };
    },

    async modifyFromImage(model: UMLModel, imageBase64: string, mimeType: string, userPrompt: string) {
        const context = JSON.stringify(serializeModel(model), null, 2);
        const fullPrompt = `${SYSTEM_PROMPT}\n\nCURRENT DIAGRAM:\n${context}\n\nUSER INSTRUCTION:\n${userPrompt}\n\nAnalyze the attached image (it may contain a UML diagram or a written description) and modify the current diagram accordingly. Return ONLY the JSON.`;
        const text = await callGemini([
            { text: fullPrompt },
            { inlineData: { mimeType, data: imageBase64 } },
        ]);
        const parsed = extractJson(text);
        const commands = diffToCommands(model, parsed);
        return { commands, message: parsed.message || `Generados ${commands.length} cambio(s).` };
    },

    async transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
        const text = await callGemini([
            { text: 'Transcribe exactamente lo que se dice en el audio. Devuelve solo la transcripción en español, sin explicaciones.' },
            { inlineData: { mimeType, data: audioBase64 } },
        ]);
        return text.trim();
    },
};