import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Keyboard,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, fonts, radius, spacing, typeScale } from '@/constants';
import { Button } from '@/components/ui/Button';
import { useProfileStore } from '@/store/profile';
import type { CookingIntent, SkillLevel } from '@/types';

interface IntentOption {
  value: CookingIntent;
  title: string;
  description: string;
}

const INTENTS: IntentOption[] = [
  { value: 'cook_more', title: 'Cook more at home', description: 'Build a steady weekly rhythm' },
  { value: 'eat_healthier', title: 'Eat healthier', description: 'Track macros and balance meals' },
  { value: 'learn_techniques', title: 'Learn new techniques', description: 'Explore the craft behind each dish' },
  { value: 'save_money', title: 'Save money', description: 'Cook restaurant favorites at home' },
  { value: 'meal_prep', title: 'Meal prep for the week', description: 'Plan, shop, and prep ahead' },
];

const CUISINES = [
  'Italian', 'Japanese', 'Mexican', 'Thai', 'Chinese', 'Indian',
  'Mediterranean', 'French', 'Korean', 'American', 'Middle Eastern', 'Vietnamese',
];

const DIETARY = [
  'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Nut-free', 'Pescatarian',
];

interface SkillOption {
  value: SkillLevel;
  title: string;
  description: string;
}

const SKILLS: SkillOption[] = [
  { value: 'beginner', title: 'Beginner', description: 'Just getting started in the kitchen' },
  { value: 'intermediate', title: 'Intermediate', description: 'Comfortable following most recipes' },
  { value: 'advanced', title: 'Advanced', description: 'Confident improvising and adapting' },
];

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const update = useProfileStore((s) => s.update);
  const profile = useProfileStore((s) => s.profile);
  const isEditing = !!profile?.onboardedAt;
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<CookingIntent | null>(profile?.intent ?? null);
  const [cuisines, setCuisines] = useState<string[]>(profile?.cuisinePreferences ?? []);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherDraft, setOtherDraft] = useState('');
  const insets = useSafeAreaInsets();
  const [dietary, setDietary] = useState<string[]>(profile?.dietaryRestrictions ?? []);
  const [skill, setSkill] = useState<SkillLevel | null>(profile?.skillLevel ?? null);
  const [saving, setSaving] = useState(false);

  const toggle = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const canContinue = (() => {
    if (step === 0) return intent !== null;
    if (step === 1) return cuisines.length > 0;
    if (step === 2) return true; // dietary is optional
    if (step === 3) return skill !== null;
    return false;
  })();

  const handleContinue = async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1);
      return;
    }
    setSaving(true);
    try {
      await update({
        intent,
        cuisinePreferences: cuisines,
        dietaryRestrictions: dietary,
        skillLevel: skill,
        markOnboarded: !isEditing,
      });
      if (isEditing) {
        router.back();
      } else {
        router.replace('/(tabs)' as any);
      }
    } catch (e) {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (step === 0) return;
    setStep(step - 1);
  };

  return (
    <View style={styles.safe}>
      <View style={styles.grabberWrap}>
        <View style={styles.grabber} />
      </View>
      <View style={styles.header}>
        {step > 0 ? (
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        ) : isEditing ? (
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Text style={styles.backText}>Close</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtnPlaceholder} />
        )}
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressDot,
                i <= step && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
        <View style={styles.backBtnPlaceholder} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 && (
          <StepShell
            eyebrow="Step 1 of 4"
            title="What brings you to mise?"
            subtitle="Pick the goal that fits you best — this shapes the recipes we surface."
          >
            <View style={styles.cardList}>
              {INTENTS.map((opt) => (
                <SelectCard
                  key={opt.value}
                  title={opt.title}
                  description={opt.description}
                  selected={intent === opt.value}
                  onPress={() => setIntent(opt.value)}
                />
              ))}
            </View>
          </StepShell>
        )}

        {step === 1 && (
          <StepShell
            eyebrow="Step 2 of 4"
            title="Which cuisines do you love?"
            subtitle="Choose any that interest you. We'll lean into them as we recommend dishes."
          >
            <View style={styles.chipGrid}>
              {CUISINES.map((c) => (
                <ChipToggle
                  key={c}
                  label={c}
                  selected={cuisines.includes(c)}
                  onPress={() => setCuisines(toggle(cuisines, c))}
                />
              ))}
              {cuisines
                .filter((c) => !CUISINES.includes(c))
                .map((c) => (
                  <CustomChip
                    key={c}
                    label={c}
                    onRemove={() =>
                      setCuisines(cuisines.filter((v) => v !== c))
                    }
                  />
                ))}
              <TouchableOpacity
                style={styles.otherChip}
                onPress={() => setOtherOpen(true)}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={14}
                  color={colors.umber}
                />
                <Text style={styles.otherChipLabel}>Other</Text>
              </TouchableOpacity>
            </View>
            {otherOpen && (
              <View style={styles.otherInputRow}>
                <TextInput
                  value={otherDraft}
                  onChangeText={setOtherDraft}
                  placeholder="Add a cuisine"
                  placeholderTextColor={colors.umber}
                  style={styles.otherInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    const v = otherDraft.trim();
                    if (v && !cuisines.includes(v)) {
                      setCuisines([...cuisines, v]);
                    }
                    setOtherDraft('');
                    setOtherOpen(false);
                    Keyboard.dismiss();
                  }}
                />
                <TouchableOpacity
                  onPress={() => {
                    setOtherDraft('');
                    setOtherOpen(false);
                    Keyboard.dismiss();
                  }}
                  style={styles.otherCancel}
                >
                  <Text style={styles.otherCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </StepShell>
        )}

        {step === 2 && (
          <StepShell
            eyebrow="Step 3 of 4"
            title="Anything we should leave out?"
            subtitle="Optional — pick any dietary preferences and we'll filter accordingly."
          >
            <View style={styles.chipGrid}>
              {DIETARY.map((d) => (
                <ChipToggle
                  key={d}
                  label={d}
                  selected={dietary.includes(d)}
                  onPress={() => setDietary(toggle(dietary, d))}
                />
              ))}
            </View>
          </StepShell>
        )}

        {step === 3 && (
          <StepShell
            eyebrow="Step 4 of 4"
            title="How would you describe your skill level?"
            subtitle="We'll match the depth of technique notes to where you are."
          >
            <View style={styles.cardList}>
              {SKILLS.map((opt) => (
                <SelectCard
                  key={opt.value}
                  title={opt.title}
                  description={opt.description}
                  selected={skill === opt.value}
                  onPress={() => setSkill(opt.value)}
                />
              ))}
            </View>
          </StepShell>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, spacing.lg) },
        ]}
      >
        <Button
          label={step < TOTAL_STEPS - 1 ? 'Continue' : 'Finish'}
          onPress={handleContinue}
          disabled={!canContinue || saving}
          loading={saving}
        />
        {step === 2 && dietary.length === 0 && (
          <TouchableOpacity onPress={handleContinue} style={styles.skipBtn}>
            <Text style={styles.skipText}>None of these</Text>
          </TouchableOpacity>
        )}
      </View>
      {saving && (
        <View style={styles.savingOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.terra} />
        </View>
      )}
    </View>
  );
}

