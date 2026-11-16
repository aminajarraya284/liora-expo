import type { PropertySchema, ToolSpec } from '../../../shared/assistant-contract';

/**
 * Vérifie les arguments qu'un outil reçoit du modèle, d'après sa définition.
 * Le serveur demande déjà au modèle de respecter le schéma ; l'application
 * revérifie, car elle n'exécute jamais une action sur la foi de ce qui
 * arrive du réseau.
 *
 * Renvoie un message d'erreur, ou null si les arguments conviennent.
 */
export function checkToolInput(spec: ToolSpec, input: unknown): string | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return 'Les arguments doivent être un objet.';
  const values = input as Record<string, unknown>;
  const { properties, required } = spec.input_schema;
  for (const key of Object.keys(values)) if (!(key in properties)) return `Argument inconnu : ${key}.`;
  for (const key of required) if (!(key in values)) return `Argument manquant : ${key}.`;
  for (const [key, schema] of Object.entries(properties)) {
    const problem = checkValue(schema, values[key]);
    if (problem) return `Argument « ${key} » invalide : ${problem}`;
  }
  return null;
}

function checkValue(schema: PropertySchema, value: unknown): string | null {
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') return 'un texte est attendu.';
      if (schema.enum && !schema.enum.includes(value)) return `valeurs possibles : ${schema.enum.join(', ')}.`;
      return null;
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) return 'un nombre entier est attendu.';
      if (!schema.enum.includes(value)) return `valeurs possibles : ${schema.enum.join(', ')}.`;
      return null;
    case 'boolean':
      return typeof value === 'boolean' ? null : 'true ou false est attendu.';
    case 'array':
      return Array.isArray(value) && value.every((item) => typeof item === 'string') ? null : 'une liste de textes est attendue.';
  }
}
