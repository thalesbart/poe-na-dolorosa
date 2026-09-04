import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import Tag from '../components/Tag';
import { api } from '../services/api';
import { COLORS, outroUsuario, periodoAtual, formatarMoeda } from '../theme';

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'receitas', label: '↑ Receitas' },
  { id: 'debitos', label: '↓ Débitos' },
  { id: 'divididos', label: '⇄ Divididos' },
];

function isFixo(item) {
  return item.categoria === 'Custos Fixos';
}

function aplicarFiltro(itens, filtro) {
  const filtrados = itens.filter((i) => {
    if (filtro === 'receitas') return i.tipo === 'receita';
    if (filtro === 'debitos') return i.tipo === 'debito' && i.subtipo === 'pessoal';
    if (filtro === 'divididos') return i.subtipo === 'dividido';
    return true;
  });
  // Custos fixos sempre no topo
  return [...filtrados.filter(isFixo), ...filtrados.filter((i) => !isFixo(i))];
}

export default function Historico({ usuario, onEditarLancamento, recarregar }) {
  const outro = outroUsuario(usuario);
  const [filtro, setFiltro] = useState('todos');
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [transacoes, setTransacoes] = useState([]);

  const carregar = useCallback(async ({ viaRefresh = false } = {}) => {
    if (viaRefresh) setAtualizando(true);
    else setCarregando(true);
    try {
      // Sem filtro de período aqui — queremos ver todos os períodos (abertos e fechados)
      const r = await api.listarTransacoes(usuario, null);
      setTransacoes(r.transacoes || []);
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [usuario]);

  useEffect(() => {
    carregar();
  }, [carregar, recarregar]);

  // Agrupa por período — usa período atual se vier vazio/undefined
  const periodosMap = {};
  transacoes.forEach((t) => {
    const chave = t.periodo && t.periodo.trim() !== '' ? t.periodo : periodoAtual();
    if (!periodosMap[chave]) periodosMap[chave] = [];
    periodosMap[chave].push(t);
  });
  const periodosOrdenados = Object.keys(periodosMap).sort().reverse();
  const periodoCorrente = periodoAtual();

  if (carregando) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={atualizando}
          onRefresh={() => carregar({ viaRefresh: true })}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
    >
      <Text style={styles.titulo}>Histórico</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {FILTROS.map((f) => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filtroBotao, filtro === f.id && { backgroundColor: COLORS.accent, borderColor: COLORS.accent }]}
              onPress={() => setFiltro(f.id)}
            >
              <Text style={[styles.filtroTexto, filtro === f.id && { color: '#fff' }]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {periodosOrdenados.map((periodo) => {
        const itens = aplicarFiltro(periodosMap[periodo], filtro);
        if (itens.length === 0) return null;
        const aberto = periodo === periodoCorrente;
        const statusFechado = periodosMap[periodo][0]?.status_periodo === 'fechado';

        return (
          <View key={periodo}>
            <View style={styles.separadorPeriodo}>
              <View style={styles.linha} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.labelPeriodo, { color: aberto ? COLORS.accent : COLORS.muted }]}>{periodo}</Text>
                {statusFechado ? <Tag color={COLORS.muted}>fechado</Tag> : <Tag color={COLORS.accent}>atual</Tag>}
              </View>
              <View style={styles.linha} />
            </View>

            {itens.map((item, i) => {
              const ehReceita = item.tipo === 'receita';
              const dividido = item.subtipo === 'dividido';
              const recebidoDoOutro = item.dono !== usuario;
              // Num item dividido, o valor relevante é sempre a parte do outro:
              // positivo/verde para quem lançou (tem a receber), negativo/vermelho para quem participou (tem que pagar)
              const souCredor = dividido && !recebidoDoOutro;
              const valorExibido = dividido ? item.valor_outro : item.valor_dono;
              const positivo = ehReceita || souCredor;
              const fixo = isFixo(item);

              return (
                <View key={item.id || i}>
                  {i > 0 && !fixo && isFixo(itens[i - 1]) && (
                    <View style={styles.separadorDemais}>
                      <View style={styles.linha} />
                      <Text style={styles.labelDemais}>DEMAIS</Text>
                      <View style={styles.linha} />
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.itemLinha, statusFechado && { opacity: 0.7 }]}
                    onPress={() => onEditarLancamento(item)}
                    activeOpacity={0.6}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View
                        style={[
                          styles.icone,
                          { backgroundColor: ehReceita ? COLORS.greenSoft : fixo ? COLORS.yellowSoft : item.subtipo === 'dividido' ? COLORS.accentSoft : COLORS.redSoft },
                        ]}
                      >
                        <Text>{ehReceita ? '↑' : fixo ? '📌' : item.subtipo === 'dividido' ? '⇄' : '↓'}</Text>
                      </View>
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={styles.descricao}>{item.descricao}</Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
                          {fixo && <Tag color={COLORS.yellow}>fixo</Tag>}
                          {item.forma_pagamento ? <Tag color={COLORS.muted}>{item.forma_pagamento}</Tag> : null}
                          {item.subtipo === 'dividido' && (
                            <Tag color={COLORS.accent}>{recebidoDoOutro ? `de ${item.dono}` : `÷ ${item.dividido_com}`}</Tag>
                          )}
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.valor, { color: positivo ? COLORS.green : fixo ? COLORS.yellow : COLORS.red }]}>
                      {positivo ? '+' : '-'}R$ {formatarMoeda(valorExibido)}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        );
      })}

      {periodosOrdenados.length === 0 && (
        <Text style={styles.textoVazio}>Nenhum lançamento encontrado.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, gap: 16 },
  loadingContainer: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' },
  titulo: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  filtroBotao: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  filtroTexto: { color: COLORS.muted, fontSize: 12, fontWeight: '600' },
  separadorPeriodo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  linha: { flex: 1, height: 1, backgroundColor: COLORS.border },
  labelPeriodo: { fontSize: 12, fontWeight: '700' },
  separadorDemais: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  labelDemais: { fontSize: 10, color: COLORS.muted, fontWeight: '600', letterSpacing: 0.5 },
  itemLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  icone: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  descricao: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  valor: { fontSize: 15, fontWeight: '700' },
  textoVazio: { color: COLORS.muted, textAlign: 'center', marginTop: 40 },
});
