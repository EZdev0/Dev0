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
  Globe,
  Terminal,
} from 'lucide-react-native';
import { IDE } from '@/constants/colors';
import { AI_PROVIDERS, AIProviderType, AppSettings } from '@/types';
import {
  FreePoolState,
  SharedPoolKey,
  GovernanceUser,
  GovernanceRole,
  evaluatePoolKeyStatus,
  maskEmailAddress,
  canManageUsers,
  canViewUserChats,
  detectAuthOrKeyPlaceholder,
} from '@/utils/free-ai-pool';

interface FreeAIPoolModalProps {
  visible: boolean;
  onClose: () => void;
  poolState: FreePoolState;
  settings?: AppSettings;
  onUpdateSettings?: (partial: Partial<AppSettings>) => void;
  onTogglePoolEnabled: (enabled: boolean) => void;
  onShareKeyToPool: (params: {
    provider: AIProviderType;
    model: string;
    rawKey: string;
    tokenLimit: number;
    durationMinutes: number | null;
    targetUserId: string;
    notifyAtPercent?: number;
    emergencyCutoffEnabled?: boolean;
    emergencyCutoffPercent?: number;
  }) => void;
  onRemovePoolKey: (keyId: string) => void;
  onTogglePoolKeyActive: (keyId: string) => void;
  onUpdatePoolKeyThresholds?: (
    keyId: string,
    updates: {
      notifyAtPercent?: number;
      emergencyCutoffEnabled?: boolean;
      emergencyCutoffPercent?: number;
      tokenLimit?: number;
      isActive?: boolean;
    },
  ) => void;
  onSwitchUserIdentity: (
    email: string,
    displayName: string,
    authProvider?: 'google' | 'local',
    ownerPassphrase?: string,
  ) => void;
  onSignInWithFirebaseGoogle?: (
    ownerPassphrase?: string,
  ) => Promise<{ success: boolean; message: string }>;
  onSignOutFirebaseGoogle?: () => Promise<void>;
  onClaimOwnerRole?: (passphrase: string) => boolean;
  onSetUserRole?: (userId: string, role: GovernanceRole) => void;
  onTimeoutUser: (userId: string, minutes: number | null) => void;
  onToggleSuspendUser: (userId: string, reason?: string) => void;
  onUpdateUserTokenQuota: (userId: string, quota: number) => void;
  onClearNotifications: () => void;
}

