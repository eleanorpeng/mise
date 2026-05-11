import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, typeScale, spacing, radius } from '@/constants';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useSessionStore } from '@/store/session';

export function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signInWithEmail = useSessionStore((s) => s.signInWithEmail);
  const signUpWithEmail = useSessionStore((s) => s.signUpWithEmail);
  const signInWithGoogle = useSessionStore((s) => s.signInWithGoogle);
  const signInWithApple = useSessionStore((s) => s.signInWithApple);

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password);
      }
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleSocial = async (provider: 'google' | 'apple') => {
    setSocialLoading(provider);
    setError(null);
    try {
      if (provider === 'google') await signInWithGoogle();
      else await signInWithApple();
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return;
      setError(e.message ?? 'Something went wrong');
    } finally {
      setSocialLoading(null);
    }
  };

  const canSubmit = email.trim().length > 0 && password.trim().length >= 6;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.wordmark}>mise</Text>
            <Text style={styles.tagline}>
              Turn cooking videos into recipes you can actually follow.
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              label={mode === 'login' ? 'Sign in' : 'Create account'}
              onPress={handleEmailAuth}
              loading={loading}
              disabled={!canSubmit}
            />
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialButtons}>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => handleSocial('apple')}
                disabled={socialLoading !== null}
                activeOpacity={0.8}
              >
                {socialLoading === 'apple' ? (
                  <ActivityIndicator size="small" color={colors.espresso} />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="apple"
                      size={20}
                      color={colors.espresso}
                    />
                    <Text style={styles.socialLabel}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => handleSocial('google')}
              disabled={socialLoading !== null}
              activeOpacity={0.8}
            >
              {socialLoading === 'google' ? (
                <ActivityIndicator size="small" color={colors.espresso} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name="google"
                    size={20}
                    color={colors.espresso}
                  />
                  <Text style={styles.socialLabel}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
          >
            <Text style={styles.toggleText}>
              {mode === 'login'
                ? "Don't have an account? "
                : 'Already have an account? '}
            </Text>
            <Text style={styles.toggleAction}>
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  flex: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xl2,
  },
  header: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  wordmark: {
    ...typeScale.display,
    color: colors.terra,
    fontSize: 42,
    lineHeight: 48,
  },
  tagline: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.umber,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },
  form: {
    gap: spacing.lg,
  },
  error: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.rust,
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.sand,
  },
  dividerText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
  },
  socialButtons: {
    gap: spacing.md,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.cardBg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: spacing.xl2,
    minHeight: 46,
  },
  socialLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.espresso,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  toggleText: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.umber,
  },
  toggleAction: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.terra,
  },
});
