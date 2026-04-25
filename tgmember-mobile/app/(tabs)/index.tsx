import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const CRM_BASE = "http://127.0.0.1:8001";
const TDLIB_BASE = "http://127.0.0.1:8000";

type Screen =
  | "checking"
  | "login"
  | "create_session"
  | "phone"
  | "code"
  | "password"
  | "home"
  | "audience"
  | "folder";

export default function IndexScreen() {
  const [screen, setScreen] = useState<Screen>("login");
  const [userId, setUserId] = useState("1");

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [groups, setGroups] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);

  const [text, setText] = useState("");
  const [maxCount, setMaxCount] = useState("1");
  const [logs, setLogs] = useState<string[]>([]);

  const [errorMessage, setErrorMessage] = useState("");

  const log = (msg: string) => setLogs((p) => [msg, ...p]);

  async function login() {
    try {
      setErrorMessage("");
      setScreen("checking");

      // 1. 先問 CRM / FastAPI：這個 member 是否存在
      const memberRes = await fetch(`${CRM_BASE}/members/${userId}`);

      if (memberRes.status === 404) {
        showError("無法登入", "找不到此帳號，請聯絡開發人員。");
        setScreen("login");
        return;
      }

      if (!memberRes.ok) {
        showError("無法登入", "帳號檢查失敗，請聯絡開發人員。");
        setScreen("login");
        return;
      }

      const memberData = await memberRes.json();
      console.log("member:", memberData);

      // 2. member 存在，再問 TDLib 狀態
      await checkTdlibState();
    } catch (e) {
      console.error(e);
      showError("連線失敗", "無法連線到伺服器，請確認後端是否啟動。");
      setScreen("login");
    }
  }

  async function startTelegramSession() {
    try {
      setScreen("checking");

      const res = await fetch(`${TDLIB_BASE}/auth/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
        }),
      });

      const data = await res.json();
      console.log("auth start:", data);

      await checkTdlibState();
    } catch (e) {
      console.error(e);
      showError("建立失敗", "無法建立 Telegram session。");
      setScreen("login");
    }
  }

  async function checkTdlibState() {
    try {
      const res = await fetch(`${TDLIB_BASE}/auth/state/${userId}`);

      if (res.status === 404) {
        setScreen("create_session");
        return;
      }

      if (!res.ok) {
        showError("無法登入", "TDLib 狀態異常。");
        setScreen("login");
        return;
      }

      const data = await res.json();
      console.log("tdlib state:", data);

      const payload = data.data || data;
      const state = payload.auth_state || payload.auth_state_raw?.["@type"];

      if (
        payload.is_ready ||
        payload.is_authorized ||
        state === "authorizationStateReady"
      ) {
        setScreen("home");
      } else if (state === "authorizationStateWaitPhoneNumber") {
        setScreen("phone");
      } else if (state === "authorizationStateWaitCode") {
        setScreen("code");
      } else if (state === "authorizationStateWaitPassword") {
        setScreen("password");
      } else {
        setScreen("phone");
      }
    } catch (e) {
      console.error(e);
      showError("連線失敗", "無法連線到 TDLib service。");
      setScreen("login");
    }
  }

  function showError(title: string, message: string) {
    console.log(title, message);
    setErrorMessage(`${title}：${message}`);

    if (typeof window !== "undefined") {
      window.alert(`${title}\n${message}`);
    } else {
      showError(title, message);
    }
  }

  async function startLogin() {
    try {
      const res = await fetch(`${TDLIB_BASE}/auth/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      console.log("start:", data);
      await checkTdlibState();
    } catch (e) {
      console.error(e);
      showError("Error", "Start login failed");
    }
  }

  async function submitPhone() {
    await postAuth("/auth/phone", { user_id: userId, phone_number: phone });
  }

  async function submitCode() {
    await postAuth("/auth/code", { user_id: userId, code });
  }

  async function submitPassword() {
    await postAuth("/auth/password", { user_id: userId, password });
  }

  async function postAuth(path: string, body: any) {
    try {
      const res = await fetch(`${TDLIB_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      console.log(path, data);
      await checkTdlibState();
    } catch (e) {
      console.error(e);
      showError("Error", "Auth step failed");
    }
  }

  async function loadGroups() {
    const res = await fetch(`${TDLIB_BASE}/supergroups/${userId}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || data.result || [];
    setGroups(list);
  }

  async function sendToGroupMembers() {
    if (!selectedGroup) return showError("Error", "請先選群組");
    if (!text.trim()) return showError("Error", "請輸入訊息");

    const chatId = selectedGroup.chat_id || selectedGroup.id;

    const res = await fetch(
      `${TDLIB_BASE}/supergroups/${userId}/${chatId}/send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, max_count: Number(maxCount || 1) }),
      },
    );

    const data = await res.json();
    console.log("send group:", data);
    log(`群組群發完成: ${JSON.stringify(data)}`);
  }

  async function loadFolders() {
    const res = await fetch(`${TDLIB_BASE}/folders/${userId}`);
    const data = await res.json();
    const list = Array.isArray(data) ? data : data.data || data.result || [];
    setFolders(list);
  }

  async function sendToFolder() {
    if (!selectedFolder) return showError("Error", "請先選盒子/Folder");
    if (!text.trim()) return showError("Error", "請輸入訊息");

    const folderId = selectedFolder.id || selectedFolder.folder_id;

    const res = await fetch(
      `${TDLIB_BASE}/folders/${userId}/${folderId}/send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      },
    );

    const data = await res.json();
    console.log("send folder:", data);
    log(`盒子群發完成: ${JSON.stringify(data)}`);
  }

  if (screen === "checking") {
    return <CenterText text="Checking session..." />;
  }

  if (screen === "login") {
    return (
      <Page title="TGMember Login">
        <Label>User ID</Label>
        <TextInput
          style={styles.input}
          value={userId}
          onChangeText={setUserId}
        />
        <Btn title="Login" onPress={login} />
      </Page>
    );
  }

  if (screen === "create_session") {
    return (
      <Page title="建立 Session">
        <Text style={styles.info}>此帳號尚未建立 Telegram Session</Text>

        <Btn title="Start Telegram Login" onPress={startTelegramSession} />
        <Btn title="Back" onPress={() => setScreen("login")} />
      </Page>
    );
  }

  if (screen === "phone") {
    return (
      <Page title="Phone Login">
        <Label>Phone Number</Label>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+886..."
        />
        <Btn title="Submit Phone" onPress={submitPhone} />
      </Page>
    );
  }

  if (screen === "code") {
    return (
      <Page title="Code Verification">
        <Label>Code</Label>
        <TextInput style={styles.input} value={code} onChangeText={setCode} />
        <Btn title="Submit Code" onPress={submitCode} />
      </Page>
    );
  }

  if (screen === "password") {
    return (
      <Page title="2FA Password">
        <Label>Password</Label>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Btn title="Submit Password" onPress={submitPassword} />
      </Page>
    );
  }

  if (screen === "home") {
    return (
      <Page title="TGMember Home">
        <Text style={styles.info}>User ID: {userId}</Text>
        <Btn title="群組成員群發" onPress={() => setScreen("audience")} />
        <Btn title="對話盒子群發" onPress={() => setScreen("folder")} />
      </Page>
    );
  }

  if (screen === "audience") {
    return (
      <Page title="群組成員群發">
        <Btn title="Back" onPress={() => setScreen("home")} />
        <Btn title="Load Groups" onPress={loadGroups} />

        {groups.map((g) => (
          <TouchableOpacity
            key={String(g.chat_id || g.id)}
            style={[
              styles.item,
              selectedGroup &&
                (selectedGroup.chat_id || selectedGroup.id) ===
                  (g.chat_id || g.id) &&
                styles.selected,
            ]}
            onPress={() => setSelectedGroup(g)}
          >
            <Text>{g.title || `Group ${g.chat_id || g.id}`}</Text>
          </TouchableOpacity>
        ))}

        <SenderInputs
          text={text}
          setText={setText}
          maxCount={maxCount}
          setMaxCount={setMaxCount}
        />
        <Btn title="Start Group Send" onPress={sendToGroupMembers} />
        <Logs logs={logs} />
      </Page>
    );
  }

  return (
    <Page title="對話盒子群發">
      <Btn title="Back" onPress={() => setScreen("home")} />
      <Btn title="Load Folders" onPress={loadFolders} />

      {folders.map((f) => (
        <TouchableOpacity
          key={String(f.id || f.folder_id)}
          style={[
            styles.item,
            selectedFolder &&
              (selectedFolder.id || selectedFolder.folder_id) ===
                (f.id || f.folder_id) &&
              styles.selected,
          ]}
          onPress={() => setSelectedFolder(f)}
        >
          <Text>{f.name || f.title || `Folder ${f.id || f.folder_id}`}</Text>
        </TouchableOpacity>
      ))}

      <SenderInputs
        text={text}
        setText={setText}
        maxCount={maxCount}
        setMaxCount={setMaxCount}
      />
      <Btn title="Start Folder Send" onPress={sendToFolder} />
      <Logs logs={logs} />
    </Page>
  );
}

function Page({ title, children }: any) {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </ScrollView>
  );
}

