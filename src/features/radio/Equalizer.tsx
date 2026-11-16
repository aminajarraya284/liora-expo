import React, { useEffect } from 'react';
import { Animated, Easing, View } from 'react-native';
import { NATIVE_DRIVER , useAnimatedValue } from '../../components/motion';
import { useStore } from '../../state/store';

const BAR_HEIGHT = 26;

function Bar({ active, color, delay }: { active: boolean; color: string; delay: number }) {
  const level = useAnimatedValue(0.35);
  useEffect(() => {
    if (!active) {
      level.setValue(0.35);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(level, { toValue: 1, duration: 380, delay, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(level, { toValue: 0.3, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, level, delay]);
  return (
    <View style={{ width: 5, height: BAR_HEIGHT, justifyContent: 'flex-end' }}>
      <Animated.View style={{ height: BAR_HEIGHT, borderRadius: 3, backgroundColor: color, transformOrigin: 'bottom', transform: [{ scaleY: level }] }} />
    </View>
  );
}

/** Petites barres qui dansent pendant que la radio joue. Immobiles si les animations sont réduites. */
export function Equalizer({ playing, color }: { playing: boolean; color: string }) {
  const { reduceMotion } = useStore();
  const active = playing && !reduceMotion;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }} accessible={false}>
      {[0, 140, 60, 200].map((delay) => (
        <Bar key={delay} active={active} color={color} delay={delay} />
      ))}
    </View>
  );
}
