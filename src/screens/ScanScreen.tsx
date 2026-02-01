import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { ArrowLeft } from 'lucide-react-native';
import { RootStackParamList } from '../types';
import ImagePicker from 'react-native-image-crop-picker';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { colors, typography, spacing } from '../theme';
import { borderRadius } from '../theme/spacing';
import { recognizeText } from '../services/ocr/textRecognition';
import { parseReceiptText } from '../services/ocr/receiptParser';
import { useDrafts } from '../hooks/useDrafts';

type ScanScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ScanTab'>;

interface Props {
  navigation: ScanScreenNavigationProp;
}

const ScanScreen: React.FC<Props> = ({ navigation }) => {
  const { saveDraft } = useDrafts();
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);

  // Wiggle animation for emoji
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(wiggleAnim, {
          toValue: -3,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(wiggleAnim, {
          toValue: 3,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(wiggleAnim, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ])
    ).start();
  }, [wiggleAnim]);
  /**
   * Take photo with camera
   */
  const takePhoto = async () => {
    try {
      const image = await ImagePicker.openCamera({
        mediaType: 'photo',
        cropping: true,
        freeStyleCropEnabled: true,
        compressImageQuality: 0.8,
      });

      if (image?.path) {
        setImageUri(image.path);
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
      const image = await ImagePicker.openPicker({
        mediaType: 'photo',
        cropping: true,
        freeStyleCropEnabled: true,
        compressImageQuality: 0.8,
      });

      if (image?.path) {
        setImageUri(image.path);
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Kawaii */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ArrowLeft size={24} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Escanear</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Captura tu recibo de compra ✨
        </Text>

        {/* Camera Emoji */}
        <View style={styles.cameraEmojiContainer}>
          <Animated.Text
            style={[
              styles.cameraEmoji,
              {
                transform: [{
                  rotate: wiggleAnim.interpolate({
                    inputRange: [-3, 3],
                    outputRange: ['-3deg', '3deg']
                  })
                }]
              }
            ]}
          >
            📸
          </Animated.Text>
          <Text style={styles.sparkleEmoji}>✨</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

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
              title="🔄 Cambiar Foto"
              onPress={clearImage}
              variant="text"
              disabled={processing}
              style={styles.actionButton}
            />
            <Button
              title="✨ Procesar"
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
            <Text style={styles.processingEmoji}>🔍</Text>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.processingText}>
              Procesando imagen con magia IA...
            </Text>
            <Text style={styles.processingSubtext}>
              Esto puede tomar unos segundos ✨
            </Text>
          </Card>
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    ...typography.headlineLarge,
    fontSize: 32,
    fontWeight: '800',
    color: colors.onSurface,
    flex: 1,
  },
  headerSubtitle: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    opacity: 0.9,
  },
  cameraEmojiContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
    position: 'relative',
  },
  cameraEmoji: {
    fontSize: 64,
  },
  sparkleEmoji: {
    position: 'absolute',
    top: -8,
    right: '35%',
    fontSize: 24,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
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
  processingEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  processingText: {
    ...typography.titleMedium,
    fontWeight: '700',
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
