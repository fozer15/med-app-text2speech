import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import Login from './(auth)/login';
import { auth } from './firebaseConfig';

export default function Index() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userFound, setUserFound] = useState(false);
  
  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserFound(true);
        router.replace('/(tabs)');
      } else {
        setUserFound(false);
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
