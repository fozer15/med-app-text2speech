import { useLocalSearchParams } from 'expo-router';
import { useRouter } from 'expo-router'; // Import useRouter for navigation
import { Button, StyleSheet, Text, View, TextInput, ActivityIndicator, FlatList, Dimensions, Image, TouchableOpacity, Alert, ImageBackground, ScrollView, Modal } from 'react-native'; // Import ScrollView and Modal
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useRef } from 'react'; // Import useRef
import { Audio } from 'expo-av';
import Carousel from 'react-native-reanimated-carousel';
import images from '../../utils/images';
import { MaterialIcons } from '@expo/vector-icons'; // Import icons from Expo
import { counterEvent } from 'react-native/Libraries/Performance/Systrace';
import { LinearGradient } from 'expo-linear-gradient'; // Import LinearGradient
import fetchWithAuth from '../../utils/fetchWithAuth';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function Details() {
  const router = useRouter(); // Initialize router for navigation
  const { title: initialTitle } = useLocalSearchParams();
  const [title, setTitle] = useState(initialTitle || '');
  const [ambiance, setAmbiance] = useState('');
  const [voiceId, setVoiceId] = useState('');
  const [ambiances, setAmbiances] = useState<string[]>([]);
  const [voices, setVoices] = useState<{ id: string; displayName: string; tags?: string[] }[]>([]);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [relatedMeditations, setRelatedMeditations] = useState<string[]>([]);
  const [ambianceItems, setAmbianceItems] = useState(
    ambiances.map((amb) => ({ label: amb, value: amb }))
  );
  const [voiceItems, setVoiceItems] = useState(
    voices.map((voice) => ({ label: voice.displayName, value: voice.id }))
  );
  const [isPageLoading, setIsPageLoading] = useState(true); // New state for page loading
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null); // Track the currently playing file
  const ambianceCarouselRef = useRef<typeof Carousel<{ label: string; value: string; image?: any }> | null>(null); // Ref for ambiance carousel
  const voiceCarouselRef = useRef<typeof Carousel<{ label: string; value: string }> | null>(null); // Ref for voice carousel
  const [isSwiping, setIsSwiping] = useState(false); // Track swiping status
  const [backgroundImage, setBackgroundImage] = useState(images[ambiance]); // Track the current background image
  const [playbackStatus, setPlaybackStatus] = useState<{ positionMillis: number; durationMillis: number } | null>(null); // Track playback status
  const [isModalVisible, setIsModalVisible] = useState(false); // State for modal visibility
  const [selectedVoiceTags, setSelectedVoiceTags] = useState<string[]>([]); // State for selected voice tags
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Track the file being deleted

  async function fetchAmbiances() {
    try {
      const response = await fetchWithAuth('http://192.168.2.37:3000/ambiances', {}, router);
      const data = await response.json();
      setAmbiances(data);
    } catch (error) {
      console.error('Error fetching ambiances:', error);
    }
  }

  async function fetchVoices() {
    try {
      const response = await fetchWithAuth('http://192.168.2.37:3000/list-voices', {}, router);
      const data = await response.json();
      const voicesList = [
        ...data.categorizedVoices.male,
        ...data.categorizedVoices.female,
      ].map((voice) => ({
        ...voice,
        tags: voice.tags
          ?.filter((tag) => tag.startsWith('timbre:') || tag.startsWith('accent:'))
          .map((tag) => tag.split(':')[1]), // Keep only the part after ":"
      }));
      setVoices(voicesList);
    } catch (error) {
      console.error('Error fetching voices:', error);
    }
  }

  async function fetchAudio() {
    try {
      setIsLoading(true); // Start loading
      const fileUri = `${FileSystem.documentDirectory}${title}_${ambiance}_${voiceId}.mp3`;
      const body = JSON.stringify({ title, ambiance, voiceId });

      const response = await fetchWithAuth(
        'http://192.168.2.37:3000/generate-audio',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
        router
      );

      const blob = await response.blob();

      // Convert blob to base64 and save to file
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result?.toString().split(',')[1];
        if (base64Data) {
          await FileSystem.writeAsStringAsync(fileUri, base64Data, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await fetchRelatedMeditations(); // refresh the states after writing the file
        }
      };
      reader.readAsDataURL(blob); //starts reading the blob asyncly
    } catch (error) {
      console.error('Error fetching audio:', error);
    } finally {
      setIsLoading(false); // Stop loading
    }
  }

  async function togglePlayPause(fileUri: string) {
    try {
      if (currentlyPlaying === fileUri) {
        // Pause the currently playing sound
        if (sound) {
          const status = await sound.getStatusAsync();
          if (status.isLoaded) {
            await sound.pauseAsync();
            setPlaybackStatus({
              positionMillis: status.positionMillis || 0,
              durationMillis: status.durationMillis || 0,
            }); // Save the current playback position
          }
          setCurrentlyPlaying(null); // Ensure currentlyPlaying is set to null
        }
      } else {
        // Play the selected sound
        if (sound) {
          await sound.unloadAsync();
        }
        const { sound: newSound } = await Audio.Sound.createAsync({ uri: fileUri });
        setSound(newSound);
        setCurrentlyPlaying(fileUri);

        // Listen to playback status updates
        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            setPlaybackStatus({
              positionMillis: status.positionMillis || 0,
              durationMillis: status.durationMillis || 0,
            });
          }
        });

        // Resume from the last saved position if available
        if (playbackStatus?.positionMillis) {
          await newSound.playFromPositionAsync(playbackStatus.positionMillis);
        } else {
          await newSound.playAsync();
        }
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
    }
  }

  async function seekToPosition(positionMillis: number) {
    if (sound && currentlyPlaying) {
      try {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          await sound.setPositionAsync(positionMillis);
        } else {
          console.error('Error seeking to position: Sound is not loaded.');
        }
      } catch (error) {
        console.error('Error seeking to position:', error);
      }
    }
  }

  async function fetchRelatedMeditations() {
    try {
      const directoryUri = FileSystem.documentDirectory || '';
      const files = await FileSystem.readDirectoryAsync(directoryUri);
      const filteredFiles = files.filter((file) => {
        const [fileTitle] = file.split('_'); // Extract title from file name
        return fileTitle === title;
      });
      setRelatedMeditations(filteredFiles);
    } catch (error) {
      console.error('Error fetching related meditations:', error);
    }
  }

  async function deleteFile(fileUri: string) {
    try {
      setIsDeleting(fileUri); // Start loading for the specific file
      // Extract parameters from fileUri
      const fileName = fileUri.split('/').pop() || '';
      const [fileTitle, fileAmbiance, fileVoiceIdWithExtension] = fileName.split('_');
      const fileVoiceId = fileVoiceIdWithExtension.replace('.mp3', '');

      const body = JSON.stringify({ title: fileTitle, ambiance: fileAmbiance, voiceId: fileVoiceId });

      // Make a request to the /remove-file endpoint
      await fetchWithAuth(
        'http://192.168.2.37:3000/remove-file',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body },
        router
      );

      await FileSystem.deleteAsync(fileUri); // Delete the file locally
      console.log(`Deleted file: ${fileUri}`);
      await fetchRelatedMeditations(); // Refresh the playlist
    } catch (error) {
      console.error('Error deleting file:', error);
    } finally {
      setIsDeleting(null); // Stop loading
    }
  }

  useEffect(() => {
    async function fetchDetails() {
      try {
        await Promise.all([fetchAmbiances(), fetchVoices(), fetchRelatedMeditations()]);
      } catch (error) {
        console.error('Error fetching details:', error);
      } finally {
        setIsPageLoading(false); // Set loading to false after all data is fetched
      }
    }

    fetchDetails();
  }, [title]);

  useEffect(() => {
    if (ambiances.length > 0) {
      setAmbiance(ambiances[0]); // Set the first ambiance as the default
    }
  }, [ambiances]);

  useEffect(() => {
    if (voices.length > 0) {
      setVoiceId(voices[0].id); // Set the first voice ID as the default
    }
  }, [voices]);

  useEffect(() => {
    setAmbianceItems(
      ambiances.map((amb) => ({
        label: amb,
        value: amb,
        image: images[amb], // Directly reference the image path
      }))
    );
  }, [ambiances]);

  useEffect(() => {
    setVoiceItems(voices.map((voice) => ({ label: voice.displayName, value: voice.id })));
  }, [voices]);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync().catch((error) => {
          console.error('Error unloading sound:', error);
        });
      }
    };
  }, [sound]);

  useEffect(() => {
    setBackgroundImage(images[ambiance]); // Directly update the background image without animation
  }, [ambiance]); // Run this effect whenever the ambiance changes

  const formatTime = (millis: number) => {
    const minutes = Math.floor(millis / 60000);
    const seconds = Math.floor((millis % 60000) / 1000);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const renderCarouselItem = ({ item }: { item: { label: string; value: string; image: any } }) => (
    <View style={styles.carouselItem}>
      <Image source={item.image} style={styles.carouselImage} />
      <Text style={styles.carouselText}>
        {item.label.charAt(0).toUpperCase() + item.label.slice(1)} {/* Capitalize the first letter */}
      </Text>
    </View>
  );

  const renderVoiceCarouselItem = ({ item }: { item: { label: string; value: string; tags: string[] } }) => (
    <View style={[styles.carouselItem, { height: screenHeight * 0.07, justifyContent:'center', paddingBottom: 0, width:'47%'}]}>
      <Text style={styles.carouselText}>{item.label}</Text>
      <TouchableOpacity
        style={styles.infoButton}
        onPress={() => {
          setSelectedVoiceTags(item.tags);
          setIsModalVisible(true);
        }}
      >
        <MaterialIcons name="info" size={23} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderCreatedMeditationItem = ({ item }: { item: string }) => {
    const fileUri = `${FileSystem.documentDirectory}${item}`;
    const isPlaying = currentlyPlaying === fileUri;
    const progress =
      isPlaying && playbackStatus
        ? playbackStatus.positionMillis / playbackStatus.durationMillis
        : 0;

    return (
      <View style={styles.playlistItem} key={item}>
        <View style={styles.songInfo}>
          <Text style={styles.playlistText}>
            {item?.split('_')[1].charAt(0).toUpperCase() + item?.split('_')[1].slice(1).toLowerCase() + " &" + " " + item?.split('_')[2].charAt(0).toUpperCase() + item?.split('_')[2].slice(1).toLowerCase().replace(".mp3", "")}
          </Text>
          <Text style={styles.timerText}>
            {isPlaying && playbackStatus
              ? `${formatTime(playbackStatus.positionMillis)} / ${formatTime(playbackStatus.durationMillis)}`
              : '0:00 / 0:00'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.progressBarContainer}
          activeOpacity={1}
        >
          <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
        </TouchableOpacity>
        <View style={styles.actionButtons}>
          <TouchableOpacity onPress={() => togglePlayPause(fileUri)}>
            <Image
              source={
                isPlaying
                  ? images['pause'] // Use custom pause icon
                  : images['play'] // Use custom play icon
              }
              style={{ width: 26, height: 26, tintColor: '#fff' }} // Set color to white
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deleteFile(fileUri)} disabled={isDeleting === fileUri}>
            {isDeleting === fileUri ? (
              <ActivityIndicator size="small" color="#FF6347" />
            ) : (
              <MaterialIcons name="delete" size={24} color="#FF6347" style={styles.deleteIcon} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );};

  const handleAmbianceScroll = (direction: 'left' | 'right') => {
      if (ambianceCarouselRef.current) {
        setIsSwiping(true); // Start swiping
        if (direction === 'left') {
          ambianceCarouselRef.current.scrollTo({ count: -1, animated: true });
        } else {
          ambianceCarouselRef.current.scrollTo({ count: 1, animated: true });
        }
        setTimeout(() => setIsSwiping(false), 500); // End swiping after animation
      }
  };

  const handleVoiceScroll = (direction: 'left' | 'right') => {
    if (voiceCarouselRef.current) {
      setIsSwiping(true); // Start swiping
      if (direction === 'left') {
        voiceCarouselRef.current.scrollTo({ count: -1, animated: true });
      } else {
        voiceCarouselRef.current.scrollTo({ count: 1, animated: true });
      }
      setTimeout(() => setIsSwiping(false), 500); // End swiping after animation
    }
  };

  if (isPageLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ffff" />
        <Text style={styles.loadingText}>Loading details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.backgroundContainer}>
        <ImageBackground
          source={backgroundImage} // Use the updated background image
          style={styles.backgroundImage}
          blurRadius={15} // Keep the blur effect
        />
      </View>
      <LinearGradient
        colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.7)']} // Transition from transparent to black
        style={styles.fullScreenGradient} // Updated style to cover the whole screen
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={[styles.title, {marginBottom:"7%"}]}>{title}</Text>
          <View style={styles.pickerGroup}>
            <View style={styles.shadowedTitleContainer}>
              <Text style={styles.shadowedTitle}>Choose Your Ambiance</Text>
            </View>
            <View style={styles.carouselContainer}>
              <MaterialIcons
                name="chevron-left"
                size={37}
                style={[styles.carouselIcon, styles.carouselIconLeft]}
                onPress={() => handleAmbianceScroll('left')}
              />
              <Carousel
                ref={ambianceCarouselRef}
                loop
                width={screenWidth}
                height={screenHeight * 0.28}
                autoPlay={false}
                data={ambianceItems}
                renderItem={renderCarouselItem}
                onSnapToItem={(index) => setAmbiance(ambianceItems[index].value)}
              />
              <MaterialIcons
                name="chevron-right"
                size={37}
                style={[styles.carouselIcon, styles.carouselIconRight]}
                onPress={() => handleAmbianceScroll('right')}
              />
            </View>
          </View>

          <View style={[styles.pickerGroup, { marginTop: '5%', height: '12%' }]}>
            <View style={styles.shadowedTitleContainer}>
              <Text style={styles.shadowedTitle}>Choose Your Meditator</Text>
            </View>
            <View style={styles.carouselContainer}>
              <MaterialIcons
                name="chevron-left"
                size={37}
                style={[styles.carouselIcon, styles.carouselIconLeft, { top: '25%'}]}
                onPress={() => handleVoiceScroll('left')}
              />
              <Carousel
                ref={voiceCarouselRef}
                width={screenWidth}
                height={screenHeight * 0.07}
                autoPlay={false}
                data={voiceItems.map((voice) => ({
                  ...voice,
                  tags: voices.find((v) => v.id === voice.value)?.tags || [],
                }))}
                renderItem={renderVoiceCarouselItem}
                onSnapToItem={(index) => setVoiceId(voiceItems[index].value)}
              />
              <MaterialIcons
                name="chevron-right"
                size={37}
                style={[styles.carouselIcon, styles.carouselIconRight, { top: '25%' }]}
                onPress={() => handleVoiceScroll('right')}
              />
            </View>
          </View>

          {isLoading ? (
            <ActivityIndicator size="large" color="#1DB954" style={styles.loading} />
          ) : (
            <TouchableOpacity
              style={[styles.createButton, isSwiping && { opacity: 0.5 }]} // Dim button when disabled
              onPress={fetchAudio}
              disabled={isSwiping} // Disable button while swiping
            >
              <MaterialIcons name="add-circle-outline" size={24} color="#fff" />
              <Text style={styles.createButtonText}>Create Your Meditation</Text>
            </TouchableOpacity>
          )}
          <View style={{ marginTop: 20 }} />

          <Text style={[styles.title, { marginBottom: 18, marginTop: 13 }]}>
            My Meditation Playlist{' '}
          </Text>
          {relatedMeditations.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#fff', fontSize: 16, marginTop: 5 }}>
              (No meditations created yet)
            </Text>
          )}
          {relatedMeditations.map((item, index) => (
            <View key={index}>{renderCreatedMeditationItem({ item })}</View>
          ))}
        </ScrollView>
      </LinearGradient>
      <Modal
        visible={isModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Voice Tags</Text>
            {selectedVoiceTags.length > 0 ? (
              selectedVoiceTags.map((tag, index) => (
                <Text key={index} style={styles.modalTag}>
                  {tag}
                </Text>
              ))
            ) : (
              <Text style={styles.modalTag}>No tags available</Text>
            )}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: 'none', // Forest green background
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    alignSelf: 'center',
    padding: 10,
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 20,
  },
  dropdown: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 30,
    height: 40,
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderColor: '#ccc',
  },
  loading: {
    marginVertical: 20,
  },
  relatedContainer: {
    marginTop: 20,
    width: '100%',
    backgroundColor: '#1E1E1E',
    padding: 10,
    borderRadius: 5,
  },
  relatedItem: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
  },
  label: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    width: '100%',
  },
  carouselItem: {
    backgroundColor: 'none',
    width: '94%', // Ensure consistent width
    alignSelf: 'center', // Center the item in the carousel
    alignItems: 'center',
    borderRadius: 10,
  },
  carouselImage: {
    width: '100%',
    height: '85%', // Adjusted height for better visibility
    marginBottom: 10,
    borderRadius: 10,
    resizeMode: 'cover', // Ensures the image covers the area while maintaining aspect ratio
  },
  carouselText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#228B22', // Forest green background
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 10,
  },
  pickerGroup: {
    marginBottom: 0, // Added margin for spacing between picker groups
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center', // Ensure vertical centering
  },
  playlistItem: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop:15,
    paddingBottom:12,
    paddingLeft:20,
    paddingRight:20,
    borderRadius: 20,
    width: '90%',
    alignSelf: 'center',
    marginBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Subtle background for better visibility
    shadowColor: '#000', // Shadow color for iOS
    shadowOffset: { width: 0, height: 2 }, // Shadow offset for iOS
    shadowOpacity: 0.2, // Shadow opacity for iOS
    shadowRadius: 3, // Shadow radius for iOS
    elevation: 5, // Shadow for Android
  },
  songInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 5,
  },
  playlistText: {
    color: '#fff', // Keep text color white for visibility
    fontSize: 16,
    flex: 1,
  },
  timerText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'right',
  },
  progressBarContainer: {
    width: '100%',
    height: 10, // Increased height for better touch accessibility
    backgroundColor: 'rgba(255, 255, 255, 0.3)', // Background for the progress bar
    borderRadius: 5, // Adjusted border radius for the new height
    overflow: 'hidden',
    marginVertical: 10, // Increased margin for better spacing
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1DB954', // Spotify green for the progress bar
  },
  carouselContainer: {
    alignItems: 'center',
    justifyContent: 'center', // Center the carousel vertically
    width: '100%',
    marginTop: 5,
    padding: 0,
    position: 'relative', // Allow absolute positioning for icons
  },
  carouselIcon: {
    position: 'absolute', // Position the icons absolutely
    zIndex: 1, // Ensure icons are above the carousel
    top: '38%', // Vertically center the icons
    transform: [{ translateY: -15 }], // Adjust for icon size
    color: '#fff',
  },
  carouselIconLeft: {
    left: 15, // Position the left icon
  },
  carouselIconRight: {
    right: 15, // Position the right icon
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#367588', // Spotify green for a vibrant button
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: "7%",
    width: '70%', // Adjusted width for better visibility
    alignSelf: 'center', // Center the button
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10, // Space between icon and text
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject, // Ensure the background covers the entire screen
    zIndex: -1, // Place the background behind other content
  },
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover', // Ensure the image covers the entire screen
  },
  gradientOverlay: {
    flex: 1,
    justifyContent: 'center',
  },
  animatedBackground: {
    flex: 1,
  },
  fullScreenGradient: {
    ...StyleSheet.absoluteFillObject, // Ensure the gradient covers the entire screen
  },
  scrollContainer: {
    flexGrow: 1,
    paddingTop: 20, // Add padding to the top of the page
    paddingBottom:60, // Add padding to the bottom of the page
  },
  shadowedTitleContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)', // Semi-transparent black background
    borderRadius: 50, // Circular shape
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 10,
    shadowColor: '#000', // Shadow color
    shadowOffset: { width: 0, height: 2 }, // Shadow offset
    shadowOpacity: 0.3, // Shadow opacity
    shadowRadius: 4, // Shadow radius
    elevation: 5, // Shadow for Android
  },
  shadowedTitle: {
    color: '#fff', // White text color
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    paddingHorizontal:2,
  },
  deleteIcon: {
    marginLeft: 10,
  },
  infoButton: {
    position: 'absolute',
    right: 10,
    top: '40%',
    transform: [{ translateY: -10 }],
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    padding: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalTag: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  modalCloseButton: {
    marginTop: 15,
    backgroundColor: '#367588',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
