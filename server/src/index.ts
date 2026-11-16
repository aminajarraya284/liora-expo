import { createServer } from 'node:http';
import { createClient } from './anthropic.ts';
import { createHandler } from './app.ts';
import { ConfigError, loadConfig } from './config.ts';

function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`Configuration invalide : ${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const handle = createHandler({ config, client: createClient(), log: (line) => console.log(`${new Date().toISOString()} ${line}`) });
  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500).end();
    });
  });

  // Délais courts : une connexion lente ou abandonnée ne monopolise pas le serveur.
  server.headersTimeout = 15_000;
  server.requestTimeout = 150_000;
  server.keepAliveTimeout = 5_000;

  server.listen(config.port, config.host, () => {
    console.log(`Relais LIORA à l'écoute sur http://${config.host}:${config.port} (modèle ${config.model}, effort ${config.effort})`);
  });

  const stop = () => server.close(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main();
