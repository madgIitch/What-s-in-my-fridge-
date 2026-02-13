import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Animated,
  StatusBar,
  Image,
} from 'react-native';
import { signIn, signUp } from '../services/firebase/auth';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { colors, typography, spacing } from '../theme';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const wiggleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Wiggle animation for fridge emoji
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(wiggleAnim, {
          toValue: -5,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(wiggleAnim, {
          toValue: 5,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(wiggleAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.delay(3000),
      ])
    ).start();

    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [wiggleAnim, fadeAnim]);

  const validate = () => {
    let valid = true;

    setEmailError('');
    setPasswordError('');

    if (!email.trim()) {
      setEmailError('El email es requerido');
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Invalid email');
      valid = false;
    }

    if (!password.trim()) {
      setPasswordError('Password is required');
      valid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      valid = false;
    }

    return valid;
  };

  const handleSignIn = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      await signUp(email.trim(), password);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setEmailError('');
    setPasswordError('');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFE5EC" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Kawaii */}
          <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
            <View style={styles.headerContent}>
              <Animated.Image
                source={require('../../assets/neveritoNevera.png')}
                style={[
                  styles.headerImage,
                  {
                    transform: [{
                      rotate: wiggleAnim.interpolate({
                        inputRange: [-5, 5],
                        outputRange: ['-5deg', '5deg']
                      })
                    }]
                  }
                ]}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>What's In My Fridge</Text>
            <Text style={styles.subtitle}>
              Gestiona tu inventario de alimentos ♡
            </Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View style={[styles.formCard, { opacity: fadeAnim }]}>
            <Text style={styles.formTitle}>
              {isSignUp ? 'Join us! ✨' : 'Welcome back! 🎉'}
            </Text>

            <View style={styles.form}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                error={emailError}
                placeholder="ejemplo@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!loading}
              />

              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                error={passwordError}
                placeholder="Minimum 6 characters"
                secureTextEntry
                autoComplete="password"
                editable={!loading}
              />

              <Button
                title={isSignUp ? 'Create Account' : 'Sign In'}
                onPress={isSignUp ? handleSignUp : handleSignIn}
                loading={loading}
                style={styles.primaryButton}
              />

              <Button
                title={isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                onPress={toggleMode}
                variant="text"
                disabled={loading}
              />
            </View>
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {isSignUp
                ? 'By creating an account, you accept our terms and conditions'
                : 'Your data is protected with Firebase Authentication 🔒'}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFE5EC',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  headerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerImage: {
    width: 120,
    height: 120,
  },
  title: {
    ...typography.headlineLarge,
    fontSize: 28,
    fontWeight: '800',
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  formTitle: {
    ...typography.headlineSmall,
    fontSize: 22,
    fontWeight: '700',
    color: colors.onSurface,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.sm,
  },
  primaryButton: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    opacity: 0.8,
  },
});

export default LoginScreen;
