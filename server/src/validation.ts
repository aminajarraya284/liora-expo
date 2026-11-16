import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { LIMITS } from '../../shared/assistant-contract.ts';

/**
 * Vérification de tout ce que l'application envoie. Le serveur ne fait
 * confiance à rien de ce qu'il reçoit : forme, taille et contenu sont contrôlés.
 */

/** Blocs que l'application a le droit de mettre dans un message « utilisateur ». */
const USER_BLOCKS = ['text', 'tool_result'];

/** Un bloc de contenu. Les blocs du modèle sont renvoyés tels quels : on vérifie seulement qu'ils ont un type. */
const Block = z.looseObject({ type: z.string().min(1).max(64) });

const Message = z.strictObject({
  role: z.enum(['user', 'assistant']),
  content: z.array(Block).min(1).max(64),
});

const Conversation = z
  .strictObject({ messages: z.array(Message).min(1).max(LIMITS.maxMessages) })
  .superRefine(({ messages }, ctx) => {
    if (messages.length === 0) return; // déjà signalé par la règle de longueur
    if (messages[0].role !== 'user') ctx.addIssue({ code: 'custom', message: 'La conversation doit commencer par un message de la personne.' });
    if (messages[messages.length - 1].role !== 'user') ctx.addIssue({ code: 'custom', message: 'Le dernier message doit venir de la personne.' });
    for (const message of messages) {
      if (message.role === 'user' && message.content.some((block) => !USER_BLOCKS.includes(block.type))) {
        ctx.addIssue({ code: 'custom', message: 'Type de contenu non autorisé dans un message de la personne.' });
      }
    }
  });

const JPEG_BASE64_PREFIX = '/9j/';

const MoodScan = z.strictObject({
  image: z
    .string()
    .min(1000)
    .max(LIMITS.maxImageBase64)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/)
    .refine((value) => value.startsWith(JPEG_BASE64_PREFIX), 'La photo doit être au format JPEG.'),
});

export class ValidationError extends Error {}

export function parseConversation(body: unknown): Anthropic.Beta.BetaMessageParam[] {
  const result = Conversation.safeParse(body);
  if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? 'Requête invalide.');
  // La forme est vérifiée ci-dessus ; le détail des blocs est contrôlé par l'API elle-même.
  return result.data.messages as Anthropic.Beta.BetaMessageParam[];
}

export function parseMoodScan(body: unknown): string {
  const result = MoodScan.safeParse(body);
  if (!result.success) throw new ValidationError(result.error.issues[0]?.message ?? 'Requête invalide.');
  return result.data.image;
}
