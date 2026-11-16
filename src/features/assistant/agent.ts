import type Anthropic from '@anthropic-ai/sdk';
import { type AssistantResponse, LIMITS } from '../../../shared/assistant-contract';

/**
 * Boucle de l'assistant : un « tour » part d'un message de la personne et se
 * termine quand le modèle a répondu. Entre les deux, le modèle peut demander
 * plusieurs fois à l'application d'exécuter des outils (lire l'agenda,
 * ajouter un rendez-vous…).
 *
 * La boucle tourne dans l'application, et non sur le serveur, parce que les
 * données sur lesquelles agissent les outils sont sur le téléphone.
 *
 * Règle d'or : la conversation n'est jamais retouchée. Les blocs renvoyés par
 * le modèle sont rangés tels quels et renvoyés tels quels au tour suivant.
 */

export type Message = Anthropic.Beta.BetaMessageParam;
type Block = Anthropic.Beta.BetaContentBlock;
type ToolUse = Anthropic.Beta.BetaToolUseBlock;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

export type ToolOutcome = {
  /** Texte renvoyé au modèle. */
  result: string;
  /** Faux si l'outil a échoué (arguments invalides, élément introuvable…). */
  ok: boolean;
  /** Phrase courte montrée dans la conversation (« Rendez-vous ajouté… »). Absente pour une simple lecture. */
  summary?: string;
};

/**
 * Issue d'un tour :
 * - done      : le modèle a répondu ;
 * - refused   : la demande a été déclinée pour une raison de sécurité ;
 * - truncated : la réponse a été coupée avant la fin ;
 * - too_long  : trop d'allers-retours d'outils pour une seule demande.
 */
export type TurnEnd = 'done' | 'refused' | 'truncated' | 'too_long';

export type TurnResult = {
  /** Conversation à garder pour la suite. C'est celle d'avant le tour si celui-ci n'a pas abouti. */
  messages: Message[];
  reply: string;
  end: TurnEnd;
};

export type TurnOptions = {
  history: Message[];
  /** Ligne de contexte ajoutée par l'application : date, heure, prénom. */
  context: string;
  userText: string;
  send: (messages: Message[]) => Promise<AssistantResponse>;
  runTool: (name: string, input: unknown) => Promise<ToolOutcome>;
  /** Appelé après chaque action visible, pour l'afficher sans attendre la fin du tour. */
  onAction?: (summary: string, ok: boolean) => void;
};

const textOf = (content: Block[]): string =>
  content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n\n');

export async function runTurn({ history, context, userText, send, runTool, onAction }: TurnOptions): Promise<TurnResult> {
  const abandoned = (end: TurnEnd): TurnResult => ({ messages: history, reply: '', end });
  const messages: Message[] = [
    ...history,
    { role: 'user', content: [{ type: 'text', text: context }, { type: 'text', text: userText }] },
  ];

  for (let round = 0; round <= LIMITS.maxToolRounds; round++) {
    const response = await send(messages);
    const content = response.content as Block[];
    const calls = content.filter((block): block is ToolUse => block.type === 'tool_use');

    if (response.stop_reason === 'refusal') return abandoned('refused');
    // Une réponse coupée peut contenir un appel d'outil incomplet : on ne l'exécute jamais.
    if (response.stop_reason === 'max_tokens' && calls.length > 0) return abandoned('truncated');

    messages.push({ role: 'assistant', content });

    // Le serveur a suspendu un long traitement : on renvoie la conversation pour qu'il le reprenne.
    if (response.stop_reason === 'pause_turn') continue;
    if (calls.length === 0) return { messages, reply: textOf(content), end: response.stop_reason === 'max_tokens' ? 'truncated' : 'done' };

    // Tous les résultats d'un même message du modèle repartent ensemble, dans un seul message.
    const results: ToolResult[] = [];
    for (const call of calls) {
      const outcome = await runTool(call.name, call.input).catch((): ToolOutcome => ({ ok: false, result: 'Erreur de l’application pendant cette action.' }));
      if (outcome.summary) onAction?.(outcome.summary, outcome.ok);
      results.push({ type: 'tool_result', tool_use_id: call.id, content: outcome.result, ...(outcome.ok ? {} : { is_error: true }) });
    }
    messages.push({ role: 'user', content: results });
  }
  return abandoned('too_long');
}

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Ligne de contexte placée en tête de chaque message : le modèle sait ainsi quel jour et quelle heure il est. */
export function contextLine(now: Date, isoDate: string, time: string, firstName: string): string {
  const name = firstName.trim() ? `, prénom : ${firstName.trim()}` : '';
  return `[Contexte ajouté par l’application — date : ${DAYS[now.getDay()]} ${isoDate}, heure : ${time}${name}]`;
}
