import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Button } from '../components/common/Button';
import { colors, typography, spacing } from '../theme';
import { X } from 'lucide-react-native';

type CropScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Crop'>;
type CropScreenRouteProp = RouteProp<RootStackParamList, 'Crop'>;

interface Props {
  navigation: CropScreenNavigationProp;
  route: CropScreenRouteProp;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CropScreen: React.FC<Props> = ({ navigation, route }) => {
  const { imageUri, onCropComplete } = route.params;
  const [processing, setProcessing] = useState(false);

  const handleCrop = async () => {
    setProcessing(true);
    try {
      // For now, we'll use the full image
      // You can add crop rectangle selection later
      const manipResult = await manipulateAsync(
        imageUri,
        [{ resize: { width: SCREEN_WIDTH * 2 } }], // Resize for performance
        { compress: 0.8, format: SaveFormat.JPEG }
      );

      onCropComplete(manipResult.uri);
      navigation.goBack();
    } catch (error) {
      console.error('Error cropping image:', error);
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleCancel}
          style={styles.closeButton}
          activeOpacity={0.7}
        >
          <X size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recortar Foto</Text>
        <View style={styles.closeButton} />
      </View>

      {/* Image Preview */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          resizeMode="contain"
        />
      </View>

      {/* Bottom Controls */}
      <View style={styles.controls}>
        <Text style={styles.hint}>
          Ajusta el encuadre y presiona Aceptar ✨
        </Text>

        <View style={styles.buttons}>
          <Button
            title="Cancel"
            onPress={handleCancel}
            variant="secondary"
            disabled={processing}
            style={styles.cancelButton}
          />
          <Button
            title="Aceptar"
            onPress={handleCrop}
            loading={processing}
            style={styles.acceptButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: '#000000',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.titleLarge,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  controls: {
    backgroundColor: '#FFE5EC',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  hint: {
    ...typography.bodyMedium,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  acceptButton: {
    flex: 1,
  },
});

export default CropScreen;
