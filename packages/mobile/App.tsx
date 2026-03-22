import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Animated,
  Alert,
  AppState as NativeAppState,
  PanResponder,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import type { MeResponse, SupportedLocale, ThemePreference } from '@japanese-learn/shared';
import LoginScreen from './src/screens/LoginScreen';
import ConsentScreen from './src/screens/ConsentScreen';
import HomeScreen from './src/screens/HomeScreen';
import SessionScreen from './src/screens/SessionScreen';
import DiagnosisScreen from './src/screens/DiagnosisScreen';
import ReportScreen from './src/screens/ReportScreen';
import PlanScreen from './src/screens/PlanScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { SettingsProvider, useSettings } from './src/providers/settings-provider';
import type { ThemeColors } from './src/theme';
import {
  clearAuthData,
  getDiagnosisDone,
  getValidAppToken,
  secureGet,
  setDiagnosisDone,
  STORAGE_KEYS,
} from './src/services/secure-storage';
import { fetchWithTimeout } from './src/services/network';
import { runSync, startAutoSync, stopAutoSync } from './src/services/sync-service';

export type AppTab = 'home' | 'session' | 'plan' | 'report' | 'settings';
type AuthFlowState = 'loading' | 'unauthenticated' | 'consent' | 'diagnosis' | 'authenticated';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
const BOOTSTRAP_TIMEOUT_MS = 12000;
const LOCALE_CYCLE: SupportedLocale[] = ['ko', 'en', 'ja'];
const THEME_CYCLE: ThemePreference[] = ['system', 'light', 'dark'];
const QUICK_MARGIN = 12;
const QUICK_TOP_OFFSET = Platform.OS === 'android' ? 84 : 56;
const QUICK_BOTTOM_SAFE = 104;
const QUICK_COLLAPSED_VISIBLE = 18;
const QUICK_EXPANDED_FALLBACK = { width: 240, height: 56 };
const QUICK_COLLAPSED_FALLBACK = { width: 36, height: 112 };

type FloatingPosition = {
  x: number;
  y: number;
};

