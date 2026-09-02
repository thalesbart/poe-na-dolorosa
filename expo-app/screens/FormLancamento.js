import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import Avatar from '../components/Avatar';
import SelectDropdown from '../components/SelectDropdown';
import PromptModal from '../components/PromptModal';
import { api } from '../services/api';
import { COLORS, outroUsuario, periodoAtual } from '../theme';

const CATEGORIAS_PADRAO = ['Alimentação', 'Transporte', 'Lazer', 'Saúde', 'Moradia', 'Custos Fixos', 'Outros'];

const SUBTIPOS = [
  { id: 'pessoal', label: '↓ Pessoal', cor: COLORS.red },
  { id: 'dividido', label: '⇄ Dividido', cor: COLORS.accent },
  { id: 'receita', label: '↑ Receita', cor: COLORS.green },
];

function inferirSubtipo(lancamento) {
  if (!lancamento) return 'pessoal';
  if (lancamento.tipo === 'receita') return 'receita';
  if (lancamento.subtipo === 'dividido') return 'dividido';
  return 'pessoal';
}

export default function FormLancamento({ usuario, lancamento, onSalvo, onVoltar }) {
  const outro = outroUsuario(usuario);
  const editando = !!lancamento;

  const [subtipo, setSubtipo] = useState(inferirSubtipo(lancamento));
  const [descricao, setDescricao] = useState(lancamento?.descricao || '');
  const [categoria, setCategoria] = useState(lancamento?.categoria || '');
  const [forma, setForma] = useState(lancamento?.forma_pagamento || '');
  const [total, setTotal] = useState(
    lancamento ? String((Number(lancamento.valor_dono) || 0) + (Number(lancamento.valor_outro) || 0)) : ''
  );
  const [valorOutroInput, setValorOutroInput] = useState(lancamento?.valor_outro?.toString() || '');
  const [salvando, setSalvando] = useState(false);

  const [descricoesPessoais, setDescricoesPessoais] = useState([]);
  const [descricoesReceita, setDescricoesReceita] = useState([]);
  const [formasPagamento, setFormasPagamento] = useState([]);
  const [categorias, setCategorias] = useState(CATEGORIAS_PADRAO);

  // Controle do modal de "adicionar novo item"
  const [promptAberto, setPromptAberto] = useState(null); // 'descricao' | 'descricao_receita' | 'forma' | 'categoria' | null

  useEffect(() => {
    api.carregarOpcoesFormulario().then((r) => {
      setDescricoesPessoais(r.descricoes || []);
      setDescricoesReceita(r.descricoes_receita || []);
      setFormasPagamento(r.formas || []);
      setCategorias(r.categorias && r.categorias.length ? r.categorias : CATEGORIAS_PADRAO);
    });
  }, []);

  const totalNum = parseFloat(total) || 0;
  const valorOutroNum = parseFloat(valorOutroInput) || 0;
  const minhaParte = totalNum > 0 ? totalNum - valorOutroNum : 0;

  const handleConfirmarNovoItem = async (texto) => {
    if (promptAberto === 'descricao') {
      await api.cadastrarDescricao(texto);
      setDescricoesPessoais((prev) => [...prev, texto]);
      setDescricao(texto);
    } else if (promptAberto === 'descricao_receita') {
      await api.cadastrarDescricaoReceita(texto);
      setDescricoesReceita((prev) => [...prev, texto]);
      setDescricao(texto);
    } else if (promptAberto === 'forma') {
      await api.cadastrarFormaPagamento(texto);
      setFormasPagamento((prev) => [...prev, texto]);
      setForma(texto);
    } else if (promptAberto === 'categoria') {
      await api.cadastrarCategoria(texto);
      setCategorias((prev) => [...prev, texto]);
      setCategoria(texto);
    }
    // fecha o modal após 1.2s (tempo do feedback de sucesso no PromptModal)
    setTimeout(() => setPromptAberto(null), 1200);
  };

  const validar = () => {
    if (!descricao) return 'Preencha a descrição.';
    if (totalNum <= 0) return 'Informe um valor total válido.';
    if (subtipo === 'dividido' && valorOutroNum <= 0) return `Informe a parte de ${outro}.`;
    if (subtipo === 'dividido' && minhaParte < 0) return `O valor de ${outro} não pode ser maior que o total.`;
    return null;
  };

  const handleSalvar = async () => {
    const erro = validar();
    if (erro) {
      Alert.alert('Verifique os dados', erro);
      return;
    }

    setSalvando(true);
    try {
      const dadosBase = {
        tipo: subtipo === 'receita' ? 'receita' : 'debito',
        subtipo,
        descricao,
        categoria,
        forma_pagamento: subtipo === 'dividido' ? forma : '',
        dono: usuario,
        valor_dono: subtipo === 'dividido' ? minhaParte : totalNum,
        dividido_com: subtipo === 'dividido' ? outro : '',
        valor_outro: subtipo === 'dividido' ? valorOutroNum : '',
        periodo: periodoAtual(),
      };

      if (editando) {
        await api.editarTransacao({ id: lancamento.id, ...dadosBase });
      } else {
        await api.criarTransacao(dadosBase);
      }
      onSalvo();
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível salvar o lançamento.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = () => {
    Alert.alert('Excluir lançamento', 'Tem certeza? Essa ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await api.excluirTransacao(lancamento.id);
          onSalvo();
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.botaoVoltar} onPress={onVoltar}>
          <Text style={styles.textoVoltar}>←</Text>
        </TouchableOpacity>
        <Text style={styles.titulo}>{editando ? 'Editar lançamento' : 'Novo lançamento'}</Text>
      </View>

      {/* Subtipo */}
      <View style={styles.tabsContainer}>
        {SUBTIPOS.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.tab, subtipo === s.id && { backgroundColor: s.cor }]}
            onPress={() => {
              setSubtipo(s.id);
              setDescricao('');
              setForma('');
              setValorOutroInput('');
            }}
          >
            <Text style={[styles.tabTexto, subtipo === s.id && { color: '#fff' }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Descrição */}
      {subtipo === 'pessoal' ? (
        <SelectDropdown
          label="Descrição"
          value={descricao}
          onChange={setDescricao}
          options={descricoesPessoais}
          placeholder="Selecione a descrição..."
          accentColor={COLORS.red}
          onAddNew={() => setPromptAberto('descricao')}
          addNewLabel="+ Cadastrar nova..."
        />
      ) : subtipo === 'receita' ? (
        <SelectDropdown
          label="Descrição"
          value={descricao}
          onChange={setDescricao}
          options={descricoesReceita}
          placeholder="Selecione a receita..."
          accentColor={COLORS.green}
          onAddNew={() => setPromptAberto('descricao_receita')}
          addNewLabel="+ Cadastrar nova..."
        />
      ) : (
        <View>
          <Text style={styles.label}>DESCRIÇÃO</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Jantar, Viagem..."
            placeholderTextColor={COLORS.muted}
            value={descricao}
            onChangeText={setDescricao}
          />
        </View>
      )}

      {/* Categoria — só para débito dividido */}
      {subtipo === 'dividido' && (
        <SelectDropdown
          label="Categoria"
          value={categoria}
          onChange={setCategoria}
          options={categorias}
          placeholder="Selecione a categoria..."
          onAddNew={() => setPromptAberto('categoria')}
          addNewLabel="+ Cadastrar nova..."
        />
      )}

      {/* Forma de pagamento — só dividido */}
      {subtipo === 'dividido' && (
        <SelectDropdown
          label="Forma de pagamento"
          value={forma}
          onChange={setForma}
          options={formasPagamento}
          placeholder="Selecione a forma..."
          onAddNew={() => setPromptAberto('forma')}
        />
      )}

      {/* Valor total */}
      <View>
        <Text style={styles.label}>VALOR TOTAL</Text>
        <TextInput
          style={styles.inputValor}
          placeholder="R$ 0,00"
          placeholderTextColor={COLORS.muted}
          keyboardType="decimal-pad"
          value={total}
          onChangeText={setTotal}
        />
      </View>

      {/* Divisão */}
      {subtipo === 'dividido' && (
        <View style={styles.cardDivisao}>
          <View style={styles.linhaOutro}>
            <Avatar name={outro} size={32} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.textoDividindo}>Dividindo com {outro}</Text>
              <Text style={styles.textoMuted}>Quanto é a parte de {outro}?</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.labelPequeno}>PARTE DE {outro.toUpperCase()}</Text>
              <TextInput
                style={styles.inputDivisao}
                placeholder="R$ 0"
                placeholderTextColor={COLORS.muted}
                keyboardType="decimal-pad"
                value={valorOutroInput}
                onChangeText={setValorOutroInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.labelPequeno}>SUA PARTE</Text>
              <View style={styles.minhaParteBox}>
                <Text style={[styles.minhaParteTexto, minhaParte < 0 && { color: COLORS.red }]}>
                  {totalNum > 0 ? `R$ ${minhaParte.toFixed(2)}` : '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Botão salvar */}
      <TouchableOpacity
        style={[
          styles.botaoSalvar,
          { backgroundColor: editando ? COLORS.yellow : subtipo === 'pessoal' ? COLORS.red : subtipo === 'dividido' ? COLORS.accent : COLORS.green },
        ]}
        onPress={handleSalvar}
        disabled={salvando}
      >
        <Text style={[styles.botaoSalvarTexto, editando && { color: COLORS.bg }]}>
          {salvando ? 'Salvando...' : editando ? '✓ Salvar alterações' : subtipo === 'dividido' ? `Salvar • Notificar ${outro}` : 'Salvar lançamento'}
        </Text>
      </TouchableOpacity>

      {editando && (
        <TouchableOpacity style={styles.botaoExcluir} onPress={handleExcluir}>
          <Text style={styles.botaoExcluirTexto}>🗑 Excluir lançamento</Text>
        </TouchableOpacity>
      )}

      <PromptModal
        visivel={promptAberto !== null}
        titulo={
          promptAberto === 'descricao' ? 'Nova descrição'
          : promptAberto === 'descricao_receita' ? 'Nova receita'
          : promptAberto === 'forma' ? 'Nova forma de pagamento'
          : 'Nova categoria'
        }
        mensagem={
          promptAberto === 'descricao' ? 'Digite o nome do novo item (ex: Farmácia, Academia):'
          : promptAberto === 'descricao_receita' ? 'Digite o nome da receita (ex: Salário, Freela):'
          : promptAberto === 'forma' ? 'Digite o nome (ex: Cartão Nubank):'
          : 'Digite o nome da categoria (ex: Educação):'
        }
        placeholder="Digite aqui..."
        corDestaque={promptAberto === 'descricao' ? COLORS.red : COLORS.accent}
        onConfirmar={handleConfirmarNovoItem}
        onCancelar={() => setPromptAberto(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  botaoVoltar: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  textoVoltar: { color: COLORS.text, fontSize: 16 },
  titulo: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  tabsContainer: { flexDirection: 'row', gap: 8, backgroundColor: COLORS.card, borderRadius: 14, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabTexto: { color: COLORS.muted, fontWeight: '600', fontSize: 13 },
  label: { fontSize: 12, color: COLORS.muted, fontWeight: '600', marginBottom: 6 },
  labelPequeno: { fontSize: 11, color: COLORS.muted, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: COLORS.text, fontSize: 14 },
  inputValor: { backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: COLORS.text, fontSize: 20, fontWeight: '700' },
  cardDivisao: { backgroundColor: COLORS.accentSoft, borderWidth: 1, borderColor: COLORS.accent + '55', borderRadius: 16, padding: 18 },
  linhaOutro: { flexDirection: 'row', alignItems: 'center' },
  textoDividindo: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  textoMuted: { color: COLORS.muted, fontSize: 11 },
  inputDivisao: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.accent + '55', borderRadius: 10, padding: 12, color: COLORS.text, fontSize: 16, fontWeight: '700' },
  minhaParteBox: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, minHeight: 46, justifyContent: 'center' },
  minhaParteTexto: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  botaoSalvar: { borderRadius: 14, padding: 16, alignItems: 'center' },
  botaoSalvarTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  botaoExcluir: { borderWidth: 1, borderColor: COLORS.red + '44', borderRadius: 14, padding: 14, alignItems: 'center' },
  botaoExcluirTexto: { color: COLORS.red, fontSize: 14, fontWeight: '600' },
});
