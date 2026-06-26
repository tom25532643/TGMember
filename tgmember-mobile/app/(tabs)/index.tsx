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
  loadAdminSupergroups,
  getAllMembers,
  sendToSupergroupMembers,
  getFolders,
  sendFolder,
  previewFolderSend,
} from "../../api/tdlib";
import { storage, STORAGE_KEYS } from "../../api/storage";
import {
  syncTelegramMemberExpirations,
  updateTelegramMemberExpiration,
  updateMemberLoginKey,
} from "../../api/crm";

const FOREVER_DATE = "2099-12-31";

export default function IndexScreen() {
  const [screen, setScreen] = useState<Screen>("checking");
  const [loginKey, setLoginKey] = useState("");
  const [userId, setUserId] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [newLoginKey, setNewLoginKey] = useState("");

  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [messageText, setMessageText] = useState("");
  const [maxCount, setMaxCount] = useState("1");
  const [logs, setLogs] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const [managedGroups, setManagedGroups] = useState<any[]>([]);
  const [selectedManagedGroup, setSelectedManagedGroup] = useState<any>(null);
  const [managedMembers, setManagedMembers] = useState<any[]>([]);
  const [expirationRecords, setExpirationRecords] = useState<Record<string, any>>({});
  const [memberSearch, setMemberSearch] = useState("");
  const [memberStatusFilter, setMemberStatusFilter] = useState("all");
  const [memberLogs, setMemberLogs] = useState<string[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);

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

  const mlog = (msg: string) => setMemberLogs((current) => [...current, msg]);

  function todayDateOnly() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function dateOnly(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  function addMonths(months: number) {
    const date = new Date();
    const day = date.getDate();
    date.setMonth(date.getMonth() + months);
    if (date.getDate() !== day) {
      date.setDate(0);
    }
    return date.toISOString().slice(0, 10);
  }

  function getExpirationStatus(record: any) {
    const expiration = record?.expiration_date;
    if (!expiration) return "unset";
    if (expiration === FOREVER_DATE) return "forever";
    return dateOnly(expiration) < todayDateOnly() ? "expired" : "active";
  }

  function statusLabel(status: string) {
    const labels: Record<string, string> = {
      all: "全部",
      unset: "未設定",
      active: "有效",
      expired: "已過期",
      forever: "永久",
    };
    return labels[status] || status;
  }

  function matchesMemberStatusFilter(status: string) {
    if (memberStatusFilter === "all") return true;
    if (memberStatusFilter === "active") {
      return status === "active" || status === "forever";
    }
    return status === memberStatusFilter;
  }

  function statusStyle(status: string) {
    if (status === "active") return styles.statusActive;
    if (status === "expired") return styles.statusExpired;
    if (status === "forever") return styles.statusForever;
    return styles.statusUnset;
  }

  function filteredManagedMembers() {
    const query = memberSearch.trim().toLowerCase();

    return managedMembers.filter((member) => {
      const record = expirationRecords[String(member.user_id)];
      const status = getExpirationStatus(record);
      const haystack = [member.display_name, member.username, member.user_id]
        .join(" ")
        .toLowerCase();

      return (
        (!query || haystack.includes(query)) &&
        matchesMemberStatusFilter(status)
      );
    });
  }

  function handleSelectFolder(folder: any | null) {
    const folderId = folder?.id ?? null;

    folderRequestSeq.current += 1;
    selectedFolderIdRef.current = folderId;
    setSelectedFolder(folder);
    setFolderChats([]);
    setSelectedFolderChatIds({});
    setFolderLogs(
      folder ? [`已選擇盒子：${folder.title || folder.name || folder.id}`] : [],
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
      Alert.alert("錯誤", error?.message || "發生錯誤，請稍後再試。");
      setScreen(fallbackScreen);
    }
  }

  async function resolveAndApplyScreen(key: string) {
    const result = await resolveScreen(key);

    setUserId(result.userId);
    setNewLoginKey(result.member?.username || key);
    setScreen(result.screen);

    await storage.setItem(STORAGE_KEYS.USER_ID, result.userId);
    await storage.setItem(STORAGE_KEYS.LOGIN_KEY, key);
  }

  useEffect(() => {
    async function restoreUser() {
      const savedLoginKey = await storage.getItem(STORAGE_KEYS.LOGIN_KEY);

      if (!savedLoginKey) {
        await storage.removeItem(STORAGE_KEYS.USER_ID);
        setUserId("");
        setLoginKey("");
        setScreen("login");
        return;
      }

      setLoginKey(savedLoginKey);

      await run(async () => {
        await resolveAndApplyScreen(savedLoginKey);
      });
    }

    restoreUser();
  }, []);

  async function login() {
    const key = loginKey.trim();

    if (!key) {
      Alert.alert("錯誤", "請輸入登入金鑰。");
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
      await resolveAndApplyScreen(loginKey);
    });
  }

  async function submitCode() {
    setScreen("checking");

    await run(async () => {
      await sendCode(userId, code);
      await resolveAndApplyScreen(loginKey);
    });
  }

  async function submitPassword() {
    setScreen("checking");

    await run(async () => {
      await sendPassword(userId, password);
      await resolveAndApplyScreen(loginKey);
    });
  }


  async function handleUpdateLoginKey() {
    const nextLoginKey = newLoginKey.trim();

    if (!nextLoginKey) {
      Alert.alert("錯誤", "請輸入登入金鑰。");
      return;
    }

    await run(async () => {
      const member: any = await updateMemberLoginKey(userId, nextLoginKey);
      const updatedLoginKey = member.username || nextLoginKey;

      setLoginKey(updatedLoginKey);
      setNewLoginKey(updatedLoginKey);
      await storage.setItem(STORAGE_KEYS.LOGIN_KEY, updatedLoginKey);
      Alert.alert("已儲存", "登入金鑰已更新。");
    }, "settings");
  }
  async function handleLoadManagedGroups() {
    await run(async () => {
      const data: any = await loadAdminSupergroups(userId);
      const list = Array.isArray(data) ? data : data.data || data.result || [];

      setManagedGroups(list);
      setSelectedManagedGroup(null);
      setManagedMembers([]);
      setExpirationRecords({});
      setMemberLogs([`已載入 ${list.length} 個可管理群組。`]);
    }, "memberManagement");
  }

  async function handleSelectManagedGroup(group: any) {
    setSelectedManagedGroup(group);
    setManagedMembers([]);
    setExpirationRecords({});
    setMemberLogs([`已選擇群組：${group.title || group.chat_id}`]);
    await handleLoadManagedMembers(group);
  }

  async function handleLoadManagedMembers(groupArg?: any) {
    const group = groupArg || selectedManagedGroup;

    if (!group) {
      Alert.alert("錯誤", "請先選擇群組。");
      return;
    }

    setMemberLoading(true);

    try {
      const chatId = group.chat_id || group.id;
      const result: any = await getAllMembers(userId, Number(chatId), 10);
      const members = result.data?.members || [];
      const syncItems = members.map((member: any) => ({
        telegram_user_id: Number(member.user_id),
        display_name: member.display_name || null,
        username: member.username || null,
      }));
      const records: any = await syncTelegramMemberExpirations(
        userId,
        chatId,
        syncItems,
      );

      setManagedMembers(members);
      setExpirationRecords(
        records.reduce((next: Record<string, any>, record: any) => {
          next[String(record.telegram_user_id)] = record;
          return next;
        }, {}),
      );
      mlog(`已同步 ${members.length} 位成員。`);
    } catch (error: any) {
      console.error(error);
      mlog(`同步失敗：${error?.message || "未知錯誤"}`);
      Alert.alert("錯誤", error?.message || "成員同步失敗。");
    } finally {
      setMemberLoading(false);
    }
  }

  async function handleUpdateMemberExpiration(
    telegramUserId: string | number,
    action: "one-month" | "three-months" | "forever" | "clear",
  ) {
    const group = selectedManagedGroup;

    if (!group) {
      Alert.alert("錯誤", "請先選擇群組。");
      return;
    }

    const expirationDate = {
      "one-month": addMonths(1),
      "three-months": addMonths(3),
      forever: FOREVER_DATE,
      clear: null,
    }[action];

    try {
      const chatId = group.chat_id || group.id;
      const record: any = await updateTelegramMemberExpiration(
        userId,
        chatId,
        telegramUserId,
        expirationDate,
      );

      setExpirationRecords((current) => ({
        ...current,
        [String(record.telegram_user_id)]: record,
      }));
      mlog(`已更新使用者 ${telegramUserId}。`);
    } catch (error: any) {
      console.error(error);
      Alert.alert("錯誤", error?.message || "效期更新失敗。");
    }
  }

  async function handleLoadGroups() {
    await run(async () => {
      const data: any = await loadSupergroups(userId);
      const list = Array.isArray(data) ? data : data.data || data.result || [];

      setGroups(list);
      setSelectedGroup(null);
      log(`已載入 ${list.length} 個群組。`);
    }, "audience");
  }

  async function handleLoadFolders() {
    await run(async () => {
      const res: any = await getFolders(userId);
      const list = res.data || [];

      setFolders(list);
      handleSelectFolder(null);
      log(`已載入 ${list.length} 個盒子。`);
    }, "folder");
  }

  async function handlePreviewFolderSend() {
    const folder = selectedFolder;

    if (!folder) {
      Alert.alert("錯誤", "請先選擇盒子。");
      return;
    }

    const requestId = ++folderRequestSeq.current;
    const folderId = folder.id;

    setFolderChats([]);
    setSelectedFolderChatIds({});
    setFolderLogs([`正在載入預覽：${folder.title || folder.name || folderId}`]);

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

      flog(`預覽對象：${list.length}`);
      flog(`總數：${preview.total ?? list.length}`);
      flog(`將發送：${preview.included ?? list.length}`);
      flog(`已排除：${preview.excluded ?? 0}`);
    } catch (error: any) {
      console.error("previewFolderSend error:", error);

      if (!isCurrentFolderRequest(requestId, folderId)) return;
      flog(`預覽失敗：${error?.message || "預覽失敗"}`);
      Alert.alert("錯誤", error?.message || "預覽失敗。");
    }
  }

  async function handleSendFolder() {
    if (!selectedFolder) {
      Alert.alert("錯誤", "請先選擇盒子。");
      return;
    }

    if (!messageText.trim()) {
      Alert.alert("錯誤", "請輸入訊息內容。");
      return;
    }

    const excludeChatIds = getExcludedFolderChatIds();
    const selectedCount = folderChats.length - excludeChatIds.length;

    if (folderChats.length > 0 && selectedCount === 0) {
      Alert.alert("錯誤", "請至少選擇一個聊天室。");
      return;
    }

    setFolderSending(true);
    setFolderLogs([]);

    flog("開始盒子發送...");
    flog(`選取聊天室：${folderChats.length > 0 ? selectedCount : "全部"}`);
    flog(`略過聊天室：${excludeChatIds.length}`);

    try {
      const res: any = await sendFolder(
        userId,
        selectedFolder.id,
        messageText,
        excludeChatIds,
      );
      const result = res.data || res;
      const results = result.results || [];

      flog(`總數：${result.total ?? 0}`);
      flog(`成功：${result.success ?? 0}`);
      flog(`失敗：${result.failed ?? 0}`);

      results.forEach((item: any) => {
        const title = item.title || item.chat_id;
        flog(item.ok ? `成功 ${title}` : `失敗 ${title} ${item.error || ""}`);
      });

      Alert.alert(
        "發送完成",
        `成功 ${result.success ?? 0} / 失敗 ${result.failed ?? 0}`,
      );
    } catch (error: any) {
      flog(`錯誤：${error?.message || "盒子發送失敗。"}`);
      Alert.alert("錯誤", error?.message || "盒子發送失敗。");
    } finally {
      setFolderSending(false);
    }
  }

  async function handleSendAudience() {
    if (!selectedGroup) {
      Alert.alert("錯誤", "請先選擇群組。");
      return;
    }

    if (!messageText.trim()) {
      Alert.alert("錯誤", "請輸入訊息內容。");
      return;
    }

    const chatId = selectedGroup.chat_id || selectedGroup.id;
    const requestedMax = Number.parseInt(maxCount, 10);
    const limit = Number.isFinite(requestedMax) && requestedMax > 0 ? requestedMax : 1;

    setSending(true);
    log(`開始名單發送，最多 ${limit} 人。`);

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

      log(`完成。目標=${targeted} 成功=${success} 失敗=${failed}`);
      Alert.alert(
        "發送完成",
        `目標 ${targeted} / 成功 ${success} / 失敗 ${failed}`,
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert("錯誤", error?.message || "名單發送失敗。");
    } finally {
      setSending(false);
    }
  }

  if (screen === "checking") {
    return <Center text="檢查中..." />;
  }

  if (screen === "login") {
    return (
      <Page title="登入">
        <Label>登入金鑰</Label>
        <TextInput
          style={styles.input}
          value={loginKey}
          onChangeText={setLoginKey}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="例如：tom123"
        />
        <Btn title="登入" onPress={login} />
      </Page>
    );
  }

  if (screen === "session_missing") {
    return (
      <Page title="找不到 TDLib Session">
        <Text style={styles.info}>
          這個使用者尚未建立 TDLib session，請重新開始登入流程。
        </Text>
        <Btn title="返回" onPress={() => setScreen("login")} />
      </Page>
    );
  }

  if (screen === "phone") {
    return (
      <Page title="手機號碼">
        <Label>手機號碼</Label>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="+886..."
        />
        <Btn title="送出手機號碼" onPress={submitPhone} />
      </Page>
    );
  }

  if (screen === "code") {
    return (
      <Page title="驗證碼">
        <Label>驗證碼</Label>
        <TextInput style={styles.input} value={code} onChangeText={setCode} />
        <Btn title="送出驗證碼" onPress={submitCode} />
      </Page>
    );
  }

  if (screen === "password") {
    return (
      <Page title="密碼">
        <Label>密碼</Label>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <Btn title="送出密碼" onPress={submitPassword} />
      </Page>
    );
  }

  if (screen === "home") {
    return (
      <Page title="TGMember">
        <Text style={styles.subtitle}>Telegram 工作流程工具</Text>
        <Text style={styles.info}>使用者 ID：{userId}</Text>

        <HomeCard
          title="盒子發送"
          description="選擇 Telegram 盒子、預覽目標聊天室並發送訊息。"
          actionText="開啟盒子發送"
          onPress={() => setScreen("folder")}
        />

        <HomeCard
          title="名單發送"
          description="選擇 Telegram 群組，並限制人數發送訊息。"
          actionText="開啟名單發送"
          onPress={() => setScreen("audience")}
        />

        <HomeCard
          title="私密群組成員"
          description="管理你擔任管理員的 Telegram 群組成員效期。"
          actionText="開啟成員管理"
          onPress={() => setScreen("memberManagement")}
        />

        <HomeCard
          title="登入金鑰設定"
          description="修改你用來登入 TGMember 的登入金鑰。"
          actionText="開啟設定"
          onPress={() => setScreen("settings")}
        />
      </Page>
    );
  }


  if (screen === "settings") {
    return (
      <Page title="登入金鑰設定">
        <Btn title="返回" onPress={() => setScreen("home")} />
        <Text style={styles.info}>Current 使用者 ID：{userId}</Text>
        <Label>登入金鑰</Label>
        <TextInput
          style={styles.input}
          value={newLoginKey}
          onChangeText={setNewLoginKey}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="新的登入金鑰"
        />
        <Btn title="儲存登入金鑰" onPress={handleUpdateLoginKey} />
      </Page>
    );
  }
  if (screen === "folder") {
    return (
      <Page title="盒子發送">
        <Btn title="返回" onPress={() => setScreen("home")} />
        <Btn title="載入盒子" onPress={handleLoadFolders} />

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

        <Btn title="預覽對象" onPress={handlePreviewFolderSend} />

        {folderChats.length > 0 && (
          <View style={styles.chatSelectionHeader}>
            <Text style={styles.itemSub}>
              已選 {folderChats.length - getExcludedFolderChatIds().length} /{" "}
              {folderChats.length}
            </Text>
            <View style={styles.chatSelectionActions}>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => setAllFolderChatsSelected(true)}
              >
                <Text style={styles.smallButtonText}>全選</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => setAllFolderChatsSelected(false)}
              >
                <Text style={styles.smallButtonText}>全不選</Text>
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

        <Label>訊息內容</Label>
        <TextInput
          style={[styles.input, styles.textarea]}
          multiline
          value={messageText}
          onChangeText={setMessageText}
          placeholder="請輸入訊息"
        />

        {folderSending ? (
          <View style={styles.progressBox}>
            <Text style={styles.progressTitle}>盒子發送中...</Text>
            <Text style={styles.progressText}>
              請不要關閉此畫面。
            </Text>
          </View>
        ) : (
          <Btn title="發送盒子" onPress={handleSendFolder} />
        )}

        <Text style={styles.section}>盒子發送紀錄</Text>
        {folderLogs.map((entry, index) => (
          <Text key={index} style={styles.log}>
            {entry}
          </Text>
        ))}
      </Page>
    );
  }

  if (screen === "memberManagement") {
    const visibleMembers = filteredManagedMembers();

    return (
      <Page title="私密群組成員">
        <Btn title="返回" onPress={() => setScreen("home")} />
        <Btn title="載入可管理群組" onPress={handleLoadManagedGroups} />

        {managedGroups.map((group) => {
          const id = group.chat_id || group.id;
          const selected =
            selectedManagedGroup &&
            (selectedManagedGroup.chat_id || selectedManagedGroup.id) === id;

          return (
            <TouchableOpacity
              key={String(id)}
              style={[styles.item, selected && styles.selected]}
              onPress={() => handleSelectManagedGroup(group)}
            >
              <Text style={styles.itemTitle}>
                {group.title || group.name || `群組 ${id}`}
              </Text>
              <Text style={styles.itemSub}>chat_id: {String(id)}</Text>
              <Text style={styles.itemSub}>
                {group.is_channel ? "頻道" : "群組"} · {group.my_status || "admin"}
              </Text>
            </TouchableOpacity>
          );
        })}

        {selectedManagedGroup && (
          <Btn
            title={memberLoading ? "同步成員中..." : "同步成員"}
            onPress={() => handleLoadManagedMembers()}
          />
        )}

        <Label>搜尋成員</Label>
        <TextInput
          style={styles.input}
          value={memberSearch}
          onChangeText={setMemberSearch}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="名稱、username 或 user id"
        />

        <Text style={styles.section}>狀態篩選</Text>
        <View style={styles.filterRow}>
          {["all", "unset", "active", "expired", "forever"].map((status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterChip,
                memberStatusFilter === status && styles.filterChipActive,
              ]}
              onPress={() => setMemberStatusFilter(status)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  memberStatusFilter === status && styles.filterChipTextActive,
                ]}
              >
                {statusLabel(status)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.itemSub}>
          成員 {visibleMembers.length} / {managedMembers.length}。加入時間：未知。
        </Text>

        {visibleMembers.map((member) => {
          const record = expirationRecords[String(member.user_id)];
          const status = getExpirationStatus(record);
          const username = member.username ? `@${member.username}` : "沒有 username";

          return (
            <View key={String(member.user_id)} style={styles.memberCard}>
              <Text style={styles.itemTitle}>
                {member.display_name || member.user_id}
              </Text>
              <Text style={styles.itemSub}>{username}</Text>
              <Text style={styles.itemSub}>user_id: {member.user_id}</Text>
              <Text style={styles.itemSub}>加入時間：未知</Text>
              <Text style={styles.itemSub}>
                到期日： {record?.expiration_date || "Unset"}
              </Text>
              <Text style={[styles.statusBadge, statusStyle(status)]}>
                {statusLabel(status)}
              </Text>

              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => handleUpdateMemberExpiration(member.user_id, "one-month")}
                >
                  <Text style={styles.smallButtonText}>1M</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => handleUpdateMemberExpiration(member.user_id, "three-months")}
                >
                  <Text style={styles.smallButtonText}>3M</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={() => handleUpdateMemberExpiration(member.user_id, "forever")}
                >
                  <Text style={styles.smallButtonText}>永久</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallButton, styles.dangerButton]}
                  onPress={() => handleUpdateMemberExpiration(member.user_id, "clear")}
                >
                  <Text style={[styles.smallButtonText, styles.dangerButtonText]}>清除</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <Text style={styles.section}>成員紀錄</Text>
        {memberLogs.map((entry, index) => (
          <Text key={index} style={styles.log}>
            {entry}
          </Text>
        ))}
      </Page>
    );
  }

  if (screen === "audience") {
    return (
      <Page title="名單發送">
        <Btn title="返回" onPress={() => setScreen("home")} />
        <Btn title="載入群組" onPress={handleLoadGroups} />

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
                {group.title || group.name || `群組 ${id}`}
              </Text>
              <Text style={styles.itemSub}>chat_id: {String(id)}</Text>
            </TouchableOpacity>
          );
        })}

        <Label>訊息內容</Label>
        <TextInput
          style={[styles.input, styles.textarea]}
          multiline
          value={messageText}
          onChangeText={setMessageText}
          placeholder="請輸入訊息"
        />

        <Label>最多發送人數</Label>
        <TextInput
          style={styles.input}
          value={maxCount}
          onChangeText={setMaxCount}
          keyboardType="numeric"
        />

        {sending ? (
          <View style={styles.progressBox}>
            <Text style={styles.progressTitle}>發送中...</Text>
            <Text style={styles.progressText}>
              佇列執行中，請不要關閉此畫面。
            </Text>
          </View>
        ) : (
          <Btn title="開始名單發送" onPress={handleSendAudience} />
        )}

        <Text style={styles.section}>紀錄</Text>
        {logs.map((entry, index) => (
          <Text key={index} style={styles.log}>
            {entry}
          </Text>
        ))}
      </Page>
    );
  }

  return <Center text="未知畫面" />;
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
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#cfd6df",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: "#1677ff",
    borderColor: "#1677ff",
  },
  filterChipText: {
    color: "#333",
    fontSize: 12,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  memberCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginVertical: 6,
    backgroundColor: "#fff",
  },
  statusBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  statusUnset: {
    backgroundColor: "#f2f4f7",
    color: "#475467",
  },
  statusActive: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  statusExpired: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  statusForever: {
    backgroundColor: "#e0f2fe",
    color: "#075985",
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  dangerButton: {
    borderColor: "#be123c",
  },
  dangerButtonText: {
    color: "#be123c",
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
