import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import {
  ASSISTANT_TOOLS, type AssistantResponse, CONFIDENCE_VALUES, MOOD_VALUES, type MoodScanResponse,
} from '../../shared/assistant-contract.ts';
import type { Config } from './config.ts';
import { ASSISTANT_PROMPT, MOOD_PROMPT } from './prompts.ts';

/**
 * Si le modèle décline une demande pour une raison de sécurité, l'API la
 * relance elle-même sur le modèle de repli qu'elle recommande : un refus à
 * tort ne laisse pas la personne sans réponse.
 */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/** Assez pour la réflexion du modèle et une réponse courte, tout en bornant le coût d'un appel. */
const MAX_TOKENS = 16000;

export function createClient(): Anthropic {
  // Sans argument : la clé est lue dans l'environnement (ANTHROPIC_API_KEY) ou dans le profil « ant auth login ».
  return new Anthropic({ timeout: 120_000, maxRetries: 2 });
}

/** Un tour de conversation : le modèle répond ou demande à l'application d'exécuter des outils. */
export async function runAssistant(client: Anthropic, config: Config, messages: Anthropic.Beta.BetaMessageParam[]): Promise<AssistantResponse> {
  const response = await client.beta.messages.create({
    model: config.model,
    max_tokens: MAX_TOKENS,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: config.effort },
    // Le début de la conversation est identique d'un tour à l'autre : il est mis en cache.
    cache_control: { type: 'ephemeral' },
    system: ASSISTANT_PROMPT,
    tools: [...ASSISTANT_TOOLS],
    messages,
  });
  return { content: response.content, stop_reason: response.stop_reason };
}

const MoodReading = z.object({
  mood: z.enum([...MOOD_VALUES, 'illisible']),
  confidence: z.enum(CONFIDENCE_VALUES),
});

const UNREADABLE: MoodScanResponse = { mood: null, confidence: 'faible' };

/** Propose une humeur à partir d'une photo du visage. La photo n'est ni enregistrée ni journalisée. */
export async function readMood(client: Anthropic, config: Config, jpegBase64: string): Promise<MoodScanResponse> {
  const response = await client.beta.messages.parse({
    model: config.model,
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(MoodReading) },
    system: MOOD_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: jpegBase64 } },
          { type: 'text', text: 'Quelle humeur proposes-tu pour ce visage ?' },
        ],
      },
    ],
  });
  const reading = response.parsed_output;
  // Refus, réponse coupée ou image illisible : l'application laissera la personne choisir elle-même.
  if (response.stop_reason !== 'end_turn' || !reading || reading.mood === 'illisible') return UNREADABLE;
  return { mood: reading.mood, confidence: reading.confidence };
}
