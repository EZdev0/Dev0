import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Switch, Linking, Alert,
} from 'react-native';
import {
  Key, Eye, EyeOff, ChevronDown, ChevronUp, ExternalLink,
  Minus, Plus, Zap, Globe, Shield, RefreshCw, FlaskConical,
  Info, Check, Sparkles, Star, Copy, CircleCheck, Circle,
  Brain, FileText,
 Heart } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { IDE } from '@/constants/colors';
import { useApp } from '@/providers/AppProvider';
import SponsorBanner from '@/components/SponsorBanner';
import { AI_PROVIDERS, PERSONAS } from '@/types';

interface ProviderMeta {
  desc: string;
  endpoint?: string;
  modelHint?: string;
  pricing?: string;
}

const PROVIDER_INFO: Record<string, ProviderMeta> = {
  rork: {
    desc: 'Free AI directly in Dev0. No API key required.',
    pricing: 'Completely free',
  },
  groq: {
    desc: 'Extremely fast inference with Groq Hardware. Free API key available.',
    endpoint: 'https://console.groq.com/keys',
    modelHint: 'llama-3.3-70b-versatile',
    pricing: 'Free (with limits)',
  },
  gemini: {
    desc: 'Google AI models with generous free tier.',
    endpoint: 'https://aistudio.google.com/app/apikey',
    modelHint: 'gemini-2.0-flash',
    pricing: 'Free (with limits)',
  },
  openai: {
    desc: 'GPT-4o and GPT-4o Mini by OpenAI.',
    endpoint: 'https://platform.openai.com/api-keys',
    modelHint: 'gpt-4o',
    pricing: 'Paid',
  },
  anthropic: {
    desc: 'Claude Sonnet 4 and Claude 3.5 Haiku by Anthropic.',
    endpoint: 'https://console.anthropic.com/settings/keys',
    modelHint: 'claude-sonnet-4',
    pricing: 'Paid',
  },
  nvidia: {
    desc: 'High performance inference via NVIDIA NIM.',
    endpoint: 'https://build.nvidia.com/explore/discover',
    modelHint: 'Llama models running on NVIDIA infra.',
  },
  openrouter: {
    desc: 'Access to many models via one key. Free and paid options.',
    endpoint: 'https://openrouter.ai/keys',
    modelHint: 'llama-3.3-70b (Free)',
    pricing: 'Free + Paid',
  },
  custom: {
    desc: 'Custom OpenAI-compatible endpoint for local LLMs or other services.',
    pricing: 'Variable',
  },
};

const KEY_MAP: Record<string, string> = {
  groq: 'groqKey',
  gemini: 'geminiKey',
  openai: 'openaiKey',
  anthropic: 'anthropicKey',
  openrouter: 'openrouterKey',
  nvidia: 'nvidiaKey',
  custom: 'customKey',
};

const KEY_PLACEHOLDER: Record<string, string> = {
  groq: 'gsk_...',
  gemini: 'AIza...',
  openai: 'sk-...',
  anthropic: 'sk-ant-...',
  openrouter: 'sk-or-...',
  custom: 'Your API key',
};

