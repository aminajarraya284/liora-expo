import React, { useEffect, useId, useState } from 'react';
import { Animated, Easing, Image, Pressable, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { fmtLitres, imgSource } from '../../lib';
import { PHOTOS } from '../../photos';
import { type Meal, useStore } from '../../store';
import { F, TINTS } from '../../theme';
import { Card, CardTitle, Check, CircleBtn, Divider, FormSheet, Header, Hero, Icon, OutlineBtn, Screen, T, tap, useColors, useDialog, usePhotosEnabled } from '../../ui';
import { useAnimatedValue } from '../../components/motion';

const GLASS_ML = 250;
const ORANGE = TINTS.orange;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Anneau d'hydratation : il se remplit en douceur quand on ajoute un verre. */
function Ring({ ratio }: { ratio: number }) {
  const { reduceMotion } = useStore();
  const size = 132;
  const stroke = 13;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = Math.min(1, Math.max(0, ratio));
  const progress = useAnimatedValue(target);
  const gradientId = `water${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    // Les propriétés d'un dessin SVG ne passent pas par le moteur d'animation natif.
    Animated.timing(progress, { toValue: target, duration: reduceMotion ? 0 : 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [progress, target, reduceMotion]);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ORANGE.grad[0]} />
            <Stop offset="1" stopColor={ORANGE.grad[1]} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#F6E3D2" strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] })}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <T v="h1" style={{ fontFamily: F.bold, fontSize: 30 }}>{Math.round(ratio * 100)} %</T>
    </View>
  );
}

export default function Nutrition() {
  const { data, update } = useStore();
  const dialog = useDialog();
  const colors = useColors();
  const photosEnabled = usePhotosEnabled();
  const [sheet, setSheet] = useState<null | 'goal' | Meal>(null);
  const meal = sheet && sheet !== 'goal' ? sheet : null;
  const { day, waterGoalMl: goal } = data;
  const ratio = goal ? day.waterMl / goal : 0;
  const remaining = Math.max(0, goal - day.waterMl);

  const setWater = (ml: number) => {
    tap();
    update((d) => ({ ...d, day: { ...d.day, waterMl: Math.max(0, ml) } }));
  };
  const toggleMeal = (id: string) => {
    tap();
    update((d) => ({ ...d, day: { ...d.day, meals: d.day.meals.map((m) => (m.id === id ? { ...m, done: !m.done } : m)) } }));
  };
  const toggleHabit = (id: string) => {
    tap();
    update((d) => ({ ...d, day: { ...d.day, habits: d.day.habits.map((h) => (h.id === id ? { ...h, done: !h.done } : h)) } }));
  };
  const restartDay = () =>
    update((d) => ({ ...d, day: { ...d.day, waterMl: 0, meals: d.day.meals.map((m) => ({ ...m, done: false })), habits: d.day.habits.map((h) => ({ ...h, done: false })) } }));

  const options = () =>
    dialog.menu('Nutrition', [
      { label: 'Modifier mon objectif d’eau', icon: 'water-outline', onPress: () => setSheet('goal') },
      { label: 'Retirer un verre', icon: 'remove-circle-outline', onPress: () => setWater(day.waterMl - GLASS_ML) },
      { label: 'Recommencer la journée', icon: 'refresh-outline', danger: true, onPress: restartDay },
    ]);

  const litres = (value: unknown) => Number(String(value).replace(',', '.'));

  return (
    <Screen section="nutrition" tab="bienetre" speak={`Nutrition. Hydratation : ${fmtLitres(day.waterMl)} sur ${fmtLitres(goal)}.`}>
      <Header title="Nutrition" right={<CircleBtn icon="ellipsis-vertical" label="Options" onPress={options} />} />
      <Hero title="Nutrition" subtitle="Une alimentation équilibrée et savoureuse" />

      <Card>
        {photosEnabled && <Image source={PHOTOS.hydratation} style={{ width: '100%', height: 96, borderRadius: 16, marginBottom: 12 }} resizeMode="cover" accessible={false} />}
        <CardTitle icon="water-outline" right={<T>Objectif : {fmtLitres(goal)}</T>}>Hydratation</CardTitle>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Ring ratio={ratio} />
          <View style={{ flex: 1 }}>
            <T>
              <T v="h1" style={{ fontFamily: F.bold }}>{fmtLitres(day.waterMl)}</T>
              <T style={{ fontSize: 19 }}> / {fmtLitres(goal)}</T>
            </T>
            <T style={{ marginTop: 2 }}>{remaining > 0 ? `Encore ${fmtLitres(remaining)} pour atteindre votre objectif` : 'Bravo, objectif atteint !'}</T>
            <OutlineBtn small label="Ajouter un verre" icon="add" fill={ORANGE.soft} color={ORANGE.ink} onPress={() => setWater(day.waterMl + GLASS_ML)} style={{ marginTop: 10 }} />
          </View>
        </View>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <CardTitle icon="restaurant-outline">Repas de la journée</CardTitle>
        {day.meals.map((item, index) => {
          const photo = imgSource(item.photo);
          return (
            <View key={item.id}>
              {index > 0 && <Divider />}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                <Pressable onPress={() => setSheet(item)} accessibilityRole="button" accessibilityLabel={`Modifier ${item.name}`} style={({ pressed }) => [{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, pressed && { opacity: 0.6 }]}>
                  {photo ? (
                    <Image source={photo} style={{ width: 92, height: 54, borderRadius: 12 }} accessible={false} />
                  ) : (
                    <View style={{ width: 92, height: 54, borderRadius: 12, backgroundColor: ORANGE.soft, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="restaurant-outline" size={24} color={ORANGE.ink} />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <T v="title">{item.name}</T>
                    <T v="small">{item.desc || 'Touchez pour noter votre repas'}</T>
                  </View>
                </Pressable>
                <Pressable hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: item.done }} accessibilityLabel={`${item.name} pris`} onPress={() => toggleMeal(item.id)}>
                  <Check on={item.done} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <CardTitle icon="leaf-outline">Bonnes habitudes</CardTitle>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {day.habits.map((habit) => (
            <Pressable
              key={habit.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: habit.done }}
              accessibilityLabel={habit.label}
              onPress={() => toggleHabit(habit.id)}
              style={{ flex: 1, flexDirection: 'row', gap: 10, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: colors.cardBorder, backgroundColor: habit.done ? '#F1F5EA' : 'rgba(255,255,255,0.8)' }}>
              <Check on={habit.done} />
              <T style={{ flex: 1 }}>{habit.label}</T>
            </Pressable>
          ))}
        </View>
      </Card>

      <FormSheet
        visible={sheet === 'goal'}
        title="Objectif d’hydratation"
        onClose={() => setSheet(null)}
        fields={[{ key: 'goal', label: 'Objectif par jour (en litres)', required: true, placeholder: '1,5', maxLength: 4, validate: (value) => (litres(value) >= 0.5 && litres(value) <= 4 ? null : 'Indiquez une valeur entre 0,5 et 4 litres.') }]}
        initial={{ goal: String(goal / 1000).replace('.', ',') }}
        onSubmit={(values) => { update((d) => ({ ...d, waterGoalMl: Math.round(litres(values.goal) * 1000) })); setSheet(null); }}
      />
      <FormSheet
        visible={!!meal}
        title={meal?.name ?? ''}
        onClose={() => setSheet(null)}
        fields={[{ key: 'desc', label: 'Au menu', placeholder: 'Ex. : Saumon, légumes vapeur, quinoa' }, { key: 'photo', label: 'Ajouter une photo', type: 'image' }]}
        initial={meal ?? undefined}
        onSubmit={(values) => {
          const id = meal!.id;
          update((d) => ({ ...d, day: { ...d.day, meals: d.day.meals.map((m) => (m.id === id ? { ...m, desc: values.desc ?? '', photo: values.photo } : m)) } }));
          setSheet(null);
        }}
      />
    </Screen>
  );
}
