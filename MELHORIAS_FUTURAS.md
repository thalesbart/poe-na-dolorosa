# Melhorias futuras — análise de dados

Lista de possibilidades de análise e features levantadas a partir do schema atual de
`transacoes` e `acertos`, em ordem de prioridade. Registrado em 2026-09 para revisitar depois.

## O que os dados de hoje já permitem analisar
- Tendência de receita/despesa/investimento ao longo dos meses (juntando períodos fechados).
- Padrão de uso por forma de pagamento (útil pra bater com fatura de cartão).
- Frequência e ticket médio por descrição.
- Assimetria de contribuição no dividido (quem paga 100% vs 50%, com que frequência).
- Tempo até o acerto (dias/lançamentos acumulados até quitar o saldo).

## O que falta nos dados hoje
- Gasto por categoria em despesas **pessoais** — o campo `categoria` só existe em lançamentos
  divididos. Sem isso, qualquer "gasto por categoria" fica incompleto.
- Granularidade menor que "mês" não é exposta (dia da semana, hora etc.), embora a `data` bruta
  permitisse derivar isso.
- Descrição livre fragmenta contagem (ex: "Mercado" vs "Supermercado" contam como itens diferentes).

## Features propostas, em ordem de prioridade

1. **Categoria também em despesas pessoais** (pré-requisito pra quase tudo abaixo) — hoje o
   campo categoria só aparece na aba Dividido do formulário de lançamento.
2. **Gráfico de gasto por categoria no período** — barras/pizza somando valor_dono por categoria.
3. **Tendência mensal** (receitas/despesas/investimentos) — gráfico de linha juntando os
   períodos já fechados do Histórico.
4. **Taxa de poupança do mês** — (Receitas − Despesas) / Receitas, ao lado do "SALDO DO MÊS".
5. **Alerta de valor fora do padrão** — comparar com a média histórica da descrição/categoria
   ao lançar, e avisar se estiver muito acima/abaixo do normal (teria pego o bug da vírgula
   decimal antes, por exemplo).
6. **Histórico do saldo entre usuários como série** — hoje só existe como snapshot atual, não
   como série ao longo do tempo.
7. **Padronização de descrição (fuzzy match ao cadastrar)** — avisar se a nova descrição é
   parecida com uma já existente, evitando fragmentar categorias.
8. **Reconciliação com fatura de cartão** — somar por forma de pagamento no período e comparar
   com o valor real da fatura (digitado manualmente).
9. **Sazonalidade/decomposição por categoria** — só faz sentido com 12+ meses de histórico
   fechado; aplicar o método de Séries Temporais do MBA na própria base de dados do casal.

## Limitações a lembrar quando revisitar
- Volume de dados ainda baixo (app novo) — análises de tendência/sazonalidade só ficam
  confiáveis com mais histórico acumulado.
- Lançamentos antigos podem ter valores corrompidos pelo bug de vírgula decimal (corrigido em
  código, mas dados antigos só se acertam editando e salvando de novo).
