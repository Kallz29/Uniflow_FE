import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, Animated, ActivityIndicator,
  TouchableWithoutFeedback, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/aiAssistantStyles';
import {
  createChatSession, getAllChatSessions,
  getChatMessages, sendChatMessage, updateChatSession,
  deleteChatSession,
} from '../services/api';
import { toUserMessage, logError } from '../utils/errorHandler';

const stripMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^[\*\-] /gm, '\u2022 ')
    .replace(/#+\s/g, '')
    .replace(/`(.+?)`/g, '$1')
    .trim();
};

const SUGGESTED = [
  'Apa standar pH air minum yang aman?',
  'Berapa suhu air yang ideal?',
  'Apa itu TDS dan berapa batas amannya?',
  'Bagaimana cara mengukur kekeruhan air?',
];

const buildTitle = (text) => {
  const trimmed = text.trim();
  return trimmed.length > 40 ? trimmed.slice(0, 40).trimEnd() + '...' : trimmed;
};

const mapSessions = (sessions) =>
  sessions.map((s) => ({
    id: s.id,
    date: new Date(s.created_at).toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
    preview: s.title && s.title !== 'Sesi Baru' ? s.title : 'Sesi Baru',
  }));

const GREETING = 'Halo! Saya asisten AI UniFlow. Siap membantu seputar kualitas air, parameter monitoring, dan standar PERMENKES. Ada yang bisa saya bantu?';
const GREETING_SHORT = 'Halo! Ada yang bisa saya bantu?';

