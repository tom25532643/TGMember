import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  FlatList,
  TouchableOpacity,
  Alert,
} from "react-native";

const API_BASE = "http://10.141.81.54:8000";

type Screen = "login" | "phone" | "code" | "password" | "groups" | "members";

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");

  const [userId, setUserId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [memberInfo, setMemberInfo] = useState<any | null>(null);

  const [sendText, setSendText] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  const showError = (msg: string) => {
    setMessage(msg);
    Alert.alert("Error", msg);
  };

  const getAuthState = async () => {
    const res = await fetch(`${API_BASE}/auth/state/${userId}`);
    const data = await res.json();
    return data?.data?.auth_state;
  };

  const goByAuthState = async () => {
    try {
      const authState = await getAuthState();

      if (authState === "authorizationStateReady") {
        await loadGroups();
      } else if (authState === "authorizationStateWaitPhoneNumber") {
        setScreen("phone");
      } else if (authState === "authorizationStateWaitCode") {
        setScreen("code");
      } else if (authState === "authorizationStateWaitPassword") {
        setScreen("password");
      } else {
        showError(`Unsupported auth state: ${authState || "unknown"}`);
      }
    } catch {
      showError("UserID 不存在或後端連線失敗");
    }
  };

  const startAuth = async () => {
    if (!userId.trim()) return showError("請輸入 User ID");

    try {
      const res = await fetch(`${API_BASE}/auth/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await res.json();
      const authState = data?.data?.auth_state;

      if (authState === "authorizationStateReady") {
        await loadGroups();
      } else {
        await goByAuthState();
      }
    } catch {
      showError("啟動登入失敗");
    }
  };

  const sendPhone = async () => {
    await fetch(`${API_BASE}/auth/phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, phone_number: phoneNumber }),
    });
    await goByAuthState();
  };

  const sendCode = async () => {
    await fetch(`${API_BASE}/auth/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, code }),
    });
    await goByAuthState();
  };

  const sendPassword = async () => {
    await fetch(`${API_BASE}/auth/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, password }),
    });
    await goByAuthState();
  };

  const loadGroups = async () => {
    try {
      const res = await fetch(`${API_BASE}/supergroups/${userId}`);
      const data = await res.json();

      if (!res.ok || data.ok === false) {
        throw new Error(data.detail || "載入群組失敗");
      }

      setGroups(data.data || []);
      setScreen("groups");
      setMessage("");
    } catch (e: any) {
      showError(e.message || "載入群組失敗");
    }
  };

  const loadMembers = async (group: any) => {
    try {
      setSelectedGroup(group);
      setMembers([]);
      setMemberInfo(null);
      setSendText("");
      setScreen("members");

      const res = await fetch(
        `${API_BASE}/supergroups/${userId}/${group.chat_id}/members/all?max_pages=10`,
      );
      const data = await res.json();

      if (!res.ok || data.ok === false) {
        throw new Error(data.detail || "載入 members 失敗");
      }

      setMemberInfo(data.data);
      setMembers(data.data?.members || []);
    } catch (e: any) {
      showError(e.message || "載入 members 失敗");
    }
  };

  const sendToMembers = async () => {
    if (!selectedGroup) return;

    if (!sendText.trim()) {
      showError("請輸入訊息");
      return;
    }

    try {
      setSending(true);

      const res = await fetch(
        `${API_BASE}/supergroups/${userId}/${selectedGroup.chat_id}/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: sendText,
            max_count: 100,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok || data.ok === false) {
        throw new Error(data.detail || "發送失敗");
      }

      Alert.alert("完成", "訊息已送出");
      setSendText("");
    } catch (e: any) {
      showError(e.message || "發送失敗");
    } finally {
      setSending(false);
    }
  };

  const pageStyle = {
    flex: 1,
    padding: 20,
    backgroundColor: "#fff",
  };

  const inputStyle = {
    borderWidth: 1,
    borderColor: "#ccc",
    color: "#000",
    backgroundColor: "#fff",
    padding: 10,
    marginBottom: 16,
  };

  if (screen === "login") {
    return (
      <View style={{ ...pageStyle, justifyContent: "center" }}>
        <Text style={{ fontSize: 26, marginBottom: 20, color: "#000" }}>
          TGMember Login
        </Text>

        <TextInput
          placeholder="User ID"
          placeholderTextColor="#888"
          value={userId}
          onChangeText={setUserId}
          style={inputStyle}
        />

        <Button title="Start / Check Login" onPress={startAuth} />

        {message ? (
          <Text style={{ color: "red", marginTop: 16 }}>{message}</Text>
        ) : null}
      </View>
    );
  }

  if (screen === "phone") {
    return (
      <View style={{ ...pageStyle, justifyContent: "center" }}>
        <Text style={{ fontSize: 22, marginBottom: 20, color: "#000" }}>
          Telegram Phone
        </Text>

        <TextInput
          placeholder="+886..."
          placeholderTextColor="#888"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          style={inputStyle}
        />

        <Button title="Send Phone" onPress={sendPhone} />
      </View>
    );
  }

  if (screen === "code") {
    return (
      <View style={{ ...pageStyle, justifyContent: "center" }}>
        <Text style={{ fontSize: 22, marginBottom: 20, color: "#000" }}>
          Telegram Code
        </Text>

        <TextInput
          placeholder="Code"
          placeholderTextColor="#888"
          value={code}
          onChangeText={setCode}
          style={inputStyle}
        />

        <Button title="Verify Code" onPress={sendCode} />
      </View>
    );
  }

  if (screen === "password") {
    return (
      <View style={{ ...pageStyle, justifyContent: "center" }}>
        <Text style={{ fontSize: 22, marginBottom: 20, color: "#000" }}>
          2FA Password
        </Text>

        <TextInput
          placeholder="Password"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={inputStyle}
        />

        <Button title="Verify Password" onPress={sendPassword} />
      </View>
    );
  }

  if (screen === "groups") {
    return (
      <View style={{ ...pageStyle, paddingTop: 50 }}>
        <Text style={{ fontSize: 22, marginBottom: 10, color: "#000" }}>
          Supergroups / Channels
        </Text>

        <Text style={{ color: "#555", marginBottom: 10 }}>
          User ID: {userId}
        </Text>

        <FlatList
          data={groups}
          keyExtractor={(item: any) => item.chat_id.toString()}
          renderItem={({ item }: any) => (
            <TouchableOpacity
              style={{
                padding: 12,
                borderBottomWidth: 1,
                borderBottomColor: "#eee",
              }}
              onPress={() => loadMembers(item)}
            >
              <Text style={{ color: "#000", fontSize: 16 }}>{item.title}</Text>
              <Text style={{ color: "#666" }}>
                {item.is_channel ? "Channel" : "Group"} / {item.chat_id}
              </Text>
            </TouchableOpacity>
          )}
        />

        <Button title="Back to Login" onPress={() => setScreen("login")} />
      </View>
    );
  }

  return (
    <View style={{ ...pageStyle, paddingTop: 50 }}>
      <Text style={{ fontSize: 22, marginBottom: 8, color: "#000" }}>
        Members
      </Text>

      <Text style={{ color: "#000", marginBottom: 4 }}>
        {selectedGroup?.title}
      </Text>

      <Text style={{ color: "#666", marginBottom: 10 }}>
        Total: {memberInfo?.total ?? "Loading..."} / Pages:{" "}
        {memberInfo?.pages_fetched ?? "-"}
      </Text>

      <TextInput
        placeholder="輸入要發送的訊息"
        placeholderTextColor="#888"
        value={sendText}
        onChangeText={setSendText}
        multiline
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          color: "#000",
          backgroundColor: "#fff",
          padding: 10,
          minHeight: 80,
          marginBottom: 10,
          textAlignVertical: "top",
        }}
      />

      <Button
        title={sending ? "Sending..." : "Send to Members"}
        onPress={sendToMembers}
        disabled={sending}
      />

      <FlatList
        style={{ marginTop: 12 }}
        data={members}
        keyExtractor={(item: any) => item.user_id.toString()}
        renderItem={({ item }: any) => (
          <View
            style={{
              padding: 10,
              borderBottomWidth: 1,
              borderBottomColor: "#eee",
            }}
          >
            <Text style={{ color: "#000" }}>User {item.user_id}</Text>
            <Text style={{ color: "#666" }}>{item.status}</Text>
          </View>
        )}
      />

      <View style={{ marginTop: 16 }}>
        <Button title="Back to Groups" onPress={() => setScreen("groups")} />
      </View>
    </View>
  );
}
