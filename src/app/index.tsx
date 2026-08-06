import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";

export default function HomeScreen() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("Hello! Main ARIN AI hu 🤖");

  async function sendMessage() {
    if (!message.trim()) return;

    try {
      const res = await fetch("http://localhost:3000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
        }),
      });

      const data = await res.json();
      setReply(data.reply);
      setMessage("");
    } catch (e) {
      setReply("❌ Server se connect nahi ho paya.");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.logo}>🤖</Text>
      <Text style={styles.title}>ARIN AI</Text>

      <View style={styles.chatBox}>
        <Text>{reply}</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Message likho..."
        value={message}
        onChangeText={setMessage}
      />

      <TouchableOpacity style={styles.button} onPress={sendMessage}>
        <Text style={styles.buttonText}>Send</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#111827",
  },
  logo: {
    fontSize: 80,
    textAlign: "center",
  },
  title: {
    color: "#22d3ee",
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
  },
  chatBox: {
    backgroundColor: "#ffffff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
  },
  input: {
    backgroundColor: "#ffffff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#06b6d4",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
});
