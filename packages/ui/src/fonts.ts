import { Fraunces_400Regular, Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';

/** Charge les polices d'Amara. Renvoie true quand elles sont prêtes. */
export function useAmaraFonts(): boolean {
  const [loaded, error] = useFonts({
    Fraunces_400Regular,
    Fraunces_400Regular_Italic,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  // En cas d'échec réseau, on affiche quand même l'application avec les polices système.
  return loaded || error != null;
}
