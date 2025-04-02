import { useLocalSearchParams } from 'expo-router';
import { Button, StyleSheet, Text, View, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Audio } from 'expo-av';

export default function Details() {
  const { title: initialTitle } = useLocalSearchParams();
  const [title, setTitle] = useState(initialTitle || '');
  const [ambiance, setAmbiance] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [ambiances, setAmbiances] = useState<string[]>([]);
  const [voices, setVoices] = useState<{ id: string; displayName: string }[]>([]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function fetchAmbiances() {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch('http://192.168.2.37:3000/ambiances', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setAmbiances(data);
    } catch (error) {
      console.error('Error fetching ambiances:', error);
    }
  }

  async function fetchVoices() {
    try {
      const token = await AsyncStorage.getItem('userToken');
      const response = await fetch('http://192.168.2.37:3000/list-voices', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      const voicesList = [
        ...data.categorizedVoices.male,
        ...data.categorizedVoices.female,
      ];
      setVoices(voicesList);
    } catch (error) {
      console.error('Error fetching voices:', error);
    }
  }

  async function fetchAudio() {
    try {
      setIsLoading(true); // Start loading
      const fileUri = `${FileSystem.documentDirectory}${title}_${ambiance}_${voiceId}.mp3`; // Updated fileUri
      const token = await AsyncStorage.getItem('userToken');

      const response = await fetch('http://192.168.2.37:3000/generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title, ambiance, voiceId }),
      });

      const blob = await response.blob();

      // Convert blob to base64 and save to file
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result?.toString().split(',')[1];
        if (base64Data) {
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          console.log('Audio file saved:', fileUri);
          setAudioUri(fileUri);
        }
      };

      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error fetching audio:', error);
    } finally {
      setIsLoading(false); // Stop loading
    }
  }

  async function playSound() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
      });

      const uri = audioUri || `${FileSystem.documentDirectory}${title}_${ambiance}_${voiceId}.mp3`; // Updated fileUri
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        console.warn('File does not exist:', uri);
        return;
      }

      const { sound } = await Audio.Sound.createAsync({ uri });
      setSound(sound);
      await sound.playAsync();
      console.log('Playing sound...');
    } catch (error: any) {
      console.error('Error playing sound:', error.message);
    }
  }
  
  // function printSelectedValues() {
  //   console.log('Selected Title:', title);
  //   console.log('Selected Ambiance:', ambiance);
  //   console.log('Selected Voice ID:', voiceId);
  // }

  useEffect(() => {
    fetchAmbiances();
    fetchVoices();
  }, []);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch((error) => {
          console.error('Error unloading sound:', error);
        });
      }
    };
  }, [sound]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Meditation Details</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter Title"
        value={title}
        onChangeText={setTitle}
      />

      <Picker
        selectedValue={ambiance}
        onValueChange={(itemValue) => setAmbiance(itemValue)}
        style={styles.picker}
      >
        <Picker.Item label="Select Ambiance" value="" />
        {ambiances.map((amb, index) => (
          <Picker.Item key={index} label={amb} value={amb} />
        ))}
      </Picker>

      <Picker
        selectedValue={voiceId}
        onValueChange={(itemValue) => setVoiceId(itemValue)}
        style={styles.picker}
      >
        <Picker.Item label="Select Voice" value="" />
        {voices.map((voice) => (
          <Picker.Item key={voice.id} label={voice.displayName} value={voice.id} />
        ))}
      </Picker>

      {isLoading ? (
        <ActivityIndicator size="large" color="#1DB954" style={styles.loading} />
      ) : (
        <Button title="Fetch Audio" onPress={fetchAudio} />
      )}
      <View style={{ marginTop: 20 }} />
      <Button title="Play Sound" onPress={playSound} />
      <View style={{ marginTop: 20 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  picker: {
    width: '100%',
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  loading: {
    marginVertical: 20,
  },
});