export default function AIAssistant({ onBack }) {
  const [messages, setMessages] = useState([{
    id: '1', text: GREETING, sender: 'ai', timestamp: new Date(),
  }]);
  const [inputText,        setInputText]        = useState('');
  const [isTyping,         setIsTyping]         = useState(false);
  const [drawerOpen,       setDrawerOpen]       = useState(false);
  const [chatHistory,      setChatHistory]      = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isFirstMessage,   setIsFirstMessage]   = useState(true);
  const [loadingSession,   setLoadingSession]   = useState(true);
  const [sessionError,     setSessionError]     = useState(null);
  const [deletingId,       setDeletingId]       = useState(null);
  const [deleteTarget,     setDeleteTarget]     = useState(null); // { id, preview }

  const scrollRef  = useRef(null);
  const typingAnim = useRef(new Animated.Value(0)).current;
  const drawerAnim = useRef(new Animated.Value(-280)).current;

  const refreshHistory = async () => {
    try {
      const res = await getAllChatSessions();
      const sessions = res.data || [];
      setChatHistory(mapSessions(sessions));
      return sessions;
    } catch (err) {
      logError('AIAssistant.refreshHistory', err);
      return [];
    }
  };

  useEffect(() => { initSession(); }, []);

  const initSession = async () => {
    try {
      setLoadingSession(true);
      setSessionError(null);

      const sessionsRes = await getAllChatSessions();
      const sessions = sessionsRes.data || [];
      setChatHistory(mapSessions(sessions));

      let sessionId;
      if (sessions.length > 0) {
        sessionId = sessions[0].id;
        await loadMessagesForSession(sessionId);
      } else {
        const res = await createChatSession('Sesi Baru');
        sessionId = res.data.id;
        setMessages([{ id: '1', text: GREETING, sender: 'ai', timestamp: new Date() }]);
        setIsFirstMessage(true);
      }

      setCurrentSessionId(sessionId);
    } catch (err) {
      logError('AIAssistant.initSession', err);
      setSessionError(toUserMessage(err, 'Gagal memuat sesi chat'));
    } finally {
      setLoadingSession(false);
    }
  };

  const loadMessagesForSession = async (sessionId) => {
    const msgRes = await getChatMessages(sessionId);
    const rawMsgs = msgRes.data || msgRes || [];

    const msgs = rawMsgs.map((item) => ({
      id: String(item.id),
      text: item.role === 'assistant' ? stripMarkdown(item.content) : (item.content || ''),
      sender: item.role === 'assistant' ? 'ai' : 'user',
      timestamp: new Date(item.created_at),
    }));

    if (msgs.length > 0) {
      setMessages(msgs);
      setIsFirstMessage(false);
    } else {
      setMessages([{ id: '1', text: GREETING_SHORT, sender: 'ai', timestamp: new Date() }]);
      setIsFirstMessage(true);
    }
  };

  const openDrawer = async () => {
    await refreshHistory();
    setDrawerOpen(true);
    Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 12 }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerAnim, { toValue: -280, duration: 220, useNativeDriver: true })
      .start(() => setDrawerOpen(false));
  };

  const loadSession = async (sessionId) => {
    closeDrawer();
    setCurrentSessionId(sessionId);
    try {
      await loadMessagesForSession(sessionId);
    } catch (err) {
      logError('AIAssistant.loadSession', err);
      setMessages([{
        id: Date.now().toString(),
        text: toUserMessage(err, 'Gagal memuat pesan'),
        sender: 'ai',
        timestamp: new Date(),
      }]);
    }
  };

  const newSession = async () => {
    closeDrawer();
    try {
      const res = await createChatSession('Sesi Baru');
      const sessionId = res.data.id;
      setCurrentSessionId(sessionId);
      setIsFirstMessage(true);
      setMessages([{ id: '1', text: GREETING_SHORT, sender: 'ai', timestamp: new Date() }]);
      await refreshHistory();
    } catch (err) {
      logError('AIAssistant.newSession', err);
      setMessages((p) => [...p, {
        id: Date.now().toString(),
        text: toUserMessage(err, 'Gagal membuat sesi baru'),
        sender: 'ai',
        timestamp: new Date(),
      }]);
    }
  };

  // Buka modal konfirmasi delete (tanpa Alert)
  const handleDeleteSession = (sessionId, sessionPreview) => {
    setDeleteTarget({ id: sessionId, preview: sessionPreview });
  };

  // Eksekusi delete setelah user konfirmasi
  const doDeleteSession = async () => {
    if (!deleteTarget) return;
    const { id: sessionId } = deleteTarget;
    setDeleteTarget(null);
    setDeletingId(sessionId);
    try {
      await deleteChatSession(sessionId);

      if (sessionId === currentSessionId) {
        const remaining = (await refreshHistory()).filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id);
          await loadMessagesForSession(remaining[0].id);
        } else {
          const res = await createChatSession('Sesi Baru');
          const newId = res.data.id;
          setCurrentSessionId(newId);
          setMessages([{ id: '1', text: GREETING_SHORT, sender: 'ai', timestamp: new Date() }]);
          setIsFirstMessage(true);
        }
      }

      await refreshHistory();
    } catch (err) {
      logError('AIAssistant.deleteSession', err);
      setMessages((p) => [...p, {
        id: Date.now().toString(),
        text: 'Gagal menghapus sesi: ' + toUserMessage(err),
        sender: 'ai',
        timestamp: new Date(),
      }]);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isTyping) {
      Animated.loop(Animated.sequence([
        Animated.timing(typingAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(typingAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ])).start();
    } else {
      typingAnim.setValue(0);
    }
  }, [isTyping]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      try {
        const res = await createChatSession('Sesi Baru');
        sessionId = res.data.id;
        setCurrentSessionId(sessionId);
        setIsFirstMessage(true);
      } catch (err) {
        logError('AIAssistant.createSessionBeforeSend', err);
        setMessages((p) => [...p, {
          id: Date.now().toString(),
          text: toUserMessage(err, 'Gagal terhubung ke server.'),
          sender: 'ai',
          timestamp: new Date(),
        }]);
        return;
      }
    }

    const userText = inputText.trim();
    setMessages((p) => [...p, {
      id: Date.now().toString(), text: userText, sender: 'user', timestamp: new Date(),
    }]);
    setInputText('');
    setIsTyping(true);

    const wasFirstMessage = isFirstMessage;
    if (isFirstMessage) setIsFirstMessage(false);

    try {
      const res = await sendChatMessage(sessionId, userText);
      const rawAi = res.content || res.ai_response || res.data?.content || res.data?.ai_response || 'Maaf, tidak ada respons.';
      const aiText = stripMarkdown(rawAi);
      setMessages((p) => [...p, {
        id: (Date.now() + 1).toString(), text: aiText, sender: 'ai', timestamp: new Date(),
      }]);

      if (wasFirstMessage) {
        try {
          await updateChatSession(sessionId, buildTitle(userText));
        } catch (err) {
          logError('AIAssistant.updateChatSession', err);
        }
      }
    } catch (err) {
      logError('AIAssistant.sendMessage', err);
      setMessages((p) => [...p, {
        id: (Date.now() + 1).toString(),
        text: 'Maaf, terjadi kesalahan: ' + toUserMessage(err),
        sender: 'ai',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
      refreshHistory();
    }
  };

  const formatTime = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const TypingIndicator = () => (
    <View style={styles.rowAI}>
      <View style={styles.aiAvatar}><View style={styles.aiAvatarDot} /></View>
      <View style={styles.typingBubble}>
        {[0, 1, 2].map((i) => (
          <Animated.View key={i} style={[styles.typingDot, {
            opacity: typingAnim.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: i === 0 ? [0.25, 1, 0.25] : i === 1 ? [0.25, 0.25, 1] : [1, 0.25, 0.25],
            }),
          }]} />
        ))}
      </View>
    </View>
  );

  if (loadingSession) return (
    <View style={styles.centerScreen}>
      <ActivityIndicator size="large" color="#7CB9D8" />
      <Text style={styles.loadingText}>Memuat sesi chat...</Text>
    </View>
  );

  if (sessionError) return (
    <View style={styles.centerScreen}>
      <View style={styles.errorIconWrap}><Ionicons name="wifi-outline" size={28} color="#7CB9D8" /></View>
      <Text style={styles.errorTitle}>Gagal terhubung ke server</Text>
      <Text style={styles.errorDesc}>{sessionError}</Text>
      <TouchableOpacity onPress={initSession} style={styles.retryBtn}>
        <Text style={styles.retryText}>Coba Lagi</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack} style={{ marginTop: 12 }}>
        <Text style={styles.errorBack}>Kembali</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.headerBtn}>
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
          <View style={styles.hamburgerLine} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>UniFlow AI</Text>
          <Text style={styles.headerSub}>Asisten monitoring kualitas air</Text>
        </View>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg) => (
          <View key={msg.id} style={msg.sender === 'user' ? styles.rowUser : styles.rowAI}>
            {msg.sender === 'ai' && (
              <View style={styles.aiAvatar}><View style={styles.aiAvatarDot} /></View>
            )}
            <View style={[styles.bubble, msg.sender === 'user' ? styles.bubbleUser : styles.bubbleAI]}>
              <Text style={msg.sender === 'user' ? styles.bubbleTextUser : styles.bubbleTextAI}>
                {msg.text}
              </Text>
              <Text style={msg.sender === 'user' ? styles.timeUser : styles.timeAI}>
                {formatTime(msg.timestamp)}
              </Text>
            </View>
          </View>
        ))}
        {isTyping && <TypingIndicator />}
        {messages.length === 1 && (
          <View style={styles.suggestedWrap}>
            <Text style={styles.suggestedLabel}>Pertanyaan yang sering diajukan:</Text>
            <View style={styles.suggestedList}>
              {SUGGESTED.map((q, i) => (
                <TouchableOpacity key={i} onPress={() => setInputText(q)} style={styles.suggestedPill}>
                  <Text style={styles.suggestedPillText}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Tanyakan sesuatu..."
          placeholderTextColor="#A8C8D8"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={!inputText.trim() || isTyping}
          style={[styles.sendBtn, (!inputText.trim() || isTyping) && styles.sendBtnDisabled]}
        >
          <Ionicons name="arrow-up" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Drawer overlay */}
      {drawerOpen && (
        <TouchableWithoutFeedback onPress={closeDrawer}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Drawer */}
      <Animated.View style={[styles.drawer, { transform: [{ translateX: drawerAnim }] }]}>
        <View style={styles.drawerHead}>
          <Text style={styles.drawerTitle}>Riwayat Chat</Text>
          <View style={styles.drawerHeadRight}>
            <TouchableOpacity onPress={newSession} style={styles.drawerNewBtn}>
              <Text style={styles.drawerNewText}>+ Baru</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={closeDrawer} style={styles.drawerCloseBtn}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.drawerLabel}>SESI SEBELUMNYA</Text>
        <ScrollView style={styles.drawerList} showsVerticalScrollIndicator={false}>
          {chatHistory.length > 0 ? chatHistory.map((item) => (
            <View
              key={item.id}
              style={[styles.sessionItem, item.id === currentSessionId && styles.sessionItemActive]}
            >
              <TouchableOpacity
                onPress={() => loadSession(item.id)}
                style={styles.sessionItemContent}
              >
                <Text
                  style={[styles.sessionTitle, item.id === currentSessionId && styles.sessionTitleActive]}
                  numberOfLines={2}
                >
                  {item.preview}
                </Text>
                <Text style={styles.sessionDate}>{item.date}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDeleteSession(item.id, item.preview)}
                style={styles.sessionDeleteBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {deletingId === item.id
                  ? <ActivityIndicator size="small" color="#E57373" />
                  : <Ionicons name="trash-outline" size={15} color="#B0C8D4" />
                }
              </TouchableOpacity>
            </View>
          )) : (
            <Text style={styles.sessionEmpty}>Belum ada riwayat chat</Text>
          )}
        </ScrollView>
      </Animated.View>

      {/* ══════════════════════════════════════════════════
          ── Delete Confirm Modal ──
      ══════════════════════════════════════════════════ */}
      <Modal
        visible={!!deleteTarget}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center', alignItems: 'center', padding: 32,
        }}>
          <View style={{
            backgroundColor: '#fff', borderRadius: 20,
            padding: 24, width: '100%', maxWidth: 340,
          }}>
            {/* Icon */}
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: '#FEE2E2',
                justifyContent: 'center', alignItems: 'center',
              }}>
                <Ionicons name="trash-outline" size={26} color="#F87171" />
              </View>
            </View>

            {/* Title & message */}
            <Text style={{
              fontSize: 16, fontWeight: '700', color: '#1A3040',
              textAlign: 'center', marginBottom: 8,
            }}>
              Hapus Sesi
            </Text>
            <Text style={{
              fontSize: 13, color: '#6B7280', textAlign: 'center',
              lineHeight: 20, marginBottom: 24,
            }}>
              Hapus sesi{'\n'}
              <Text style={{ fontWeight: '600', color: '#1A3040' }}>
                "{deleteTarget?.preview}"
              </Text>
              ?{'\n'}Semua pesan akan dihapus permanen.
            </Text>

            {/* Buttons */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => setDeleteTarget(null)}
                activeOpacity={0.85}
                style={{
                  flex: 1, borderWidth: 1.5, borderColor: '#D1D5DB',
                  borderRadius: 12, padding: 13, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 14 }}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={doDeleteSession}
                activeOpacity={0.85}
                style={{
                  flex: 1, backgroundColor: '#F87171',
                  borderRadius: 12, padding: 13, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Hapus</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}
