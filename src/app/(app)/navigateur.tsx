import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { PrivateBrowser } from '../../features/links/PrivateBrowser';
import { resolveLink } from '../../features/links/resolve';
import { NEWS_SOURCES } from '../../features/news/parse';
import { findNews } from '../../features/news/store';
import { useStore } from '../../store';
import { Btn, Card, Header, Icon, Screen, T, useBack } from '../../ui';

export default function Navigateur() {
  const { lien, actu } = useLocalSearchParams<{ lien?: string; actu?: string }>();
  const { data } = useStore();
  // Un article d'actualité s'ouvre par son identifiant : seule une adresse lue dans un flux vérifié est acceptée.
  const article = findNews(actu);
  const goBack = useBack(actu ? '/actualites' : '/demarches');
  const target = article ? { title: NEWS_SOURCES[article.source].label, url: article.url } : actu ? null : resolveLink(lien, data.links);

  if (!target) {
    return (
      <Screen section="demarches">
        <Header title="Navigateur" fallback="/demarches" />
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="alert-circle-outline" size={48} color="#2A4280" />
          <T v="h3" center style={{ marginTop: 10 }}>Ce lien n’est pas reconnu</T>
          <T center style={{ marginTop: 6, marginBottom: 16 }}>{actu ? 'Ouvrez un article depuis la page « Actualités ».' : 'Ouvrez un site depuis la page « Démarches ».'}</T>
          <Btn label="Retour" icon="chevron-back" onPress={goBack} style={{ alignSelf: 'stretch' }} />
        </Card>
      </Screen>
    );
  }
  return <PrivateBrowser url={target.url} title={target.title} onClose={goBack} />;
}