interface StepShellProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function StepShell({ eyebrow, title, subtitle, children }: StepShellProps) {
  return (
    <View style={styles.step}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.stepBody}>{children}</View>
    </View>
  );
}

interface SelectCardProps {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}

function SelectCard({ title, description, selected, onPress }: SelectCardProps) {
  return (
    <TouchableOpacity
      style={[styles.selectCard, selected && styles.selectCardActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.selectCardText}>
        <Text style={[styles.selectTitle, selected && styles.selectTitleActive]}>
          {title}
        </Text>
        <Text style={[styles.selectDesc, selected && styles.selectDescActive]}>
          {description}
        </Text>
      </View>
      <View style={[styles.radio, selected && styles.radioActive]}>
        {selected && <View style={styles.radioDot} />}
      </View>
    </TouchableOpacity>
  );
}

interface ChipToggleProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function CustomChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, styles.chipActive, styles.customChip]}
      onPress={onRemove}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipLabel, styles.chipLabelActive]}>{label}</Text>
      <MaterialCommunityIcons name="close" size={14} color={colors.brick} />
    </TouchableOpacity>
  );
}

function ChipToggle({ label, selected, onPress }: ChipToggleProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.oat },
  flex: { flex: 1 },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sand,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sand,
  },
  progressDotActive: {
    backgroundColor: colors.terra,
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    minWidth: 48,
  },
  backBtnPlaceholder: {
    minWidth: 48,
  },
  backText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.umber,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl3,
  },
  step: {
    gap: spacing.sm,
  },
  eyebrow: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.umber,
  },
  title: {
    ...typeScale.h1,
    color: colors.espresso,
    fontSize: 28,
    lineHeight: 34,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.umber,
    lineHeight: 22,
  },
  stepBody: {
    marginTop: spacing.xl,
  },
  cardList: {
    gap: spacing.md,
  },
  selectCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  selectCardActive: {
    borderColor: colors.terra,
    borderWidth: 1.5,
  },
  selectCardText: {
    flex: 1,
    gap: 2,
  },
  selectTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.espresso,
  },
  selectTitleActive: {
    color: colors.rust,
  },
  selectDesc: {
    fontFamily: fonts.bodyRegular,
    fontSize: 13,
    color: colors.umber,
    lineHeight: 18,
  },
  selectDescActive: {
    color: colors.umber,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.terra,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.terra,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.linen,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderWidth: 0.5,
    borderColor: colors.borderResting,
  },
  chipActive: {
    backgroundColor: colors.blush,
    borderColor: colors.terra,
  },
  chipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.umber,
  },
  chipLabelActive: {
    color: colors.brick,
  },
  customChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  otherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'transparent',
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.sand,
    borderStyle: 'dashed',
  },
  otherChipLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.umber,
  },
  otherInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  otherInput: {
    flex: 1,
    backgroundColor: colors.linen,
    borderWidth: 0.5,
    borderColor: colors.sand,
    borderRadius: radius.inner,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.bodyRegular,
    fontSize: 15,
    color: colors.espresso,
  },
  otherCancel: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  otherCancelText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.umber,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  skipBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.umber,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,239,224,0.5)',
  },
});
