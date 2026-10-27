import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import {
  Sparkles,
  Key,
  Shield,
  Clock,
  Activity,
  Bell,
  Users,
  Plus,
  Trash2,
  X,
  CheckCircle,
  AlertTriangle,
  Lock,
  UserCheck,
  Ban,
  MessageSquare,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { AI_PROVIDERS, AIProviderType } from '@/types';
import {
  FreePoolState,
  SharedPoolKey,
  GovernanceUser,
  evaluatePoolKeyStatus,
} from '@/utils/free-ai-pool';

interface FreeAIPoolModalProps {
  visible: boolean;
  onClose: () => void;
  poolState: FreePoolState;
  onTogglePoolEnabled: (enabled: boolean) => void;
  onShareKeyToPool: (params: {
    provider: AIProviderType;
    model: string;
    rawKey: string;
    tokenLimit: number;
    durationMinutes: number | null;
    targetUserId: string;
  }) => void;
  onRemovePoolKey: (keyId: string) => void;
  onTogglePoolKeyActive: (keyId: string) => void;
  onSwitchUserIdentity: (email: string, displayName: string) => void;
  onTimeoutUser: (userId: string, minutes: number | null) => void;
  onToggleSuspendUser: (userId: string, reason?: string) => void;
  onUpdateUserTokenQuota: (userId: string, quota: number) => void;
  onClearNotifications: () => void;
}

export const FreeAIPoolModal: React.FC<FreeAIPoolModalProps> = ({
  visible,
  onClose,
  poolState,
  onTogglePoolEnabled,
  onShareKeyToPool,
  onRemovePoolKey,
  onTogglePoolKeyActive,
  onSwitchUserIdentity,
  onTimeoutUser,
  onToggleSuspendUser,
  onUpdateUserTokenQuota,
  onClearNotifications,
}) => {
  const [activeTab, setActiveTab] = useState<'pool' | 'telemetry' | 'admin'>('pool');
  const [showAddKeyForm, setShowAddKeyForm] = useState<boolean>(false);

  // Share Key Form State
  const [shareProvider, setShareProvider] = useState<AIProviderType>('groq');
  const [shareModel, setShareModel] = useState<string>('llama-3.3-70b-versatile');
  const [shareRawKey, setShareRawKey] = useState<string>('');
  const [shareTokenLimit, setShareTokenLimit] = useState<string>('50000');
  const [shareDurationMins, setShareDurationMins] = useState<number | null>(120);
  const [shareTargetUserId, setShareTargetUserId] = useState<string>('*');
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  // User Login / Switch State
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginName, setLoginName] = useState<string>('');
  const [inspectingUserChat, setInspectingUserChat] = useState<GovernanceUser | null>(null);

  const currentUser = useMemo(
    () =>
      poolState.users.find(u => u.id === poolState.currentUserId) ||
      poolState.users[0],
    [poolState.users, poolState.currentUserId],
  );

  const isAdmin = currentUser?.role === 'admin';

  const selectedProviderModels = useMemo(() => {
    const prov = AI_PROVIDERS.find(p => p.id === shareProvider);
    return prov?.models || [{ id: 'default', name: 'Default Model' }];
  }, [shareProvider]);

  const handleCreateSharedKey = () => {
    if (!shareRawKey.trim()) {
      setFormFeedback('Please enter an API key to share with the pool.');
      return;
    }
    const parsedLimit = Math.max(0, parseInt(shareTokenLimit, 10) || 0);
    onShareKeyToPool({
      provider: shareProvider,
      model: shareModel,
      rawKey: shareRawKey.trim(),
      tokenLimit: parsedLimit,
      durationMinutes: shareDurationMins,
      targetUserId: shareTargetUserId.trim() || '*',
    });
    setShareRawKey('');
    setShowAddKeyForm(false);
    setFormFeedback('Key encrypted, masked, and added to the AI for Free pool.');
    setTimeout(() => setFormFeedback(null), 4000);
  };

  const formatRemainingTime = (expiresAt: number | null) => {
    if (!expiresAt) return 'Unlimited time';
    const diff = expiresAt - Date.now();
    if (diff <= 0) return 'Expired';
    const mins = Math.ceil(diff / 60000);
    if (mins < 60) return `${mins}m left`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m left`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.floatingWindow}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Sparkles size={20} color={IDE.accent} />
              <View>
                <Text style={styles.headerTitle}>AI for Free — Smart Key Pool & Governance</Text>
                <Text style={styles.headerSubtitle}>
                  User ID: {currentUser?.id} ({currentUser?.role === 'admin' ? 'Super Admin' : 'Member'})
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={IDE.muted} />
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'pool' && styles.tabBtnActive]}
              onPress={() => setActiveTab('pool')}
            >
              <Key size={14} color={activeTab === 'pool' ? IDE.primary : IDE.muted} />
              <Text style={[styles.tabBtnText, activeTab === 'pool' && styles.tabBtnTextActive]}>
                Free Key Pool ({poolState.sharedKeys.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'telemetry' && styles.tabBtnActive]}
              onPress={() => setActiveTab('telemetry')}
            >
              <Activity size={14} color={activeTab === 'telemetry' ? IDE.primary : IDE.muted} />
              <Text style={[styles.tabBtnText, activeTab === 'telemetry' && styles.tabBtnTextActive]}>
                Tokens & Alerts ({poolState.notifications.filter(n => !n.read).length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'admin' && styles.tabBtnActive]}
              onPress={() => setActiveTab('admin')}
            >
              <Users size={14} color={activeTab === 'admin' ? IDE.primary : IDE.muted} />
              <Text style={[styles.tabBtnText, activeTab === 'admin' && styles.tabBtnTextActive]}>
                {isAdmin ? 'Admin & Users' : 'Account'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {activeTab === 'pool' && (
              <>
                {/* Master Pool Toggle Banner */}
                <View style={styles.recommendBanner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recommendTitle}>
                      Recommended: Use "AI for Free" Shared Pool
                    </Text>
                    <Text style={styles.recommendDesc}>
                      Automatically routes requests through available community and shared keys with real-time token tracking and zero key exposure.
                    </Text>
                  </View>
                  <Switch
                    value={poolState.poolEnabled}
                    onValueChange={onTogglePoolEnabled}
                    trackColor={{ false: IDE.border, true: IDE.accent }}
                  />
                </View>

                {formFeedback && (
                  <View style={styles.feedbackToast}>
                    <CheckCircle size={15} color={IDE.accent} />
                    <Text style={styles.feedbackToastText}>{formFeedback}</Text>
                  </View>
                )}

                {/* Action Header */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>Active Masked Keys in Pool</Text>
                  <TouchableOpacity
                    style={styles.offerKeyBtn}
                    onPress={() => setShowAddKeyForm(v => !v)}
                  >
                    <Plus size={15} color="#fff" />
                    <Text style={styles.offerKeyBtnText}>
                      {showAddKeyForm ? 'Cancel' : 'Offer / Share Key'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Share Key Form */}
                {showAddKeyForm && (
                  <View style={styles.shareFormCard}>
                    <View style={styles.securityNoteRow}>
                      <Lock size={14} color={IDE.accent} />
                      <Text style={styles.securityNoteText}>
                        Your API key is encrypted and masked (••••). Other users can NEVER view your raw key.
                      </Text>
                    </View>

                    <Text style={styles.inputLabel}>1. Select Provider</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      {AI_PROVIDERS.filter(p => p.id !== 'custom').map(prov => (
                        <TouchableOpacity
                          key={prov.id}
                          style={[
                            styles.chipBtn,
                            shareProvider === prov.id && styles.chipBtnActive,
                          ]}
                          onPress={() => {
                            setShareProvider(prov.id);
                            if (prov.models[0]) setShareModel(prov.models[0].id);
                          }}
                        >
                          <Text
                            style={[
                              styles.chipBtnText,
                              shareProvider === prov.id && styles.chipBtnTextActive,
                            ]}
                          >
                            {prov.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={styles.inputLabel}>2. Select Model</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                      {selectedProviderModels.map(m => (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.chipBtn, shareModel === m.id && styles.chipBtnActive]}
                          onPress={() => setShareModel(m.id)}
                        >
                          <Text
                            style={[
                              styles.chipBtnText,
                              shareModel === m.id && styles.chipBtnTextActive,
                            ]}
                          >
                            {m.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={styles.inputLabel}>3. API Key (Strictly Masked for Others)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={shareRawKey}
                      onChangeText={setShareRawKey}
                      placeholder="Paste API key (e.g. gsk_..., AIza..., sk-or-...)"
                      placeholderTextColor={IDE.muted}
                      secureTextEntry
                    />

                    <Text style={styles.inputLabel}>4. Max Token Allowance (0 = Unlimited)</Text>
                    <View style={styles.presetRow}>
                      {['10000', '50000', '250000', '1000000', '0'].map(val => (
                        <TouchableOpacity
                          key={val}
                          style={[
                            styles.chipBtn,
                            shareTokenLimit === val && styles.chipBtnActive,
                          ]}
                          onPress={() => setShareTokenLimit(val)}
                        >
                          <Text
                            style={[
                              styles.chipBtnText,
                              shareTokenLimit === val && styles.chipBtnTextActive,
                            ]}
                          >
                            {val === '0' ? 'Unlimited' : `${Number(val) / 1000}k Tokens`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={[styles.textInput, { marginTop: 6 }]}
                      value={shareTokenLimit}
                      onChangeText={setShareTokenLimit}
                      keyboardType="numeric"
                      placeholder="Custom token limit"
                      placeholderTextColor={IDE.muted}
                    />

                    <Text style={styles.inputLabel}>5. Time Duration Limit</Text>
                    <View style={styles.presetRow}>
                      {[
                        { label: '30 Mins', mins: 30 },
                        { label: '2 Hours', mins: 120 },
                        { label: '24 Hours', mins: 1440 },
                        { label: '7 Days', mins: 10080 },
                        { label: 'Unlimited', mins: null },
                      ].map(d => (
                        <TouchableOpacity
                          key={d.label}
                          style={[
                            styles.chipBtn,
                            shareDurationMins === d.mins && styles.chipBtnActive,
                          ]}
                          onPress={() => setShareDurationMins(d.mins)}
                        >
                          <Text
                            style={[
                              styles.chipBtnText,
                              shareDurationMins === d.mins && styles.chipBtnTextActive,
                            ]}
                          >
                            {d.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.inputLabel}>
                      6. Target User ID ("*" for all Free Pool users, or specific User ID)
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={shareTargetUserId}
                      onChangeText={setShareTargetUserId}
                      placeholder="* (All users) or e.g. usr_demo_member_1"
                      placeholderTextColor={IDE.muted}
                    />

                    <TouchableOpacity
                      style={styles.submitShareBtn}
                      onPress={handleCreateSharedKey}
                    >
                      <Shield size={16} color="#fff" />
                      <Text style={styles.submitShareBtnText}>
                        Add Masked Key to Free Pool
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Shared Keys List */}
                {poolState.sharedKeys.map((k: SharedPoolKey) => {
                  const status = evaluatePoolKeyStatus(k);
                  const pct =
                    k.tokenLimit > 0
                      ? Math.min(100, Math.round((k.tokensUsed / k.tokenLimit) * 100))
                      : 0;
                  const statusColor =
                    status === 'active'
                      ? IDE.accent
                      : status === 'warning'
                        ? IDE.warning
                        : IDE.danger;

                  return (
                    <View key={k.id} style={styles.keyCard}>
                      <View style={styles.keyCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.keyProviderModel}>
                            {k.provider.toUpperCase()} · {k.model}
                          </Text>
                          <Text style={styles.maskedKeyText}>{k.maskedKey}</Text>
                        </View>
                        <View style={styles.keyStatusGroup}>
                          <Text style={[styles.keyStatusLabel, { color: statusColor }]}>
                            {status.toUpperCase()}
                          </Text>
                          <TouchableOpacity
                            style={styles.smallIconBtn}
                            onPress={() => onTogglePoolKeyActive(k.id)}
                          >
                            <Text style={{ fontSize: 11, color: IDE.primary, fontWeight: '600' }}>
                              {k.isActive ? 'Pause' : 'Resume'}
                            </Text>
                          </TouchableOpacity>
                          {k.id !== 'pool_builtin_studio_free' && (
                            <TouchableOpacity
                              style={styles.smallIconBtn}
                              onPress={() => onRemovePoolKey(k.id)}
                            >
                              <Trash2 size={14} color={IDE.danger} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>

                      <View style={styles.keyMetaRow}>
                        <Text style={styles.keyMetaText}>
                          Target: {k.targetUserId === '*' ? 'All Free Users (*)' : `User ${k.targetUserId}`}
                        </Text>
                        <Text style={styles.keyMetaText}>·</Text>
                        <Clock size={12} color={IDE.muted} />
                        <Text style={styles.keyMetaText}>{formatRemainingTime(k.expiresAt)}</Text>
                      </View>

                      {/* Token Quota Bar */}
                      <View style={styles.quotaRow}>
                        <Text style={styles.quotaNumbers}>
                          {k.tokensUsed.toLocaleString()} /{' '}
                          {k.tokenLimit > 0 ? k.tokenLimit.toLocaleString() : '∞'} tokens ({pct}%)
                        </Text>
                        <Text style={styles.quotaBreakdown}>
                          P: {k.promptTokensUsed.toLocaleString()} · C: {k.completionTokensUsed.toLocaleString()}
                        </Text>
                      </View>
                      {k.tokenLimit > 0 && (
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${pct}%`, backgroundColor: statusColor },
                            ]}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {activeTab === 'telemetry' && (
              <>
                <View style={styles.telemetryGrid}>
                  <View style={styles.telemetryBox}>
                    <Text style={styles.telemetryLabel}>Prompt Tokens</Text>
                    <Text style={styles.telemetryValue}>
                      {poolState.sessionTokens.prompt.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.telemetryBox}>
                    <Text style={styles.telemetryLabel}>Completion Tokens</Text>
                    <Text style={styles.telemetryValue}>
                      {poolState.sessionTokens.completion.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.telemetryBox}>
                    <Text style={styles.telemetryLabel}>Total Consumed</Text>
                    <Text style={[styles.telemetryValue, { color: IDE.primary }]}>
                      {poolState.sessionTokens.total.toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.telemetryBox}>
                    <Text style={styles.telemetryLabel}>Saved via Compression</Text>
                    <Text style={[styles.telemetryValue, { color: IDE.accent }]}>
                      {poolState.sessionTokens.savedByCompression.toLocaleString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeading}>Real-Time Pool Alerts & Warnings</Text>
                  {poolState.notifications.length > 0 && (
                    <TouchableOpacity onPress={onClearNotifications}>
                      <Text style={{ fontSize: 12, color: IDE.primary, fontWeight: '600' }}>
                        Clear All
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {poolState.notifications.length === 0 ? (
                  <Text style={styles.emptyNote}>No warnings or key rotation alerts.</Text>
                ) : (
                  poolState.notifications.map(n => (
                    <View key={n.id} style={styles.notifCard}>
                      <AlertTriangle
                        size={16}
                        color={
                          n.level === 'critical'
                            ? IDE.danger
                            : n.level === 'warning'
                              ? IDE.warning
                              : IDE.primary
                        }
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.notifTitle}>{n.title}</Text>
                        <Text style={styles.notifMsg}>{n.message}</Text>
                      </View>
                    </View>
                  ))
                )}
              </>
            )}

            {activeTab === 'admin' && (
              <>
                {/* Quick Google / Identity Switcher */}
                <View style={styles.shareFormCard}>
                  <Text style={styles.sectionHeading}>Active User Session (Zero-Config Auth)</Text>
                  <Text style={styles.recommendDesc}>
                    First user is automatically promoted to Super Admin. Switch identities below to test per-User ID key routing.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TextInput
                      style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                      value={loginEmail}
                      onChangeText={setLoginEmail}
                      placeholder="Email (e.g. ggjonasgameryt@gmail.com)"
                      placeholderTextColor={IDE.muted}
                    />
                    <TextInput
                      style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                      value={loginName}
                      onChangeText={setLoginName}
                      placeholder="Display Name"
                      placeholderTextColor={IDE.muted}
                    />
                    <TouchableOpacity
                      style={styles.offerKeyBtn}
                      onPress={() => {
                        if (!loginEmail.trim()) return;
                        onSwitchUserIdentity(
                          loginEmail.trim(),
                          loginName.trim() || loginEmail.trim().split('@')[0],
                        );
                        setLoginEmail('');
                        setLoginName('');
                      }}
                    >
                      <UserCheck size={14} color="#fff" />
                      <Text style={styles.offerKeyBtnText}>Sign In</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Admin User Management List */}
                <Text style={[styles.sectionHeading, { marginTop: 12, marginBottom: 8 }]}>
                  User Governance & Moderation ({poolState.users.length} Users)
                </Text>

                {poolState.users.map(u => (
                  <View key={u.id} style={styles.keyCard}>
                    <View style={styles.keyCardTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.keyProviderModel}>
                          {u.displayName} ({u.role.toUpperCase()})
                        </Text>
                        <Text style={styles.maskedKeyText}>
                          ID: {u.id} · {u.email}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color:
                            u.status === 'active'
                              ? IDE.accent
                              : u.status === 'timeout'
                                ? IDE.warning
                                : IDE.danger,
                        }}
                      >
                        {u.status.toUpperCase()}
                      </Text>
                    </View>

                    <Text style={styles.keyMetaText}>
                      Tokens Consumed: {u.tokensConsumed.toLocaleString()} · Quota:{' '}
                      {u.tokenQuota > 0 ? u.tokenQuota.toLocaleString() : 'Unlimited'}
                    </Text>

                    {isAdmin && u.role !== 'admin' && (
                      <View style={styles.adminActionRow}>
                        <TouchableOpacity
                          style={styles.adminBtn}
                          onPress={() => onTimeoutUser(u.id, 15)}
                        >
                          <Clock size={12} color={IDE.warning} />
                          <Text style={styles.adminBtnText}>15m Timeout</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.adminBtn}
                          onPress={() => onTimeoutUser(u.id, null)}
                        >
                          <Text style={styles.adminBtnText}>Clear Timeout</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.adminBtn}
                          onPress={() => onToggleSuspendUser(u.id, 'Policy violation')}
                        >
                          <Ban size={12} color={IDE.danger} />
                          <Text style={[styles.adminBtnText, { color: IDE.danger }]}>
                            {u.status === 'suspended' ? 'Unsuspend' : 'Suspend'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.adminBtn}
                          onPress={() =>
                            onUpdateUserTokenQuota(
                              u.id,
                              u.tokenQuota === 50000 ? 0 : 50000,
                            )
                          }
                        >
                          <Text style={styles.adminBtnText}>
                            {u.tokenQuota === 50000 ? 'Remove Cap' : 'Cap 50k'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.adminBtn}
                          onPress={() => setInspectingUserChat(u)}
                        >
                          <MessageSquare size={12} color={IDE.primary} />
                          <Text style={[styles.adminBtnText, { color: IDE.primary }]}>
                            Audit Chat ({u.recentChatExcerpts.length})
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}

                {inspectingUserChat && (
                  <View style={styles.shareFormCard}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionHeading}>
                        Chat Audit: {inspectingUserChat.displayName}
                      </Text>
                      <TouchableOpacity onPress={() => setInspectingUserChat(null)}>
                        <X size={16} color={IDE.muted} />
                      </TouchableOpacity>
                    </View>
                    {inspectingUserChat.recentChatExcerpts.length === 0 ? (
                      <Text style={styles.emptyNote}>No recorded chat excerpts for this user.</Text>
                    ) : (
                      inspectingUserChat.recentChatExcerpts.map(ex => (
                        <View key={ex.id} style={styles.notifCard}>
                          <Text style={styles.notifMsg}>
                            [{new Date(ex.timestamp).toLocaleTimeString()}] {ex.text}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  floatingWindow: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    backgroundColor: IDE.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: IDE.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
    backgroundColor: IDE.bg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: IDE.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: IDE.muted,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  closeBtn: {
    padding: 6,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: IDE.border,
    backgroundColor: IDE.bg,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: IDE.primary,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: IDE.muted,
  },
  tabBtnTextActive: {
    color: IDE.primary,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
  },
  recommendBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.accent + '60',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  recommendTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: IDE.text,
    marginBottom: 3,
  },
  recommendDesc: {
    fontSize: 12,
    color: IDE.muted,
    lineHeight: 17,
  },
  feedbackToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: IDE.accent + '20',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  feedbackToastText: {
    fontSize: 12,
    color: IDE.accent,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: IDE.text,
  },
  offerKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: IDE.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
  },
  offerKeyBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  shareFormCard: {
    backgroundColor: IDE.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IDE.border,
    padding: 14,
    marginBottom: 14,
  },
  securityNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  securityNoteText: {
    fontSize: 11,
    color: IDE.accent,
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: IDE.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: IDE.text,
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  chipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    marginRight: 6,
  },
  chipBtnActive: {
    backgroundColor: IDE.primary + '25',
    borderColor: IDE.primary,
  },
  chipBtnText: {
    fontSize: 11,
    color: IDE.muted,
    fontWeight: '600',
  },
  chipBtnTextActive: {
    color: IDE.primary,
  },
  submitShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: IDE.accent,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 6,
  },
  submitShareBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  keyCard: {
    backgroundColor: IDE.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: IDE.border,
    padding: 12,
    marginBottom: 10,
  },
  keyCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  keyProviderModel: {
    fontSize: 13,
    fontWeight: '700',
    color: IDE.text,
  },
  maskedKeyText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: IDE.muted,
    marginTop: 2,
  },
  keyStatusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keyStatusLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  smallIconBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  keyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  keyMetaText: {
    fontSize: 11,
    color: IDE.muted,
  },
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  quotaNumbers: {
    fontSize: 11,
    color: IDE.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  quotaBreakdown: {
    fontSize: 10,
    color: IDE.muted,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 5,
    backgroundColor: IDE.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  telemetryBox: {
    flex: 1,
    minWidth: 130,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    padding: 10,
  },
  telemetryLabel: {
    fontSize: 11,
    color: IDE.muted,
    marginBottom: 4,
  },
  telemetryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: IDE.text,
    fontVariant: ['tabular-nums'],
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  notifTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: IDE.text,
  },
  notifMsg: {
    fontSize: 11,
    color: IDE.muted,
    marginTop: 2,
  },
  emptyNote: {
    fontSize: 12,
    color: IDE.muted,
    textAlign: 'center',
    paddingVertical: 16,
  },
  adminActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  adminBtnText: {
    fontSize: 11,
    color: IDE.textSecondary,
    fontWeight: '600',
  },
});

export default FreeAIPoolModal;