export const FreeAIPoolModal: React.FC<FreeAIPoolModalProps> = ({
  visible,
  onClose,
  poolState,
  settings,
  onUpdateSettings,
  onTogglePoolEnabled,
  onShareKeyToPool,
  onRemovePoolKey,
  onTogglePoolKeyActive,
  onUpdatePoolKeyThresholds,
  onSwitchUserIdentity,
  onSignInWithFirebaseGoogle,
  onSignOutFirebaseGoogle,
  onClaimOwnerRole,
  onSetUserRole,
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
  const [shareTokenLimit, setShareTokenLimit] = useState<string>('100000');
  const [shareDurationMins, setShareDurationMins] = useState<number | null>(120);
  const [shareTargetUserId, setShareTargetUserId] = useState<string>('*');
  const [shareNotifyPercent, setShareNotifyPercent] = useState<number>(40);
  const [shareEmergencyCutoffEnabled, setShareEmergencyCutoffEnabled] = useState<boolean>(true);
  const [shareEmergencyCutoffPercent, setShareEmergencyCutoffPercent] = useState<number>(50);
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  // Google Sign-In & Owner Claim State
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginName, setLoginName] = useState<string>('');
  const [ownerClaimCode, setOwnerClaimCode] = useState<string>('');
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);
  const [inspectingUserChat, setInspectingUserChat] = useState<GovernanceUser | null>(null);
  const [customQuotaDrafts, setCustomQuotaDrafts] = useState<Record<string, string>>({});
  const [systemPromptDraft, setSystemPromptDraft] = useState<string>(
    settings?.customSystemPrompt || '',
  );
  const [plannerPromptDraft, setPlannerPromptDraft] = useState<string>(
    settings?.customPlannerPrompt || '',
  );
  const [chatPromptDraft, setChatPromptDraft] = useState<string>(
    settings?.customChatModePrompt || '',
  );

  const currentUser = useMemo(
    () =>
      poolState.users.find(u => u.id === poolState.currentUserId) ||
      poolState.users[0],
    [poolState.users, poolState.currentUserId],
  );

  const userRole: GovernanceRole = currentUser?.role || 'user';
  const isOwner = userRole === 'owner';
  const isAdminOrOwner = canManageUsers(userRole);

  const visibleDebugLogs = useMemo(() => {
    const allLogs = poolState.chatDebugLogs || [];
    if (isOwner) return allLogs;
    return allLogs.filter(l => l.userId === poolState.currentUserId);
  }, [poolState.chatDebugLogs, poolState.currentUserId, isOwner]);

  const selectedProviderModels = useMemo(() => {
    const prov = AI_PROVIDERS.find(p => p.id === shareProvider);
    return prov?.models || [{ id: 'default', name: 'Default Model' }];
  }, [shareProvider]);

  const handleCreateSharedKey = () => {
    if (!poolState.isAuthenticated && currentUser?.authProvider === 'guest') {
      setFormFeedback('Please sign in with Google in the Account tab to participate and share keys.');
      setActiveTab('admin');
      return;
    }
    if (!shareRawKey.trim()) {
      setFormFeedback('Please enter an API key to share with the pool.');
      return;
    }
    const keyPlaceholderCheck = detectAuthOrKeyPlaceholder({ apiKey: shareRawKey.trim() });
    if (keyPlaceholderCheck.isPlaceholder) {
      setFormFeedback(keyPlaceholderCheck.reasons.join(' '));
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
      notifyAtPercent: shareNotifyPercent,
      emergencyCutoffEnabled: shareEmergencyCutoffEnabled,
      emergencyCutoffPercent: shareEmergencyCutoffPercent,
    });
    setShareRawKey('');
    setShowAddKeyForm(false);
    setFormFeedback(
      `Key encrypted in Server Vault (/api/pool). Notify at ${shareNotifyPercent}%, Emergency Auto-Cutoff (Not-Aus) at ${shareEmergencyCutoffEnabled ? shareEmergencyCutoffPercent + '%' : 'OFF'}.`,
    );
    setTimeout(() => setFormFeedback(null), 4000);
  };

  const handleFirebaseGooglePopupSignIn = async () => {
    if (onSignInWithFirebaseGoogle) {
      setAuthFeedback('Opening real Firebase Google Sign-In...');
      const res = await onSignInWithFirebaseGoogle(ownerClaimCode.trim() || undefined);
      setAuthFeedback(res.message);
      if (res.success) {
        setOwnerClaimCode('');
      }
      setTimeout(() => setAuthFeedback(null), 5000);
      return;
    }
    handleGoogleSignIn();
  };

  const handleGoogleSignIn = () => {
    const emailToUse = loginEmail.trim();
    if (!emailToUse) {
      setAuthFeedback('Use "Sign in with Google (Firebase)" or enter your real verified Google email (placeholders are blocked).');
      return;
    }
    const placeholderCheck = detectAuthOrKeyPlaceholder({ email: emailToUse });
    if (placeholderCheck.isPlaceholder) {
      setAuthFeedback(`Placeholder blocked: ${placeholderCheck.reasons.join(' ')}`);
      return;
    }
    const nameToUse = loginName.trim() || emailToUse.split('@')[0];
    onSwitchUserIdentity(emailToUse, nameToUse, 'google', ownerClaimCode.trim() || undefined);
    setLoginEmail('');
    setLoginName('');
    setOwnerClaimCode('');
    setAuthFeedback('Signed in with Google. Your workspace and Free AI Pool quotas are now synced.');
    setTimeout(() => setAuthFeedback(null), 4000);
  };

  const handleClaimOwner = () => {
    if (!ownerClaimCode.trim()) {
      setAuthFeedback('Enter your Owner Passphrase (e.g. DEV0-OWNER-2026) to claim Owner governance.');
      return;
    }
    if (onClaimOwnerRole) {
      const ok = onClaimOwnerRole(ownerClaimCode.trim());
      if (ok) {
        setOwnerClaimCode('');
        setAuthFeedback('Owner role verified and activated. Full User & Chat Audit enabled.');
      } else {
        setAuthFeedback('Invalid Owner claim passphrase.');
      }
      setTimeout(() => setAuthFeedback(null), 4000);
    }
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
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Dev0 • AI for Free — Smart Key Pool & Governance</Text>
                <Text style={styles.headerSubtitle}>
                  Session: {currentUser?.displayName} · Role:{' '}
                  {userRole === 'owner'
                    ? 'OWNER (Full Audit)'
                    : userRole === 'admin'
                      ? 'ADMIN (User Mod, No Chat Access)'
                      : 'MEMBER (Private Scope)'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={IDE.muted} />
            </TouchableOpacity>
          </View>

          {/* Guest Sign-In Reminder Banner */}
          {!poolState.isAuthenticated && (
            <TouchableOpacity
              style={styles.signInReminderBanner}
              onPress={() => setActiveTab('admin')}
              activeOpacity={0.8}
            >
              <Globe size={15} color={IDE.warning} />
              <Text style={styles.signInReminderText}>
                Sign in with Google to save your sandboxed projects, participate in AI for Free, and persist token quotas.
              </Text>
              <Text style={styles.signInReminderAction}>Sign In →</Text>
            </TouchableOpacity>
          )}

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
                Chat Debug & Tokens ({visibleDebugLogs.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'admin' && styles.tabBtnActive]}
              onPress={() => setActiveTab('admin')}
            >
              <Users size={14} color={activeTab === 'admin' ? IDE.primary : IDE.muted} />
              <Text style={[styles.tabBtnText, activeTab === 'admin' && styles.tabBtnTextActive]}>
                {isOwner ? 'Owner & Audit' : isAdminOrOwner ? 'Admin & Users' : 'Google Sign-In'}
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
                      Recommended: Use "AI for Free" Auto-Rotating Key Pool
                    </Text>
                    <Text style={styles.recommendDesc}>
                      Automatically routes requests through active shared keys and rotates to the next available key when token or time quotas are reached.
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
                        Your API key is encrypted and masked (••••). Other users can NEVER view your raw key or email.
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
                            {m.name} ({m.id})
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
                      placeholder="* (All users) or specific User ID"
                      placeholderTextColor={IDE.muted}
                    />

                    <Text style={styles.inputLabel}>
                      7. Notify Owner At (%) — Early Warning Before Cutoff
                    </Text>
                    <View style={styles.presetRow}>
                      {[25, 40, 50, 75, 80].map(pctVal => (
                        <TouchableOpacity
                          key={pctVal}
                          style={[
                            styles.chipBtn,
                            shareNotifyPercent === pctVal && styles.chipBtnActive,
                          ]}
                          onPress={() => setShareNotifyPercent(pctVal)}
                        >
                          <Text
                            style={[
                              styles.chipBtnText,
                              shareNotifyPercent === pctVal && styles.chipBtnTextActive,
                            ]}
                          >
                            Notify at {pctVal}%
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: 6,
                        marginBottom: 6,
                      }}
                    >
                      <Text style={[styles.inputLabel, { marginBottom: 0 }]}>
                        8. Emergency Auto-Cutoff / Not-Aus (%) — Pauses Key Without Deleting
                      </Text>
                      <Switch
                        value={shareEmergencyCutoffEnabled}
                        onValueChange={setShareEmergencyCutoffEnabled}
                        trackColor={{ false: IDE.border, true: IDE.danger }}
                      />
                    </View>
                    {shareEmergencyCutoffEnabled && (
                      <View style={styles.presetRow}>
                        {[30, 50, 75, 90, 100].map(cutVal => (
                          <TouchableOpacity
                            key={cutVal}
                            style={[
                              styles.chipBtn,
                              shareEmergencyCutoffPercent === cutVal && styles.chipBtnActive,
                            ]}
                            onPress={() => setShareEmergencyCutoffPercent(cutVal)}
                          >
                            <Text
                              style={[
                                styles.chipBtnText,
                                shareEmergencyCutoffPercent === cutVal && styles.chipBtnTextActive,
                              ]}
                            >
                              {cutVal === 50 ? '50% Not-Aus (Default)' : `Cutoff at ${cutVal}%`}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.submitShareBtn}
                      onPress={handleCreateSharedKey}
                    >
                      <Shield size={16} color="#fff" />
                      <Text style={styles.submitShareBtnText}>
                        Add Masked Key to Server Vault & Pool
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
                  const notifyPct = k.notifyAtPercent ?? 40;
                  const cutoffEnabled = k.emergencyCutoffEnabled !== false;
                  const cutoffPct = k.emergencyCutoffPercent ?? 50;
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
                            {status === 'emergency_stop' ? 'NOT-AUS (50% CUTOFF)' : status.toUpperCase()}
                          </Text>
                          {(isAdminOrOwner || k.ownerUserId === poolState.currentUserId) && (
                            <TouchableOpacity
                              style={styles.smallIconBtn}
                              onPress={() => {
                                if (status === 'emergency_stop' && onUpdatePoolKeyThresholds) {
                                  onUpdatePoolKeyThresholds(k.id, {
                                    emergencyCutoffEnabled: false,
                                    isActive: true,
                                  });
                                } else {
                                  onTogglePoolKeyActive(k.id);
                                }
                              }}
                            >
                              <Text style={{ fontSize: 11, color: IDE.primary, fontWeight: '600' }}>
                                {status === 'emergency_stop'
                                  ? 'Unlock Not-Aus'
                                  : k.isActive
                                    ? 'Pause'
                                    : 'Resume'}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {(isAdminOrOwner || k.ownerUserId === poolState.currentUserId) && (
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
                        <Text style={styles.keyMetaText}>·</Text>
                        <Text style={[styles.keyMetaText, { color: IDE.warning }]}>
                          Notify: {notifyPct}%
                        </Text>
                        <Text style={styles.keyMetaText}>·</Text>
                        <Text style={[styles.keyMetaText, { color: cutoffEnabled ? IDE.danger : IDE.muted }]}>
                          Not-Aus: {cutoffEnabled ? `${cutoffPct}%` : 'OFF'}
                        </Text>
                      </View>

                      {status === 'emergency_stop' && (
                        <View
                          style={{
                            marginTop: 6,
                            padding: 8,
                            borderRadius: 6,
                            backgroundColor: IDE.danger + '18',
                            borderWidth: 1,
                            borderColor: IDE.danger + '50',
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: IDE.danger }}>
                            Emergency Auto-Cutoff (Not-Aus) Active — Key Paused & Protected (Not Deleted)
                          </Text>
                          <Text style={{ fontSize: 10, color: IDE.text, marginTop: 2 }}>
                            {k.emergencyStopReason ||
                              `Reached ${pct}% of token budget (cutoff set to ${cutoffPct}%). Click "Unlock Not-Aus" to resume or adjust threshold.`}
                          </Text>
                        </View>
                      )}

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

                {/* Per-Chat Real-Time Debug Telemetry */}
                <View style={styles.sectionHeaderRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Terminal size={14} color={IDE.primary} />
                    <Text style={styles.sectionHeading}>
                      Per-Chat Turn Debugger & Token Accounting ({visibleDebugLogs.length})
                    </Text>
                  </View>
                </View>

                {visibleDebugLogs.length === 0 ? (
                  <Text style={styles.emptyNote}>
                    0 chat turns recorded in this session. Send a chat message to inspect real API/BPE token counts, latency, and key routing.
                  </Text>
                ) : (
                  visibleDebugLogs.map(log => (
                    <View key={log.id} style={styles.keyCard}>
                      <View style={styles.keyCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.keyProviderModel}>
                            {log.provider.toUpperCase()} · {log.model}{' '}
                            {log.usedFallback ? '(Fallback)' : ''}
                          </Text>
                          <Text style={styles.maskedKeyText}>
                            {new Date(log.timestamp).toLocaleTimeString()} · Latency: {log.latencyMs}ms ·{' '}
                            {log.isExactFromAPI ? 'Exact API Usage' : 'Calibrated BPE'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: IDE.primary }}>
                          {log.totalTokens.toLocaleString()} tok
                        </Text>
                      </View>
                      <Text style={styles.keyMetaText}>
                        Prompt: {log.promptTokens.toLocaleString()} · Completion:{' '}
                        {log.completionTokens.toLocaleString()} · Tools:{' '}
                        {log.toolCalls.length > 0 ? log.toolCalls.join(', ') : 'none'}
                      </Text>
                      {log.promptPreview ? (
                        <Text style={[styles.notifMsg, { marginTop: 4 }]} numberOfLines={2}>
                          Prompt: "{log.promptPreview}"
                        </Text>
                      ) : null}
                    </View>
                  ))
                )}

                <View style={[styles.sectionHeaderRow, { marginTop: 12 }]}>
                  <Text style={styles.sectionHeading}>Real-Time Pool Alerts & Key Rotation Logs</Text>
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
                {/* Google Sign-In & Owner Passphrase Claim */}
                <View style={styles.shareFormCard}>
                  <Text style={styles.sectionHeading}>
                    Real Firebase Google Sign-In & Role Verification (Zero Placeholders)
                  </Text>
                  <Text style={styles.recommendDesc}>
                    Sign in with real Firebase Google Authentication (`phoenixos-v11`) to persist your sandboxed projects and manage the AI for Free key vault. All dummy placeholders (`google.user@gmail.com`) are strictly rejected.
                  </Text>

                  {authFeedback && (
                    <View style={[styles.feedbackToast, { marginTop: 8 }]}>
                      <CheckCircle size={14} color={IDE.accent} />
                      <Text style={styles.feedbackToastText}>{authFeedback}</Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      style={[styles.offerKeyBtn, { backgroundColor: IDE.primary, paddingVertical: 10 }]}
                      onPress={handleFirebaseGooglePopupSignIn}
                    >
                      <Globe size={15} color="#fff" />
                      <Text style={styles.offerKeyBtnText}>
                        Sign in with Google (Firebase Auth)
                      </Text>
                    </TouchableOpacity>

                    {poolState.isAuthenticated && onSignOutFirebaseGoogle && (
                      <TouchableOpacity
                        style={[styles.offerKeyBtn, { backgroundColor: IDE.surface, borderWidth: 1, borderColor: IDE.border }]}
                        onPress={() => onSignOutFirebaseGoogle()}
                      >
                        <Text style={[styles.offerKeyBtnText, { color: IDE.text }]}>Sign Out</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <TextInput
                      style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                      value={loginEmail}
                      onChangeText={setLoginEmail}
                      placeholder="Verified Google Email (no placeholders)"
                      placeholderTextColor={IDE.muted}
                      autoCapitalize="none"
                    />
                    <TextInput
                      style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                      value={loginName}
                      onChangeText={setLoginName}
                      placeholder="Display Name"
                      placeholderTextColor={IDE.muted}
                    />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
                    <TextInput
                      style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                      value={ownerClaimCode}
                      onChangeText={setOwnerClaimCode}
                      placeholder="Owner Claim Passphrase (e.g. DEV0-OWNER-2026)"
                      placeholderTextColor={IDE.muted}
                      secureTextEntry
                      autoCapitalize="characters"
                    />
                    {loginEmail.trim().length > 0 && (
                      <TouchableOpacity
                        style={[styles.offerKeyBtn, { backgroundColor: IDE.primary }]}
                        onPress={handleGoogleSignIn}
                      >
                        <UserCheck size={14} color="#fff" />
                        <Text style={styles.offerKeyBtnText}>Verify Email</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.offerKeyBtn, { backgroundColor: IDE.accent }]}
                      onPress={handleClaimOwner}
                    >
                      <Shield size={14} color="#000" />
                      <Text style={[styles.offerKeyBtnText, { color: '#000' }]}>Claim Owner</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Owner / Admin Live System Prompts & Agent Rules Controller */}
                {isAdminOrOwner && onUpdateSettings && (
                  <View style={styles.shareFormCard}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionHeading}>
                        Owner / Admin Live System Prompts & Agent Directives (100% English)
                      </Text>
                    </View>
                    <Text style={styles.recommendDesc}>
                      Directly control the English system prompts injected into Dev0 Main Agent, Planner, and Normal Chat Mode in real time.
                    </Text>

                    <Text style={[styles.inputLabel, { marginTop: 10 }]}>
                      1. Custom Main Agent System Prompt Override / Directives
                    </Text>
                    <TextInput
                      style={[styles.textInput, { minHeight: 72, textAlignVertical: 'top' }]}
                      value={systemPromptDraft}
                      onChangeText={setSystemPromptDraft}
                      multiline
                      placeholder="Optional custom English instructions injected at the top of Dev0's system prompt..."
                      placeholderTextColor={IDE.muted}
                    />

                    <Text style={styles.inputLabel}>
                      2. Custom Planner Prompt Directives (Agent Mode Planning)
                    </Text>
                    <TextInput
                      style={[styles.textInput, { minHeight: 60, textAlignVertical: 'top' }]}
                      value={plannerPromptDraft}
                      onChangeText={setPlannerPromptDraft}
                      multiline
                      placeholder="Optional custom English instructions for the Agent Planner..."
                      placeholderTextColor={IDE.muted}
                    />

                    <Text style={styles.inputLabel}>
                      3. Custom Normal Chat Mode Rules
                    </Text>
                    <TextInput
                      style={[styles.textInput, { minHeight: 60, textAlignVertical: 'top' }]}
                      value={chatPromptDraft}
                      onChangeText={setChatPromptDraft}
                      multiline
                      placeholder="Optional custom English instructions for Normal Chat Mode..."
                      placeholderTextColor={IDE.muted}
                    />

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <TouchableOpacity
                        style={[styles.offerKeyBtn, { backgroundColor: IDE.accent }]}
                        onPress={() => {
                          onUpdateSettings({
                            customSystemPrompt: systemPromptDraft,
                            customPlannerPrompt: plannerPromptDraft,
                            customChatModePrompt: chatPromptDraft,
                          });
                          setAuthFeedback('Live System Prompts saved and applied to Dev0.');
                          setTimeout(() => setAuthFeedback(null), 4000);
                        }}
                      >
                        <CheckCircle size={14} color="#000" />
                        <Text style={[styles.offerKeyBtnText, { color: '#000' }]}>
                          Save & Apply System Prompts
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.offerKeyBtn,
                          { backgroundColor: IDE.surface, borderWidth: 1, borderColor: IDE.border },
                        ]}
                        onPress={() => {
                          setSystemPromptDraft('');
                          setPlannerPromptDraft('');
                          setChatPromptDraft('');
                          onUpdateSettings({
                            customSystemPrompt: '',
                            customPlannerPrompt: '',
                            customChatModePrompt: '',
                          });
                          setAuthFeedback('Reset custom prompt overrides to default English rules.');
                          setTimeout(() => setAuthFeedback(null), 4000);
                        }}
                      >
                        <Text style={[styles.offerKeyBtnText, { color: IDE.muted }]}>
                          Reset to Default
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Role-Scoped Governance View */}
                {!isAdminOrOwner ? (
                  <View style={styles.keyCard}>
                    <Text style={styles.keyProviderModel}>
                      Your Account ({currentUser?.displayName})
                    </Text>
                    <Text style={styles.maskedKeyText}>
                      ID: {currentUser?.id} · Masked Email: {maskEmailAddress(currentUser?.email || '')} · Role: MEMBER
                    </Text>
                    <Text style={[styles.keyMetaText, { marginTop: 6 }]}>
                      Tokens Consumed: {currentUser?.tokensConsumed.toLocaleString()} · Quota:{' '}
                      {currentUser?.tokenQuota && currentUser.tokenQuota > 0
                        ? currentUser.tokenQuota.toLocaleString()
                        : 'Unlimited (No Cap)'}
                    </Text>
                    <Text style={[styles.recommendDesc, { marginTop: 6 }]}>
                      Privacy Guarantee: Regular users and Admins cannot view your private chat history.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.sectionHeading, { marginTop: 12, marginBottom: 8 }]}>
                      {isOwner
                        ? `Owner Governance, Custom Quotas & Full Chat Audit (${poolState.users.length} Users)`
                        : `Admin User Directory (${poolState.users.length} Users — Private Chats Hidden)`}
                    </Text>

                    {poolState.users.map(u => {
                      const canAuditThisUserChat = canViewUserChats(
                        userRole,
                        poolState.currentUserId,
                        u.id,
                      );
                      const draftQuota =
                        customQuotaDrafts[u.id] !== undefined
                          ? customQuotaDrafts[u.id]
                          : String(u.tokenQuota || 0);
                      return (
                        <View key={u.id} style={styles.keyCard}>
                          <View style={styles.keyCardTop}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.keyProviderModel}>
                                {u.displayName} ({u.role.toUpperCase()})
                              </Text>
                              <Text style={styles.maskedKeyText}>
                                ID: {u.id} · {maskEmailAddress(u.email)} · Auth: {u.authProvider.toUpperCase()}
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
                            {u.tokenQuota > 0 ? u.tokenQuota.toLocaleString() : 'Unlimited (0 = No Cap)'}
                          </Text>

                          {/* Custom Token Quota Setter (No Hardcoded 50k Cap) */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                            <Text style={{ fontSize: 11, color: IDE.muted }}>Custom Token Quota (0=Unlimited):</Text>
                            <TextInput
                              style={[
                                styles.textInput,
                                { width: 110, marginBottom: 0, paddingVertical: 4, paddingHorizontal: 8, fontSize: 11 },
                              ]}
                              value={draftQuota}
                              onChangeText={val =>
                                setCustomQuotaDrafts(prev => ({ ...prev, [u.id]: val }))
                              }
                              keyboardType="numeric"
                              placeholder="0 (Unlimited)"
                              placeholderTextColor={IDE.muted}
                            />
                            <TouchableOpacity
                              style={styles.adminBtn}
                              onPress={() => {
                                const parsed = Math.max(0, parseInt(draftQuota, 10) || 0);
                                onUpdateUserTokenQuota(u.id, parsed);
                              }}
                            >
                              <Text style={[styles.adminBtnText, { color: IDE.accent }]}>Set Quota</Text>
                            </TouchableOpacity>
                            {u.tokenQuota > 0 && (
                              <TouchableOpacity
                                style={styles.adminBtn}
                                onPress={() => {
                                  setCustomQuotaDrafts(prev => ({ ...prev, [u.id]: '0' }));
                                  onUpdateUserTokenQuota(u.id, 0);
                                }}
                              >
                                <Text style={styles.adminBtnText}>Unlimited</Text>
                              </TouchableOpacity>
                            )}
                          </View>

                          {u.role !== 'owner' && (
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

                              {isOwner && onSetUserRole && (
                                <TouchableOpacity
                                  style={styles.adminBtn}
                                  onPress={() =>
                                    onSetUserRole(u.id, u.role === 'admin' ? 'user' : 'admin')
                                  }
                                >
                                  <Shield size={12} color={IDE.accent} />
                                  <Text style={[styles.adminBtnText, { color: IDE.accent }]}>
                                    {u.role === 'admin' ? 'Demote to User' : 'Make Admin'}
                                  </Text>
                                </TouchableOpacity>
                              )}

                              {/* ONLY Owner (or self) can inspect chat excerpts */}
                              {canAuditThisUserChat && (
                                <TouchableOpacity
                                  style={styles.adminBtn}
                                  onPress={() => setInspectingUserChat(u)}
                                >
                                  <MessageSquare size={12} color={IDE.primary} />
                                  <Text style={[styles.adminBtnText, { color: IDE.primary }]}>
                                    Owner Audit Chat ({u.recentChatExcerpts.length})
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {inspectingUserChat && isOwner && (
                      <View style={styles.shareFormCard}>
                        <View style={styles.sectionHeaderRow}>
                          <Text style={styles.sectionHeading}>
                            Owner Chat Audit: {inspectingUserChat.displayName}
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
    maxWidth: 660,
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
  signInReminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: IDE.warning + '18',
    borderBottomWidth: 1,
    borderBottomColor: IDE.warning + '40',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  signInReminderText: {
    flex: 1,
    fontSize: 11,
    color: IDE.text,
  },
  signInReminderAction: {
    fontSize: 11,
    fontWeight: '700',
    color: IDE.warning,
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
    flex: 1,
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
