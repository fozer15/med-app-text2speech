import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, onIdTokenChanged } from 'firebase/auth';
import Login from './(auth)/login';
import { auth } from './firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  useEffect(() => {
    
    onIdTokenChanged(auth, async (user) => {
      try {
        if (user) {
          const token = await user?.getIdToken();
          await AsyncStorage.setItem('userToken', token!);
          router.replace('/(tabs)');
        } else {
          await AsyncStorage.removeItem('userToken');
          setCheckingAuth(false);
          
        }
      } catch (error) {
        console.error('Error in onIdTokenChanged:', error);
      }
    });

  }, []);

  if (checkingAuth) {
    return null; // or <Loading />
  }

  return <Login />;
}
