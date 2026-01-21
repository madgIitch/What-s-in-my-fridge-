import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types';
import * as ImagePicker from 'expo-image-picker';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { recognizeText } from '../services/ocr/textRecognition';
import { parseReceiptText } from '../services/ocr/receiptParser';
import { useDrafts } from '../hooks/useDrafts';

type ScanScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Scan'>;

interface Props {
  navigation: ScanScreenNavigationProp;
}

const ScanScreen: React.FC<Props> = ({ navigation }) => {
  const { saveDraft } = useDrafts();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);

  /**
   * Request camera permission
   */
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso Denegado',
        'Necesitamos acceso a la cámara para escanear recibos'
      );
      return false;
    }
    return true;
  };

  /**
   * Take photo with camera
   */
  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setOcrText(null);
      }
    } catch (error: any) {
      Alert.alert('Error', 'No se pudo tomar la foto');
      console.error('Camera error:', error);
    }
  };

  /**
   * Pick image from gallery
   */
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        setOcrText(null);
      }
    } catch (error: any) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen');
      console.error('Image picker error:', error);
    }
  };

  /**
   * Process image with OCR and parse receipt
   */
  const processImage = async () => {
    if (!imageUri) {
      Alert.alert('Error', 'Selecciona o toma una foto primero');
      return;
    }

    setProcessing(true);

    try {
      // Step 1: OCR - Extract text from image
      console.log('Starting OCR processing...');
      const ocrResult = await recognizeText(imageUri);
      const extractedText = ocrResult.text;

      console.log('OCR completed. Text:', extractedText);
      setOcrText(extractedText);

      if (!extractedText || extractedText.trim().length === 0) {
        Alert.alert(
          'Sin Texto',
          'No se pudo extraer texto de la imagen. Intenta con otra foto más clara.'
        );
        setProcessing(false);
        return;
      }

      // Step 2: Parse receipt text
      console.log('Parsing receipt...');
      const parsedInfo = parseReceiptText(extractedText);

      console.log('Parsed info:', parsedInfo);

      if (parsedInfo.items.length === 0) {
        Alert.alert(
          'Sin Items',
          'No se pudieron detectar items en el recibo. ¿Quieres revisar el texto manualmente?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Ver Texto',
              onPress: () => {
                Alert.alert('Texto Extraído', extractedText);
              },
            },
          ]
        );
        setProcessing(false);
        return;
      }

      // Step 3: Save draft
      console.log('Saving draft...');
      const draft = await saveDraft({
        rawText: extractedText,
        merchant: parsedInfo.merchant || undefined,
        purchaseDate: parsedInfo.purchaseDate || undefined,
        total: parsedInfo.total || undefined,
        currency: parsedInfo.currency,
        linesJson: JSON.stringify(parsedInfo.items),
        unrecognizedLines: JSON.stringify(parsedInfo.unrecognizedLines),
      });

      if (!draft) {
        throw new Error('No se pudo guardar el borrador');
      }

      console.log('Draft saved with ID:', draft.id);

      // Step 4: Navigate to ReviewDraft screen
      Alert.alert(
        'Éxito',
        `Se encontraron ${parsedInfo.items.length} items. Revisa y confirma los datos.`,
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.navigate('ReviewDraft', { draftId: draft.id });
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error processing image:', error);
      Alert.alert('Error', error.message || 'No se pudo procesar la imagen');
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Clear current image and start over
   */
  const clearImage = () => {
    setImageUri(null);
    setOcrText(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Escanear Recibo</Text>
      <Text style={styles.subtitle}>
        Toma una foto de tu recibo o selecciona una de la galería
      </Text>

      {imageUri ? (
        <Card style={styles.imageCard}>
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />

          {ocrText && (
            <View style={styles.ocrPreview}>
              <Text style={styles.ocrPreviewTitle}>Texto Extraído:</Text>
              <Text style={styles.ocrPreviewText} numberOfLines={5}>
                {ocrText}
              </Text>
            </View>
          )}

          <View style={styles.imageActions}>
            <Button
              title="Cambiar Foto"
              onPress={clearImage}
              variant="text"
              disabled={processing}
              style={styles.actionButton}
            />
            <Button
              title="Procesar"
              onPress={processImage}
              loading={processing}
              style={styles.actionButton}
            />
          </View>
        </Card>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📸</Text>
          <Text style={styles.emptyText}>
            Captura o selecciona una imagen del recibo
          </Text>

          <View style={styles.actionButtons}>
            <Button
              title="📷 Tomar Foto"
              onPress={takePhoto}
              style={styles.primaryButton}
            />
            <Button
              title="🖼️ Desde Galería"
              onPress={pickImage}
              variant="secondary"
              style={styles.secondaryButton}
            />
          </View>

          <Card variant="outlined" style={styles.tipCard}>
            <Text style={styles.tipTitle}>💡 Consejos</Text>
            <Text style={styles.tipText}>
              • Asegúrate de que el recibo esté bien iluminado{'\n'}
              • Captura el recibo completo y sin borrosidad{'\n'}
              • Evita sombras y reflejos{'\n'}
              • Coloca el recibo sobre una superficie plana
            </Text>
          </Card>
        </View>
      )}

      {processing && (
        <View style={styles.processingOverlay}>
          <Card style={styles.processingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.processingText}>
              Procesando imagen con OCR...
            </Text>
            <Text style={styles.processingSubtext}>
              Esto puede tomar unos segundos
            </Text>
          </Card>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    ...typography.headlineSmall,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.xl,
  },
  imageCard: {
    padding: 0,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 400,
    backgroundColor: colors.surfaceVariant,
  },
  ocrPreview: {
    padding: spacing.md,
    backgroundColor: colors.surfaceVariant,
  },
  ocrPreviewTitle: {
    ...typography.labelMedium,
    color: colors.onSurface,
    marginBottom: spacing.xs,
  },
  ocrPreviewText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    fontFamily: 'monospace',
  },
  imageActions: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.bodyLarge,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  actionButtons: {
    width: '100%',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  primaryButton: {
    width: '100%',
  },
  secondaryButton: {
    width: '100%',
  },
  tipCard: {
    width: '100%',
  },
  tipTitle: {
    ...typography.titleMedium,
    color: colors.onSurface,
    marginBottom: spacing.sm,
  },
  tipText: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    lineHeight: 20,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  processingCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  processingText: {
    ...typography.titleMedium,
    color: colors.onSurface,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  processingSubtext: {
    ...typography.bodySmall,
    color: colors.onSurfaceVariant,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default ScanScreen;
