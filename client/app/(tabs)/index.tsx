import { StyleSheet, Button, FlatList, ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';

export default function Home() {
  const router = useRouter();
  const [titles, setTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  useEffect(() => {
    const fetchMeditationTitles = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (!token) {
          console.error('No token found');
          setLoading(false);
          return;
        }

        const response = await fetch('http://192.168.2.37:3000/meditation-titles', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        setTitles(data.titles || []);
      } catch (error) {
        console.error('Error fetching meditation titles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMeditationTitles();
  }, []);

  return (
    <ThemedView style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <View style={{ flex: 1, width: '100%' }}>
          <FlatList
            data={titles}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => router.push(`/details/${encodeURIComponent(item)}`)}
                style={styles.button}
              >
                <ThemedText style={styles.buttonText}>{item}</ThemedText>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
    paddingTop: '20%',
  },
  button: {
    backgroundColor: '#007BFF',
    padding: 10,
    borderRadius: 5,
    marginVertical: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
