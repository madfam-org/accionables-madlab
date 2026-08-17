import { FastifyInstance } from 'fastify';
import {
  breakdownRequestSchema,
  draftCommunicationSchema,
  validateRequest,
} from '../schemas/validation.js';
import { verifyJWT } from '../middleware/auth.js';

/**
 * AI Provider Configuration — Selva only.
 *
 * STANDING PROHIBITION 2 (SEPARATION_OF_CONCERNS §5): no direct LLM provider
 * calls; everything routes through Selva's OpenAI-compatible /v1. Until
 * 2026-08-16 this file wired Ollama/Groq/Together directly — a per-repo
 * provider fan-out with per-repo keys is exactly the sprawl the chokepoint
 * exists to prevent (billing, model policy, and audit all live in Selva).
 *
 * 'mock' remains the default so local development needs no key and CI stays
 * hermetic; anything non-mock is Selva or a refusal — there is deliberately
 * no third branch.
 */
type AIProvider = 'selva' | 'mock';

interface AIConfig {
  provider: AIProvider;
  baseUrl?: string;
  apiKey?: string;
  model: string;
}

function getAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER || 'mock') as AIProvider;

  if (provider === 'selva') {
    const baseUrl = process.env.SELVA_BASE_URL || 'https://inference.selva.town/v1';
    const apiKey = process.env.SELVA_API_KEY;
    if (!apiKey) {
      // Fail closed and loud: a Selva selection without a key must never
      // silently fall back to mock output that reads as model output.
      throw new Error('AI_PROVIDER=selva requires SELVA_API_KEY');
    }
    return {
      provider: 'selva',
      baseUrl,
      apiKey,
      model: process.env.SELVA_MODEL || 'selva-default',
    };
  }
  return { provider: 'mock', model: 'mock' };
}

/**
 * Call AI model using OpenAI-compatible API format
 * Works with Ollama, Groq, Together.ai, and other compatible providers
 */
