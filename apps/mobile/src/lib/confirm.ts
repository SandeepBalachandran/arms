import { Alert } from 'react-native';

// Yes/no question before a destructive action. Resolves true when confirmed.
// Native: a system alert. (Web has its own file: Alert.alert does nothing there.)
export function confirm({ title, message, confirmText, cancelText = 'Cancel' }: {
  title: string;
  message?: string;
  confirmText: string;
  cancelText?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
