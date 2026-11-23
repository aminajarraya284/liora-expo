'use strict';
const byId = (id) => document.getElementById(id);
const pages = ['accueil', 'camille', 'pilote'];
function navigate() {
  const hash = location.hash.slice(1);
  const page = pages.includes(hash) ? hash : 'accueil';
  for (const id of pages) byId(id).hidden = id !== page;
  window.scrollTo(0, 0);
  const title = byId(page).querySelector('h1');
  title.tabIndex = -1;
  title.focus({ preventScroll: true });
}
window.addEventListener('hashchange', navigate);
navigate();

let selectedDocs = [];
let relative = '';
function showState(message, actions, documents = []) {
  byId('prepare').hidden = true;
  byId('scenario').hidden = false;
  byId('state').textContent = message;
  byId('documents').replaceChildren(...documents.map(name => {
    const li = document.createElement('li');
    li.textContent = name;
    return li;
  }));
  byId('controls').replaceChildren(...actions.map(([label, handler], index) => {
    const button = document.createElement('button');
    button.textContent = label;
    button.className = index === 0 ? 'primary' : 'secondary';
    button.onclick = handler;
    return button;
  }));
}
function reset() {
  byId('scenario').hidden = true;
  byId('prepare').hidden = false;
  byId('relative').focus();
}
function finish(message) {
  showState(message, [['Recommencer', reset]]);
}
function grant() {
  showState(relative + ' peut consulter ces documents pendant 24 heures.', [
    ['Révoquer la clé', () => finish('Clé révoquée. Toute nouvelle consultation est bloquée.')],
    ['Simuler la fin des 24 h', () => finish('Le délai est écoulé. L’accès est fermé.')],
  ], selectedDocs);
}
byId('prepare').onsubmit = (event) => {
  event.preventDefault();
  selectedDocs = new FormData(event.target).getAll('doc');
  byId('demo-error').textContent = selectedDocs.length ? '' : 'Choisissez au moins un document fictif.';
  if (!selectedDocs.length) return;
  relative = byId('relative').value;
  showState(relative + ' demande l’accès. Camille a 48 heures pour répondre.', [
    ['Refuser', () => finish('Demande refusée. Les documents restent privés.')],
    ['Autoriser maintenant', grant],
    ['Simuler 48 h sans réponse', grant],
  ]);
};

byId('signup').onsubmit = async (event) => {
  event.preventDefault();
  const button = byId('submit');
  if (button.disabled) return;
  button.disabled = true;
  const feedback = byId('feedback');
  feedback.textContent = 'Envoi en cours…';
  try {
    const response = await fetch(window.pilotConfig.url + '/rest/v1/rpc/liora_request_pilot', {
      method: 'POST', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { apikey: window.pilotConfig.key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_email: byId('email').value.trim(), p_consent: byId('agree').checked }),
    });
    if (!response.ok) throw new Error();
    byId('signup').reset();
    feedback.textContent = 'Merci. Votre demande de participation a été enregistrée.';
  } catch {
    feedback.textContent = 'Envoi impossible pour le moment. Vous pouvez réessayer plus tard.';
  } finally { button.disabled = false; }
};
