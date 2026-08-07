import React, { useState, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Animated,
  Alert,
  Image,
  Modal,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Message {
  id: string;
  text: string;
  sender: "user" | "arin";
  timestamp: string;
  imageUri?: string;
}

interface SelectedImage {
  uri: string;
  base64?: string;
  mimeType: string;
}

export default function HomeScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "नमस्ते! मैं ARIN हूँ। मैं पाठ (Text), आवाज़ (Voice) और तस्वीरों (Images/Screenshots) का विश्लेषण कर सकता हूँ। मैं आपकी क्या सहायता करूँ?",
      sender: "arin",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Camera Modal States
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const cameraRef = useRef<CameraView>(null);

  const flatListRef = useRef<FlatList>(null);
  const latestTranscriptRef = useRef("");

  // Animated values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const speakWaveAnim = useRef(new Animated.Value(1)).current;
  const visionPulseAnim = useRef(new Animated.Value(0.8)).current;

  // Listening Animation (Pulsing Mic)
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isListening) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.35,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [isListening, pulseAnim]);

  // Speaking Animation (Wave Pulse)
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isSpeaking) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(speakWaveAnim, {
            toValue: 1.25,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(speakWaveAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      speakWaveAnim.setValue(1);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [isSpeaking, speakWaveAnim]);

  // Loading / Vision Analysis Pulse Animation
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (isLoading) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(visionPulseAnim, {
            toValue: 1.1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(visionPulseAnim, {
            toValue: 0.8,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      visionPulseAnim.setValue(0.8);
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [isLoading, visionPulseAnim]);

  // Language Detection (Hindi / English)
  const detectLanguage = (text: string): string => {
    const devanagariRegex = /[\u0900-\u097F]/;
    if (devanagariRegex.test(text)) {
      return "hi-IN";
    }
    return "en-US";
  };

  // Speech Recognition Events
  useSpeechRecognitionEvent("result", (event) => {
    const transcript = event.results[0]?.transcript || "";
    if (transcript) {
      setInputText(transcript);
      latestTranscriptRef.current = transcript;
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setIsListening(false);
    if (latestTranscriptRef.current.trim()) {
      const recognizedText = latestTranscriptRef.current.trim();
      latestTranscriptRef.current = "";
      handleSendMessage(recognizedText);
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    console.error("Speech recognition error:", event.error);
    setIsListening(false);
  });

  // Speak response aloud with auto language detection
  const speakReply = (text: string) => {
    Speech.stop();
    setIsSpeaking(true);
    const targetLanguage = detectLanguage(text);

    Speech.speak(text, {
      language: targetLanguage,
      pitch: 1.0,
      rate: 0.95,
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // Toggle voice recognition
  const handleMicPress = async () => {
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }

    if (isListening) {
      try {
        await ExpoSpeechRecognitionModule.stop();
      } catch (err) {
        console.error("Failed to stop speech recognition:", err);
      }
      setIsListening(false);
      return;
    }

    const permission =
      await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "अनुमति आवश्यक है",
        "आवाज़ दर्ज करने के लिए माइक्रोफ़ोन अनुमति की आवश्यकता है।"
      );
      return;
    }

    latestTranscriptRef.current = "";
    setInputText("");
    setIsListening(true);

    try {
      await ExpoSpeechRecognitionModule.start({
        lang: "hi-IN",
        interimResults: true,
        maxAlternatives: 1,
      });
    } catch (error) {
      console.error("Speech recognition start failed:", error);
      setIsListening(false);
    }
  };

  // Gallery Picker (Optimized payload size)
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.4, // Reduced to 0.4 to prevent payload bloat
        base64: true,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        let base64Data = asset.base64;

        if (!base64Data && asset.uri) {
          base64Data = await FileSystem.readAsStringAsync(asset.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        setSelectedImage({
          uri: asset.uri,
          base64: base64Data || undefined,
          mimeType: asset.mimeType || "image/jpeg",
        });
      }
    } catch (error) {
      Alert.alert("Error", "गैलरी से तस्वीर चुनने में समस्या आई।");
    }
  };

  // Open Camera
  const handleOpenCamera = async () => {
    if (!cameraPermission?.granted) {
      const res = await requestCameraPermission();
      if (!res.granted) {
        Alert.alert(
          "Permission Required",
          "तस्वीर खींचने के लिए कैमरा अनुमति की आवश्यकता है।"
        );
        return;
      }
    }
    setIsCameraVisible(true);
  };

  // Capture Photo (Optimized quality)
  const handleTakePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.4, // Optimized quality for fast AI processing
          base64: true,
        });

        if (photo) {
          setSelectedImage({
            uri: photo.uri,
            base64: photo.base64,
            mimeType: "image/jpeg",
          });
          setIsCameraVisible(false);
        }
      } catch (error) {
        Alert.alert("Error", "तस्वीर कैप्चर करने में विफल।");
      }
    }
  };

  // Clear Selected Image
  const handleRemoveImage = () => {
    setSelectedImage(null);
  };

  // Send Message (Safe JSON Handling to Prevent HTML Crash)
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    const currentImage = selectedImage;

    if (!textToSend && !currentImage) return;
    if (isLoading) return;

    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    }

    const defaultPromptText = currentImage
      ? "कृपया इस तस्वीर का विस्तार से विश्लेषण करें।"
      : "";
    const finalPromptText = textToSend || defaultPromptText;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: finalPromptText,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      imageUri: currentImage?.uri,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const visionPromptContext = `
[ARIN AI System Context]
User Query: ${finalPromptText}
Instructions:
- Analyze the user request and image if provided.
- If image has text: read and transcribe/explain all text.
- If screenshot (Mobile UI, AutoDraft, ibisPaint, CapCut, App UI, Code editor): explain buttons, tools, editing timelines, layout, or bugs.
- If document: summarize key details clearly.
- If medicine: identify medicine name and provide safe general context.
- If food/plant/animal: identify accurately.
- Automatically respond in natural Hindi or English matching the user language.
- Keep the response clear, structured, and easy to speak aloud.
`;

      const payload: {
        message: string;
        imageBase64?: string;
        mimeType?: string;
        image?: string;
      } = {
        message: visionPromptContext,
      };

      if (currentImage?.base64) {
        payload.imageBase64 = currentImage.base64;
        payload.mimeType = currentImage.mimeType || "image/jpeg";
        payload.image = currentImage.base64;
      }

      const response = await fetch("https://arin-m7wy.onrender.com/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      // 🔴 Safe Response Reading (Handles HTML Error Pages gracefully)
      const rawText = await response.text();
      let data: any = {};

      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        console.error("Server returned Non-JSON HTML Page:", rawText);
        throw new Error(
          response.status === 413
            ? "तस्वीर का साइज़ बहुत बड़ा है।"
            : "सर्वर से जुड़ने में असमर्थ। कृपया पुनः प्रयास करें।"
        );
      }

      const replyText =
        data?.reply || data?.response || "क्षमा करें, कोई उत्तर प्राप्त नहीं हुआ।";

      const arinMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: replyText,
        sender: "arin",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      setMessages((prev) => [...prev, arinMessage]);
      speakReply(replyText);
    } catch (error: any) {
      console.error("API error:", error);
      const errorMessageText =
        error?.message || "सर्वर से जुड़ने में असमर्थ। कृपया नेटवर्क की जांच करें।";

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: errorMessageText,
        sender: "arin",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isUser = item.sender === "user";
    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.userRow : styles.arinRow,
        ]}
      >
        {!isUser && (
          <Animated.View
            style={[
              styles.avatarContainer,
              isSpeaking && { transform: [{ scale: speakWaveAnim }] },
            ]}
          >
            <Ionicons name="eye-outline" size={18} color="#6366F1" />
          </Animated.View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.arinBubble,
          ]}
        >
          {item.imageUri && (
            <View style={styles.imageBubbleContainer}>
              <Image
                source={{ uri: item.imageUri }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            </View>
          )}
          {!!item.text && <Text style={styles.messageText}>{item.text}</Text>}
          <Text style={styles.timestampText}>{item.timestamp}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0F17" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={styles.onlineBadge} />
          <Text style={styles.headerTitle}>ARIN EYES</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          {isListening
            ? "सुन रहा हूँ (Hindi/English)..."
            : isSpeaking
            ? "बोल रहा हूँ..."
            : isLoading
            ? "विज़न और AI विश्लेषण जारी है..."
            : "मल्टीमॉडल AI सहायक (Vision + Voice)"}
        </Text>
      </View>

      {/* Messages List */}
      <KeyboardAvoidingView
        style={styles.flexContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Loading Indicator with Vision Pulse */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <Animated.View
              style={{ transform: [{ scale: visionPulseAnim }] }}
            >
              <Ionicons name="scan-circle" size={28} color="#6366F1" />
            </Animated.View>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={styles.loadingText}>
              ARIN तस्वीर और संदेश का विश्लेषण कर रहा है...
            </Text>
          </View>
        )}

        {/* Floating Actions: Gallery | Mic | Camera */}
        <View style={styles.floatingActionRow}>
          {/* Gallery Button */}
          <TouchableOpacity
            style={styles.sideActionButton}
            onPress={handlePickImage}
            activeOpacity={0.7}
          >
            <Ionicons name="images-outline" size={22} color="#F8FAFC" />
          </TouchableOpacity>

          {/* Central Microphone */}
          <Animated.View
            style={[
              styles.micPulseRing,
              isListening && { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.micButton,
                isListening && styles.micButtonActive,
                isSpeaking && styles.micButtonSpeaking,
              ]}
              onPress={handleMicPress}
              activeOpacity={0.8}
            >
              <Ionicons
                name={
                  isSpeaking
                    ? "volume-high"
                    : isListening
                    ? "mic"
                    : "mic-outline"
                }
                size={28}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </Animated.View>

          {/* Camera Button */}
          <TouchableOpacity
            style={styles.sideActionButton}
            onPress={handleOpenCamera}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={22} color="#F8FAFC" />
          </TouchableOpacity>
        </View>

        {/* Selected Image Preview Staging Bar */}
        {selectedImage && (
          <View style={styles.imagePreviewStagingBar}>
            <Image
              source={{ uri: selectedImage.uri }}
              style={styles.previewThumbnail}
            />
            <View style={styles.previewInfo}>
              <Text style={styles.previewTitle}>तस्वीर चुनी गई</Text>
              <Text style={styles.previewSubtitle}>
                Gemini Vision विश्लेषण के लिए तैयार
              </Text>
            </View>
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={handleRemoveImage}
            >
              <Ionicons name="close-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Input Container */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="संदेश लिखें या तस्वीर जोड़ें..."
            placeholderTextColor="#64748B"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() && !selectedImage) || isLoading
                ? styles.sendButtonDisabled
                : null,
            ]}
            onPress={() => handleSendMessage()}
            disabled={(!inputText.trim() && !selectedImage) || isLoading}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* In-App Camera Modal */}
      <Modal
        visible={isCameraVisible}
        animationType="slide"
        onRequestClose={() => setIsCameraVisible(false)}
      >
        <SafeAreaView style={styles.cameraModalContainer}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing={facing}
            flash={flash}
          >
            {/* Top Controls Overlay */}
            <View style={styles.cameraTopBar}>
              <TouchableOpacity
                style={styles.cameraIconButton}
                onPress={() => setIsCameraVisible(false)}
              >
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cameraIconButton}
                onPress={() =>
                  setFlash((prev) => (prev === "off" ? "on" : "off"))
                }
              >
                <Ionicons
                  name={flash === "on" ? "flash" : "flash-off"}
                  size={24}
                  color={flash === "on" ? "#FBBF24" : "#FFFFFF"}
                />
              </TouchableOpacity>
            </View>

            {/* Bottom Shutter Controls Overlay */}
            <View style={styles.cameraBottomBar}>
              <TouchableOpacity
                style={styles.cameraIconButton}
                onPress={() =>
                  setFacing((prev) => (prev === "back" ? "front" : "back"))
                }
              >
                <Ionicons name="camera-reverse" size={28} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Shutter Button */}
              <TouchableOpacity
                style={styles.shutterButtonOuter}
                onPress={handleTakePhoto}
                activeOpacity={0.8}
              >
                <View style={styles.shutterButtonInner} />
              </TouchableOpacity>

              <View style={{ width: 44 }} />
            </View>
          </CameraView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0F17",
  },
  flexContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#161B26",
    borderBottomWidth: 1,
    borderBottomColor: "#1E2638",
    alignItems: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  onlineBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#F8FAFC",
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 90,
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 6,
    alignItems: "flex-end",
  },
  userRow: {
    justifyContent: "flex-end",
  },
  arinRow: {
    justifyContent: "flex-start",
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1E2638",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: "#6366F1",
    borderBottomRightRadius: 4,
  },
  arinBubble: {
    backgroundColor: "#1E2638",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#2D3748",
  },
  imageBubbleContainer: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 8,
  },
  messageImage: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.45,
    borderRadius: 12,
  },
  messageText: {
    fontSize: 15,
    color: "#F8FAFC",
    lineHeight: 22,
  },
  timestampText: {
    fontSize: 10,
    color: "#94A3B8",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    gap: 8,
    backgroundColor: "#161B26",
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#2D3748",
  },
  loadingText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  floatingActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -26,
    zIndex: 10,
    gap: 20,
  },
  sideActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1E2638",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  micPulseRing: {
    borderRadius: 35,
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    padding: 4,
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#6366F1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  micButtonActive: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
  },
  micButtonSpeaking: {
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
  },
  imagePreviewStagingBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E2638",
    marginHorizontal: 14,
    marginTop: 6,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  previewThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  previewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F8FAFC",
  },
  previewSubtitle: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  removeImageButton: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161B26",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 24 : 12,
    borderTopWidth: 1,
    borderTopColor: "#1E2638",
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#0D0F17",
    color: "#F8FAFC",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#2D3748",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#6366F1",
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#334155",
    opacity: 0.6,
  },
  cameraModalContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  cameraTopBar: {
    position: "absolute",
    top: 40,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 20,
  },
  cameraBottomBar: {
    position: "absolute",
    bottom: 40,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 20,
  },
  cameraIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterButtonOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  shutterButtonInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
  },
});
