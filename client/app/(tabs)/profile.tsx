import { StyleSheet, Button } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth'; // Import Firebase auth functions
import { auth } from '../firebaseConfig';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export default function ProfileScreen() {
  const router = useRouter();
   // Initialize Firebase auth
  const handleLogout = async () => {
    try {
      await signOut(auth); // Sign out the user
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">User Profile</ThemedText>
      <ThemedText>Name: John Doe</ThemedText>
      <ThemedText>Email: john.doe@example.com</ThemedText>
      <Button title="Logout" onPress={handleLogout} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});
