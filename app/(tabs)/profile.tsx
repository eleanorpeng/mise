import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, radius, spacing, typeScale } from '@/constants';
import { BottomFade } from '@/components/ui/BottomFade';
import { useSessionStore } from '@/store/session';
import { useProfileStore } from '@/store/profile';
import { profileService } from '@/services/profile';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ProfileScreen() {
  const session = useSessionStore((s) => s.session);
  const userId = useSessionStore((s) => s.userId);
  const signOut = useSessionStore((s) => s.signOut);

  const profile = useProfileStore((s) => s.profile);
  const stats = useProfileStore((s) => s.stats);
  const fetchProfile = useProfileStore((s) => s.fetch);
  const fetchStats = useProfileStore((s) => s.fetchStats);
  const updateProfile = useProfileStore((s) => s.update);

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, [fetchProfile, fetchStats]);

  const email = session?.user?.email ?? '';
  const displayName = profile?.displayName?.trim() || email.split('@')[0] || 'Cook';
  const initials = useMemo(() => {
    const source = profile?.displayName || email;
    if (!source) return 'M';
    return source
      .split(/[\s@.]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase();
  }, [profile?.displayName, email]);

  const now = new Date();
  const currentMonthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;

  const handleAvatarPress = async () => {
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to update your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploading(true);
    try {
      const url = await profileService.uploadAvatar(userId, result.assets[0].uri);
      await updateProfile({ avatarUrl: url });
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'Try again in a moment.');
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={handleAvatarPress}
            activeOpacity={0.85}
          >
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}
            <View style={styles.avatarEdit}>
              {uploading ? (
                <ActivityIndicator size="small" color={colors.textOnDark} />
              ) : (
                <MaterialCommunityIcons
                  name="camera"
                  size={14}
                  color={colors.textOnDark}
                />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{displayName}</Text>
          {!!email && <Text style={styles.email}>{email}</Text>}
        </View>

        {/* Stats */}
        <TouchableOpacity
          style={styles.statsRow}
          onPress={() => router.push('/profile/stats' as any)}
          activeOpacity={0.85}
        >
          <StatTile label="Recipes saved" value={stats.totalRecipes} />
          <StatTile label="Cooked this month" value={stats.cookedThisMonth} />
        </TouchableOpacity>

        {/* Recap card */}
        <TouchableOpacity
          style={styles.recapCard}
          activeOpacity={0.9}
          onPress={() => router.push('/recap' as any)}
        >
          <View style={styles.recapBlobOne} />
          <View style={styles.recapBlobTwo} />
          <View style={styles.recapContent}>
            <Text style={styles.recapEyebrow}>Monthly recap</Text>
            <Text style={styles.recapTitle}>{currentMonthLabel}</Text>
            <Text style={styles.recapTeaser}>
              {stats.cookedThisMonth > 0
                ? `${stats.cookedThisMonth} ${stats.cookedThisMonth === 1 ? 'meal' : 'meals'} so far · tap to generate`
                : 'Tap to generate when the month is in.'}
            </Text>
          </View>
          <View style={styles.recapArrow}>
            <MaterialCommunityIcons
              name="arrow-right"
              size={18}
              color={colors.textOnDark}
            />
          </View>
        </TouchableOpacity>

        {/* Settings */}
        <SectionLabel>Settings</SectionLabel>
        <View style={styles.settingsCard}>
          <SettingRow
            icon="tune-vertical"
            label="Preferences"
            sublabel="Update your cooking goals and cuisines"
            onPress={() => router.push('/onboarding' as any)}
          />
          <Divider />
          <SettingRow
            icon="bell-outline"
            label="Notifications"
            onPress={() => router.push('/profile/notifications' as any)}
          />
          <Divider />
          <SettingRow
            icon="ruler"
            label="Units"
            sublabel="Metric or imperial"
            onPress={() => router.push('/profile/units' as any)}
          />
          <Divider />
          <SettingRow
            icon="account-outline"
            label="Account"
            onPress={() => router.push('/profile/account' as any)}
          />
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
      <BottomFade />
    </SafeAreaView>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

interface SettingRowProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  sublabel?: string;
  onPress: () => void;
}

function SettingRow({ icon, label, sublabel, onPress }: SettingRowProps) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingIcon}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.umber} />
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        {!!sublabel && <Text style={styles.settingSub}>{sublabel}</Text>}
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={18}
        color={colors.umber}
      />
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: 140,
    gap: spacing.lg,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  avatarWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: spacing.sm,
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.textOnDark,
  },
  avatarEdit: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.espresso,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.oat,
  },
  name: {
    ...typeScale.h1,
    color: colors.espresso,
    fontSize: 28,
    lineHeight: 34,
    marginTop: spacing.xs,
  },
  email: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 44,
    color: colors.espresso,
  },
  statLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
  },

  // Recap card
  recapCard: {
    backgroundColor: colors.espresso,
    borderRadius: radius.hero,
    padding: spacing.lg,
    minHeight: 140,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recapBlobOne: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.terra,
    opacity: 0.55,
    right: -50,
    top: -40,
  },
  recapBlobTwo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.ember,
    opacity: 0.4,
    right: 40,
    bottom: -40,
  },
  recapContent: {
    flex: 1,
    gap: spacing.xs,
  },
  recapEyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.butter,
  },
  recapTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 30,
    color: colors.textOnDark,
  },
  recapTeaser: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: 'rgba(250,232,218,0.7)',
    marginTop: 2,
  },
  recapArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(250,232,218,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Settings
  sectionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginTop: spacing.md,
    marginBottom: -spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  settingsCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.linen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.espresso,
  },
  settingSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderResting,
    marginLeft: spacing.lg + 32 + spacing.md,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    marginTop: spacing.md,
  },
  signOutText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.rust,
  },
});