async function callAI(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 4096,
): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number } }> {
  if (config.provider === 'mock') {
    throw new Error('Mock provider - no AI call');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  // Selva is OpenAI-compatible; one endpoint shape, no per-provider forks.
  const endpoint = `${config.baseUrl}/chat/completions`;

  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI API error: ${response.status} - ${error}`);
  }

  // Type for OpenAI-compatible response
  interface AIResponse {
    message?: { content?: string };
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    eval_count?: number;
    prompt_eval_count?: number;
  }

  const data = await response.json() as AIResponse;

  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens || 0,
      completionTokens: data.usage.completion_tokens || 0,
    } : undefined,
  };
}

/**
 * Agent System Prompts
 */
const AGENT_PROMPTS = {
  fragmento: {
    system: `You are Fragmento, a friendly AI assistant specialized in breaking down big goals into manageable tasks for neurodivergent users.

Your personality:
- Encouraging and supportive
- Clear and explicit in your explanations
- You understand executive function challenges
- You avoid overwhelming users with too much at once

When breaking down events into tasks:
1. Work backwards from the event date
2. Create clear, actionable tasks (not vague goals)
3. Estimate realistic hours (account for ND challenges like task initiation)
4. Identify dependencies between tasks
5. Group tasks into logical phases
6. Use simple, concrete language

Output format: Return valid JSON with this structure:
{
  "tasks": [
    {
      "title": "Task title in Spanish",
      "titleEn": "Task title in English",
      "description": "Brief description",
      "estimatedHours": number,
      "difficulty": "easy" | "medium" | "hard" | "expert",
      "phase": number (1-5),
      "section": "Section name",
      "dependencies": ["title of prerequisite task"],
      "daysBeforeEvent": number
    }
  ],
  "phases": [
    {
      "number": 1,
      "name": "Phase name",
      "nameEn": "Phase name in English",
      "description": "What this phase accomplishes"
    }
  ],
  "warnings": ["Any concerns or suggestions"],
  "totalEstimatedHours": number
}`,
  },
  palabras: {
    system: `You are Palabras, a friendly AI assistant that helps neurodivergent users draft communications.

Your personality:
- Neutral and professional
- You understand that writing can cause paralysis for ND folks
- You provide clear templates that users can customize
- You match the requested tone perfectly

Guidelines:
- Keep messages concise but complete
- Use clear structure (greeting, body, closing)
- Avoid ambiguity
- Include all necessary information
- Respect cultural norms for Spanish/English

Output format: Return valid JSON with this structure:
{
  "draft": "The full message text",
  "subject": "Email subject if applicable",
  "keyPoints": ["Main points covered"],
  "alternativeOpenings": ["2-3 alternative first sentences"],
  "tone": "Description of the tone used"
}`,
  },
};

export async function agentRoutes(fastify: FastifyInstance) {
  /**
     * POST /api/agents/breakdown
     * Fragmento agent: Break down an event into tasks
     */
  fastify.post<{ Body: unknown }>(
    '/agents/breakdown',
    { preHandler: verifyJWT },
    async (request, reply) => {
      const validation = validateRequest(breakdownRequestSchema, request.body);
      if (!validation.success) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          details: validation.errors,
        });
      }

      const { eventName, eventDescription, eventDate, eventType, teamSize, constraints, preferences } =
                validation.data;

      const config = getAIConfig();

      if (config.provider === 'mock') {
        return reply.send({
          success: true,
          agent: 'fragmento',
          data: getMockBreakdownResponse({ eventDate }),
          mock: true,
        });
      }

      try {
        const language = preferences?.language || 'es';
        const detailLevel = preferences?.detailLevel || 'moderate';

        const userPrompt = `Break down this event into tasks:

Event: ${eventName}
Description: ${eventDescription}
Date: ${eventDate}
Type: ${eventType}
Team Size: ${teamSize} people
${constraints?.length ? `Constraints:\n${constraints.map((c) => `- ${c}`).join('\n')}` : ''}

Requirements:
- Primary language: ${language === 'es' ? 'Spanish' : 'English'}
- Detail level: ${detailLevel}
- ${preferences?.includeTimeEstimates ? 'Include time estimates' : 'Skip time estimates'}

Please generate a comprehensive task breakdown. Respond with valid JSON only.`;

        const response = await callAI(
          config,
          AGENT_PROMPTS.fragmento.system,
          userPrompt,
          4096,
        );

        let parsedResponse;
        try {
          const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/) ||
                        response.content.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response.content;
          parsedResponse = JSON.parse(jsonStr);
        } catch {
          fastify.log.error('Failed to parse AI response as JSON');
          return reply.code(500).send({
            success: false,
            error: 'Failed to parse AI response',
            rawResponse: response.content,
          });
        }

        return reply.send({
          success: true,
          agent: 'fragmento',
          data: parsedResponse,
          provider: config.provider,
          model: config.model,
          usage: response.usage,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: 'AI agent request failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
     * POST /api/agents/draft
     * Palabras agent: Draft communications
     */
  fastify.post<{ Body: unknown }>(
    '/agents/draft',
    { preHandler: verifyJWT },
    async (request, reply) => {
      const validation = validateRequest(draftCommunicationSchema, request.body);
      if (!validation.success) {
        return reply.code(400).send({
          success: false,
          error: 'Validation failed',
          details: validation.errors,
        });
      }

      const { type, context, recipients, tone, language } = validation.data;

      const config = getAIConfig();

      if (config.provider === 'mock') {
        return reply.send({
          success: true,
          agent: 'palabras',
          data: getMockDraftResponse({ language, context, tone }),
          mock: true,
        });
      }

      try {
        const userPrompt = `Draft a ${type} communication:

Context: ${context}
Recipients: ${recipients.join(', ')}
Tone: ${tone}
Language: ${language === 'es' ? 'Spanish' : 'English'}

Please draft an appropriate message. Respond with valid JSON only.`;

        const response = await callAI(
          config,
          AGENT_PROMPTS.palabras.system,
          userPrompt,
          2048,
        );

        let parsedResponse;
        try {
          const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/) ||
                        response.content.match(/\{[\s\S]*\}/);
          const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response.content;
          parsedResponse = JSON.parse(jsonStr);
        } catch {
          parsedResponse = {
            draft: response.content,
            keyPoints: [],
            tone: tone,
          };
        }

        return reply.send({
          success: true,
          agent: 'palabras',
          data: parsedResponse,
          provider: config.provider,
          model: config.model,
          usage: response.usage,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({
          success: false,
          error: 'AI agent request failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  /**
     * GET /api/agents/status
     * Check agent availability and configuration
     */
  fastify.get('/agents/status', async (_request, reply) => {
    const config = getAIConfig();
    const isAIEnabled = config.provider !== 'mock';

    return reply.send({
      success: true,
      agents: {
        fragmento: {
          available: true,
          aiEnabled: isAIEnabled,
          description: 'Task breakdown agent',
        },
        palabras: {
          available: true,
          aiEnabled: isAIEnabled,
          description: 'Communication drafting agent',
        },
        timely: {
          available: false,
          aiEnabled: false,
          description: 'Reminder agent (coming soon)',
        },
        calma: {
          available: false,
          aiEnabled: false,
          description: 'Overwhelm detection agent (coming soon)',
        },
        enfoque: {
          available: true,
          aiEnabled: false,
          description: 'Focus session agent (client-side only)',
        },
        fiesta: {
          available: true,
          aiEnabled: false,
          description: 'Celebration agent (client-side only)',
        },
      },
      configuration: {
        provider: config.provider,
        model: config.model,
        baseUrl: config.provider !== 'mock' ? config.baseUrl : undefined,
        supportedProviders: ['selva'],
        envVars: {
          AI_PROVIDER: 'selva | mock',
          SELVA_BASE_URL: 'https://inference.selva.town/v1 (default)',
          SELVA_API_KEY: 'required when AI_PROVIDER=selva',
          SELVA_MODEL: 'selva-default (default)',
        },
      },
    });
  });
}

/**
 * Mock responses for development without AI provider
 */
function getMockBreakdownResponse(input: { eventDate: string; eventName?: string }) {
  const daysUntilEvent = Math.ceil(
    (new Date(input.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  return {
    tasks: [
      {
        title: 'Definir objetivos y alcance',
        titleEn: 'Define objectives and scope',
        description: 'Establecer metas claras y definir el alcance del evento',
        estimatedHours: 2,
        difficulty: 'easy',
        phase: 1,
        section: 'Planificación',
        dependencies: [],
        daysBeforeEvent: daysUntilEvent,
      },
      {
        title: 'Crear lista de tareas detallada',
        titleEn: 'Create detailed task list',
        description: 'Desglosar todas las actividades necesarias',
        estimatedHours: 3,
        difficulty: 'medium',
        phase: 1,
        section: 'Planificación',
        dependencies: ['Definir objetivos y alcance'],
        daysBeforeEvent: daysUntilEvent - 2,
      },
      {
        title: 'Asignar responsabilidades',
        titleEn: 'Assign responsibilities',
        description: 'Distribuir tareas entre los miembros del equipo',
        estimatedHours: 2,
        difficulty: 'medium',
        phase: 2,
        section: 'Organización',
        dependencies: ['Crear lista de tareas detallada'],
        daysBeforeEvent: daysUntilEvent - 4,
      },
      {
        title: 'Preparar materiales',
        titleEn: 'Prepare materials',
        description: 'Reunir y preparar todo lo necesario',
        estimatedHours: 5,
        difficulty: 'medium',
        phase: 3,
        section: 'Preparación',
        dependencies: ['Asignar responsabilidades'],
        daysBeforeEvent: Math.floor(daysUntilEvent / 2),
      },
      {
        title: 'Ensayo general',
        titleEn: 'General rehearsal',
        description: 'Practicar y revisar todos los detalles',
        estimatedHours: 4,
        difficulty: 'hard',
        phase: 4,
        section: 'Ejecución',
        dependencies: ['Preparar materiales'],
        daysBeforeEvent: 2,
      },
      {
        title: 'Día del evento',
        titleEn: 'Event day',
        description: 'Ejecutar el plan y disfrutar el momento',
        estimatedHours: 8,
        difficulty: 'hard',
        phase: 5,
        section: 'Ejecución',
        dependencies: ['Ensayo general'],
        daysBeforeEvent: 0,
      },
    ],
    phases: [
      { number: 1, name: 'Planificación', nameEn: 'Planning', description: 'Definir metas y estructura' },
      { number: 2, name: 'Organización', nameEn: 'Organization', description: 'Asignar recursos y roles' },
      { number: 3, name: 'Preparación', nameEn: 'Preparation', description: 'Preparar materiales y logística' },
      { number: 4, name: 'Pre-evento', nameEn: 'Pre-event', description: 'Últimos preparativos y ensayos' },
      { number: 5, name: 'Ejecución', nameEn: 'Execution', description: 'El gran día' },
    ],
    warnings: [
      'Este es un desglose de ejemplo. Configure AI_PROVIDER para obtener un plan personalizado con IA.',
    ],
    totalEstimatedHours: 24,
    mock: true,
  };
}

function getMockDraftResponse(input: { language?: string; context: string; tone?: string }) {
  const isSpanish = input.language === 'es';

  return {
    draft: isSpanish
      ? `Hola equipo,\n\nQuería compartir una actualización sobre ${input.context}.\n\nSaludos`
      : `Hi team,\n\nI wanted to share an update about ${input.context}.\n\nBest regards`,
    subject: isSpanish ? 'Actualización del proyecto' : 'Project Update',
    keyPoints: [
      isSpanish ? 'Contexto proporcionado' : 'Context provided',
      isSpanish ? 'Tono apropiado' : 'Appropriate tone',
    ],
    alternativeOpenings: [
      isSpanish ? 'Espero que estén bien.' : 'Hope you are doing well.',
      isSpanish ? 'Les escribo para informarles...' : 'I am writing to inform you...',
    ],
    tone: input.tone || 'casual',
    mock: true,
  };
}
