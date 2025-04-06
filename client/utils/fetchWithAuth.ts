import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../app/firebaseConfig'; // Import the Firebase auth object
import { getIdToken } from 'firebase/auth';

//max retry count logic
export default async function fetchWithAuth(url: string, options: RequestInit = {}, router: any) {
  const makeRequest = async (token: string) => {
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
    return await fetch(url, { ...options, headers });
  };

  try {
    let token = await AsyncStorage.getItem('userToken');
    let response = await makeRequest(token!);
    if (response.status === 401) {
      const currentUser = auth.currentUser;
      if (currentUser && token) {
          token = await getIdToken(currentUser, true); 
          await AsyncStorage.setItem('userToken', token);
          response = await makeRequest(token);
      } else {
          router.replace('/login'); 
          throw new Error('Unauthorized');
      }
    }
    return response;
  } catch (error) {
    console.error('Error in fetchWithAuth:', error);
    throw error;
  }
}
