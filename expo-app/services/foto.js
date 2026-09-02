/**
 * services/foto.js
 * Fluxo de escolha, compressão e upload da foto de perfil do usuário.
 */
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Alert } from 'react-native';
import { api } from './api';

/**
 * Abre a galeria, deixa o usuário recortar a foto em quadrado, comprime
 * para caber num POST ao Apps Script e envia para o backend.
 * Retorna a nova URL da foto, ou null se o usuário cancelou / algo falhou.
 */
export async function escolherEEnviarFoto(usuario) {
  const permissao = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissao.granted) {
    Alert.alert('Permissão necessária', 'Precisamos de acesso às suas fotos para trocar o avatar.');
    return null;
  }

  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (resultado.canceled || !resultado.assets?.[0]) return null;

  try {
    // Redimensiona para 400x400 e converte para JPEG comprimido — mantém
    // o upload pequeno o suficiente para o POST ao Apps Script.
    const manipulada = await ImageManipulator.manipulateAsync(
      resultado.assets[0].uri,
      [{ resize: { width: 400, height: 400 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    if (!manipulada.base64) throw new Error('Falha ao gerar base64 da imagem');

    const resposta = await api.salvarFotoPerfil(usuario, manipulada.base64, 'image/jpeg');
    if (!resposta.sucesso) throw new Error(resposta.erro || 'Erro desconhecido');
    return resposta.url;
  } catch (err) {
    Alert.alert('Erro', 'Não foi possível enviar a foto. Tente novamente.');
    return null;
  }
}
