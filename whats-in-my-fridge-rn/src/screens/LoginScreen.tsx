import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
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

  const validate = () => {
    let valid = true;

    setEmailError('');
    setPasswordError('');

    if (!email.trim()) {
      setEmailError('El email es requerido');
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('Email inválido');
      valid = false;
    }

    if (!password.trim()) {
      setPasswordError('La contraseña es requerida');
      valid = false;
    } else if (password.length < 6) {
      setPasswordError('La contraseña debe tener al menos 6 caracteres');
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>🍎 What's In My Fridge</Text>
          <Text style={styles.subtitle}>
            Gestiona tu inventario de alimentos
          </Text>
        </View>

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
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            error={passwordError}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry
            autoComplete="password"
            editable={!loading}
          />

          <Button
            title={isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
            onPress={isSignUp ? handleSignUp : handleSignIn}
            loading={loading}
            style={styles.primaryButton}
          />

          <Button
            title={isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
            onPress={toggleMode}
            variant="text"
            disabled={loading}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {isSignUp
              ? 'Al crear una cuenta, aceptas nuestros términos y condiciones'
              : 'Tus datos están protegidos con Firebase Authentication'}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.headlineMedium,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  form: {
    marginBottom: spacing.xl,
  },
  primaryButton: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
});

export default LoginScreen;
