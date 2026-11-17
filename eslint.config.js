// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prototypeComponents = [
  'Agenda', 'AssistantVocal', 'BienEtre', 'CoffreFort', 'Dashboard', 'Header',
  'Medications', 'Onboarding', 'Parametres', 'PhysiqueDoux', 'ProcheDashboard',
  'Proches', 'Proteger', 'RadioAudio', 'Urgence',
];

module.exports = defineConfig([
  expoConfig,
  {
    // Le serveur relais a son propre contrôle de types (cd server && npm run typecheck).
    ignores: [
      'dist/**', 'server/**', 'node_modules/**',
      // Les fonctions Deno et le banc SQL Supabase ont leur environnement et leurs tests propres.
      'supabase/**',
      // Ancien prototype Vite, hors de l'application Expo et de ses dépendances.
      'server.ts', 'vite.config.ts', 'src/App.tsx', 'src/main.tsx',
      ...prototypeComponents.map((name) => `src/components/${name}.tsx`),
    ],
  },
  {
    rules: {
      // Aucune donnée personnelle ne doit partir dans les journaux.
      'no-console': 'error',
    },
  },
]);
