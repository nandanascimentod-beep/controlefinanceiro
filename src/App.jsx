'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';

/* PALETA */
const C = {
  bg: '#F8F9FA',
  surface: '#FFFFFF',
  surface2: '#F1F3F5',
  border: '#DEE2E6',

  primary: '#FFFFFF',
  secondary: '#212529',

  accent: '#8E9AAF',
  accentDark: '#5C677D',

  light: '#FFFFFF',
  muted: '#6C757D',

  danger: '#E57373',
  success: '#81C784',
  warning: '#001178',
};

const CATEGORIAS = [
  'Apartamento',
  'Carro',
  'Cosméticos',
  'Comida besteira',
  'Dinheiro',
  'Entretenimento',
  'Estética',
  'Farmácia',
  'Mercado',
  'Outros',
  'Presentes',
  'Roupas',
];

const METODOS = ['Cartão de Crédito', 'Boleto'];

const CAT_ICONS = {
  Apartamento: '\ud83c\udfe0',
  Carro: '\ud83d\ude97',
  Dinheiro: '\ud83d\udcb5',
  Mercado: '\ud83d\uded2',
  Outros: '\ud83d\udce6',
  Roupas: '\ud83d\udc57',
  Entretenimento: '\ud83c\udfac',
  Presentes: '\ud83c\udf81',
  Cosméticos: '\ud83d\udc84',
  'Comida besteira': '\ud83c\udf54',
  Estética: '\u2702\ufe0f',
  Farmácia: '\ud83d\udc8a',
};

const CAT_COLORS = {
  Apartamento: '#C0C4A3',
  Carro: '#DBB79F',
  Dinheiro: '#A8C4A2',
  Mercado: '#D4B896',
  Outros: '#8A9485',
  Roupas: '#C4A8B0',
  Entretenimento: '#DFEBE3',
  Presentes: '#6A7662',
  Cosméticos: '#C4B0C8',
  'Comida besteira': '#C47B6A',
  Estética: '#C0C4A3',
  Farmácia: '#A8C4A2',
};

