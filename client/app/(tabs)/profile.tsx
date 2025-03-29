import { StyleSheet, Button } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">User Profile</ThemedText>
      <ThemedText>Name: John Doe</ThemedText>
      <ThemedText>Email: john.doe@example.com</ThemedText>
      <Button title="Logout" onPress={() => router.replace('/login')} />
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
