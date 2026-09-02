/**
 * services/push.js
 * Registro de notificações push via Expo (gratuito, sem servidor próprio).
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { api } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Solicita permissão e registra o token push do dispositivo,
 * salvando-o na planilha associado ao nome do usuário.
 */
export async function registrarPushNotifications(usuario) {
  if (!Device.isDevice) {
    console.log('Notificações push exigem um dispositivo físico (não funciona em emulador).');
    return null;
  }

  const { status: statusExistente } = await Notifications.getPermissionsAsync();
  let status = statusExistente;

  if (status !== 'granted') {
    const { status: novoStatus } = await Notifications.requestPermissionsAsync();
    status = novoStatus;
  }

  if (status !== 'granted') {
    console.log('Permissão de notificação negada.');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await api.salvarTokenPush(usuario, token);

  return token;
}
