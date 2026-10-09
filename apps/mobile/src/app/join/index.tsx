import { parseGymCode } from '@gymos/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button, Input, Screen, Text } from '@/components/ui';

// Shown after sign-in when the user has no gym yet, and from Profile to join
// another one. Accepts a gym code or a pasted join link.
export default function JoinWithCodeScreen() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function next() {
    const slug = parseGymCode(value);
    if (!slug) return setError('That doesn’t look like a gym code or join link.');
    setError(null);
    router.push({ pathname: '/join/[slug]', params: { slug } });
  }

  return (
    <Screen>
      <Text variant="title">Join your gym</Text>
      <Text variant="muted">
        Open the join link your gym shared on WhatsApp, or type the gym code you got from the front desk.
      </Text>
      <Input
        label="Gym code or link"
        value={value}
        onChangeText={setValue}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="e.g. iron-fit"
        returnKeyType="go"
        onSubmitEditing={next}
      />
      {error && <Text variant="error">{error}</Text>}
      <Button title="Continue" onPress={next} disabled={!value.trim()} />
    </Screen>
  );
}
