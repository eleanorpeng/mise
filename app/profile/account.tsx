import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, radius, spacing } from '@/constants';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { useSessionStore } from '@/store/session';
import { useProfileStore } from '@/store/profile';

export default function AccountScreen() {
  const session = useSessionStore((s) => s.session);
  const signOut = useSessionStore((s) => s.signOut);
  const profile = useProfileStore((s) => s.profile);
  const update = useProfileStore((s) => s.update);

  const email = session?.user?.email ?? '';
  const provider = session?.user?.app_metadata?.provider ?? 'email';
  const memberSinceRaw = session?.user?.created_at ?? null;
  const memberSince = memberSinceRaw
    ? new Date(memberSinceRaw).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      })
    : null;

  const [name, setName] = useState(profile?.displayName ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = (profile?.displayName ?? '') !== name.trim();

  const handleSave = async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      await update({ displayName: name.trim() || null });
    } catch (e: any) {
      Alert.alert('Could not save', e.message ?? 'Try again in a moment.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(tabs)' as any);
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your recipes, plans, and history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Coming soon',
              'Account deletion is rolling out — reach out to support@mise.app to delete your account in the meantime.',
            ),
        },
      ],
    );
  };

  const providerLabel =
    provider === 'apple'
      ? 'Apple'
      : provider === 'google'
        ? 'Google'
        : 'Email & password';

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Account" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SectionLabel>Profile</SectionLabel>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Display name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="What should we call you?"
                placeholderTextColor={colors.umber}
                style={styles.input}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>
            {dirty && (
              <View style={styles.saveRow}>
                <Button
                  label={saving ? 'Saving…' : 'Save'}
                  onPress={handleSave}
                  loading={saving}
                  disabled={saving}
                />
              </View>
            )}
          </View>

          <SectionLabel>Sign-in</SectionLabel>
          <View style={styles.card}>
            <ReadOnlyRow icon="email-outline" label="Email" value={email || '—'} isFirst />
            <Divider />
            <ReadOnlyRow icon="shield-key-outline" label="Provider" value={providerLabel} />
            {memberSince && (
              <>
                <Divider />
                <ReadOnlyRow icon="calendar-outline" label="Member since" value={memberSince} isLast />
              </>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
              <Text style={styles.deleteText}>Delete account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

interface ReadOnlyRowProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string;
  isFirst?: boolean;
  isLast?: boolean;
}

function ReadOnlyRow({ icon, label, value }: ReadOnlyRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.umber} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  flex: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl4,
    gap: spacing.lg,
  },

  sectionLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
    marginTop: spacing.sm,
    marginBottom: -spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    overflow: 'hidden',
  },

  fieldRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  fieldLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  input: {
    fontFamily: fonts.bodyRegular,
    fontSize: 16,
    color: colors.espresso,
    paddingVertical: spacing.xs,
  },
  saveRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.linen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
  rowValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.espresso,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderResting,
    marginLeft: spacing.lg + 32 + spacing.md,
  },

  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  signOutText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.rust,
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  deleteText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
  },
});
