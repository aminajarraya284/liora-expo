import { Redirect } from 'expo-router';
import { useStore } from '../store';

export default function Index() {
  const { user } = useStore();
  return <Redirect href={user ? '/accueil' : '/login'} />;
}
