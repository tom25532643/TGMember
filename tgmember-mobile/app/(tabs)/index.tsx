import { useEffect, useRef, useState } from "react";
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
  sendToSupergroupMembers,
  getFolders,
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
  const [sending, setSending] = useState(false);

  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [folderChats, setFolderChats] = useState<any[]>([]);
  const [selectedFolderChatIds, setSelectedFolderChatIds] = useState<
    Record<string, boolean>
  >({});
  const [folderLogs, setFolderLogs] = useState<string[]>([]);
  const [folderSending, setFolderSending] = useState(false);

  const folderRequestSeq = useRef(0);
  const selectedFolderIdRef = useRef<number | null>(null);

  const log = (msg: string) => setLogs((current) => [...current, msg]);
  const flog = (msg: string) => setFolderLogs((current) => [...current, msg]);

  function handleSelectFolder(folder: any | null) {
    const folderId = folder?.id ?? null;

    folderRequestSeq.current += 1;
    selectedFolderIdRef.current = folderId;
    setSelectedFolder(folder);
    setFolderChats([]);
    setSelectedFolderChatIds({});
    setFolderLogs(
      folder ? [`Selected folder: ${folder.title || folder.name || folder.id}`] : [],
    );
  }

  function getChatId(chat: any) {
    return chat.chat_id ?? chat.id;
  }

  function selectAllFolderChats(chats: any[]) {
    setSelectedFolderChatIds(
      chats.reduce<Record<string, boolean>>((next, chat) => {
        const chatId = getChatId(chat);

        if (chatId !== undefined && chatId !== null) {
          next[String(chatId)] = true;
        }

        return next;
      }, {}),
    );
  }

  function toggleFolderChat(chatId: string | number) {
    const key = String(chatId);

    setSelectedFolderChatIds((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function setAllFolderChatsSelected(selected: boolean) {
    setSelectedFolderChatIds(
      folderChats.reduce<Record<string, boolean>>((next, chat) => {
        const chatId = getChatId(chat);

        if (chatId !== undefined && chatId !== null) {
          next[String(chatId)] = selected;
        }

        return next;
      }, {}),
    );
  }

  function getExcludedFolderChatIds() {
    return folderChats
      .map(getChatId)
      .filter((chatId) => chatId !== undefined && chatId !== null)
      .filter((chatId) => !selectedFolderChatIds[String(chatId)]);
  }

  function isCurrentFolderRequest(requestId: number, folderId: number) {
    return (
      folderRequestSeq.current === requestId &&
      selectedFolderIdRef.current === folderId
    );
  }

  async function run(
    fn: () => Promise<void>,
    fallbackScreen: Screen = "login",
  ) {
    try {
      await fn();
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error?.message || "Something went wrong.");
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
      Alert.alert("Error", "Enter a login key.");
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
      log(`Loaded ${list.length} groups.`);
    }, "audience");
  }

  async function handleLoadFolders() {
    await run(async () => {
      const res: any = await getFolders(userId);
      const list = res.data || [];

      setFolders(list);
      handleSelectFolder(null);
      log(`Loaded ${list.length} folders.`);
    }, "folder");
  }

  async function handlePreviewFolderSend() {
    const folder = selectedFolder;

    if (!folder) {
      Alert.alert("Error", "Select a folder first.");
      return;
    }

    const requestId = ++folderRequestSeq.current;
    const folderId = folder.id;

    setFolderChats([]);
    setSelectedFolderChatIds({});
    setFolderLogs([`Loading preview: ${folder.title || folder.name || folderId}`]);

    try {
      const res: any = await previewFolderSend(userId, folderId);

      if (!isCurrentFolderRequest(requestId, folderId)) return;

      const preview = res.data || {};
      const list = Array.isArray(preview)
        ? preview
        : Array.isArray(preview.chats)
          ? preview.chats
          : [];

      setFolderChats(list);
      selectAllFolderChats(list);

      flog(`Preview targets: ${list.length}`);
      flog(`Total: ${preview.total ?? list.length}`);
      flog(`Included: ${preview.included ?? list.length}`);
      flog(`Excluded: ${preview.excluded ?? 0}`);
    } catch (error: any) {
      console.error("previewFolderSend error:", error);

      if (!isCurrentFolderRequest(requestId, folderId)) return;
      flog(`Preview failed: ${error?.message || "preview failed"}`);
      Alert.alert("Error", error?.message || "Preview failed.");
    }
  }

  async function handleSendFolder() {
    if (!selectedFolder) {
      Alert.alert("Error", "Select a folder first.");
      return;
    }

    if (!messageText.trim()) {
      Alert.alert("Error", "Enter a message.");
      return;
    }

    const excludeChatIds = getExcludedFolderChatIds();
    const selectedCount = folderChats.length - excludeChatIds.length;

    if (folderChats.length > 0 && selectedCount === 0) {
      Alert.alert("Error", "Select at least one chat.");
      return;
    }

    setFolderSending(true);
    setFolderLogs([]);

    flog("Starting folder send...");
    flog(`Selected chats: ${folderChats.length > 0 ? selectedCount : "all"}`);
    flog(`Skipped chats: ${excludeChatIds.length}`);

    try {
      const res: any = await sendFolder(
        userId,
        selectedFolder.id,
        messageText,
        excludeChatIds,
      );
      const result = res.data || res;
      const results = result.results || [];

      flog(`Total: ${result.total ?? 0}`);
      flog(`Success: ${result.success ?? 0}`);
      flog(`Failed: ${result.failed ?? 0}`);

      results.forEach((item: any) => {
        const title = item.title || item.chat_id;
        flog(item.ok ? `OK ${title}` : `Failed ${title} ${item.error || ""}`);
      });

      Alert.alert(
        "Send complete",
        `Success ${result.success ?? 0} / Failed ${result.failed ?? 0}`,
      );
    } catch (error: any) {
      flog(`Error: ${error?.message || "Folder send failed."}`);
      Alert.alert("Error", error?.message || "Folder send failed.");
    } finally {
      setFolderSending(false);
    }
  }

  async function handleSendAudience() {
    if (!selectedGroup) {
      Alert.alert("Error", "Select a group first.");
      return;
    }

    if (!messageText.trim()) {
      Alert.alert("Error", "Enter a message.");
      return;
    }

    const chatId = selectedGroup.chat_id || selectedGroup.id;
    const requestedMax = Number.parseInt(maxCount, 10);
    const limit = Number.isFinite(requestedMax) && requestedMax > 0 ? requestedMax : 1;

    setSending(true);
    log(`Starting audience send. Max count: ${limit}.`);

    try {
      const response: any = await sendToSupergroupMembers(
        userId,
        chatId,
        messageText,
        limit,
      );
      const result = response?.data || response;
      const targeted = result?.targeted ?? 0;
      const success = result?.success ?? 0;
      const failed = result?.failed ?? 0;

      log(`Complete. targeted=${targeted} success=${success} failed=${failed}`);
      Alert.alert(
        "Send complete",
        `Targeted ${targeted} / Success ${success} / Failed ${failed}`,
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error?.message || "Audience send failed.");
    } finally {
      setSending(false);
    }
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
          placeholder="Example: tom123"
        />
        <Btn title="Login" onPress={login} />
      </Page>
    );
  }

  if (screen === "session_missing") {
    return (
      <Page title="TDLib Session Missing">
        <Text style={styles.info}>
          No TDLib session exists for this user. Start login again to create one.
        </Text>
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
        <Text style={styles.subtitle}>Telegram workflow tools</Text>
        <Text style={styles.info}>User ID: {userId}</Text>

        <HomeCard
          title="Folder Send"
          description="Select a Telegram folder, preview target chats, and send a message."
          actionText="Open Folder Send"
          onPress={() => setScreen("folder")}
        />

        <HomeCard
          title="Audience Send"
          description="Select a Telegram group and send messages to a limited member audience."
          actionText="Open Audience Send"
          onPress={() => setScreen("audience")}
        />
      </Page>
    );
  }

  if (screen === "folder") {
    return (
      <Page title="Folder Send">
        <Btn title="Back" onPress={() => setScreen("home")} />
        <Btn title="Load Folders" onPress={handleLoadFolders} />

        {folders.map((folder) => {
          const selected = selectedFolder && selectedFolder.id === folder.id;

          return (
            <TouchableOpacity
              key={folder.id}
              style={[styles.item, selected && styles.selected]}
              onPress={() => handleSelectFolder(folder)}
            >
              <Text style={styles.itemTitle}>{folder.title || folder.name}</Text>
              <Text style={styles.itemSub}>folder_id: {folder.id}</Text>
            </TouchableOpacity>
          );
        })}

        <Btn title="Preview Targets" onPress={handlePreviewFolderSend} />

        {folderChats.length > 0 && (
          <View style={styles.chatSelectionHeader}>
            <Text style={styles.itemSub}>
              Selected {folderChats.length - getExcludedFolderChatIds().length} /{" "}
              {folderChats.length}
            </Text>
            <View style={styles.chatSelectionActions}>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => setAllFolderChatsSelected(true)}
              >
                <Text style={styles.smallButtonText}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => setAllFolderChatsSelected(false)}
              >
                <Text style={styles.smallButtonText}>Select None</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {folderChats.map((chat) => {
          const chatId = getChatId(chat);
          const checked = selectedFolderChatIds[String(chatId)] !== false;

          return (
            <TouchableOpacity
              key={String(chatId)}
              style={styles.chatOption}
              onPress={() => toggleFolderChat(chatId)}
            >
              <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                {checked ? <Text style={styles.checkboxMark}>OK</Text> : null}
              </View>
              <Text style={styles.chatOptionText}>
                {chat.title} ({chatId})
              </Text>
            </TouchableOpacity>
          );
        })}

        <Label>Message</Label>
        <TextInput
          style={[styles.input, styles.textarea]}
          multiline
          value={messageText}
          onChangeText={setMessageText}
          placeholder="Message"
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
        {folderLogs.map((entry, index) => (
          <Text key={index} style={styles.log}>
            {entry}
          </Text>
        ))}
      </Page>
    );
  }

  if (screen === "audience") {
    return (
      <Page title="Audience Send">
        <Btn title="Back" onPress={() => setScreen("home")} />
        <Btn title="Load Groups" onPress={handleLoadGroups} />

        {groups.map((group) => {
          const id = group.chat_id || group.id;
          const selected =
            selectedGroup && (selectedGroup.chat_id || selectedGroup.id) === id;

          return (
            <TouchableOpacity
              key={String(id)}
              style={[styles.item, selected && styles.selected]}
              onPress={() => setSelectedGroup(group)}
            >
              <Text style={styles.itemTitle}>
                {group.title || group.name || `Group ${id}`}
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
          placeholder="Message"
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

        <Text style={styles.section}>Logs</Text>
        {logs.map((entry, index) => (
          <Text key={index} style={styles.log}>
            {entry}
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
    borderRadius: 8,
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
  chatSelectionHeader: {
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  chatSelectionActions: {
    flexDirection: "row",
    gap: 8,
  },
  smallButton: {
    borderWidth: 1,
    borderColor: "#1677ff",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallButtonText: {
    color: "#1677ff",
    fontSize: 12,
    fontWeight: "600",
  },
  chatOption: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  checkbox: {
    width: 26,
    height: 22,
    borderWidth: 1,
    borderColor: "#999",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: "#1677ff",
    borderColor: "#1677ff",
  },
  checkboxMark: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 14,
  },
  chatOptionText: {
    flex: 1,
    fontSize: 12,
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
});