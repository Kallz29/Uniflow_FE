import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { splashScreenStyles as styles } from '../styles/splashScreenStyles';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(18)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleY = useRef(new Animated.Value(14)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const bubbleAnim = useRef(new Animated.Value(0)).current;
  const dotsAnim = useRef([
    new Animated.Value(0.35),
    new Animated.Value(0.35),
    new Animated.Value(0.35),
  ]).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 58,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 360,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(90, [
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(titleY, {
            toValue: 0,
            duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(subtitleOpacity, {
            toValue: 1,
            duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(subtitleY, {
            toValue: 0,
            duration: 380,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),
    ]).start();

    Animated.stagger(
      160,
      dotsAnim.map((anim) => Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration: 520,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.35,
            duration: 520,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ))
    ).start();

    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 5200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -7,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(bubbleAnim, {
        toValue: 1,
        duration: 3600,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const waveTranslate = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 0.1, width * 0.1],
  });

  const bubbleLift = bubbleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [16, -18],
  });

  return (
    <LinearGradient
      colors={['#5AA3C8', '#3E8FB8']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
    >
      <Animated.View
        style={[
          styles.waveBack,
          { transform: [{ translateX: waveTranslate }, { rotate: '-6deg' }] },
        ]}
      />
      <Animated.View
        style={[
          styles.waveFront,
          { transform: [{ translateX: Animated.multiply(waveTranslate, -0.75) }, { rotate: '5deg' }] },
        ]}
      />
      <Animated.View
        style={[
          styles.bubbleLarge,
          { opacity: bubbleAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.16, 0.28, 0.16] }), transform: [{ translateY: bubbleLift }] },
        ]}
      />
      <Animated.View
        style={[
          styles.bubbleSmall,
          { opacity: bubbleAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.24, 0.1, 0.24] }), transform: [{ translateY: Animated.multiply(bubbleLift, -0.7) }] },
        ]}
      />

      <Animated.View
        style={[
          styles.logoWrap,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }, { translateY: logoFloat }],
          },
        ]}
      >
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <View style={styles.textBlock}>
        <Animated.Text
          style={[
            styles.title,
            { opacity: titleOpacity, transform: [{ translateY: titleY }] },
          ]}
        >
          UniFlow
        </Animated.Text>

        <Animated.Text
          style={[
            styles.subtitle,
            { opacity: subtitleOpacity, transform: [{ translateY: subtitleY }] },
          ]}
        >
          Monitoring Kualitas Air
        </Animated.Text>
      </View>

      <View style={styles.dotsContainer}>
        {dotsAnim.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              { opacity: anim },
            ]}
          />
        ))}
      </View>
    </LinearGradient>
  );
}
