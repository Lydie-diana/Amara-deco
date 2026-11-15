import { useAmaraClient, useRequestOtp, useSession, useSignOut, useVerifyOtp } from '@amara/api';
import { formatCameroonPhone, normalizeCameroonPhone } from '@amara/core';
import { useTranslation } from '@amara/i18n';
import { Arch, Button, colors, Logo, Screen, space, Text, TextField } from '@amara/ui';
import { useState } from 'react';
import { View } from 'react-native';

export interface PhoneSignInScreenProps {
  /** Mention sous le logo : « PRO » pour Amara Pro, « ADMIN » pour la console. */
  badge?: string;
  /** Appelé une fois la session ouverte. */
  onSignedIn?: () => void;
}

/** Connexion par numéro camerounais et code SMS, commune aux trois applications. */
export function PhoneSignInScreen({ badge, onSignedIn }: PhoneSignInScreenProps) {
  const { t } = useTranslation('auth');
  const { t: tc } = useTranslation('common');
  const client = useAmaraClient();
  const { session } = useSession();
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const signOut = useSignOut();

  const [rawPhone, setRawPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const failed = requestOtp.isError || verifyOtp.isError;

  function submitPhone() {
    if (!normalizeCameroonPhone(rawPhone)) {
      setPhoneError(t('phoneInvalid'));
      return;
    }
    setPhoneError(null);
    requestOtp.mutate(rawPhone, { onSuccess: setSentTo });
  }

  function submitCode() {
    if (!sentTo) return;
    verifyOtp.mutate({ phone: sentTo, token: code.trim() }, { onSuccess: () => onSignedIn?.() });
  }

  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.lg, paddingTop: space.xl }}>
        <Arch
          width={140}
          height={170}
          color={colors.sand}
          style={{ alignItems: 'center', justifyContent: 'center' }}
        >
          <Logo size={22} badge={badge} />
        </Arch>
        <Text variant="display" style={{ textAlign: 'center' }}>
          {t('title')}
        </Text>
      </View>

      {!client ? (
        <Text tone="muted" style={{ textAlign: 'center' }}>
          {tc('configMissing')}
        </Text>
      ) : session ? (
        <View style={{ gap: space.md }}>
          <Text style={{ textAlign: 'center' }}>{t('signedIn')}</Text>
          <Button label={t('signOut')} variant="secondary" onPress={() => signOut.mutate()} />
        </View>
      ) : sentTo ? (
        <View style={{ gap: space.md }}>
          <Text tone="muted">{t('codeSentTo', { phone: formatCameroonPhone(sentTo) })}</Text>
          <TextField
            label={t('codeLabel')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={6}
            onSubmitEditing={submitCode}
          />
          <Button
            label={t('verify')}
            onPress={submitCode}
            loading={verifyOtp.isPending}
            disabled={code.trim().length < 4}
          />
          <Button label={t('changeNumber')} variant="ghost" onPress={() => setSentTo(null)} />
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          <TextField
            label={t('phoneLabel')}
            placeholder={t('phonePlaceholder')}
            value={rawPhone}
            onChangeText={setRawPhone}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            error={phoneError}
            onSubmitEditing={submitPhone}
          />
          <Button label={t('sendCode')} onPress={submitPhone} loading={requestOtp.isPending} />
        </View>
      )}

      {failed ? (
        <Text
          variant="caption"
          style={{ color: colors.clay, textAlign: 'center' }}
          accessibilityLiveRegion="polite"
        >
          {t('error')}
        </Text>
      ) : null}
    </Screen>
  );
}
