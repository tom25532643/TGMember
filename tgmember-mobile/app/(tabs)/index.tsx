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

import { resolveScreen, Screen } from "../../auth/authMachine";
import {
  sendPhone,
  sendCode,
  sendPassword,
  loadSupergroups,
  getAllMembers,
  sendMessage,
  getFolders,
  getFolderChats,
  sendFolder,
  previewFolderSend,
} from "../../api/tdlib";

import { storage, STORAGE_KEYS } from "../../api/storage";

export default function IndexScreen() {
  const [screen, setScreen] = useState<Screen>("checking");

  const [loginKey, setLoginKey] = useState("");
  const [userId, setUserId] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [messageText, setMessageText] = useState("");
  const [maxCount, setMaxCount] = useState("1");
  const [logs, setLogs] = useState<string[]>([]);

  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [folderChats, setFolderChats] = useState<any[]>([]);

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<any>(null);
  const [sendError, setSendError] = useState("");

  const [folderLogs, setFolderLogs] = useState<string[]>([]);
  const [folderSending, setFolderSending] = useState(false);
  const [folderProgress, setFolderProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    targetName: "",
  });

  const log = (msg: string) => setLogs((p) => [...p, msg]);
  const flog = (msg: string) => setFolderLogs((p) => [...p, msg]);

  async function run(
    fn: () => Promise<void>,
    fallbackScreen: Screen = "login",
  ) {
    try {
      await fn();
    } catch (e: any) {
      console.error(e);
      const msg = e?.message || "未知錯誤";
      Alert.alert("錯誤", msg);
      setScreen(fallbackScreen);
    }
  }

  async function resolveAndApplyScreen(key: string) {
    const result = await resolveScreen(key);

    setUserId(result.userId);
    setScreen(result.screen);

    await storage.setItem(STORAGE_KEYS.USER_ID, result.userId);
    await storage.setItem(STORAGE_KEYS.LOGIN_KEY, key);
  }

  useEffect(() => {
    async function restoreUser() {
      const savedLoginKey = await storage.getItem(STORAGE_KEYS.LOGIN_KEY);
      const savedUserId = await storage.getItem(STORAGE_KEYS.USER_ID);
      const saved = savedLoginKey || savedUserId;

      if (!saved) {
        setScreen("login");
        return;
      }

      setLoginKey(saved);

      if (savedUserId) {
        setUserId(savedUserId);
      }

      await run(async () => {
        await resolveAndApplyScreen(saved);
      });
    }

    restoreUser();
  }, []);

  async function login() {
    const key = loginKey.trim();

    if (!key) {
      Alert.alert("錯誤", "請輸入 Login Key");
      return;
    }

    setScreen("checking");

    await run(async () => {
      await resolveAndApplyScreen(key);
    });
  }

  async function submitPhone() {
    setScreen("checking");

    await run(async () => {
      await sendPhone(userId, phone);
      await resolveAndApplyScreen(loginKey || userId);
    });
  }

  async function submitCode() {
    setScreen("checking");

    await run(async () => {
      await sendCode(userId, code);
      await resolveAndApplyScreen(loginKey || userId);
    });
  }

  async function submitPassword() {
    setScreen("checking");

    await run(async () => {
      await sendPassword(userId, password);
      await resolveAndApplyScreen(loginKey || userId);
    });
  }

  async function handleLoadGroups() {
    await run(async () => {
      const data: any = await loadSupergroups(userId);
      const list = Array.isArray(data) ? data : data.data || data.result || [];

      setGroups(list);
      setSelectedGroup(null);
      log(`載入群組完成：${list.length} 個`);
    }, "audience");
  }

  async function handleLoadFolders() {
    const res: any = await getFolders(userId);
    setFolders(res.data || []);
    log(`載入 folders ${res.data?.length}`);
  }

  async function handleLoadFolderChats() {
    if (!selectedFolder) return;

    const res: any = await getFolderChats(userId, selectedFolder.id);

    const list = res.data || [];
    setFolderChats(list);

    flog(`載入 chats ${list.length}`);
  }

  async function handleSendFolder() {
    if (!selectedFolder) {
      return Alert.alert("請選 folder");
    }

    if (!messageText.trim()) {
      return Alert.alert("請輸入訊息");
    }

    setFolderSending(true);
    setFolderLogs([]);

    flog("開始發送 folder...");

    try {
      const res: any = await sendFolder(userId, selectedFolder.id, messageText);
      const result = res.data || res;

      flog(`總數: ${result.total ?? 0}`);
      flog(`成功: ${result.success ?? 0}`);
      flog(`失敗: ${result.failed ?? 0}`);

      const results = result.results || [];

      results.forEach((c: any) => {
        if (c.ok) {
          flog(`✔ ${c.title || c.chat_id}`);
        } else {
          flog(`❌ ${c.title || c.chat_id} ${c.error || ""}`);
        }
      });

      Alert.alert(
        "完成",
        `成功 ${result.success ?? 0} / 失敗 ${result.failed ?? 0}`,
      );
    } catch (e: any) {
      flog(`錯誤: ${e?.message || "發送失敗"}`);
      Alert.alert("錯誤", e?.message || "發送失敗");
    } finally {
      setFolderSending(false);
    }
  }

  async function handleSendAudience() {
    if (!selectedGroup) {
      Alert.alert("錯誤", "請先選群組");
      return;
    }

    const chatId = selectedGroup.chat_id || selectedGroup.id;

    log("開始取得成員...");

    const membersRes: any = await getAllMembers(userId, chatId);

    console.log("membersRes =", membersRes);
    log(`membersRes: ${JSON.stringify(membersRes)}`);

    const members = Array.isArray(membersRes)
      ? membersRes
      : Array.isArray(membersRes.data)
        ? membersRes.data
        : Array.isArray(membersRes.data?.members)
          ? membersRes.data.members
          : Array.isArray(membersRes.result)
            ? membersRes.result
            : [];

    log(`取得 ${members.length} 個成員`);

    log(`取得 ${members.length} 個成員`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < members.length; i++) {
      const m = members[i];

      const targetName =
        m.display_name ||
        m.name ||
        [m.first_name, m.last_name].filter(Boolean).join(" ") ||
        m.username ||
        String(m.user_id || m.id);

      const targetChatId = m.user_id || m.id;

      try {
        log(`正在發送給：${targetName}`);
        await sendMessage(userId, targetChatId, messageText);

        success++;
        log(`✔ ${i + 1}/${members.length} ${targetName}`);
      } catch (e) {
        failed++;
        log(`❌ ${i + 1}/${members.length} ${targetName}`);
      }

      // 🔥 防封：延遲
      await new Promise((r) => setTimeout(r, 1500));
    }

    log(`完成 success=${success} failed=${failed}`);
    Alert.alert("完成", `成功 ${success} / 失敗 ${failed}`);
  }
  if (screen === "checking") {
    return <Center text="Checking..." />;
  }

  if (screen === "login") {
    return (
      <Page title="Login">
        <Label>Login Key</Label>
        <TextInput
          style={styles.input}
          value={loginKey}
          onChangeText={setLoginKey}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="例如 tom123"
        />
        <Btn title="Login" onPress={login} />
      </Page>
    );
  }

  if (screen === "session_missing") {
    return (
      <Page title="TDLib Session 不存在">
        <Text style={styles.info}>TDLib session 不存在，請聯絡開發人員。</Text>
        <Btn title="Back" onPress={() => setScreen("login")} />
      </Page>
    );
  }

  if (screen === "phone") {
    return (
      <Page title="Phone">
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
      <Page title="Code">
        <Label>Code</Label>
        <TextInput style={styles.input} value={code} onChangeText={setCode} />
        <Btn title="Submit Code" onPress={submitCode} />
      </Page>
    );
  }

  if (screen === "password") {
    return (
      <Page title="Password">
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
      <Page title="TGMember">
        <Text style={styles.subtitle}>Telegram 成員管理與群發工具</Text>
        <Text style={styles.info}>User ID: {userId}</Text>

        <HomeCard
          title="群組群發"
          description="選擇 Telegram folder / 對話群組，將訊息送到多個群組或對話。"
          actionText="進入群組群發"
          onPress={() => setScreen("folder")}
        />

        <HomeCard
          title="對話群發"
          description="從指定群組抓取成員，對成員逐一發送訊息。"
          actionText="進入對話群發"
          onPress={() => setScreen("audience")}
        />
      </Page>
    );
  }

  if (screen === "folder") {
    return (
      <Page title="群組群發">
        <Btn title="Back" onPress={() => setScreen("home")} />

        <Btn title="Load Folders" onPress={handleLoadFolders} />

        {folders.map((f) => {
          const selected = selectedFolder && selectedFolder.id === f.id;

          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.item, selected && styles.selected]}
              onPress={() => setSelectedFolder(f)}
            >
              <Text style={styles.itemTitle}>{f.title || f.name}</Text>
              <Text style={styles.itemSub}>folder_id: {f.id}</Text>
            </TouchableOpacity>
          );
        })}

        <Btn title="Load Chats" onPress={handleLoadFolderChats} />

        {folderChats.map((c) => (
          <Text key={c.chat_id} style={styles.log}>
            {c.title} ({c.chat_id})
          </Text>
        ))}

        <Label>Message</Label>
        <TextInput
          style={[styles.input, styles.textarea]}
          multiline
          value={messageText}
          onChangeText={setMessageText}
          placeholder="message"
        />

        {folderSending ? (
          <View style={styles.progressBox}>
            <Text style={styles.progressTitle}>Folder sending...</Text>
            <Text style={styles.progressText}>
              Please do not close this screen.
            </Text>
          </View>
        ) : (
          <Btn title="Send Folder" onPress={handleSendFolder} />
        )}

        <Text style={styles.section}>Folder Logs</Text>
        {folderLogs.map((l, i) => (
          <Text key={i} style={styles.log}>
            {l}
          </Text>
        ))}
      </Page>
    );
  }

  if (screen === "audience") {
    return (
      <Page title="對話群發">
        <Btn title="Back" onPress={() => setScreen("home")} />
        <Btn title="Load Groups" onPress={handleLoadGroups} />

        {groups.map((g) => {
          const id = g.chat_id || g.id;
          const selected =
            selectedGroup && (selectedGroup.chat_id || selectedGroup.id) === id;

          return (
            <TouchableOpacity
              key={String(id)}
              style={[styles.item, selected && styles.selected]}
              onPress={() => setSelectedGroup(g)}
            >
              <Text style={styles.itemTitle}>
                {g.title || g.name || `Group ${id}`}
              </Text>
              <Text style={styles.itemSub}>chat_id: {String(id)}</Text>
            </TouchableOpacity>
          );
        })}

        <Label>Message</Label>
        <TextInput
          style={[styles.input, styles.textarea]}
          multiline
          value={messageText}
          onChangeText={setMessageText}
          placeholder="輸入要群發的訊息"
        />

        <Label>Max Count</Label>
        <TextInput
          style={styles.input}
          value={maxCount}
          onChangeText={setMaxCount}
          keyboardType="numeric"
        />

        {sending ? (
          <View style={styles.progressBox}>
            <Text style={styles.progressTitle}>Sending...</Text>
            <Text style={styles.progressText}>
              Queue is running. Please do not close this screen.
            </Text>
          </View>
        ) : (
          <Btn title="Start Audience Send" onPress={handleSendAudience} />
        )}

        {sendResult && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>Send Result</Text>
            <Text style={styles.resultText}>
              {JSON.stringify(sendResult, null, 2)}
            </Text>
          </View>
        )}

        {sendError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Send Failed</Text>
            <Text style={styles.errorText}>{sendError}</Text>
            <Btn title="Retry" onPress={handleSendAudience} />
          </View>
        ) : null}

        <Text style={styles.section}>Logs</Text>
        {logs.map((l, i) => (
          <Text key={i} style={styles.log}>
            {l}
          </Text>
        ))}
      </Page>
    );
  }

  return <Center text="Unknown screen" />;
}

