import React, { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';

interface LoadingNeveritoProps {
  size?: number;
  speed?: number; // ms entre frames
}

export const LoadingNeverito: React.FC<LoadingNeveritoProps> = ({
  size = 60,
  speed = 150
}) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const translateX = useRef(new Animated.Value(-100)).current;
  const bounce = useRef(new Animated.Value(0)).current;

  // Array con los frames de neverito corriendo
  const frames = [
    require('../../../neveritoCorriendo/1.png'),
    require('../../../neveritoCorriendo/2.png'),
    require('../../../neveritoCorriendo/3.png'),
    require('../../../neveritoCorriendo/4.png'),
  ];

  useEffect(() => {
    // Animar los frames
    const frameInterval = setInterval(() => {
      setCurrentFrame((prev) => (prev + 1) % frames.length);
    }, speed);

    // Animación horizontal (movimiento de izquierda a derecha)
    const moveAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 100,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -100,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    // Animación de rebote sutil
    const bounceAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -8,
          duration: speed,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: speed,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    moveAnimation.start();
    bounceAnimation.start();

    return () => {
      clearInterval(frameInterval);
      moveAnimation.stop();
      bounceAnimation.stop();
    };
  }, [speed]);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={frames[currentFrame]}
        style={[
          styles.neverito,
          {
            width: size,
            height: size,
            transform: [
              { translateX },
              { translateY: bounce },
            ],
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    paddingVertical: 10,
  },
  neverito: {
    resizeMode: 'contain',
  },
});
