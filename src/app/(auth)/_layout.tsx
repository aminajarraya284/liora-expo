import { Redirect, Stack } from 'expo-router';
import { useStore } from '../../store';
import { C } from '../../theme';

export default function AuthLayout() {
  const { user, reduceMotion } = useStore();
  if (user) return <Redirect href="/accueil" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg1 }, animation: reduceMotion ? 'none' : 'default' }} />;
}