function CenterText({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <Text>{text}</Text>
    </View>
  );
}

function Label({ children }: any) {
  return <Text style={styles.label}>{children}</Text>;
}

function Btn({ title, onPress }: any) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

function SenderInputs({ text, setText, maxCount, setMaxCount }: any) {
  return (
    <>
      <Label>Message</Label>
      <TextInput
        style={[styles.input, styles.textarea]}
        multiline
        value={text}
        onChangeText={setText}
      />

      <Label>Max Count</Label>
      <TextInput
        style={styles.input}
        value={maxCount}
        onChangeText={setMaxCount}
        keyboardType="numeric"
      />
    </>
  );
}

function Logs({ logs }: { logs: string[] }) {
  return (
    <>
      <Text style={styles.section}>Logs</Text>
      {logs.map((l, i) => (
        <Text key={i} style={styles.log}>
          {l}
        </Text>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 16 },
  label: { marginTop: 10, fontWeight: "600" },
  section: { marginTop: 20, fontWeight: "bold" },
  info: { marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginVertical: 8,
    borderRadius: 6,
  },
  textarea: { height: 110, textAlignVertical: "top" },
  button: {
    backgroundColor: "#1677ff",
    padding: 12,
    borderRadius: 6,
    marginVertical: 8,
  },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "600" },
  item: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    marginVertical: 5,
  },
  selected: { backgroundColor: "#dbeafe" },
  log: { fontSize: 12, marginTop: 4 },
  errorText: {
    color: "red",
    marginVertical: 10,
  },
});
