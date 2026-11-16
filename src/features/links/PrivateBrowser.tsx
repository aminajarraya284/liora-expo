import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { Icon } from '../../components/icons';
import { T } from '../../components/text';
import { useDialog } from '../../components/dialog';
import { C, TINTS } from '../../theme';
import { displayHost, parseHttpsUrl } from '../../utils/validation';

/**
 * Navigateur privé intégré (iOS et Android).
 *
 * - Navigation privée : ni historique, ni cookies, ni cache conservés après la fermeture.
 * - Seules les pages https sont chargées ; tout autre type d'adresse est refusé.
 * - L'application ne lit rien de ce qui est affiché ou saisi dans la page.
 * - Le nom du site en cours reste visible en haut, pour repérer un faux site.
 */

const NAVY = TINTS.navy;

/** Adresses internes que le moteur du navigateur charge de lui-même. */
const isInternal = (url: string) => url === 'about:blank' || url.startsWith('about:srcdoc');

export function PrivateBrowser({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  // Le paramètre de type est requis : sans lui, la bibliothèque déclare des propriétés impossibles à satisfaire.
  const web = useRef<WebView<object>>(null);
  const [current, setCurrent] = useState(url);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const host = parseHttpsUrl(current)?.host ?? '';

  const onNavigation = (state: WebViewNavigation) => {
    setCanGoBack(state.canGoBack);
    setCanGoForward(state.canGoForward);
    if (parseHttpsUrl(state.url)) setCurrent(state.url);
  };

  /** Décide, pour chaque adresse demandée par la page, si elle peut être chargée. */
  const allow = (request: ShouldStartLoadRequest): boolean => {
    const target = request.url;
    if (parseHttpsUrl(target) || isInternal(target)) return true;
    // Un numéro de téléphone ou une adresse e-mail : on demande avant de quitter le navigateur.
    if (/^(tel|mailto):/i.test(target) && request.isTopFrame !== false) {
      dialog
        .confirm({ title: 'Quitter le navigateur ?', message: target.startsWith('tel:') ? 'Cette page propose de passer un appel.' : 'Cette page propose d’écrire un e-mail.', ok: 'Continuer' })
        .then((yes) => {
          if (yes) Linking.openURL(target).catch(() => {});
        });
    }
    return false;
  };

  const retry = () => {
    setFailed(false);
    setLoading(true);
    web.current?.reload();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={[st.bar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer le navigateur" style={st.barButton}>
          <Icon name="close" size={26} color="#fff" />
        </Pressable>
        <View style={st.address} accessible accessibilityLabel={`Site affiché : ${displayHost(host)}. Connexion sécurisée.`}>
          <Icon name="lock-closed" size={16} color={NAVY.ink} />
          <T v="bodyBold" c={NAVY.ink} numberOfLines={1} style={{ flex: 1 }}>{displayHost(host) || title}</T>
        </View>
        <Pressable onPress={() => web.current?.reload()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Recharger la page" style={st.barButton}>
          <Icon name="refresh" size={24} color="#fff" />
        </Pressable>
      </View>
      <View style={st.notice}>
        <Icon name="mc:incognito" size={18} color={NAVY.ink} />
        <T v="small" c={NAVY.ink} style={{ flex: 1 }}>Navigation privée : rien n’est conservé à la fermeture.</T>
        {loading && <ActivityIndicator size="small" color={NAVY.ink} />}
      </View>

      {failed ? (
        <View style={st.error}>
          <Icon name="cloud-offline-outline" size={56} color={C.muted} />
          <T v="h3" center style={{ marginTop: 12 }}>La page ne s’affiche pas</T>
          <T center style={{ marginTop: 6 }}>Vérifiez votre connexion à Internet, puis réessayez.</T>
          <Pressable onPress={retry} accessibilityRole="button" style={st.retry}>
            <T v="btn" c="#fff">Réessayer</T>
          </Pressable>
        </View>
      ) : (
        <WebView<object>
          ref={web}
          source={{ uri: url }}
          style={{ flex: 1 }}
          // --- Navigation privée ---
          incognito
          cacheEnabled={false}
          sharedCookiesEnabled={false}
          thirdPartyCookiesEnabled={false}
          saveFormDataDisabled
          // --- Uniquement des pages https ---
          originWhitelist={['https://*']}
          onShouldStartLoadWithRequest={allow}
          mixedContentMode="never"
          // --- La page n'a accès ni aux fichiers, ni à la position, ni à d'autres fenêtres ---
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          geolocationEnabled={false}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          allowsLinkPreview={false}
          webviewDebuggingEnabled={false}
          // --- Nécessaire au fonctionnement des sites (connexion, formulaires) ---
          javaScriptEnabled
          domStorageEnabled
          // --- Confort ---
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          mediaPlaybackRequiresUserAction
          onNavigationStateChange={onNavigation}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setFailed(true);
          }}
          onFileDownload={() => dialog.alert('Téléchargement impossible', 'Le navigateur privé n’enregistre aucun fichier. Utilisez le navigateur de votre téléphone pour télécharger ce document.')}
        />
      )}

      <View style={[st.toolbar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <ToolButton icon="chevron-back" label="Page précédente" disabled={!canGoBack} onPress={() => web.current?.goBack()} />
        <ToolButton icon="chevron-forward" label="Page suivante" disabled={!canGoForward} onPress={() => web.current?.goForward()} />
        <ToolButton icon="close-circle-outline" label="Fermer" onPress={onClose} />
      </View>
    </View>
  );
}

function ToolButton({ icon, label, onPress, disabled }: { icon: string; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} style={[st.tool, disabled && { opacity: 0.35 }]}>
      <Icon name={icon} size={28} color={NAVY.ink} />
      <T v="small" c={NAVY.ink}>{label}</T>
    </Pressable>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 10, backgroundColor: NAVY.btn[1] },
  barButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  address: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, minHeight: 44 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: NAVY.soft, paddingHorizontal: 14, paddingVertical: 8 },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  retry: { marginTop: 20, backgroundColor: NAVY.btn[1], borderRadius: 26, paddingHorizontal: 28, minHeight: 52, justifyContent: 'center' },
  toolbar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: '#fff', paddingTop: 6 },
  tool: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 54, gap: 2 },
});
