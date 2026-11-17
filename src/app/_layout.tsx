import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { RadioProvider } from '../features/radio/RadioProvider';
import { StoreProvider, useStore } from '../store';
import { C } from '../theme';
import { DialogProvider, SideMenuProvider } from '../ui';

function Root() {
  const { ready, reduceMotion, storageError, retrySave, user, accountMode, cloudAvailable } = useStore();
  const [fontsLoaded, fontError] = useFonts({ Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold });

  // Sur iPhone, le contenu est flouté dans le sélecteur d'applications : les données de santé n'y apparaissent pas.
  useEffect(() => {
    if (Platform.OS === 'ios') ScreenCapture.enableAppSwitcherProtectionAsync(0.8).catch(() => {});
  }, []);

  if (!ready || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg1 }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }
  return (
    <DialogProvider>
      <StatusBar style="dark" />
      <SideMenuProvider>
        <View style={{ flex: 1 }}>
          {(Platform.OS === 'web' || storageError || (cloudAvailable && accountMode === 'cloud')) && (
            <SafeAreaView edges={['top']} style={{ backgroundColor: C.ivory, paddingHorizontal: 20, paddingBottom: 10 }}>
              {Platform.OS === 'web' && <Text style={{ color: C.title, paddingTop: 10 }}>Aperçu web : données fictives uniquement. La copie locale et la connexion sont oubliées au rechargement.</Text>}
              {cloudAvailable && accountMode === 'cloud' && <Text style={{ color: C.title, paddingTop: 10 }}>Essai en ligne : données fictives uniquement. Les informations synchronisées restent dans votre compte en ligne.</Text>}
              {!!storageError && <Text accessibilityRole="alert" style={{ color: C.danger, paddingTop: 10 }}>{storageError}</Text>}
              {!!storageError && !!user && <Pressable accessibilityRole="button" onPress={retrySave} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: C.primary, fontWeight: 'bold' }}>Réessayer la sauvegarde</Text></Pressable>}
            </SafeAreaView>
          )}
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg1 }, animation: reduceMotion ? 'none' : 'default' }} />
        </View>
      </SideMenuProvider>
    </DialogProvider>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <RadioProvider>
          <Root />
        </RadioProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
