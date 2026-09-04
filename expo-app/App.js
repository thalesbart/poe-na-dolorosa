import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Entrada from './screens/Entrada';
import Dashboard from './screens/Dashboard';
import Historico from './screens/Historico';
import FormLancamento from './screens/FormLancamento';
import Acerto from './screens/Acerto';
import { registrarPushNotifications } from './services/push';
import { api } from './services/api';
import { COLORS } from './theme';

const TABS = [
  { id: 'dashboard', icone: '⬡', label: 'Início' },
  { id: 'historico', icone: '↕', label: 'Histórico' },
  { id: 'novo', icone: '+', label: 'Lançar', principal: true },
  { id: 'acerto', icone: '⇄', label: 'Acerto' },
];

export default function App() {
  const [usuario, setUsuario] = useState(null);
  const [tela, setTela] = useState('dashboard');
  const [lancamentoEditando, setLancamentoEditando] = useState(null);
  const [recarregarHistorico, setRecarregarHistorico] = useState(0);
  const [carregandoUsuarioSalvo, setCarregandoUsuarioSalvo] = useState(true);
  const [fotos, setFotos] = useState({});

  // Recupera o usuário salvo localmente (sem necessidade de login)
  useEffect(() => {
    AsyncStorage.getItem('@pixmedeve_usuario').then((valor) => {
      if (valor) setUsuario(valor);
      setCarregandoUsuarioSalvo(false);
    });
  }, []);

  const atualizarFotos = useCallback(() => {
    api.listarFotosPerfil().then((r) => setFotos(r.fotos || {})).catch(() => {});
  }, []);

  useEffect(() => {
    atualizarFotos();
  }, [atualizarFotos]);

  const escolherUsuario = useCallback(async (nome) => {
    await AsyncStorage.setItem('@pixmedeve_usuario', nome);
    setUsuario(nome);
    registrarPushNotifications(nome);
  }, []);

  const trocarUsuario = useCallback(async () => {
    await AsyncStorage.removeItem('@pixmedeve_usuario');
    setUsuario(null);
    setTela('dashboard');
  }, []);

  const abrirEdicao = (lancamento) => {
    setLancamentoEditando(lancamento);
    setTela('novo');
  };

  const fecharFormulario = () => {
    const voltarPara = lancamentoEditando ? 'historico' : 'dashboard';
    setLancamentoEditando(null);
    setTela(voltarPara);
    setRecarregarHistorico((v) => v + 1);
  };

  if (carregandoUsuarioSalvo) {
    return <View style={styles.appContainer} />;
  }

  if (!usuario) {
    return <Entrada onEscolher={escolherUsuario} fotos={fotos} />;
  }

  return (
    <SafeAreaView style={styles.appContainer}>
      <KeyboardAvoidingView
        style={styles.appContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.telaContainer}>
          {tela === 'dashboard' && (
            <Dashboard usuario={usuario} fotos={fotos} onFotoAtualizada={atualizarFotos} key={recarregarHistorico} />
          )}
          {tela === 'historico' && (
            <Historico usuario={usuario} onEditarLancamento={abrirEdicao} recarregar={recarregarHistorico} />
          )}
          {tela === 'novo' && (
            <FormLancamento usuario={usuario} fotos={fotos} lancamento={lancamentoEditando} onSalvo={fecharFormulario} onVoltar={fecharFormulario} />
          )}
          {tela === 'acerto' && <Acerto usuario={usuario} fotos={fotos} onAcertoRegistrado={() => setRecarregarHistorico((v) => v + 1)} />}
        </View>

        {tela !== 'novo' && (
          <View style={styles.bottomNav}>
            {TABS.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.tab, t.principal && styles.tabPrincipal]}
                onPress={() => setTela(t.id)}
              >
                <Text style={[styles.tabIcone, { color: t.principal ? '#fff' : tela === t.id ? COLORS.accent : COLORS.muted }]}>
                  {t.icone}
                </Text>
                <Text style={[styles.tabLabel, { color: t.principal ? '#fff' : tela === t.id ? COLORS.accent : COLORS.muted }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.trocarUsuario} onPress={trocarUsuario}>
          <Text style={styles.trocarUsuarioTexto}>trocar usuário</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appContainer: { flex: 1, backgroundColor: COLORS.bg },
  telaContainer: { flex: 1 },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tab: { alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6 },
  tabPrincipal: { backgroundColor: COLORS.accent, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 10 },
  tabIcone: { fontSize: 20 },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  trocarUsuario: { alignItems: 'center', paddingVertical: 8 },
  trocarUsuarioTexto: { color: COLORS.muted, fontSize: 11 },
});
