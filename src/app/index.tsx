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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

interface Message {
  id: string;
  text: string;
  sender: "user" | "arin";
  timestamp: string;
}

export default function HomeScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "नमस्ते! मैं ARIN हूँ। मैं आपकी क्या सहायता कर सकता हूँ?",
      sender: "arin",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const latestTranscriptRef = useRef("");

  // Animated values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const speakWaveAnim = useRef(new Animated.Value(1)).current;

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

  // Speak response aloud in Hindi
  const speakReply = (text: string) => {
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(text, {
      language: "hi-IN",
      pitch: 1.0,
      rate: 0.95,
      onStart: () => setIsSpeaking(true),
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  // Toggle or start voice recognition
  const handleMicPress = async () => {
    // Requirement 15: Stop speaking if user presses mic while speaking
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

    // Permission Check
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

  // Send message to Backend
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isLoading) return;

    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      sender: "user",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const response = await fetch("https://arin-m7wy.onrender.com/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: textToSend }),
      });

      const data = await response.json();
      const replyText = data?.reply || "क्षमा करें, कोई उत्तर प्राप्त नहीं हुआ।";

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
    } catch (error) {
      console.error("API error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "सर्वर से जुड़ने में असमर्थ। कृपया बाद में प्रयास करें।",
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
            <Ionicons name="hardware-chip-outline" size={18} color="#6366F1" />
          </Animated.View>
        )}
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.arinBubble,
          ]}
        >
          <Text style={styles.messageText}>{item.text}</Text>
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
          <Text style={styles.headerTitle}>ARIN AI</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          {isListening
            ? "सुन रहा हूँ..."
            : isSpeaking
            ? "बोल रहा हूँ..."
            : "ऑनलाइन"}
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

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={styles.loadingText}>ARIN सोच रहा है...</Text>
          </View>
        )}

        {/* Floating Voice / Active Status Bar */}
        <View style={styles.floatingActionWrapper}>
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
        </View>

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="संदेश लिखें या माइक दबाएं..."
            placeholderTextColor="#64748B"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            onPress={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    paddingVertical: 14,
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
    paddingBottom: 80,
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
    maxWidth: "78%",
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
    paddingVertical: 8,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  floatingActionWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -26,
    zIndex: 10,
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
});
