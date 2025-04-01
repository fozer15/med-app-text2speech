import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './(auth)/login';
import { auth } from './firebaseConfig';

export default function Index() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/(tabs)');
      } else {
        setCheckingAuth(false);
        router.replace('/login');
      }
    });

  }, []);

  if (checkingAuth) {
    return null; // or <Loading />
  }

  return <Login />;
}