export default function SettingsScreen() {
  const { settings, updateSettings, agentMd, setAgentMd, soulMd, setSoulMd, identityMd, setIdentityMd, userMd, setUserMd, memoryMd, setMemoryMd } = useApp();

  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [customModels, setCustomModels] = useState<{ id: string; name: string }[]>([]);
  const [openRouterModels, setOpenRouterModels] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showProviderPicker, setShowProviderPicker] = useState<boolean>(false);
  const [showModelPicker, setShowModelPicker] = useState<boolean>(false);
  const [activeSection, setActiveSection] = useState<'main' | 'beta'>('main');
  const [expandedProviderInfo, setExpandedProviderInfo] = useState<string | null>(null);
  const [editingIdentityFile, setEditingIdentityFile] = useState<string | null>(null);
  const [identityEditContent, setIdentityEditContent] = useState<string>('');

  const currentProvider = useMemo(() => {
    const base = AI_PROVIDERS.find(p => p.id === settings.selectedProvider) ?? AI_PROVIDERS[0];
    if (settings.selectedProvider === 'custom' && customModels.length > 0) {
      return { ...base, models: customModels };
    }
    if (settings.selectedProvider === 'openrouter' && openRouterModels.length > 0) {
      return { ...base, models: openRouterModels };
    }
    return base;
  }, [settings.selectedProvider, customModels, openRouterModels]);
  const currentModel = useMemo(
    () => currentProvider?.models?.find(m => m.id === settings.selectedModel) ?? currentProvider?.models?.[0],
    [currentProvider, settings.selectedModel]
  );

  useEffect(() => {
    let active = true;
    const fetchModels = async () => {
      if (settings.selectedProvider === 'openrouter') {
        if (openRouterModels.length > 0) return;
        setIsLoadingModels(true);
        try {
          const res = await fetch('https://openrouter.ai/api/v1/models');
          const data = await res.json();
          if (active && data?.data) {
            setOpenRouterModels(data.data.map((m: any) => ({ id: m.id, name: m.name })));
          }
        } catch (e) {
          console.log('[Settings] Error fetching OpenRouter models:', e);
        } finally {
          if (active) setIsLoadingModels(false);
        }
      } else if (settings.selectedProvider === 'custom' && settings.customEndpoint) {
        setIsLoadingModels(true);
        try {
          let base = settings.customEndpoint.trim();
          if (base.startsWith('ttps://')) base = 'https://' + base.substring(7);
          else if (base.startsWith('ttp://')) base = 'http://' + base.substring(6);

          if (!base.startsWith('http://') && !base.startsWith('https://') && !base.startsWith('/')) {
            // Allow relative api paths for proxying if not starting with /
            if (!base.startsWith('/')) {
               base = 'https://' + base;
            }
          }
          const url = base.replace(/\/v1\/chat\/completions$/, '').replace(/\/$/, '') + '/v1/models';
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (settings.customKey) headers['Authorization'] = 'Bearer ' + settings.customKey;
          const res = await fetch(url, { headers });
          const data = await res.json();
          if (active && data?.data) {
            setCustomModels(data.data.map((m: any) => ({ id: m.id, name: m.id })));
          }
        } catch (e) {
          console.log('[Settings] Error fetching custom models:', e);
        } finally {
          if (active) setIsLoadingModels(false);
        }
      }
    };
    fetchModels();
    return () => { active = false; };
  }, [settings.selectedProvider, settings.customEndpoint, settings.customKey]);

  const toggleKeyVisibility = useCallback((key: string) => {
    setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleProviderChange = useCallback((providerId: string) => {
    const provider = AI_PROVIDERS.find(p => p.id === providerId);
    if (provider && provider.models && provider.models.length > 0) {
      updateSettings({
        selectedProvider: providerId,
        selectedModel: provider.models[0].id,
      });
    }
    setShowProviderPicker(false);
  }, [updateSettings]);

  const handleModelChange = useCallback((modelId: string) => {
    updateSettings({ selectedModel: modelId });
    setShowModelPicker(false);
  }, [updateSettings]);

  const handleCopyEndpoint = useCallback(async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', 'Copied to clipboard.');
    } catch {
      // ignore
    }
  }, []);

  const currentKeyField = KEY_MAP[settings.selectedProvider] as keyof typeof settings | undefined;
  const currentKeyValue = currentKeyField ? (settings[currentKeyField] as string) || '' : '';
  const needsApiKey = settings.selectedProvider !== 'rork';
  const providerInfo = PROVIDER_INFO[settings.selectedProvider] ?? PROVIDER_INFO.custom;

  const configuredProviderCount = useMemo(() => {
    let count = 1;
    if (settings.groqKey) count++;
    if (settings.geminiKey) count++;
    if (settings.openaiKey) count++;
    if (settings.anthropicKey) count++;
    if (settings.openrouterKey) count++;
    if (settings.nvidiaKey) count++;
    if (settings.customKey && settings.customEndpoint) count++;
    return count;
  }, [settings]);

  return (
    <View style={{ flex: 1, backgroundColor: IDE.bg }}>
      <SponsorBanner style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 0 }} />
      <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionTabs}>
        <TouchableOpacity
          style={[styles.sectionTab, activeSection === 'main' && styles.sectionTabActive]}
          onPress={() => setActiveSection('main')}
          activeOpacity={0.7}
        >
          <Text style={[styles.sectionTabText, activeSection === 'main' && styles.sectionTabTextActive]}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sectionTab, activeSection === 'beta' && styles.sectionTabActive]}
          onPress={() => setActiveSection('beta')}
          activeOpacity={0.7}
        >
          <FlaskConical size={13} color={activeSection === 'beta' ? IDE.warning : IDE.muted} />
          <Text style={[styles.sectionTabText, activeSection === 'beta' && styles.sectionTabTextBeta]}>Beta</Text>
        </TouchableOpacity>
      </View>

      {activeSection === 'main' ? (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>AI PROVIDER</Text>
              <View style={styles.providerCountBadge}>
                <Text style={styles.providerCountText}>{configuredProviderCount} active</Text>
              </View>
            </View>

            <View style={styles.activeProviderCard}>
              <View style={styles.activeProviderTop}>
                <View style={[styles.providerIconLarge, currentProvider?.free ? styles.providerIconFree : styles.providerIconPaid]}>
                  {currentProvider?.free ? <Sparkles size={18} color="#fff" /> : <Globe size={18} color="#fff" />}
                </View>
                <View style={styles.activeProviderInfo}>
                  <View style={styles.providerNameRow}>
                    <Text style={styles.activeProviderName}>{currentProvider?.name ?? 'Unknown'}</Text>
                  </View>
                  <Text style={styles.activeProviderModel}>
                    {currentModel?.name ?? 'No Model'}
                  </Text>
                  {providerInfo?.pricing && (
                    <View style={[
                      styles.pricingBadge,
                      currentProvider?.free ? styles.pricingBadgeFree : styles.pricingBadgePaid,
                    ]}>
                      <Text style={[
                        styles.pricingBadgeText,
                        currentProvider?.free ? styles.pricingTextFree : styles.pricingTextPaid,
                      ]}>
                        {providerInfo.pricing}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {!needsApiKey && (
                <View style={styles.freeNotice}>
                  <CircleCheck size={14} color={IDE.accent} />
                  <Text style={styles.freeNoticeText}>Ready to use — no key needed</Text>
                </View>
              )}

              {needsApiKey && (
                <View style={styles.keySection}>
                  <View style={styles.keyInputRow}>
                    <Key size={14} color={IDE.muted} />
                    <TextInput
                      style={styles.keyInput}
                      value={currentKeyValue}
                      onChangeText={(v) => {
                        if (currentKeyField) {
                          updateSettings({ [currentKeyField]: v } as any);
                        }
                      }}
                      placeholder={KEY_PLACEHOLDER[settings.selectedProvider] || 'API Key'}
                      placeholderTextColor={IDE.muted}
                      secureTextEntry={!showKeys[settings.selectedProvider]}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      onPress={() => toggleKeyVisibility(settings.selectedProvider)}
                      style={styles.eyeBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {showKeys[settings.selectedProvider] ? (
                        <EyeOff size={16} color={IDE.muted} />
                      ) : (
                        <Eye size={16} color={IDE.muted} />
                      )}
                    </TouchableOpacity>
                  </View>
                  <View style={styles.keyActions}>
                    {currentKeyValue ? (
                      <View style={styles.keyConfigured}>
                        <CircleCheck size={12} color={IDE.accent} />
                        <Text style={styles.keyConfiguredText}>Configured</Text>
                      </View>
                    ) : (
                      <View style={styles.keyMissing}>
                        <Circle size={12} color={IDE.muted} />
                        <Text style={styles.keyMissingText}>Not configured</Text>
                      </View>
                    )}
                    {providerInfo?.endpoint && (
                      <TouchableOpacity
                        style={styles.getKeyBtn}
                        onPress={() => Linking.openURL(providerInfo.endpoint!)}
                        activeOpacity={0.7}
                      >
                        <ExternalLink size={11} color={IDE.primary} />
                        <Text style={styles.getKeyBtnText}>Get Key</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {settings.selectedProvider === 'custom' && (
                <View style={styles.customSection}>
                  <Text style={styles.fieldLabel}>Endpoint URL</Text>
                  <TextInput
                    style={styles.inputField}
                    value={settings.customEndpoint}
                    onChangeText={(v) => updateSettings({ customEndpoint: v })}
                    placeholder="https://api.example.com"
                    placeholderTextColor={IDE.muted}
                    autoCapitalize="none"
                  />
                </View>
              )}
            </View>

            <View style={styles.providerActions}>
              <TouchableOpacity
                style={styles.changeProviderBtn}
                onPress={() => setShowProviderPicker(!showProviderPicker)}
                activeOpacity={0.7}
              >
                <Text style={styles.changeProviderBtnText}>
                  {showProviderPicker ? 'Hide Providers' : 'Change Provider'}
                </Text>
                {showProviderPicker ? (
                  <ChevronUp size={14} color={IDE.primary} />
                ) : (
                  <ChevronDown size={14} color={IDE.primary} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modelSelectBtn}
                onPress={() => setShowModelPicker(!showModelPicker)}
                activeOpacity={0.7}
              >
                <Zap size={13} color={IDE.accent} />
                <Text style={styles.modelSelectText} numberOfLines={1}>{isLoadingModels ? 'Loading...' : (currentModel?.name ?? 'Model')}</Text>
                {showModelPicker ? (
                  <ChevronUp size={14} color={IDE.muted} />
                ) : (
                  <ChevronDown size={14} color={IDE.muted} />
                )}
              </TouchableOpacity>
            </View>

            {showProviderPicker && (
              <View style={styles.providerList}>
                {AI_PROVIDERS.map(p => {
                  const isActive = settings.selectedProvider === p.id;
                  const pInfo = PROVIDER_INFO[p.id];
                  const isExpanded = expandedProviderInfo === p.id;
                  return (
                    <View key={p.id} style={[styles.providerListItem, isActive && styles.providerListItemActive]}>
                      <TouchableOpacity
                        style={styles.providerListItemMain}
                        onPress={() => handleProviderChange(p.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.providerListLeft}>
                          <View style={[
                            styles.providerDot,
                            isActive ? styles.providerDotActive : styles.providerDotInactive,
                          ]}>
                            {isActive && <Check size={10} color="#fff" />}
                          </View>
                          <View style={styles.providerListInfo}>
                            <View style={styles.providerListNameRow}>
                              <Text style={[styles.providerListName, isActive && styles.providerListNameActive]}>
                                {(p.name ?? '').replace(' ★ Kostenlos', '')}
                              </Text>
                              {p.free && (
                                <View style={styles.freePill}>
                                  <Text style={styles.freePillText}>FREE</Text>
                                </View>
                              )}
                            </View>
                            {pInfo?.pricing && (
                              <Text style={styles.providerListPricing}>{pInfo.pricing}</Text>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          onPress={() => setExpandedProviderInfo(isExpanded ? null : p.id)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          style={styles.providerInfoToggle}
                        >
                          <Info size={14} color={IDE.muted} />
                        </TouchableOpacity>
                      </TouchableOpacity>

                      {isExpanded && pInfo && (
                        <View style={styles.providerInfoExpanded}>
                          <Text style={styles.providerInfoDesc}>{pInfo.desc}</Text>
                          {pInfo.endpoint && (
                            <TouchableOpacity
                              style={styles.providerInfoEndpoint}
                              onPress={() => handleCopyEndpoint(pInfo.endpoint!)}
                              activeOpacity={0.7}
                            >
                              <Copy size={10} color={IDE.muted} />
                              <Text style={styles.providerInfoEndpointText} numberOfLines={1}>
                                {pInfo.endpoint}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {pInfo.modelHint && (
                            <Text style={styles.providerInfoHint}>Recommended: {pInfo.modelHint}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {showModelPicker && (
              <View style={styles.modelList}>
                {(currentProvider?.models ?? []).map(m => {
                  const isSelected = settings.selectedModel === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.modelListItem, isSelected && styles.modelListItemActive]}
                      onPress={() => handleModelChange(m.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modelListName, isSelected && styles.modelListNameActive]}>
                        {m.name}
                      </Text>
                      {isSelected && <Check size={14} color={IDE.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ADDITIONAL API KEYS</Text>
            <Text style={styles.sectionSubtitle}>
              For auto-fallback on rate limits.
            </Text>

            {AI_PROVIDERS.filter(p => p.id !== 'rork' && p.id !== 'custom' && p.id !== settings.selectedProvider).map(p => {
              const keyField = KEY_MAP[p.id] as keyof typeof settings;
              const keyValue = keyField ? (settings[keyField] as string) || '' : '';
              const pInfo = PROVIDER_INFO[p.id];
              return (
                <View key={p.id} style={styles.extraKeyCard}>
                  <View style={styles.extraKeyHeader}>
                    <View style={styles.extraKeyLeft}>
                      <Text style={styles.extraKeyName}>{(p.name ?? '').replace(' ★ Kostenlos', '')}</Text>
                      {p.free && <View style={styles.freePillSm}><Text style={styles.freePillSmText}>FREE</Text></View>}
                    </View>
                    {keyValue ? (
                      <View style={styles.keyConfiguredSm}>
                        <CircleCheck size={10} color={IDE.accent} />
                        <Text style={styles.keyConfiguredSmText}>OK</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.keyInputRowSm}>
                    <Key size={12} color={IDE.muted} />
                    <TextInput
                      style={styles.keyInputSm}
                      value={keyValue}
                      onChangeText={(v) => updateSettings({ [keyField]: v } as any)}
                      placeholder={KEY_PLACEHOLDER[p.id] || '...'}
                      placeholderTextColor={IDE.muted}
                      secureTextEntry={!showKeys[p.id]}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      onPress={() => toggleKeyVisibility(p.id)}
                      style={styles.eyeBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {showKeys[p.id] ? <EyeOff size={14} color={IDE.muted} /> : <Eye size={14} color={IDE.muted} />}
                    </TouchableOpacity>
                  </View>
                  {pInfo?.endpoint && !keyValue && (
                    <TouchableOpacity
                      style={styles.getKeyLinkSm}
                      onPress={() => Linking.openURL(pInfo.endpoint!)}
                      activeOpacity={0.7}
                    >
                      <ExternalLink size={10} color={IDE.primary} />
                      <Text style={styles.getKeyLinkSmText}>{p.free ? 'Get free key' : 'Get key'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PERSONA</Text>
            <View style={styles.personaGrid}>
              {PERSONAS.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.personaCard, settings.persona === p.id && styles.personaCardActive]}
                  onPress={() => updateSettings({ persona: p.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.personaRow}>
                    <View style={[styles.personaRadio, settings.persona === p.id && styles.personaRadioActive]}>
                      {settings.persona === p.id && <View style={styles.personaRadioDot} />}
                    </View>
                    <View style={styles.personaContent}>
                      <Text style={[styles.personaName, settings.persona === p.id && styles.personaNameActive]}>
                        {p.name}
                      </Text>
                      <Text style={styles.personaDesc}>{p.description}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EDITOR</Text>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Font Size</Text>
              <View style={styles.stepper}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => updateSettings({ fontSize: Math.max(10, settings.fontSize - 1) })}
                >
                  <Minus size={14} color={IDE.text} />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{settings.fontSize}px</Text>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => updateSettings({ fontSize: Math.min(24, settings.fontSize + 1) })}
                >
                  <Plus size={14} color={IDE.text} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Line Numbers</Text>
              <Switch
                value={settings.showLineNumbers}
                onValueChange={(v) => updateSettings({ showLineNumbers: v })}
                trackColor={{ false: IDE.border, true: IDE.primary + '60' }}
                thumbColor={settings.showLineNumbers ? IDE.primary : IDE.muted}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Word Wrap</Text>
              <Switch
                value={settings.wordWrap}
                onValueChange={(v) => updateSettings({ wordWrap: v })}
                trackColor={{ false: IDE.border, true: IDE.primary + '60' }}
                thumbColor={settings.wordWrap ? IDE.primary : IDE.muted}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BEHAVIOR</Text>
            <View style={styles.settingRow}>
              <View style={styles.settingLabelRow}>
                <Zap size={14} color={IDE.warning} />
                <Text style={styles.settingLabel}>YOLO Mode</Text>
              </View>
              <Switch
                value={settings.yoloMode}
                onValueChange={(v) => updateSettings({ yoloMode: v })}
                trackColor={{ false: IDE.border, true: IDE.warning + '60' }}
                thumbColor={settings.yoloMode ? IDE.warning : IDE.muted}
              />
            </View>
            <Text style={styles.settingHint}>AI creates/edits files without asking.</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelRow}>
                <RefreshCw size={14} color={IDE.primary} />
                <Text style={styles.settingLabel}>Auto-Retry</Text>
              </View>
              <Switch
                value={settings.autoRetry}
                onValueChange={(v) => updateSettings({ autoRetry: v })}
                trackColor={{ false: IDE.border, true: IDE.primary + '60' }}
                thumbColor={settings.autoRetry ? IDE.primary : IDE.muted}
              />
            </View>
            <Text style={styles.settingHint}>Automatically retry on rate limits (429).</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelRow}>
                <Shield size={14} color={IDE.accent} />
                <Text style={styles.settingLabel}>Auto-Fallback</Text>
              </View>
              <Switch
                value={settings.autoFallback}
                onValueChange={(v) => updateSettings({ autoFallback: v })}
                trackColor={{ false: IDE.border, true: IDE.accent + '60' }}
                thumbColor={settings.autoFallback ? IDE.accent : IDE.muted}
              />
            </View>
            <Text style={styles.settingHint}>Switch to another provider on rate limit.</Text>
          </View>
        </>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BETA FEATURES</Text>
            <View style={styles.betaWarning}>
              <Text style={styles.betaWarningText}>
                Beta features can be unstable and may change at any time.
              </Text>
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelRow}>
                <FlaskConical size={14} color={IDE.warning} />
                <Text style={styles.settingLabel}>HTML Preview</Text>
              </View>
              <Switch
                value={settings.betaHtmlPreview}
                onValueChange={(v) => updateSettings({ betaHtmlPreview: v })}
                trackColor={{ false: IDE.border, true: IDE.warning + '60' }}
                thumbColor={settings.betaHtmlPreview ? IDE.warning : IDE.muted}
              />
            </View>
            <Text style={styles.settingHint}>HTML preview for .html files in the editor.</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelRow}>
                <Globe size={14} color={IDE.warning} />
                <Text style={styles.settingLabel}>Web Search</Text>
              </View>
              <Switch
                value={settings.betaWebSearch}
                onValueChange={(v) => updateSettings({ betaWebSearch: v })}
                trackColor={{ false: IDE.border, true: IDE.warning + '60' }}
                thumbColor={settings.betaWebSearch ? IDE.warning : IDE.muted}
              />
            </View>
            <Text style={styles.settingHint}>AI can search the web (DuckDuckGo).</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelRow}>
                <Globe size={14} color={IDE.warning} />
                <Text style={styles.settingLabel}>Web Fetch</Text>
              </View>
              <Switch
                value={settings.betaWebFetch}
                onValueChange={(v) => updateSettings({ betaWebFetch: v })}
                trackColor={{ false: IDE.border, true: IDE.warning + '60' }}
                thumbColor={settings.betaWebFetch ? IDE.warning : IDE.muted}
              />
            </View>
            <Text style={styles.settingHint}>AI can load and read website content.</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelRow}>
                <Star size={14} color={IDE.warning} />
                <Text style={styles.settingLabel}>AI Learning</Text>
              </View>
              <Switch
                value={settings.betaAgentLearning}
                onValueChange={(v) => updateSettings({ betaAgentLearning: v })}
                trackColor={{ false: IDE.border, true: IDE.warning + '60' }}
                thumbColor={settings.betaAgentLearning ? IDE.warning : IDE.muted}
              />
            </View>
            <Text style={styles.settingHint}>
              AI learns via 5 identity files: SOUL.md, AGENTS.md, IDENTITY.md, USER.md, MEMORY.md
            </Text>

            {settings.betaAgentLearning && (
              <View style={styles.identityFilesSection}>
                <View style={styles.identityFilesHeader}>
                  <Brain size={14} color={IDE.primary} />
                  <Text style={styles.identityFilesTitle}>Identity Files</Text>
                </View>
                <Text style={styles.identityFilesDesc}>
                  These files define your AI agent's personality and knowledge. They cannot be deleted, only edited.
                </Text>

                {([
                  { key: 'soul', label: 'SOUL.md', desc: 'Personality & Values', value: soulMd, setter: setSoulMd },
                  { key: 'agents', label: 'AGENTS.md', desc: 'Rules & Protocol', value: agentMd, setter: setAgentMd },
                  { key: 'identity', label: 'IDENTITY.md', desc: 'Name, Role & Presentation', value: identityMd, setter: setIdentityMd },
                  { key: 'user', label: 'USER.md', desc: 'User Profile & Preferences', value: userMd, setter: setUserMd },
                  { key: 'memory', label: 'MEMORY.md', desc: 'Long-term Memory', value: memoryMd, setter: setMemoryMd },
                ] as const).map(file => (
                  <View key={file.key} style={styles.identityFileCard}>
                    <TouchableOpacity
                      style={styles.identityFileHeader}
                      onPress={() => {
                        if (editingIdentityFile === file.key) {
                          setEditingIdentityFile(null);
                        } else {
                          setEditingIdentityFile(file.key);
                          setIdentityEditContent(file.value || '');
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.identityFileLeft}>
                        <FileText size={13} color={IDE.primary} />
                        <View>
                          <Text style={styles.identityFileName}>{file.label}</Text>
                          <Text style={styles.identityFileDesc}>{file.desc}</Text>
                        </View>
                      </View>
                      <View style={styles.identityFileRight}>
                        <View style={[styles.identityFileBadge, file.value ? styles.identityFileBadgeActive : styles.identityFileBadgeEmpty]}>
                          <Text style={[styles.identityFileBadgeText, file.value ? styles.identityFileBadgeTextActive : styles.identityFileBadgeTextEmpty]}>
                            {file.value ? (file.value.split('\n').length + ' lines') : 'Empty'}
                          </Text>
                        </View>
                        {editingIdentityFile === file.key ? (
                          <ChevronUp size={14} color={IDE.muted} />
                        ) : (
                          <ChevronDown size={14} color={IDE.muted} />
                        )}
                      </View>
                    </TouchableOpacity>

                    {editingIdentityFile === file.key && (
                      <View style={styles.identityFileEditor}>
                        <TextInput
                          style={styles.identityFileInput}
                          value={identityEditContent}
                          onChangeText={setIdentityEditContent}
                          placeholder={'Enter content for ' + file.label + '...'}
                          placeholderTextColor={IDE.muted}
                          multiline
                          textAlignVertical="top"
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                        <View style={styles.identityFileActions}>
                          <TouchableOpacity
                            style={styles.identityFileCancelBtn}
                            onPress={() => setEditingIdentityFile(null)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.identityFileCancelText}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.identityFileSaveBtn}
                            onPress={() => {
                              file.setter(identityEditContent);
                              setEditingIdentityFile(null);
                            }}
                            activeOpacity={0.7}
                          >
                            <Check size={13} color="#fff" />
                            <Text style={styles.identityFileSaveText}>Save</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.settingRow}>
              <View style={styles.settingLabelRow}>
                <Sparkles size={14} color={IDE.warning} />
                <Text style={styles.settingLabel}>Super Agent Mode</Text>
              </View>
              <Switch
                value={settings.betaSuperAgent}
                onValueChange={(v) => updateSettings({ betaSuperAgent: v })}
                trackColor={{ false: IDE.border, true: IDE.warning + '60' }}
                thumbColor={settings.betaSuperAgent ? IDE.warning : IDE.muted}
              />
            </View>
            <Text style={styles.settingHint}>
              Main agent can autonomously create tasks and control sub-agents.
            </Text>

            <View style={styles.settingRow}>
              <View style={styles.settingLabelRow}>
                <Brain size={14} color={IDE.primary} />
                <Text style={styles.settingLabel}>Agent Mode</Text>
              </View>
              <Switch
                value={settings.agentMode}
                onValueChange={(v) => updateSettings({ agentMode: v })}
                trackColor={{ false: IDE.border, true: IDE.primary + '60' }}
                thumbColor={settings.agentMode ? IDE.primary : IDE.muted}
              />
            </View>
            <Text style={styles.settingHint}>
              Show todo graphics before execution. With Super Agent: interactive question phase.
            </Text>
          </View>

          <View style={styles.section}>
            <View style={styles.settingRow}>
              <View style={styles.settingLabelRow}>
                <Heart size={14} color={IDE.primary} />
                <Text style={styles.settingLabel}>Hide Sponsor Message</Text>
              </View>
              <Switch
                value={settings.hideSponsor}
                onValueChange={(v) => updateSettings({ hideSponsor: v })}
                trackColor={{ false: IDE.border, true: IDE.primary + '60' }}
                thumbColor={settings.hideSponsor ? IDE.primary : IDE.muted}
              />
            </View>
            <Text style={styles.settingHint}>
              Hide the occasional sponsor message in the chat.
            </Text>
          </View>


          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TOOL MANAGEMENT</Text>
            <Text style={styles.sectionSubtitle}>
              Manage tool permissions in the Tools tab.
            </Text>
            <View style={styles.toolNote}>
              <Info size={12} color={IDE.accent} />
              <Text style={styles.toolNoteText}>
                All providers support tool calls. Studio AI (Free) uses tools automatically.
              </Text>
            </View>
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Dev0 v1.4</Text>
        <Text style={styles.footerSubtext}>Mobile Code Editor with AI Assistant</Text>
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IDE.bg },
  content: { padding: 16, paddingBottom: 80 },
  sectionTabs: {
    flexDirection: 'row' as const,
    gap: 8,
    marginBottom: 20,
  },
  sectionTab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  sectionTabActive: {
    backgroundColor: IDE.primary + '18',
    borderColor: IDE.primary + '50',
  },
  sectionTabText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: IDE.muted,
  },
  sectionTabTextActive: {
    color: IDE.primary,
  },
  sectionTabTextBeta: {
    color: IDE.warning,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: IDE.muted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: IDE.muted,
    marginBottom: 10,
  },
  providerCountBadge: {
    backgroundColor: IDE.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  providerCountText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: IDE.primary,
  },

  activeProviderCard: {
    backgroundColor: IDE.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: IDE.border,
    overflow: 'hidden' as const,
  },
  activeProviderTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 14,
    gap: 12,
  },
  providerIconLarge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  providerIconFree: {
    backgroundColor: IDE.accent,
  },
  providerIconPaid: {
    backgroundColor: IDE.primary,
  },
  activeProviderInfo: {
    flex: 1,
  },
  providerNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  activeProviderName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: IDE.text,
  },
  activeProviderModel: {
    fontSize: 12,
    color: IDE.muted,
    marginTop: 2,
  },
  pricingBadge: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  pricingBadgeFree: {
    backgroundColor: IDE.accent + '20',
  },
  pricingBadgePaid: {
    backgroundColor: IDE.warning + '15',
  },
  pricingBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  pricingTextFree: {
    color: IDE.accent,
  },
  pricingTextPaid: {
    color: IDE.warning,
  },

  freeNotice: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: IDE.accent + '0D',
    borderTopWidth: 1,
    borderTopColor: IDE.accent + '20',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  freeNoticeText: {
    fontSize: 12,
    color: IDE.accent,
    fontWeight: '600' as const,
  },
  keySection: {
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    padding: 12,
  },
  keyInputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  keyInput: {
    flex: 1,
    fontSize: 13,
    color: IDE.text,
    paddingVertical: 10,
    fontFamily: 'monospace',
  },
  eyeBtn: { padding: 4 },
  keyActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 8,
  },
  keyConfigured: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  keyConfiguredText: {
    fontSize: 11,
    color: IDE.accent,
    fontWeight: '600' as const,
  },
  keyMissing: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  keyMissingText: {
    fontSize: 11,
    color: IDE.muted,
  },
  getKeyBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: IDE.primary + '12',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  getKeyBtnText: {
    fontSize: 11,
    color: IDE.primary,
    fontWeight: '600' as const,
  },
  customSection: {
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    padding: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: IDE.muted,
    marginBottom: 6,
  },
  inputField: {
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: IDE.text,
    fontFamily: 'monospace',
  },

  providerActions: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 10,
  },
  changeProviderBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    backgroundColor: IDE.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.primary + '30',
  },
  changeProviderBtnText: {
    fontSize: 12,
    color: IDE.primary,
    fontWeight: '600' as const,
  },
  modelSelectBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    backgroundColor: IDE.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  modelSelectText: {
    fontSize: 12,
    color: IDE.text,
    fontWeight: '500' as const,
    flexShrink: 1,
  },

  providerList: {
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 10,
    marginTop: 8,
    overflow: 'hidden' as const,
  },
  providerListItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IDE.border,
  },
  providerListItemActive: {
    backgroundColor: IDE.primary + '08',
  },
  providerListItemMain: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 12,
  },
  providerListLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    flex: 1,
  },
  providerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
  },
  providerDotActive: {
    backgroundColor: IDE.primary,
    borderColor: IDE.primary,
  },
  providerDotInactive: {
    backgroundColor: 'transparent',
    borderColor: IDE.border,
  },
  providerListInfo: {
    flex: 1,
  },
  providerListNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  providerListName: {
    fontSize: 14,
    color: IDE.textSecondary,
    fontWeight: '500' as const,
  },
  providerListNameActive: {
    color: IDE.primary,
    fontWeight: '700' as const,
  },
  providerListPricing: {
    fontSize: 10,
    color: IDE.muted,
    marginTop: 1,
  },
  providerInfoToggle: {
    padding: 6,
  },
  providerInfoExpanded: {
    backgroundColor: IDE.bg,
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  providerInfoDesc: {
    fontSize: 12,
    color: IDE.textSecondary,
    lineHeight: 18,
  },
  providerInfoEndpoint: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 6,
    backgroundColor: IDE.surface,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  providerInfoEndpointText: {
    fontSize: 11,
    color: IDE.muted,
    fontFamily: 'monospace',
    flex: 1,
  },
  providerInfoHint: {
    fontSize: 11,
    color: IDE.muted,
    marginTop: 6,
    fontStyle: 'italic' as const,
  },
  freePill: {
    backgroundColor: IDE.accent + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  freePillText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: IDE.accent,
    letterSpacing: 0.5,
  },
  freePillSm: {
    backgroundColor: IDE.accent + '20',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  freePillSmText: {
    fontSize: 8,
    fontWeight: '700' as const,
    color: IDE.accent,
    letterSpacing: 0.5,
  },

  modelList: {
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 10,
    marginTop: 8,
    overflow: 'hidden' as const,
  },
  modelListItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IDE.border,
  },
  modelListItemActive: {
    backgroundColor: IDE.primary + '10',
  },
  modelListName: {
    fontSize: 14,
    color: IDE.textSecondary,
  },
  modelListNameActive: {
    color: IDE.primary,
    fontWeight: '600' as const,
  },

  extraKeyCard: {
    backgroundColor: IDE.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: IDE.border,
    padding: 10,
    marginBottom: 8,
  },
  extraKeyHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  extraKeyLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  extraKeyName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: IDE.text,
  },
  keyConfiguredSm: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  keyConfiguredSmText: {
    fontSize: 10,
    color: IDE.accent,
    fontWeight: '600' as const,
  },
  keyInputRowSm: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 6,
    paddingHorizontal: 8,
  },
  keyInputSm: {
    flex: 1,
    fontSize: 12,
    color: IDE.text,
    paddingVertical: 8,
    fontFamily: 'monospace',
  },
  getKeyLinkSm: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 6,
  },
  getKeyLinkSmText: {
    fontSize: 11,
    color: IDE.primary,
  },

  betaWarning: {
    backgroundColor: IDE.warning + '12',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: IDE.warning + '25',
  },
  betaWarningText: {
    fontSize: 12,
    color: IDE.warning,
  },

  personaGrid: { gap: 6 },
  personaCard: {
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 10,
    padding: 12,
  },
  personaCardActive: { borderColor: IDE.primary, backgroundColor: IDE.primary + '08' },
  personaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  personaRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: IDE.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  personaRadioActive: {
    borderColor: IDE.primary,
  },
  personaRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: IDE.primary,
  },
  personaContent: {
    flex: 1,
  },
  personaName: { fontSize: 14, fontWeight: '600' as const, color: IDE.text },
  personaNameActive: { color: IDE.primary },
  personaDesc: { fontSize: 12, color: IDE.muted, marginTop: 2 },

  settingRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: IDE.border,
  },
  settingLabelRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6 },
  settingLabel: { fontSize: 14, color: IDE.text },
  settingHint: { fontSize: 12, color: IDE.muted, marginTop: 4, marginBottom: 4 },
  stepper: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepperValue: { fontSize: 14, color: IDE.text, fontWeight: '600' as const, minWidth: 40, textAlign: 'center' as const },

  toolItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: IDE.surface,
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  toolIcon: {
    fontSize: 14,
    width: 22,
    textAlign: 'center' as const,
  },
  toolInfo: {
    flex: 1,
  },
  toolName: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: IDE.primary,
    fontFamily: 'monospace',
  },
  toolDesc: {
    fontSize: 11,
    color: IDE.muted,
    marginTop: 1,
  },
  toolNote: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    backgroundColor: IDE.primary + '0A',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: IDE.primary + '20',
  },
  toolNoteText: {
    fontSize: 11,
    color: IDE.textSecondary,
    flex: 1,
    lineHeight: 16,
  },

  footer: { alignItems: 'center' as const, paddingVertical: 24 },
  footerText: { fontSize: 13, color: IDE.muted, fontWeight: '600' as const },
  footerSubtext: { fontSize: 11, color: IDE.muted, marginTop: 2 },

  identityFilesSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  identityFilesHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 6,
  },
  identityFilesTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: IDE.text,
  },
  identityFilesDesc: {
    fontSize: 11,
    color: IDE.muted,
    marginBottom: 10,
    lineHeight: 16,
  },
  identityFileCard: {
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 8,
    marginBottom: 6,
    overflow: 'hidden' as const,
  },
  identityFileHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 10,
  },
  identityFileLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
  },
  identityFileName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: IDE.text,
    fontFamily: 'monospace',
  },
  identityFileDesc: {
    fontSize: 10,
    color: IDE.muted,
    marginTop: 1,
  },
  identityFileRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  identityFileBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  identityFileBadgeActive: {
    backgroundColor: IDE.accent + '20',
  },
  identityFileBadgeEmpty: {
    backgroundColor: IDE.border,
  },
  identityFileBadgeText: {
    fontSize: 9,
    fontWeight: '600' as const,
  },
  identityFileBadgeTextActive: {
    color: IDE.accent,
  },
  identityFileBadgeTextEmpty: {
    color: IDE.muted,
  },
  identityFileEditor: {
    borderTopWidth: 1,
    borderTopColor: IDE.border,
    padding: 10,
  },
  identityFileInput: {
    backgroundColor: IDE.bg,
    borderWidth: 1,
    borderColor: IDE.border,
    borderRadius: 6,
    padding: 10,
    fontSize: 12,
    color: IDE.text,
    fontFamily: 'monospace',
    minHeight: 120,
    maxHeight: 300,
  },
  identityFileActions: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: 8,
    marginTop: 8,
  },
  identityFileCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: IDE.surface,
    borderWidth: 1,
    borderColor: IDE.border,
  },
  identityFileCancelText: {
    fontSize: 12,
    color: IDE.muted,
    fontWeight: '500' as const,
  },
  identityFileSaveBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: IDE.primary,
  },
  identityFileSaveText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600' as const,
  },
});
