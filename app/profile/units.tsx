import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors, fonts, radius, spacing } from '@/constants';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { usePreferencesStore } from '@/store/preferences';
import type { TemperatureUnit, UnitSystem } from '@/store/preferences';

export default function UnitsScreen() {
  const unitSystem = usePreferencesStore((s) => s.unitSystem);
  const temperatureUnit = usePreferencesStore((s) => s.temperatureUnit);
  const setUnitSystem = usePreferencesStore((s) => s.setUnitSystem);
  const setTemperatureUnit = usePreferencesStore((s) => s.setTemperatureUnit);

  return (
    <View style={styles.safe}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenHeader title="Units" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Choose how recipes display measurements. We'll convert ingredients and
          temperatures across the app to match.
        </Text>

        <SectionLabel>Measurement system</SectionLabel>
        <View style={styles.card}>
          <RadioRow<UnitSystem>
            title="Metric"
            sublabel="grams, milliliters, kilograms"
            selected={unitSystem === 'metric'}
            onPress={() => setUnitSystem('metric')}
            value="metric"
            isFirst
          />
          <Divider />
          <RadioRow<UnitSystem>
            title="Imperial"
            sublabel="ounces, cups, pounds"
            selected={unitSystem === 'imperial'}
            onPress={() => setUnitSystem('imperial')}
            value="imperial"
            isLast
          />
        </View>

        <SectionLabel>Temperature</SectionLabel>
        <View style={styles.card}>
          <RadioRow<TemperatureUnit>
            title="Celsius"
            sublabel="°C"
            selected={temperatureUnit === 'celsius'}
            onPress={() => setTemperatureUnit('celsius')}
            value="celsius"
            isFirst
          />
          <Divider />
          <RadioRow<TemperatureUnit>
            title="Fahrenheit"
            sublabel="°F"
            selected={temperatureUnit === 'fahrenheit'}
            onPress={() => setTemperatureUnit('fahrenheit')}
            value="fahrenheit"
            isLast
          />
        </View>
      </ScrollView>
    </View>
  );
}

interface RadioRowProps<T extends string> {
  title: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  value: T;
  isFirst?: boolean;
  isLast?: boolean;
}

function RadioRow<T extends string>({
  title,
  sublabel,
  selected,
  onPress,
}: RadioRowProps<T>) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {!!sublabel && <Text style={styles.rowSub}>{sublabel}</Text>}
      </View>
      {selected ? (
        <View style={styles.check}>
          <MaterialCommunityIcons name="check" size={16} color={colors.textOnDark} />
        </View>
      ) : (
        <View style={styles.checkEmpty} />
      )}
    </TouchableOpacity>
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
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl4,
    gap: spacing.lg,
  },
  intro: {
    fontFamily: fonts.bodyRegular,
    fontSize: 14,
    color: colors.umber,
    lineHeight: 20,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.espresso,
  },
  rowSub: {
    fontFamily: fonts.bodyRegular,
    fontSize: 12,
    color: colors.umber,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.terra,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.sand,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderResting,
    marginLeft: spacing.lg,
  },
});
