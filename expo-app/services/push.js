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

  // Desde o SDK 53, o Expo Go removeu o suporte a notificações push remotas
  // (só funciona num development build) — getExpoPushTokenAsync lança erro
  // nesse caso. Não deixamos isso derrubar o app: sem token, a notificação
  // de gasto dividido simplesmente não é enviada pra esse usuário.
  try {
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
  } catch (err) {
    console.log('Não foi possível registrar notificações push (normal no Expo Go a partir do SDK 53):', err.message);
    return null;
  }
}