const fmt = (v) =>
  `R$ ${Number(v || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function normalizarMes(mes) {
  if (!mes) return null;
  if (mes.includes('-')) return mes.slice(0, 7);
  if (mes.includes('/')) {
    const [m, a] = mes.split('/');
    return `20${a}-${m.padStart(2, '0')}`;
  }
  return null;
}

const FORM_VAZIO = {
  data: '',
  categoria: CATEGORIAS[0],
  descricao: '',
  valor: '',
  parcelas: 1,
  metodo: METODOS[0],
};

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const [expandedId, setExpandedId] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  const [editando, setEditando] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editarProximas, setEditarProximas] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [form, setForm] = useState(FORM_VAZIO);
  const [saving, setSaving] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('transacoes')
      .select('*')
      .order('data', { ascending: false });
    if (error) showToast('Erro ao buscar dados', 'error');
    else setTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAdd = async () => {
    if (!form.data || !form.valor) {
      showToast('Preencha os campos obrigat\u00f3rios', 'error');
      return;
    }
    const qtd = Math.max(1, parseInt(form.parcelas) || 1);
    setSaving(true);
    const novas = [];
    const valorParcela = Number(form.valor) / qtd;
    for (let i = 1; i <= qtd; i++) {
      const d = new Date(form.data + 'T12:00:00');
      d.setMonth(d.getMonth() + (i - 1));
      novas.push({
        data: d.toISOString().slice(0, 10),
        categoria: form.categoria,
        descricao: form.descricao,
        valor: valorParcela,
        parcelado: qtd > 1,
        numero_parcela: i,
        total_parcelas: qtd,
        metodo_pagamento: form.metodo,
        mes_referente: d.toISOString().slice(0, 7),
        pago: null,
      });
    }
    const { error } = await supabase.from('transacoes').insert(novas);
    setSaving(false);
    if (error) {
      showToast('Erro ao salvar', 'error');
      return;
    }
    showToast(qtd > 1 ? `${qtd} parcelas criadas!` : 'Lançamento salvo!');
    setForm(FORM_VAZIO);
    fetchData();
    setTab('lancamentos');
  };

  const handleTogglePago = async (id, checked) => {
    const novoValor = checked ? true : null;
    const { error } = await supabase
      .from('transacoes')
      .update({ pago: novoValor })
      .eq('id', id);
    if (error) {
      showToast('Erro ao atualizar', 'error');
      return;
    }
    setTransactions((prev) =>
      prev.map((x) => (x.id === id ? { ...x, pago: novoValor } : x))
    );
  };

  const abrirEdicao = (t, e) => {
    e.stopPropagation();
    setEditando(t);
    setEditForm({
      data: t.data,
      categoria: t.categoria,
      descricao: t.descricao || '',
      valor: t.valor,
      metodo: t.metodo_pagamento,
    });
    setEditarProximas(false);
    setConfirmDelete(false);
  };

  /* Identifica grupo de parcelas: mesmo descricao + categoria + total_parcelas + metodo */
  const getGrupo = (t) => {
    if (!t.parcelado) return [t];
    return transactions
      .filter(
        (x) =>
          x.parcelado &&
          x.descricao === t.descricao &&
          x.categoria === t.categoria &&
          x.total_parcelas === t.total_parcelas &&
          x.metodo_pagamento === t.metodo_pagamento
      )
      .sort((a, b) => a.numero_parcela - b.numero_parcela);
  };

  const getProximasParcelas = (t) => {
    if (!t.parcelado) return [];
    return getGrupo(t).filter((x) => x.numero_parcela > t.numero_parcela);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    const payload = {
      data: editForm.data,
      categoria: editForm.categoria,
      descricao: editForm.descricao,
      valor: Number(editForm.valor),
      metodo_pagamento: editForm.metodo,
    };
    let ids = [editando.id];
    if (editarProximas && editando.parcelado) {
      const irmas = getGrupo(editando).filter(
        (x) => x.numero_parcela > editando.numero_parcela
      );
      ids = [editando.id, ...irmas.map((x) => x.id)];
    }
    const { error } = await supabase
      .from('transacoes')
      .update(payload)
      .in('id', ids);
    setSavingEdit(false);
    if (error) {
      showToast('Erro ao salvar', 'error');
      return;
    }
    showToast('Atualizado!');
    setEditando(null);
    fetchData();
  };

  const handleDelete = async (apenasEsta) => {
    setSavingEdit(true);
    let ids = [editando.id];
    if (!apenasEsta && editando.parcelado) {
      ids = getGrupo(editando).map((x) => x.id);
    }
    const { error } = await supabase.from('transacoes').delete().in('id', ids);
    setSavingEdit(false);
    if (error) {
      showToast('Erro ao excluir', 'error');
      return;
    }
    showToast('Exclu\u00eddo!');
    setEditando(null);
    fetchData();
  };

  /* DADOS */
  const filtradas = transactions.filter(
    (t) => normalizarMes(t.mes_referente) === mes
  );

  const lancamentos = filtradas.filter((t) => {
    if (filtroCategoria && t.categoria !== filtroCategoria) return false;
    if (filtroMetodo && t.metodo_pagamento !== filtroMetodo) return false;
    if (filtroDataInicio && t.data < filtroDataInicio) return false;
    if (filtroDataFim && t.data > filtroDataFim) return false;
    return true;
  });

  const totalCartao = filtradas
    .filter((t) => t.metodo_pagamento === 'Cartão de Crédito')
    .reduce((a, b) => a + Number(b.valor || 0), 0);
  const totalBoleto = filtradas
    .filter((t) => t.metodo_pagamento === 'Boleto')
    .reduce((a, b) => a + Number(b.valor || 0), 0);
  const totalMes = totalCartao + totalBoleto;

  const porCategoriaCartao = CATEGORIAS.map((cat) => ({
    nome: cat,
    icon: CAT_ICONS[cat] || '\ud83d\udce6',
    color: CAT_COLORS[cat],
    valor: filtradas
      .filter(
        (t) => t.categoria === cat && t.metodo_pagamento === 'Cartão de Crédito'
      )
      .reduce((a, b) => a + Number(b.valor || 0), 0),
  }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const porCategoriaBoleto = CATEGORIAS.map((cat) => ({
    nome: cat,
    icon: CAT_ICONS[cat] || '\ud83d\udce6',
    color: CAT_COLORS[cat],
    valor: filtradas
      .filter((t) => t.categoria === cat && t.metodo_pagamento === 'Boleto')
      .reduce((a, b) => a + Number(b.valor || 0), 0),
  }))
    .filter((c) => c.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  const hoje = new Date().toISOString().slice(0, 10);
  const proximosMeses = [0, 1, 2].map((i) => {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    return d.toISOString().slice(0, 7);
  });
  const proximosBoletos = transactions
    .filter(
      (t) =>
        t.metodo_pagamento === 'Boleto' &&
        !t.pago &&
        t.data >= hoje &&
        proximosMeses.includes(normalizarMes(t.mes_referente))
    )
    .sort((a, b) => a.data.localeCompare(b.data));
  const totalBoletos = proximosBoletos.reduce(
    (a, b) => a + Number(b.valor || 0),
    0
  );

  const itensCartao = filtradas
    .filter((t) => t.metodo_pagamento === 'Cartão de Crédito')
    .sort((a, b) => b.data.localeCompare(a.data));
  const totalFatura = itensCartao.reduce((a, b) => a + Number(b.valor || 0), 0);
  const totalConferido = itensCartao
    .filter((t) => t.pago)
    .reduce((a, b) => a + Number(b.valor || 0), 0);
  const totalPendente = totalFatura - totalConferido;
  const pctConferido = totalFatura
    ? Math.round((totalConferido / totalFatura) * 100)
    : 0;

  return (
    <div style={S.root}>
      <header style={S.header}>
        <div style={S.headerInner}>
          <div>
            <p style={S.headerSub}>controle financeiro</p>
            <h1 style={S.headerTitle}>Minhas Finanças</h1>
          </div>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            style={S.monthPicker}
          />
        </div>
      </header>

      {toast && (
        <div
          style={{
            ...S.toast,
            background: toast.type === 'error' ? C.danger : C.success,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* MODAL EDICAO */}
      {editando && (
        <div style={S.modalOverlay} onClick={() => setEditando(null)}>
          <div style={S.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <p style={S.modalTitle}>Editar lançamento</p>
              <button style={S.modalClose} onClick={() => setEditando(null)}>
                x
              </button>
            </div>

            <label style={S.label}>Data</label>
            <div style={S.dateField}>
              <span style={S.dateLabel}>Data</span>
              <input
                type="date"
                style={S.dateInput}
                value={editForm.data}
                onChange={(e) =>
                  setEditForm({ ...editForm, data: e.target.value })
                }
              />
            </div>

            <label style={{ ...S.label, marginTop: 12 }}>Categoria</label>
            <select
              style={S.input}
              value={editForm.categoria}
              onChange={(e) =>
                setEditForm({ ...editForm, categoria: e.target.value })
              }
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <label style={S.label}>Descri\u00e7\u00e3o</label>
            <input
              type="text"
              style={S.input}
              value={editForm.descricao}
              onChange={(e) =>
                setEditForm({ ...editForm, descricao: e.target.value })
              }
            />

            <label style={S.label}>Valor (R$)</label>
            <input
              type="number"
              style={S.input}
              value={editForm.valor}
              onChange={(e) =>
                setEditForm({ ...editForm, valor: e.target.value })
              }
            />

            <label style={S.label}>Método de pagamento</label>
            <select
              style={S.input}
              value={editForm.metodo}
              onChange={(e) =>
                setEditForm({ ...editForm, metodo: e.target.value })
              }
            >
              {METODOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {editando.parcelado && getProximasParcelas(editando).length > 0 && (
              <div style={S.checkRow}>
                <div
                  style={{
                    ...S.checkboxSmall,
                    ...(editarProximas ? S.checkboxSmallOn : {}),
                  }}
                  onClick={() => setEditarProximas(!editarProximas)}
                >
                  {editarProximas && (
                    <span
                      style={{ color: C.bg, fontSize: 12, fontWeight: 800 }}
                    >
                      \u2713
                    </span>
                  )}
                </div>
                <span style={{ color: C.muted, fontSize: 13 }}>
                  Aplicar \u00e0s {getProximasParcelas(editando).length}{' '}
                  próximas parcelas também
                </span>
              </div>
            )}

            <button
              style={{ ...S.saveBtn, marginTop: 6 }}
              onClick={handleSaveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? 'Salvando...' : 'Salvar alterações'}
            </button>

            {!confirmDelete ? (
              <button
                style={S.deleteBtn}
                onClick={() => setConfirmDelete(true)}
              >
                Excluir lançamento
              </button>
            ) : (
              <div style={S.deleteConfirm}>
                <p
                  style={{
                    color: C.secondary,
                    fontSize: 13,
                    margin: '0 0 10px',
                  }}
                >
                  Confirmar exclusão:
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    style={S.deleteBtnSm}
                    onClick={() => handleDelete(true)}
                  >
                    Apenas esta
                  </button>
                  {editando.parcelado && (
                    <button
                      style={S.deleteBtnSm}
                      onClick={() => handleDelete(false)}
                    >
                      Todo parcelamento
                    </button>
                  )}
                  <button
                    style={S.cancelBtnSm}
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <main style={S.main}>
        {loading ? (
          <div style={S.loadingWrap}>
            <div style={S.spinner} />
            <p style={{ color: C.muted, marginTop: 12 }}>Carregando dados...</p>
          </div>
        ) : (
          <>
            {/* DASHBOARD */}
            {tab === 'dashboard' && (
              <div>
                <div style={S.row3}>
                  <MetricCard
                    label="Total"
                    value={fmt(totalMes)}
                    accent={C.success}
                  />
                  <MetricCard
                    label="Cartão"
                    value={fmt(totalCartao)}
                    accent={C.accent}
                  />
                  <MetricCard
                    label="Boletos"
                    value={fmt(totalBoleto)}
                    accent={C.warning}
                  />
                </div>
                {porCategoriaCartao.length > 0 && (
                  <div style={S.card}>
                    <p style={S.cardTitle}>Cartão de Crédito por categoria</p>
                    {porCategoriaCartao.map((c) => (
                      <CatBar key={c.nome} c={c} total={totalCartao} />
                    ))}
                  </div>
                )}
                {porCategoriaBoleto.length > 0 && (
                  <div style={S.card}>
                    <p style={S.cardTitle}>Boletos por categoria</p>
                    {porCategoriaBoleto.map((c) => (
                      <CatBar key={c.nome} c={c} total={totalBoleto} />
                    ))}
                  </div>
                )}
                {transactions.length === 0 && (
                  <EmptyState msg="Nenhum dado encontrado. Comece adicionando um lançamento!" />
                )}
              </div>
            )}

            {/* LANCAMENTOS */}
            {tab === 'lancamentos' && (
              <div>
                <div style={S.card}>
                  <p style={S.cardTitle}>Filtros</p>
                  <div style={S.filtrosGrid}>
                    <select
                      style={S.select}
                      value={filtroCategoria}
                      onChange={(e) => setFiltroCategoria(e.target.value)}
                    >
                      <option value="">Todas categorias</option>
                      {CATEGORIAS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <select
                      style={S.select}
                      value={filtroMetodo}
                      onChange={(e) => setFiltroMetodo(e.target.value)}
                    >
                      <option value="">Todos</option>
                      {METODOS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <div style={S.dateField}>
                      <span style={S.dateLabel}>De</span>
                      <input
                        type="date"
                        style={S.dateInput}
                        value={filtroDataInicio}
                        onChange={(e) => setFiltroDataInicio(e.target.value)}
                      />
                    </div>
                    <div style={S.dateField}>
                      <span style={S.dateLabel}>Até</span>
                      <input
                        type="date"
                        style={S.dateInput}
                        value={filtroDataFim}
                        onChange={(e) => setFiltroDataFim(e.target.value)}
                      />
                    </div>
                  </div>
                  {(filtroCategoria ||
                    filtroMetodo ||
                    filtroDataInicio ||
                    filtroDataFim) && (
                    <button
                      style={S.clearBtn}
                      onClick={() => {
                        setFiltroCategoria('');
                        setFiltroMetodo('');
                        setFiltroDataInicio('');
                        setFiltroDataFim('');
                      }}
                    >
                      Limpar filtros
                    </button>
                  )}
                </div>
                {lancamentos.length === 0 ? (
                  <EmptyState msg="Nenhum lançamento encontrado." />
                ) : (
                  lancamentos.map((t) => {
                    const isOpen = expandedId === t.id;
                    const proximas = isOpen ? getProximasParcelas(t) : [];
                    const pago = !!t.pago;
                    return (
                      <div key={t.id} style={{ marginBottom: 10 }}>
                        <div
                          style={{
                            ...S.item,
                            borderLeft: `4px solid ${
                              pago
                                ? C.success
                                : CAT_COLORS[t.categoria] || C.primary
                            }`,
                            opacity: pago ? 0.65 : 1,
                          }}
                          onClick={() =>
                            t.parcelado && setExpandedId(isOpen ? null : t.id)
                          }
                        >
                          <button
                            style={S.editBtn}
                            onClick={(e) => abrirEdicao(t, e)}
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <div style={S.itemLeft}>
                            <span style={{ fontSize: 18 }}>
                              {CAT_ICONS[t.categoria] || '\ud83d\udce6'}
                            </span>
                            <div style={{ minWidth: 0 }}>
                              <p
                                style={{
                                  ...S.itemDesc,
                                  color: pago ? C.muted : C.secondary,
                                  textDecoration: pago
                                    ? 'line-through'
                                    : 'none',
                                }}
                              >
                                {t.descricao || t.categoria}
                              </p>
                              <p style={S.itemMeta}>
                                {t.categoria}&nbsp;{t.data}
                                {t.parcelado && (
                                  <span style={S.badge}>
                                    {t.numero_parcela}/{t.total_parcelas}
                                  </span>
                                )}
                                <span
                                  style={{
                                    color:
                                      t.metodo_pagamento === 'Boleto'
                                        ? C.warning
                                        : C.accent,
                                    fontSize: 10,
                                  }}
                                >
                                  {t.metodo_pagamento === 'Boleto'
                                    ? 'Boleto'
                                    : 'Cart\u00e3o'}
                                </span>
                              </p>
                            </div>
                          </div>
                          <div style={S.itemRight}>
                            <p
                              style={{
                                ...S.itemValor,
                                color: pago ? C.success : C.secondary,
                              }}
                            >
                              {fmt(t.valor)}
                            </p>
                            {t.parcelado && (
                              <span style={{ color: C.muted, fontSize: 10 }}>
                                {isOpen ? '\u25b2' : '\u25bc'}
                              </span>
                            )}
                          </div>
                        </div>
                        {isOpen && proximas.length > 0 && (
                          <div style={S.parcelasWrap}>
                            <p style={S.parcelasTitle}>Próximas parcelas</p>
                            {proximas.map((p) => (
                              <div
                                key={p.id}
                                style={{
                                  ...S.parcelaItem,
                                  opacity: p.pago ? 0.5 : 1,
                                }}
                              >
                                <span
                                  style={{
                                    color: p.pago ? C.success : C.muted,
                                    fontSize: 13,
                                  }}
                                >
                                  {p.numero_parcela}/{p.total_parcelas}
                                  &nbsp;&nbsp;{p.data}
                                  {p.pago ? ' \u2713' : ''}
                                </span>
                                <span
                                  style={{
                                    color: p.pago ? C.success : C.secondary,
                                    fontSize: 13,
                                  }}
                                >
                                  {fmt(p.valor)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* VENCIMENTOS */}
            {tab === 'vencimentos' && (
              <div>
                <div style={{ ...S.card, borderColor: C.warning + '88' }}>
                  <p style={S.cardTitle}>Total a pagar</p>
                  <h2
                    style={{
                      fontSize: 30,
                      fontWeight: 800,
                      color: C.warning,
                      margin: '4px 0 0',
                    }}
                  >
                    {fmt(totalBoletos)}
                  </h2>
                  <p style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>
                    boletos em aberto próximos 3 meses
                  </p>
                </div>
                {proximosBoletos.length === 0 ? (
                  <EmptyState msg="Nenhum boleto pendente nos pr\u00f3ximos 3 meses." />
                ) : (
                  (() => {
                    const porMes = {};
                    proximosBoletos.forEach((t) => {
                      const m = normalizarMes(t.mes_referente) || 'sem-mes';
                      if (!porMes[m]) porMes[m] = [];
                      porMes[m].push(t);
                    });
                    return Object.entries(porMes).map(([m, items]) => {
                      const totalM = items.reduce(
                        (a, b) => a + Number(b.valor || 0),
                        0
                      );
                      const [ano, mesNum] = m.split('-');
                      const nomeMes = new Date(
                        Number(ano),
                        Number(mesNum) - 1
                      ).toLocaleString('pt-BR', {
                        month: 'long',
                        year: 'numeric',
                      });
                      return (
                        <div key={m} style={S.card}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: 12,
                            }}
                          >
                            <p style={S.cardTitle}>{nomeMes}</p>
                            <span
                              style={{
                                color: C.warning,
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              {fmt(totalM)}
                            </span>
                          </div>
                          {CATEGORIAS.map((cat) => {
                            const itensCat = items.filter(
                              (t) => t.categoria === cat
                            );
                            if (!itensCat.length) return null;
                            const totalCat = itensCat.reduce(
                              (a, b) => a + Number(b.valor || 0),
                              0
                            );
                            return (
                              <div key={cat}>
                                <div style={S.catGroupHeader}>
                                  <span>
                                    {CAT_ICONS[cat]} {cat}
                                  </span>
                                  <span
                                    style={{ color: C.muted, fontSize: 13 }}
                                  >
                                    {fmt(totalCat)}
                                  </span>
                                </div>
                                {itensCat.map((t) => (
                                  <div key={t.id} style={S.vencItem}>
                                    <div>
                                      <p
                                        style={{
                                          margin: 0,
                                          fontSize: 14,
                                          color: C.secondary,
                                        }}
                                      >
                                        {t.descricao || t.categoria}
                                      </p>
                                      <p
                                        style={{
                                          margin: 0,
                                          fontSize: 12,
                                          color: C.muted,
                                        }}
                                      >
                                        Vence {t.data}
                                      </p>
                                    </div>
                                    <span
                                      style={{
                                        color: C.warning,
                                        fontWeight: 600,
                                      }}
                                    >
                                      {fmt(t.valor)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            )}

            {/* FATURA CARTAO */}
            {tab === 'fatura' && (
              <div>
                <div style={{ ...S.card, borderColor: C.accent + '88' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <p style={S.cardTitle}>Fatura do mês</p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 28,
                          fontWeight: 800,
                          color: C.secondary,
                        }}
                      >
                        {fmt(totalFatura)}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 11,
                          color: C.muted,
                          textTransform: 'uppercase',
                          letterSpacing: 1,
                          marginBottom: 4,
                        }}
                      >
                        Conferido
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 20,
                          fontWeight: 800,
                          color: C.success,
                        }}
                      >
                        {fmt(totalConferido)}
                      </p>
                    </div>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: C.bg,
                      borderRadius: 10,
                      marginBottom: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: 8,
                        borderRadius: 10,
                        width: pctConferido + '%',
                        transition: 'width 0.4s ease',
                        background:
                          pctConferido === 100
                            ? C.success
                            : `linear-gradient(90deg, ${C.accentDark}, ${C.success})`,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 12, color: C.muted }}>
                      {pctConferido}% {itensCartao.filter((t) => t.pago).length}
                      /{itensCartao.length} itens
                    </span>
                    {totalPendente > 0 ? (
                      <span
                        style={{
                          fontSize: 12,
                          color: C.warning,
                          fontWeight: 700,
                        }}
                      >
                        Pendente: {fmt(totalPendente)}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 12,
                          color: C.success,
                          fontWeight: 700,
                        }}
                      >
                        Tudo conferido!
                      </span>
                    )}
                  </div>
                </div>
                {itensCartao.length === 0 ? (
                  <EmptyState msg="Nenhum lançamento no cartão de crédito neste mês." />
                ) : (
                  itensCartao.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        background: C.surface,
                        borderRadius: 12,
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 10,
                        border: `1px solid ${C.border}`,
                        borderLeft: `4px solid ${
                          t.pago
                            ? C.success
                            : CAT_COLORS[t.categoria] || C.accent
                        }`,
                        opacity: t.pago ? 0.6 : 1,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      <div
                        onClick={() => handleTogglePago(t.id, !t.pago)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          flexShrink: 0,
                          cursor: 'pointer',
                          border: t.pago
                            ? `2px solid ${C.success}`
                            : `2px solid ${C.border}`,
                          background: t.pago ? C.success : C.bg,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                      >
                        {t.pago && (
                          <span
                            style={{
                              color: C.bg,
                              fontSize: 14,
                              fontWeight: 800,
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 600,
                            color: t.pago ? C.muted : C.secondary,
                            textDecoration: t.pago ? 'line-through' : 'none',
                          }}
                        >
                          {t.descricao || t.categoria}
                        </p>
                        <p
                          style={{
                            margin: '2px 0 0',
                            fontSize: 12,
                            color: C.muted,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {CAT_ICONS[t.categoria]} {t.categoria} {t.data}
                          {t.parcelado && (
                            <span style={S.badge}>
                              {t.numero_parcela}/{t.total_parcelas}
                            </span>
                          )}
                        </p>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 800,
                          fontSize: 15,
                          flexShrink: 0,
                          color: t.pago ? C.success : C.secondary,
                        }}
                      >
                        {fmt(t.valor)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* NOVO LANCAMENTO */}
            {tab === 'novo' && (
              <div>
                <div style={S.card}>
                  <p style={S.cardTitle}>Novo Lançamento</p>

                  <label style={S.label}>Data *</label>
                  <div style={{ ...S.dateField, marginBottom: 14 }}>
                    <span style={S.dateLabel}>Data</span>
                    <input
                      type="date"
                      style={S.dateInput}
                      value={form.data}
                      onChange={(e) =>
                        setForm({ ...form, data: e.target.value })
                      }
                    />
                  </div>

                  <label style={S.label}>Categoria</label>
                  <select
                    style={S.input}
                    value={form.categoria}
                    onChange={(e) =>
                      setForm({ ...form, categoria: e.target.value })
                    }
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c} value={c}>
                        {CAT_ICONS[c]} {c}
                      </option>
                    ))}
                  </select>

                  <label style={S.label}>Descrição</label>
                  <input
                    type="text"
                    placeholder="Ex: Supermercado Extra"
                    style={S.input}
                    value={form.descricao}
                    onChange={(e) =>
                      setForm({ ...form, descricao: e.target.value })
                    }
                  />

                  <label style={S.label}>Valor total (R$) *</label>
                  <input
                    type="number"
                    placeholder="0,00"
                    style={S.input}
                    value={form.valor}
                    onChange={(e) =>
                      setForm({ ...form, valor: e.target.value })
                    }
                  />

                  <label style={S.label}>Número de parcelas</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="1"
                    style={S.input}
                    value={form.parcelas}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        parcelas: Math.max(1, parseInt(e.target.value) || 1),
                      })
                    }
                  />
                  {Number(form.valor) > 0 && Number(form.parcelas) > 1 && (
                    <p style={S.parcelaInfo}>
                      {form.parcelas}x de{' '}
                      {fmt(Number(form.valor) / Number(form.parcelas))} ao mês
                    </p>
                  )}

                  <label style={S.label}>Método de pagamento</label>
                  <div style={S.metodoBtns}>
                    {METODOS.map((m) => (
                      <button
                        key={m}
                        style={{
                          ...S.metodoBtn,
                          ...(form.metodo === m ? S.metodoBtnActive : {}),
                        }}
                        onClick={() => setForm({ ...form, metodo: m })}
                      >
                        {m === 'Cartão de Crédito'
                          ? '\ud83d\udcb3'
                          : '\ud83d\udcc4'}{' '}
                        {m}
                      </button>
                    ))}
                  </div>

                  <button
                    style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }}
                    onClick={handleAdd}
                    disabled={saving}
                  >
                    {saving ? 'Salvando...' : 'Salvar lançamento'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <nav style={S.nav}>
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'lancamentos', label: 'Lançamentos' },
          { id: 'vencimentos', label: 'Vencimentos' },
          { id: 'fatura', label: 'Cartão' },
          { id: 'novo', label: 'Novo' },
        ].map((item) => (
          <button
            key={item.id}
            style={{ ...S.navBtn, ...(tab === item.id ? S.navBtnActive : {}) }}
            onClick={() => setTab(item.id)}
          >
            <span
              style={{
                ...S.navLabel,
                color: tab === item.id ? C.warning : C.muted,
              }}
            >
              {item.label}
            </span>
            {tab === item.id && <div style={S.navDot} />}
          </button>
        ))}
      </nav>
    </div>
  );
}

function MetricCard({ label, value, accent }) {
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 12,
        padding: '12px 10px',
        border: `1px solid ${C.border}`,
        borderTop: `3px solid ${accent}`,
      }}
    >
      <p
        style={{
          color: C.muted,
          fontSize: 10,
          fontWeight: 700,
          margin: '0 0 4px',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 13, fontWeight: 800, margin: 0, color: accent }}>
        {value}
      </p>
    </div>
  );
}

function CatBar({ c, total }) {
  const pct = total ? (c.valor / total) * 100 : 0;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: 10,
        gap: 8,
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 130 }}
      >
        <span style={{ fontSize: 15 }}>{c.icon}</span>
        <span style={{ color: C.secondary, fontSize: 13 }}>{c.nome}</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 6, background: C.bg, borderRadius: 10 }}>
          <div
            style={{
              height: 6,
              borderRadius: 10,
              width: `${pct}%`,
              background: c.color,
              transition: 'width 0.4s',
            }}
          />
        </div>
        <span
          style={{
            color: C.secondary,
            fontSize: 13,
            fontWeight: 700,
            minWidth: 90,
            textAlign: 'right',
          }}
        >
          {fmt(c.valor)}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <p style={{ fontSize: 36 }}>\ud83c\udf3f</p>
      <p style={{ color: C.muted, marginTop: 8 }}>{msg}</p>
    </div>
  );
}

const S = {
  root: {
    background: C.bg,
    minHeight: '100vh',
    fontFamily: "'Nunito', -apple-system, sans-serif",
    maxWidth: 600,
    margin: '0 auto',
    position: 'relative',
    boxShadow: '0 0 80px rgba(0,0,0,0.5)',
  },
  header: {
    background: C.surface,
    padding: '20px 20px 16px',
    borderBottom: `1px solid ${C.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerInner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerSub: {
    color: C.accentDark,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 2,
    margin: 0,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: C.secondary,
    fontSize: 22,
    fontWeight: 800,
    margin: '2px 0 0',
    fontFamily: "'Nunito', sans-serif",
  },
  monthPicker: {
    background: C.surface2,
    color: C.secondary,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    outline: 'none',
    fontFamily: "'Nunito', sans-serif",
    maxWidth: 150,
  },
  main: { padding: '16px 16px 110px' },
  toast: {
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    color: C.bg,
    padding: '10px 22px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    zIndex: 200,
    whiteSpace: 'nowrap',
    fontFamily: "'Nunito', sans-serif",
  },
  loadingWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 60,
  },
  spinner: {
    width: 36,
    height: 36,
    border: `3px solid ${C.surface}`,
    borderTop: `3px solid ${C.primary}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 100,
  },
  modalBox: {
    background: C.surface,
    borderRadius: '20px 20px 0 0',
    padding: 20,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90vh',
    overflowY: 'auto',
    fontFamily: "'Nunito', sans-serif",
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { color: C.secondary, fontSize: 16, fontWeight: 800, margin: 0 },
  modalClose: {
    background: 'none',
    border: 'none',
    color: C.muted,
    fontSize: 26,
    cursor: 'pointer',
    lineHeight: 1,
  },
  card: {
    background: C.surface,
    borderRadius: 16,
    padding: '16px',
    border: `1px solid ${C.border}`,
    marginBottom: 14,
  },
  cardTitle: {
    color: C.muted,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
    margin: '0 0 14px',
  },
  row3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginBottom: 14,
  },
  item: {
    background: C.surface,
    borderRadius: 12,
    padding: '11px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer',
    border: `1px solid ${C.border}`,
  },
  editBtn: {
    background: 'none',
    border: 'none',
    color: C.muted,
    fontSize: 17,
    cursor: 'pointer',
    padding: '0 2px',
    flexShrink: 0,
    fontFamily: 'serif',
    lineHeight: 1,
  },
  itemLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  itemDesc: {
    fontSize: 14,
    fontWeight: 600,
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  itemMeta: {
    color: C.muted,
    fontSize: 11,
    margin: '2px 0 0',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  badge: {
    background: C.accentDark + '55',
    color: C.light,
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 5px',
    borderRadius: 5,
  },
  itemRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  itemValor: { fontWeight: 800, fontSize: 14, margin: 0 },
  parcelasWrap: {
    background: C.bg,
    borderRadius: '0 0 12px 12px',
    padding: '10px 14px',
    border: `1px solid ${C.border}`,
    borderTop: 'none',
  },
  parcelasTitle: {
    color: C.muted,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
    margin: '0 0 8px',
  },
  parcelaItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    borderBottom: `1px solid ${C.surface}`,
  },
  filtrosGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  select: {
    background: C.bg,
    color: C.secondary,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '9px 10px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    fontFamily: "'Nunito', sans-serif",
  },
  clearBtn: {
    marginTop: 10,
    background: 'transparent',
    color: C.danger,
    border: `1px solid ${C.danger}`,
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    cursor: 'pointer',
    width: '100%',
    fontFamily: "'Nunito', sans-serif",
  },
  dateField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '6px 10px',
  },
  dateLabel: {
    color: C.muted,
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateInput: {
    background: 'transparent',
    color: C.secondary,
    border: 'none',
    fontSize: 14,
    outline: 'none',
    padding: '2px 0',
    fontFamily: "'Nunito', sans-serif",
    width: '100%',
    WebkitAppearance: 'none',
  },
  catGroupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: C.muted,
    fontSize: 12,
    fontWeight: 700,
    padding: '8px 0 4px',
    borderBottom: `1px solid ${C.bg}`,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  vencItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: `1px solid ${C.bg}33`,
  },
  label: {
    color: C.muted,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  },
  input: {
    background: C.bg,
    color: C.secondary,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    marginBottom: 14,
    fontFamily: "'Nunito', sans-serif",
  },
  parcelaInfo: {
    color: C.primary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
    marginTop: -8,
  },
  metodoBtns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 18,
  },
  metodoBtn: {
    background: C.bg,
    color: C.muted,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '10px',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: "'Nunito', sans-serif",
  },
  metodoBtnActive: {
    background: C.accentDark + '55',
    color: C.primary,
    borderColor: C.primary,
    fontWeight: 700,
  },
  saveBtn: {
    width: '100%',
    padding: '13px',
    background: C.accentDark,
    color: C.light,
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: "'Nunito', sans-serif",
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  checkboxSmall: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: `2px solid ${C.border}`,
    background: C.bg,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  checkboxSmallOn: { background: C.primary, borderColor: C.primary },
  deleteBtn: {
    width: '100%',
    marginTop: 10,
    padding: '11px',
    background: 'transparent',
    color: C.danger,
    border: `1px solid ${C.danger}`,
    borderRadius: 10,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: "'Nunito', sans-serif",
    fontWeight: 700,
  },
  deleteConfirm: {
    marginTop: 10,
    padding: 12,
    background: C.bg,
    borderRadius: 10,
  },
  deleteBtnSm: {
    flex: 1,
    padding: '8px 4px',
    background: C.danger,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: "'Nunito', sans-serif",
    fontWeight: 700,
  },
  cancelBtnSm: {
    flex: 1,
    padding: '8px 4px',
    background: C.surface2,
    color: C.muted,
    border: 'none',
    borderRadius: 8,
    fontSize: 11,
    cursor: 'pointer',
    fontFamily: "'Nunito', sans-serif",
  },
  nav: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: 600,
    background: C.surface,
    borderTop: `1px solid ${C.border}`,
    display: 'flex',
    justifyContent: 'space-around',
    padding: '10px 0 22px',
    zIndex: 20,
  },
  navBtn: {
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
    padding: '4px 6px',
    borderRadius: 10,
    position: 'relative',
  },
  navBtnActive: {},
  navLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.3,
    fontFamily: "'Nunito', sans-serif",
  },
  navDot: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: C.primary,
    position: 'absolute',
    bottom: -4,
  },
};