function Page({ title, children }: any) {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </ScrollView>
  );
}

function HomeCard({ title, description, actionText, onPress }: any) {
  return (
    <TouchableOpacity style={styles.homeCard} onPress={onPress}>
      <Text style={styles.homeCardTitle}>{title}</Text>
      <Text style={styles.homeCardDescription}>{description}</Text>
      <Text style={styles.homeCardAction}>{actionText}</Text>
    </TouchableOpacity>
  );
}

function Btn({ title, onPress }: any) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

function Center({ text }: { text: string }) {
  return (
    <View style={styles.center}>
      <Text>{text}</Text>
    </View>
  );
}

function Label({ children }: any) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 6,
  },
  subtitle: {
    color: "#555",
    marginBottom: 16,
  },
  label: {
    marginTop: 10,
    fontWeight: "600",
  },
  info: {
    marginBottom: 16,
  },
  section: {
    marginTop: 20,
    fontWeight: "bold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 10,
    marginVertical: 8,
    borderRadius: 6,
  },
  textarea: {
    height: 110,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#1677ff",
    padding: 12,
    borderRadius: 6,
    marginVertical: 8,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  homeCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    backgroundColor: "#fff",
  },
  homeCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  homeCardDescription: {
    color: "#555",
    lineHeight: 20,
    marginBottom: 12,
  },
  homeCardAction: {
    color: "#1677ff",
    fontWeight: "700",
  },
  item: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    marginVertical: 5,
  },
  selected: {
    backgroundColor: "#dbeafe",
  },
  itemTitle: {
    fontWeight: "600",
  },
  itemSub: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  log: {
    fontSize: 12,
    marginTop: 4,
  },
  progressBox: {
    padding: 12,
    borderRadius: 6,
    backgroundColor: "#eef6ff",
    marginVertical: 8,
  },
  progressTitle: {
    fontWeight: "700",
    marginBottom: 4,
  },
  progressText: {
    fontSize: 12,
    color: "#555",
  },
  resultBox: {
    padding: 12,
    borderRadius: 6,
    backgroundColor: "#ecfdf5",
    marginVertical: 8,
  },
  resultTitle: {
    fontWeight: "700",
    marginBottom: 4,
  },
  resultText: {
    fontSize: 12,
  },
  errorBox: {
    padding: 12,
    borderRadius: 6,
    backgroundColor: "#fef2f2",
    marginVertical: 8,
  },
  errorTitle: {
    fontWeight: "700",
    color: "#991b1b",
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: "#991b1b",
  },
});