type FloatingLayout = {
  width: number;
  height: number;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(label)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function clampQuickPosition(
  position: FloatingPosition,
  layout: FloatingLayout,
  collapsed: boolean,
  screenWidth: number,
  screenHeight: number,
): FloatingPosition {
  const width = layout.width || (collapsed ? QUICK_COLLAPSED_FALLBACK.width : QUICK_EXPANDED_FALLBACK.width);
  const height = layout.height || (collapsed ? QUICK_COLLAPSED_FALLBACK.height : QUICK_EXPANDED_FALLBACK.height);
  const minX = collapsed ? -width + QUICK_COLLAPSED_VISIBLE : QUICK_MARGIN;
  const maxX = collapsed
    ? screenWidth - QUICK_COLLAPSED_VISIBLE
    : Math.max(QUICK_MARGIN, screenWidth - width - QUICK_MARGIN);
  const minY = QUICK_TOP_OFFSET;
  const maxY = Math.max(minY, screenHeight - height - QUICK_BOTTOM_SAFE);

  return {
    x: Math.min(maxX, Math.max(minX, position.x)),
    y: Math.min(maxY, Math.max(minY, position.y)),
  };
}

function snapCollapsedX(
  x: number,
  width: number,
  screenWidth: number,
): number {
  const leftX = -width + QUICK_COLLAPSED_VISIBLE;
  const rightX = screenWidth - QUICK_COLLAPSED_VISIBLE;
  const centerX = x + width / 2;
  return centerX < screenWidth / 2 ? leftX : rightX;
}

function getExpandedXFromCollapsed(
  x: number,
  width: number,
  screenWidth: number,
): number {
  const isLeftDocked = x + width / 2 < screenWidth / 2;
  return isLeftDocked ? QUICK_MARGIN : Math.max(QUICK_MARGIN, screenWidth - width - QUICK_MARGIN);
}

function positionsMatch(left: FloatingPosition, right: FloatingPosition): boolean {
  return left.x === right.x && left.y === right.y;
}

export default function App() {
  return (
    <SettingsProvider>
      <AppShell />
    </SettingsProvider>
  );
}

function AppShell() {
  const { colors, preferences, resolvedTheme, syncFromMe, t, updatePreferences } = useSettings();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [appState, setAppState] = useState<AuthFlowState>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [quickSaving, setQuickSaving] = useState<'locale' | 'theme' | ''>('');
  const [quickCollapsed, setQuickCollapsed] = useState(false);
  const [quickLayout, setQuickLayout] = useState<FloatingLayout>(QUICK_EXPANDED_FALLBACK);
  const [quickPosition, setQuickPosition] = useState<FloatingPosition>({
    x: Math.max(QUICK_MARGIN, screenWidth - QUICK_EXPANDED_FALLBACK.width - QUICK_MARGIN),
    y: QUICK_TOP_OFFSET,
  });
  const quickPositionInitialized = useRef(false);

  useEffect(() => {
    void bootstrapAuthenticatedUser();
  }, []);

  useEffect(() => {
    if (appState !== 'authenticated') {
      stopAutoSync();
      return;
    }

    startAutoSync();
    const subscription = NativeAppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runSync().catch(() => {});
      }
    });

    return () => {
      subscription.remove();
      stopAutoSync();
    };
  }, [appState]);

  useEffect(() => {
    setQuickPosition((prev) => {
      const next = quickPositionInitialized.current
        ? clampQuickPosition(prev, quickLayout, quickCollapsed, screenWidth, screenHeight)
        : {
            x: Math.max(QUICK_MARGIN, screenWidth - QUICK_EXPANDED_FALLBACK.width - QUICK_MARGIN),
            y: QUICK_TOP_OFFSET,
          };

      quickPositionInitialized.current = true;
      return positionsMatch(prev, next) ? prev : next;
    });
  }, [quickCollapsed, quickLayout, screenHeight, screenWidth]);

  async function bootstrapAuthenticatedUser(userIdOverride?: string) {
    try {
      await withTimeout((async () => {
        const uid = userIdOverride ?? await secureGet(STORAGE_KEYS.USER_ID);
        setUserId(uid);

        const token = await getValidAppToken();
        if (!token || !uid) {
          setAppState('unauthenticated');
          return;
        }

        const response = await fetchWithTimeout(`${BACKEND_URL}/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401 || response.status === 404) {
          await clearAuthData();
          setUserId(null);
          setAppState('unauthenticated');
          return;
        }

        if (response.ok) {
          const me = await response.json() as MeResponse;
          await syncFromMe(me);
          if (me.consent_flags.required !== true) {
            setAppState('consent');
            return;
          }
        }

        const diagnosisDone = await getDiagnosisDone(uid);
        setAppState(diagnosisDone ? 'authenticated' : 'diagnosis');
      })(), BOOTSTRAP_TIMEOUT_MS, 'App bootstrap timed out');
    } catch (error) {
      console.warn('[App] bootstrap failed, falling back to local flags', error);
      const fallbackState = await resolveBootstrapFallbackState(userIdOverride);
      setUserId(fallbackState.userId);
      setAppState(fallbackState.state);
    }
  }

  async function resolveBootstrapFallbackState(userIdOverride?: string): Promise<{
    state: AuthFlowState;
    userId: string | null;
  }> {
    try {
      const uid = userIdOverride ?? await withTimeout(
        secureGet(STORAGE_KEYS.USER_ID),
        4000,
        'Reading stored user ID timed out',
      );
      if (!uid) {
        return { state: 'unauthenticated', userId: null };
      }

      const diagnosisDone = await withTimeout(
        getDiagnosisDone(uid),
        4000,
        'Reading diagnosis status timed out',
      );

      return {
        state: diagnosisDone ? 'authenticated' : 'diagnosis',
        userId: uid,
      };
    } catch (error) {
      console.warn('[App] failed to resolve bootstrap fallback state', error);
      return {
        state: userIdOverride ? 'authenticated' : 'unauthenticated',
        userId: userIdOverride ?? null,
      };
    }
  }

  async function handleLoginComplete(uid: string) {
    setUserId(uid);
    setAppState('loading');
    await bootstrapAuthenticatedUser(uid);
  }

  async function handleConsentComplete() {
    const uid = userId ?? await secureGet(STORAGE_KEYS.USER_ID);
    setUserId(uid);
    setActiveTab('home');

    if (!uid) {
      setAppState('diagnosis');
      return;
    }

    try {
      const diagnosisDone = await withTimeout(
        getDiagnosisDone(uid),
        4000,
        'Reading diagnosis status timed out after consent',
      );
      setAppState(diagnosisDone ? 'authenticated' : 'diagnosis');
    } catch (error) {
      console.warn('[App] failed to resolve consent completion state', error);
      setAppState('diagnosis');
    }
  }

  async function handleDiagnosisComplete() {
    setAppState('authenticated');
    setActiveTab('plan');
    try {
      const uid = userId ?? await secureGet(STORAGE_KEYS.USER_ID);
      if (!uid) return;
      setUserId(uid);
      await setDiagnosisDone(uid, true);
    } catch (error) {
      console.warn('[App] failed to persist diagnosis completion', error);
    }
  }

  async function handleDiagnosisSkip() {
    if (!userId) return;
    await setDiagnosisDone(userId, true);
    setAppState('authenticated');
    setActiveTab('home');
  }

  async function handleRestartDiagnosis() {
    if (!userId) {
      setActiveTab('home');
      setAppState('diagnosis');
      return;
    }

    setActiveTab('home');
    setAppState('diagnosis');

    try {
      await setDiagnosisDone(userId, false);
    } catch (error) {
      console.warn('[App] failed to reset diagnosis flag', error);
    }
  }

  async function handleLogout() {
    stopAutoSync();
    await clearAuthData();
    setUserId(null);
    setActiveTab('home');
    setAppState('unauthenticated');
  }

  async function handleCycleLocale() {
    setQuickSaving('locale');
    try {
      const currentIndex = LOCALE_CYCLE.indexOf(preferences.locale);
      const nextLocale = LOCALE_CYCLE[(currentIndex + 1) % LOCALE_CYCLE.length];
      await updatePreferences({ locale: nextLocale });
    } catch (error) {
      Alert.alert(t('settings.language'), error instanceof Error ? error.message : String(error));
    } finally {
      setQuickSaving('');
    }
  }

  async function handleCycleTheme() {
    setQuickSaving('theme');
    try {
      const currentIndex = THEME_CYCLE.indexOf(preferences.theme);
      const nextTheme = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
      await updatePreferences({ theme: nextTheme });
    } catch (error) {
      Alert.alert(t('settings.appearance'), error instanceof Error ? error.message : String(error));
    } finally {
      setQuickSaving('');
    }
  }

  function handleQuickLayoutChange(layout: FloatingLayout) {
    setQuickLayout((prev) => (
      prev.width === layout.width && prev.height === layout.height ? prev : layout
    ));
  }

function handleQuickPositionChange(position: FloatingPosition) {
    setQuickPosition((prev) => (positionsMatch(prev, position) ? prev : position));
  }

  function handleQuickCollapseToggle() {
    setQuickCollapsed((prev) => {
      const nextCollapsed = !prev;
      setQuickPosition((current) => {
        if (nextCollapsed) {
          const collapsedLayout = QUICK_COLLAPSED_FALLBACK;
          const clamped = clampQuickPosition(
            current,
            collapsedLayout,
            true,
            screenWidth,
            screenHeight,
          );
          return {
            x: snapCollapsedX(clamped.x, collapsedLayout.width, screenWidth),
            y: clamped.y,
          };
        }

        const expandedLayout = quickLayout.width > 0 ? quickLayout : QUICK_EXPANDED_FALLBACK;
        return clampQuickPosition(
          {
            x: getExpandedXFromCollapsed(
              current.x,
              QUICK_EXPANDED_FALLBACK.width,
              screenWidth,
            ),
            y: current.y,
          },
          expandedLayout,
          false,
          screenWidth,
          screenHeight,
        );
      });
      return nextCollapsed;
    });
  }

  const shellStyles = useMemo(() => createStyles(colors), [colors]);
  const uid = userId ?? 'u_dev_web';
  const showQuickSettings = !(appState === 'authenticated' && activeTab === 'settings');

  let content: React.ReactNode;
  if (appState === 'loading') {
    content = (
      <View style={shellStyles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  } else if (appState === 'unauthenticated') {
    content = <LoginScreen onLoginComplete={handleLoginComplete} />;
  } else if (appState === 'consent') {
    content = <ConsentScreen onConsentComplete={handleConsentComplete} />;
  } else if (appState === 'diagnosis') {
    content = <DiagnosisScreen onComplete={handleDiagnosisComplete} onSkip={handleDiagnosisSkip} />;
  } else {
    content = (
      <>
        <View style={shellStyles.content}>
          {activeTab === 'home' ? (
            <HomeScreen userId={uid} onNavigate={setActiveTab} onRestartDiagnosis={handleRestartDiagnosis} />
          ) : null}
          {activeTab === 'session' ? (
            <SessionScreen userId={uid} onSessionEnd={() => setActiveTab('home')} />
          ) : null}
          {activeTab === 'plan' ? (
            <PlanScreen userId={uid} onRestartDiagnosis={handleRestartDiagnosis} />
          ) : null}
          {activeTab === 'report' ? (
            <ReportScreen userId={uid} />
          ) : null}
          {activeTab === 'settings' ? (
            <SettingsScreen userId={uid} onLogout={handleLogout} />
          ) : null}
        </View>
        <View style={shellStyles.tabBar}>
          {TAB_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === item.key }}
              onPress={() => setActiveTab(item.key)}
              style={shellStyles.tab}
            >
              <Text style={[shellStyles.tabIcon, activeTab === item.key && shellStyles.tabIconActive]}>
                {item.icon}
              </Text>
              <Text style={[shellStyles.tabText, activeTab === item.key && shellStyles.tabTextActive]}>
                {t(item.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </>
    );
  }

  return (
    <View style={shellStyles.app}>
      <StatusBar hidden style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
      {content}
      {showQuickSettings ? (
        <GlobalQuickSettings
          colors={colors}
          locale={preferences.locale}
          theme={preferences.theme}
          position={quickPosition}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          collapsed={quickCollapsed}
          busy={quickSaving !== ''}
          onCycleLocale={() => void handleCycleLocale()}
          onCycleTheme={() => void handleCycleTheme()}
          onToggleCollapse={handleQuickCollapseToggle}
          onPositionChange={handleQuickPositionChange}
          onLayoutChange={handleQuickLayoutChange}
        />
      ) : null}
    </View>
  );
}

function GlobalQuickSettings(props: {
  colors: ThemeColors;
  locale: SupportedLocale;
  theme: ThemePreference;
  position: FloatingPosition;
  screenWidth: number;
  screenHeight: number;
  collapsed: boolean;
  busy: boolean;
  onCycleLocale: () => void;
  onCycleTheme: () => void;
  onToggleCollapse: () => void;
  onPositionChange: (position: FloatingPosition) => void;
  onLayoutChange: (layout: FloatingLayout) => void;
}) {
  const styles = createStyles(props.colors);
  const layoutRef = useRef<FloatingLayout>(props.collapsed ? QUICK_COLLAPSED_FALLBACK : QUICK_EXPANDED_FALLBACK);
  const dragStartRef = useRef<FloatingPosition>(props.position);
  const draggingRef = useRef(false);
  const animatedPosition = useRef(new Animated.ValueXY(props.position)).current;

  useEffect(() => {
    if (draggingRef.current) return;
    animatedPosition.setValue(props.position);
  }, [animatedPosition, props.position]);

  const clampPosition = (nextPosition: FloatingPosition, collapsed = props.collapsed) => {
    return clampQuickPosition(
      nextPosition,
      layoutRef.current,
      collapsed,
      props.screenWidth,
      props.screenHeight,
    );
  };

  const syncAnimatedPosition = (nextPosition: FloatingPosition) => {
    animatedPosition.setValue(nextPosition);
  };

  const startDrag = () => {
    draggingRef.current = true;
    animatedPosition.stopAnimation((value) => {
      dragStartRef.current = {
        x: value.x,
        y: value.y,
      };
    });
  };

  const finishDrag = (nextPosition: FloatingPosition) => {
    draggingRef.current = false;
    syncAnimatedPosition(nextPosition);
    props.onPositionChange(nextPosition);
  };

  const collapsedResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) + Math.abs(gestureState.dy) > 3,
      onPanResponderGrant: startDrag,
      onPanResponderMove: (_, gestureState) => {
        syncAnimatedPosition(clampPosition({
          x: dragStartRef.current.x + gestureState.dx,
          y: dragStartRef.current.y + gestureState.dy,
        }, true));
      },
      onPanResponderRelease: (_, gestureState) => {
        const moved = Math.abs(gestureState.dx) + Math.abs(gestureState.dy) > 6;
        const clamped = clampPosition({
          x: dragStartRef.current.x + gestureState.dx,
          y: dragStartRef.current.y + gestureState.dy,
        }, true);

        finishDrag({
          x: snapCollapsedX(clamped.x, layoutRef.current.width || QUICK_COLLAPSED_FALLBACK.width, props.screenWidth),
          y: clamped.y,
        });

        if (!moved) {
          props.onToggleCollapse();
        }
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false;
        syncAnimatedPosition(props.position);
      },
    }),
    [animatedPosition, props.position, props.screenHeight, props.screenWidth, props.onPositionChange, props.onToggleCollapse],
  );

  const expandedResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) + Math.abs(gestureState.dy) > 3,
      onPanResponderGrant: startDrag,
      onPanResponderMove: (_, gestureState) => {
        syncAnimatedPosition(clampPosition({
          x: dragStartRef.current.x + gestureState.dx,
          y: dragStartRef.current.y + gestureState.dy,
        }));
      },
      onPanResponderRelease: (_, gestureState) => {
        const moved = Math.abs(gestureState.dx) + Math.abs(gestureState.dy) > 6;
        finishDrag(clampPosition({
          x: dragStartRef.current.x + gestureState.dx,
          y: dragStartRef.current.y + gestureState.dy,
        }));

        if (!moved) {
          props.onToggleCollapse();
        }
      },
      onPanResponderTerminate: () => {
        draggingRef.current = false;
        syncAnimatedPosition(props.position);
      },
    }),
    [animatedPosition, props.position, props.screenHeight, props.screenWidth, props.onPositionChange, props.onToggleCollapse],
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.quickOverlay,
        { transform: animatedPosition.getTranslateTransform() },
      ]}
    >
      <SafeAreaView pointerEvents="box-none">
        <View
          onLayout={(event) => {
            const layout = {
              width: Math.round(event.nativeEvent.layout.width),
              height: Math.round(event.nativeEvent.layout.height),
            };
            layoutRef.current = layout;
            props.onLayoutChange(layout);

            const clamped = clampQuickPosition(
              props.position,
              layout,
              props.collapsed,
              props.screenWidth,
              props.screenHeight,
            );

            if (!positionsMatch(props.position, clamped)) {
              props.onPositionChange(clamped);
            }
          }}
          style={[
            props.collapsed ? styles.quickCollapsedHandle : styles.quickPanel,
            props.collapsed && props.position.x + (layoutRef.current.width / 2) >= props.screenWidth / 2
              ? styles.quickCollapsedRight
              : null,
          ]}
        >
          {props.collapsed ? (
            <View {...collapsedResponder.panHandlers} style={styles.quickCollapsedBody}>
              <View style={styles.quickCollapsedGrip}>
                <View style={styles.quickCollapsedGripDot} />
                <View style={styles.quickCollapsedGripDot} />
                <View style={styles.quickCollapsedGripDot} />
              </View>
              <Text style={styles.quickCollapsedLabel}>{LOCALE_SHORT_LABELS[props.locale]}</Text>
              <Text style={styles.quickCollapsedLabel}>{THEME_SHORT_LABELS[props.theme]}</Text>
            </View>
          ) : (
            <>
              <View {...expandedResponder.panHandlers} style={styles.quickDragHandle}>
                <View style={styles.quickDragBar} />
              </View>
              <View style={styles.quickRow}>
                <QuickChip
                  colors={props.colors}
                  label={LOCALE_SHORT_LABELS[props.locale]}
                  disabled={props.busy}
                  onPress={props.onCycleLocale}
                  accessibilityLabel={`Language ${LOCALE_SHORT_LABELS[props.locale]}`}
                />
                <QuickChip
                  colors={props.colors}
                  label={THEME_SHORT_LABELS[props.theme]}
                  disabled={props.busy}
                  onPress={props.onCycleTheme}
                  accessibilityLabel={`Theme ${THEME_SHORT_LABELS[props.theme]}`}
                />
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

function QuickChip(props: {
  colors: ThemeColors;
  label: string;
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const styles = createStyles(props.colors);
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      disabled={props.disabled}
      onPress={props.onPress}
      style={[styles.quickChip, props.disabled && styles.quickChipDisabled]}
    >
      <Text style={styles.quickChipText}>{props.label}</Text>
    </TouchableOpacity>
  );
}

const TAB_ITEMS: Array<{
  key: AppTab;
  icon: string;
  labelKey: 'tab.home' | 'tab.session' | 'tab.plan' | 'tab.report' | 'tab.settings';
}> = [
  { key: 'home', icon: 'H', labelKey: 'tab.home' },
  { key: 'session', icon: 'S', labelKey: 'tab.session' },
  { key: 'plan', icon: 'P', labelKey: 'tab.plan' },
  { key: 'report', icon: 'R', labelKey: 'tab.report' },
  { key: 'settings', icon: 'T', labelKey: 'tab.settings' },
];

const LOCALE_SHORT_LABELS: Record<SupportedLocale, string> = {
  ko: 'KO',
  en: 'EN',
  ja: 'JA',
};

const THEME_SHORT_LABELS: Record<ThemePreference, string> = {
  system: 'SYS',
  light: 'LGT',
  dark: 'DRK',
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    app: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      gap: 2,
    },
    tabIcon: {
      fontSize: 14,
      color: colors.textMuted,
      fontWeight: '700',
    },
    tabIconActive: {
      color: colors.primary,
    },
    tabText: {
      fontSize: 11,
      color: colors.textMuted,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    quickOverlay: {
      position: 'absolute',
      left: 0,
      top: 0,
      zIndex: 20,
    },
    quickPanel: {
      gap: 10,
      backgroundColor: colors.surface,
      borderRadius: 24,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 6,
    },
    quickRow: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    quickDragHandle: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 2,
      paddingBottom: 2,
    },
    quickDragBar: {
      width: 40,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
    },
    quickCollapsedHandle: {
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 6,
    },
    quickCollapsedRight: {
      borderTopRightRadius: 0,
      borderBottomRightRadius: 0,
    },
    quickCollapsedBody: {
      paddingVertical: 14,
      paddingHorizontal: 8,
      minHeight: 96,
      minWidth: 40,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    quickCollapsedGrip: {
      gap: 3,
      marginBottom: 4,
    },
    quickCollapsedGripDot: {
      width: 4,
      height: 4,
      borderRadius: 999,
      backgroundColor: colors.border,
    },
    quickCollapsedLabel: {
      color: colors.primary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    quickChip: {
      minHeight: 38,
      minWidth: 58,
      borderRadius: 999,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    quickChipDisabled: {
      opacity: 0.6,
    },
    quickChipText: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
  });
}
