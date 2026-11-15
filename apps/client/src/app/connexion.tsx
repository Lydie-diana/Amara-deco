import { PhoneSignInScreen } from '@amara/features';
import { router } from 'expo-router';

export default function SignIn() {
  return <PhoneSignInScreen onSignedIn={() => router.replace('/')} />;
}
