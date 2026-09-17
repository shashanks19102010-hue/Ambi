import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as SecureStore from "expo-secure-store";

type Role = "user" | "assistant";
type Message = {
  id: string;
  role: Role;
  content: string;
};

type StreamEvent =
  | { type: "delta"; text?: unknown }
  | { type: "done" }
  | { type: "error"; message?: unknown };

const API_BASE_URL = (process.env.EXPO_PUBLIC_AMBI_API_BASE_URL ?? "").trim().replace(/\/$/, "");
const MAX_INPUT = 12_000;

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseSse(body: string): StreamEvent[] {
  const events: StreamEvent[] = [];
  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payload) as StreamEvent;
      if (parsed && typeof parsed.type === "string") events.push(parsed);
    } catch {
      // Ignore malformed SSE frames instead of crashing the app.
    }
  }
  return events;
}

async function getInstallId() {
  const key = "ambi.installation.id";
  const existing = await SecureStore.getItemAsync(key);
  if (existing) return existing;
  const created = makeId("install");
  await SecureStore.setItemAsync(key, created, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return created;
}

async function askAmbi(messages: Message[], installId: string, signal: AbortSignal) {
  if (!API_BASE_URL) {
    throw new Error("API is not configured. Add EXPO_PUBLIC_AMBI_API_BASE_URL to mobile/.env.local.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  const forwardAbort = () => controller.abort();
  signal.addEventListener("abort", forwardAbort, { once: true });

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "X-Ambi-Client": "expo-mobile-v1",
        "X-Ambi-Installation": installId,
      },
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content })),
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    if (!response.ok) {
      let message = `Ambi API returned HTTP ${response.status}.`;
      try {
        const json = JSON.parse(raw) as { error?: unknown };
        if (typeof json.error === "string" && json.error.trim()) message = json.error;
      } catch {
        // Keep the generic status message for non-JSON responses.
      }
      throw new Error(message);
    }

    const events = parseSse(raw);
    let answer = "";
    for (const event of events) {
      if (event.type === "delta" && typeof event.text === "string") answer += event.text;
      if (event.type === "error" && typeof event.message === "string") throw new Error(event.message);
    }

    const cleaned = answer.trim();
    if (!cleaned) throw new Error("Ambi returned an empty response.");
    return cleaned;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener("abort", forwardAbort);
  }
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [installId, setInstallId] = useState("");

  useEffect(() => {
    void getInstallId().then(setInstallId).catch(() => setInstallId("unavailable"));
  }, []);

  const statusText = useMemo(() => {
    if (!API_BASE_URL) return "Setup required";
    if (busy) return "Ambi is thinking";
    return "Ready";
  }, [busy]);

  async function sendMessage() {
    const text = draft.trim().slice(0, MAX_INPUT);
    if (!text || busy) return;

    setError("");
    setDraft("");

    const userMessage: Message = { id: makeId("user"), role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setBusy(true);

    const requestController = new AbortController();
    try {
      const answer = await askAmbi(nextMessages, installId || "unavailable", requestController.signal);
      setMessages((current) => [
        ...current,
        { id: makeId("assistant"), role: "assistant", content: answer },
      ]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to reach Ambi.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>A</Text>
            </View>
            <View>
              <Text style={styles.title}>Ambi</Text>
              <Text style={styles.status}>{statusText}</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => API_BASE_URL && void Linking.openURL(API_BASE_URL)}
            style={styles.webButton}
          >
            <Text style={styles.webButtonText}>Web</Text>
          </Pressable>
        </View>

        {!API_BASE_URL ? (
          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>Mobile test build</Text>
            <Text style={styles.setupBody}>
              Set EXPO_PUBLIC_AMBI_API_BASE_URL to the deployed Ambi website URL. No API secret belongs in the app bundle.
            </Text>
          </View>
        ) : null}

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={[styles.messageRow, item.role === "user" ? styles.userRow : styles.assistantRow]}>
              <View style={[styles.bubble, item.role === "user" ? styles.userBubble : styles.assistantBubble]}>
                <Text style={styles.bubbleText}>{item.content}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.bigLogo}>
                <Text style={styles.bigLogoText}>A</Text>
              </View>
              <Text style={styles.emptyTitle}>How can I help?</Text>
              <Text style={styles.emptyBody}>Ambi mobile test app</Text>
            </View>
          }
        />

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.composerWrap}>
          <TextInput
            value={draft}
            onChangeText={(value) => setDraft(value.slice(0, MAX_INPUT))}
            placeholder="Message Ambi..."
            placeholderTextColor="#8a8a8a"
            multiline
            maxLength={MAX_INPUT}
            editable={!busy}
            style={styles.input}
            onSubmitEditing={() => void sendMessage()}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={busy || !draft.trim()}
            onPress={() => void sendMessage()}
            style={({ pressed }) => [styles.send, (busy || !draft.trim()) && styles.sendDisabled, pressed && styles.sendPressed]}
          >
            {busy ? <ActivityIndicator color="#050505" /> : <Text style={styles.sendText}>↑</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#050505" },
  container: { flex: 1, backgroundColor: "#050505" },
  header: {
    minHeight: 70,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#252525",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  logo: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#050505", fontSize: 19, fontWeight: "800" },
  title: { color: "#f5f5f5", fontSize: 19, fontWeight: "700" },
  status: { color: "#909090", fontSize: 11, marginTop: 1 },
  webButton: { borderWidth: 1, borderColor: "#2d2d2d", paddingHorizontal: 13, paddingVertical: 8, borderRadius: 10 },
  webButtonText: { color: "#e8e8e8", fontSize: 12, fontWeight: "600" },
  setupCard: { margin: 16, padding: 16, borderWidth: 1, borderColor: "#333", borderRadius: 16, backgroundColor: "#0d0d0d" },
  setupTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 6 },
  setupBody: { color: "#aaa", fontSize: 13, lineHeight: 19 },
  list: { flexGrow: 1, padding: 16, paddingBottom: 12 },
  messageRow: { width: "100%", marginBottom: 12 },
  userRow: { alignItems: "flex-end" },
  assistantRow: { alignItems: "flex-start" },
  bubble: { maxWidth: "88%", paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16 },
  userBubble: { backgroundColor: "#f1f1f1", borderBottomRightRadius: 5 },
  assistantBubble: { backgroundColor: "#111111", borderWidth: 1, borderColor: "#262626", borderBottomLeftRadius: 5 },
  bubbleText: { color: "#f4f4f4", fontSize: 15, lineHeight: 22 },
  emptyState: { flex: 1, minHeight: 430, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  bigLogo: { width: 74, height: 74, borderRadius: 24, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center", marginBottom: 18 },
  bigLogoText: { color: "#050505", fontSize: 36, fontWeight: "800" },
  emptyTitle: { color: "#f5f5f5", fontSize: 24, fontWeight: "700" },
  emptyBody: { color: "#777", fontSize: 13, marginTop: 6 },
  errorCard: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#4a2a2a", backgroundColor: "#160b0b" },
  errorText: { color: "#ffb0b0", fontSize: 12, lineHeight: 18 },
  composerWrap: { margin: 12, padding: 8, minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: "#292929", backgroundColor: "#0e0e0e", flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, color: "#f5f5f5", fontSize: 15, lineHeight: 21, maxHeight: 120, paddingHorizontal: 10, paddingVertical: 8 },
  send: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#f4f4f4", alignItems: "center", justifyContent: "center" },
  sendDisabled: { opacity: 0.35 },
  sendPressed: { transform: [{ scale: 0.97 }] },
  sendText: { color: "#050505", fontSize: 22, fontWeight: "700", marginTop: -2 },
});
