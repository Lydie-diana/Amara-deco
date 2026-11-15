import AsyncStorage from '@react-native-async-storage/async-storage';

/** Sur iOS et Android, la session est gardée dans le stockage de l'application. */
export const sessionStorage = AsyncStorage;
export const canPersistSession = true;
