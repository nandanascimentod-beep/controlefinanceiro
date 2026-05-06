'use client';

import { useState, useEffect } from 'react';
import { supabase } from './supabase';

const CATEGORIAS = [
  'Carro',
  'Dinheiro',
  'Mercado',
  'Outros',
  'Roupas',
  'Entretenimento',
  'Presentes',
  'Cosméticos',
  'Comida besteira',
  'Estética',
  'Farmácia',
];

const METODOS = ['Cartão de Crédito', 'Boleto'];

const CAT_ICONS = {
  Carro: '🚗',
  Dinheiro: '💵',
  Mercado: '🛒',
  Outros: '📦',
  Roupas: '👗',
  Entretenimento: '🎬',
  Presentes: '🎁',
  Cosméticos: '💄',
  'Comida besteira': '🍔',
  Estética: '✂️',
  Farmácia: '💊',
};

const CAT_COLORS = {
  Carro: '#3B82F6',
  Dinheiro: '#10B981',
  Mercado: '#F59E0B',
  Outros: '#8B5CF6',
  Roupas: '#EC4899',
  Entretenimento: '#06B6D4',
  Presentes: '#F97316',
  Cosméticos: '#A855F7',
  'Comida besteira': '#EF4444',
  Estética: '#84CC16',
  Farmácia: '#14B8A6',
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

export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroMetodo, setFiltroMetodo] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [form, setForm] = useState({
    data: '',
    categoria: CATEGORIAS[0],
    descricao: '',
    valor: '',
    parcelas: 1,
    metodo: METODOS[0],
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

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
      showToast('Preencha os campos obrigatórios', 'error');
      return;
    }
    setSaving(true);
    const novas = [];
    const valorParcela = Number(form.valor) / Number(form.parcelas);
    for (let i = 1; i <= Number(form.parcelas); i++) {
      const d = new Date(form.data + 'T12:00:00');
      d.setMonth(d.getMonth() + (i - 1));
      novas.push({
        data: d.toISOString().slice(0, 10),
        categoria: form.categoria,
        descricao: form.descricao,
        valor: valorParcela,
        parcelado: Number(form.parcelas) > 1,
        numero_parcela: i,
        total_parcelas: Number(form.parcelas),
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
    showToast('Lançamento salvo!');
    setForm({
      data: '',
      categoria: CATEGORIAS[0],
      descricao: '',
      valor: '',
      parcelas: 1,
      metodo: METODOS[0],
    });
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

  const total = filtradas.reduce((a, b) => a + Number(b.valor || 0), 0);
  const cartao = filtradas
    .filter((t) => t.metodo_pagamento === 'Cartão de Crédito')
    .reduce((a, b) => a + Number(b.valor || 0), 0);
  const boleto = filtradas
    .filter((t) => t.metodo_pagamento === 'Boleto')
    .reduce((a, b) => a + Number(b.valor || 0), 0);

  const porCategoria = CATEGORIAS.map((cat) => ({
    nome: cat,
    icon: CAT_ICONS[cat],
    color: CAT_COLORS[cat],
    valor: filtradas
      .filter((t) => t.categoria === cat)
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

  const getParcelasRelacionadas = (t) => {
    if (!t.parcelado || !t.descricao) return [];
    return transactions
      .filter(
        (x) =>
          x.descricao === t.descricao &&
          x.categoria === t.categoria &&
          x.id !== t.id &&
          x.parcelado
      )
      .sort((a, b) => a.numero_parcela - b.numero_parcela);
  };

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
            background: toast.type === 'error' ? '#EF4444' : '#10B981',
          }}
        >
          {toast.msg}
        </div>
      )}

      <main style={S.main}>
        {loading ? (
          <div style={S.loadingWrap}>
            <div style={S.spinner} />
            <p style={{ color: '#94A3B8', marginTop: 12 }}>
              Carregando dados...
            </p>
          </div>
        ) : (
          <>
            {tab === 'dashboard' && (
              <div style={S.fadeIn}>
                <div style={S.row3}>
                  <MetricCard
                    label="Total mês"
                    value={fmt(total)}
                    accent="#6C63FF"
                    icon="💰"
                  />
                  <MetricCard
                    label="Cartão"
                    value={fmt(cartao)}
                    accent="#3B82F6"
                    icon="💳"
                  />
                  <MetricCard
                    label="Boletos"
                    value={fmt(boleto)}
                    accent="#F59E0B"
                    icon="📄"
                  />
                </div>

                {porCategoria.length > 0 && (
                  <div style={S.card}>
                    <p style={S.cardTitle}>Gastos por categoria</p>
                    {porCategoria.map((c) => (
                      <div key={c.nome} style={S.catRow}>
                        <div style={S.catLeft}>
                          <span>{c.icon}</span>
                          <span style={S.catNome}>{c.nome}</span>
                        </div>
                        <div style={S.catRight}>
                          <div style={S.barWrap}>
                            <div
                              style={{
                                ...S.barFill,
                                width: `${(c.valor / total) * 100}%`,
                                background: c.color,
                              }}
                            />
                          </div>
                          <span style={S.catValor}>{fmt(c.valor)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={S.card}>
                  <p style={S.cardTitle}>Método de pagamento</p>
                  <div style={S.metodosRow}>
                    <MetodoCard
                      label="Cartão de Crédito"
                      valor={cartao}
                      total={total}
                      color="#6C63FF"
                      icon="💳"
                    />
                    <MetodoCard
                      label="Boleto"
                      valor={boleto}
                      total={total}
                      color="#F59E0B"
                      icon="📄"
                    />
                  </div>
                </div>

                {transactions.length === 0 && (
                  <EmptyState msg="Nenhum dado encontrado. Comece adicionando um lançamento!" />
                )}
              </div>
            )}

            {tab === 'lancamentos' && (
              <div style={S.fadeIn}>
                <div style={S.card}>
                  <p style={S.cardTitle}>Filtros</p>
                  <div style={S.filtrosGrid}>
                    <select
                      style={S.select}
                      value={filtroCategoria}
                      onChange={(e) => setFiltroCategoria(e.target.value)}
                    >
                      <option value="">Todas as categorias</option>
                      {CATEGORIAS.map((c) => (
                        <option key={c} value={c}>
                          {CAT_ICONS[c]} {c}
                        </option>
                      ))}
                    </select>
                    <select
                      style={S.select}
                      value={filtroMetodo}
                      onChange={(e) => setFiltroMetodo(e.target.value)}
                    >
                      <option value="">Todos os métodos</option>
                      {METODOS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      style={S.select}
                      value={filtroDataInicio}
                      onChange={(e) => setFiltroDataInicio(e.target.value)}
                    />
                    <input
                      type="date"
                      style={S.select}
                      value={filtroDataFim}
                      onChange={(e) => setFiltroDataFim(e.target.value)}
                    />
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
                      Limpar filtros x
                    </button>
                  )}
                </div>

                {lancamentos.length === 0 ? (
                  <EmptyState msg="Nenhum lançamento encontrado para os filtros selecionados." />
                ) : (
                  lancamentos.map((t) => {
                    const isOpen = expandedId === t.id;
                    const relacionadas = isOpen
                      ? getParcelasRelacionadas(t)
                      : [];
                    return (
                      <div key={t.id} style={{ marginBottom: 10 }}>
                        <div
                          style={{
                            ...S.item,
                            borderLeft: `4px solid ${
                              CAT_COLORS[t.categoria] || '#6C63FF'
                            }`,
                          }}
                          onClick={() => setExpandedId(isOpen ? null : t.id)}
                        >
                          <div style={S.itemLeft}>
                            <span style={{ fontSize: 22 }}>
                              {CAT_ICONS[t.categoria] || '📦'}
                            </span>
                            <div>
                              <p style={S.itemDesc}>
                                {t.descricao || t.categoria}
                              </p>
                              <p style={S.itemMeta}>
                                {t.categoria} · {t.data}
                                {t.parcelado && (
                                  <span style={S.badge}>
                                    {t.numero_parcela}/{t.total_parcelas}
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div style={S.itemRight}>
                            <p style={S.itemValor}>{fmt(t.valor)}</p>
                            <p
                              style={{
                                fontSize: 13,
                                margin: 0,
                                color:
                                  t.metodo_pagamento === 'Boleto'
                                    ? '#F59E0B'
                                    : '#6C63FF',
                              }}
                            >
                              {t.metodo_pagamento === 'Boleto' ? '📄' : '💳'}
                            </p>
                            {t.parcelado && (
                              <span style={{ color: '#64748B', fontSize: 10 }}>
                                {isOpen ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                        </div>
                        {isOpen && relacionadas.length > 0 && (
                          <div style={S.parcelasWrap}>
                            <p style={S.parcelasTitle}>Próximas parcelas</p>
                            {relacionadas.map((p) => (
                              <div key={p.id} style={S.parcelaItem}>
                                <span
                                  style={{ color: '#94A3B8', fontSize: 13 }}
                                >
                                  {p.numero_parcela}/{p.total_parcelas} ·{' '}
                                  {p.data}
                                </span>
                                <span
                                  style={{ color: '#E2E8F0', fontSize: 13 }}
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

            {tab === 'vencimentos' && (
              <div style={S.fadeIn}>
                <div style={{ ...S.card, borderColor: '#F59E0B44' }}>
                  <p style={S.cardTitle}>Total a vencer</p>
                  <h2
                    style={{
                      fontSize: 32,
                      fontWeight: 800,
                      color: '#F59E0B',
                      margin: '4px 0 0',
                    }}
                  >
                    {fmt(totalBoletos)}
                  </h2>
                  <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
                    próximos 3 meses
                  </p>
                </div>

                {proximosBoletos.length === 0 ? (
                  <EmptyState msg="Nenhum boleto a vencer nos próximos 3 meses." />
                ) : (
                  (() => {
                    const porMes = {};
                    proximosBoletos.forEach((t) => {
                      const m = normalizarMes(t.mes_referente);
                      if (!porMes[m]) porMes[m] = [];
                      porMes[m].push(t);
                    });
                    return Object.entries(porMes).map(([m, items]) => {
                      const totalMes = items.reduce(
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
                                color: '#F59E0B',
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              {fmt(totalMes)}
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
                                    style={{ color: '#94A3B8', fontSize: 13 }}
                                  >
                                    {fmt(totalCat)}
                                  </span>
                                </div>
                                {itensCat.map((t) => (
                                  <div
                                    key={t.id}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '8px 0',
                                      borderBottom: '1px solid #0F172A33',
                                    }}
                                  >
                                    <div>
                                      <p
                                        style={{
                                          margin: 0,
                                          fontSize: 14,
                                          color: '#E2E8F0',
                                        }}
                                      >
                                        {t.descricao || t.categoria}
                                      </p>
                                      <p
                                        style={{
                                          margin: 0,
                                          fontSize: 12,
                                          color: '#64748B',
                                        }}
                                      >
                                        Vence {t.data}
                                      </p>
                                    </div>
                                    <span
                                      style={{
                                        color: '#F59E0B',
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

            {tab === 'fatura' && (
              <div style={S.fadeIn}>
                {/* Resumo fatura */}
                <div style={{ ...S.card, borderColor: '#6C63FF55' }}>
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
                          fontSize: 30,
                          fontWeight: 800,
                          color: '#F1F5F9',
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
                          color: '#64748B',
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
                          fontSize: 22,
                          fontWeight: 800,
                          color: '#10B981',
                        }}
                      >
                        {fmt(totalConferido)}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      height: 8,
                      background: '#0F172A',
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
                            ? '#10B981'
                            : 'linear-gradient(90deg, #6C63FF, #10B981)',
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
                    <span style={{ fontSize: 12, color: '#64748B' }}>
                      {pctConferido}% conferido ·{' '}
                      {itensCartao.filter((t) => t.pago).length}/
                      {itensCartao.length} itens
                    </span>
                    {totalPendente > 0 ? (
                      <span
                        style={{
                          fontSize: 12,
                          color: '#F59E0B',
                          fontWeight: 700,
                        }}
                      >
                        Pendente: {fmt(totalPendente)}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 12,
                          color: '#10B981',
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
                        background: '#1E293B',
                        borderRadius: 12,
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 10,
                        border: '1px solid #334155',
                        borderLeft: `4px solid ${
                          t.pago
                            ? '#10B981'
                            : CAT_COLORS[t.categoria] || '#6C63FF'
                        }`,
                        opacity: t.pago ? 0.6 : 1,
                        transition: 'opacity 0.2s',
                      }}
                    >
                      {/* Checkbox customizado */}
                      <div
                        onClick={() => handleTogglePago(t.id, !t.pago)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          flexShrink: 0,
                          cursor: 'pointer',
                          border: t.pago
                            ? '2px solid #10B981'
                            : '2px solid #475569',
                          background: t.pago ? '#10B981' : '#0F172A',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}
                      >
                        {t.pago && (
                          <span
                            style={{
                              color: '#fff',
                              fontSize: 14,
                              fontWeight: 800,
                              lineHeight: 1,
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 600,
                            color: t.pago ? '#64748B' : '#F1F5F9',
                            textDecoration: t.pago ? 'line-through' : 'none',
                          }}
                        >
                          {t.descricao || t.categoria}
                        </p>
                        <p
                          style={{
                            margin: '2px 0 0',
                            fontSize: 12,
                            color: '#64748B',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {CAT_ICONS[t.categoria]} {t.categoria} · {t.data}
                          {t.parcelado && (
                            <span style={S.badge}>
                              {t.numero_parcela}/{t.total_parcelas}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Valor */}
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 800,
                          fontSize: 15,
                          flexShrink: 0,
                          color: t.pago ? '#10B981' : '#F1F5F9',
                        }}
                      >
                        {fmt(t.valor)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'novo' && (
              <div style={S.fadeIn}>
                <div style={S.card}>
                  <p style={S.cardTitle}>Novo Lançamento</p>

                  <label style={S.label}>Data *</label>
                  <input
                    type="date"
                    style={S.input}
                    value={form.data}
                    onChange={(e) => setForm({ ...form, data: e.target.value })}
                  />

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

                  <label style={S.label}>Parcelas</label>
                  <div style={S.parcelasRow}>
                    {[1, 2, 3, 4, 5, 6, 9, 12].map((n) => (
                      <button
                        key={n}
                        style={{
                          ...S.parcelaBtn,
                          ...(form.parcelas === n ? S.parcelaBtnActive : {}),
                        }}
                        onClick={() => setForm({ ...form, parcelas: n })}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>

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
                        {m === 'Cartão de Crédito' ? '💳' : '📄'} {m}
                      </button>
                    ))}
                  </div>

                  <button
                    style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }}
                    onClick={handleAdd}
                    disabled={saving}
                  >
                    {saving ? 'Salvando...' : '✓ Salvar lançamento'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <nav style={S.nav}>
        {[
          { id: 'dashboard', icon: '📊', label: 'Dashboard' },
          { id: 'lancamentos', icon: '📋', label: 'Lançamentos' },
          { id: 'vencimentos', icon: '📅', label: 'Vencimentos' },
          { id: 'fatura', icon: '💳', label: 'Cartão' },
          { id: 'novo', icon: '＋', label: 'Novo' },
        ].map((item) => (
          <button
            key={item.id}
            style={{ ...S.navBtn, ...(tab === item.id ? S.navBtnActive : {}) }}
            onClick={() => setTab(item.id)}
          >
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span
              style={{
                ...S.navLabel,
                color: tab === item.id ? '#6C63FF' : '#64748B',
              }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function MetricCard({ label, value, accent, icon }) {
  return (
    <div style={{ ...S.metricCard, borderTop: `3px solid ${accent}` }}>
      <p style={S.metricLabel}>
        {icon} {label}
      </p>
      <p style={{ ...S.metricValue, color: accent }}>{value}</p>
    </div>
  );
}

function MetodoCard({ label, valor, total, color, icon }) {
  const pct = total ? ((valor / total) * 100).toFixed(0) : 0;
  return (
    <div
      style={{
        background: '#0F172A',
        borderRadius: 12,
        padding: 14,
        border: `1px solid ${color}44`,
      }}
    >
      <p style={{ color: '#94A3B8', fontSize: 12, margin: '0 0 6px' }}>
        {icon} {label}
      </p>
      <p style={{ fontSize: 18, fontWeight: 800, margin: '0 0 10px', color }}>
        {fmt(valor)}
      </p>
      <div style={{ height: 4, background: '#1E293B', borderRadius: 10 }}>
        <div
          style={{
            height: 4,
            borderRadius: 10,
            width: `${pct}%`,
            background: color,
          }}
        />
      </div>
      <p style={{ color: '#64748B', fontSize: 12, marginTop: 4 }}>
        {pct}% do total
      </p>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <p style={{ fontSize: 40 }}>🌙</p>
      <p style={{ color: '#64748B', marginTop: 8 }}>{msg}</p>
    </div>
  );
}

const S = {
  root: {
    background: '#0F172A',
    minHeight: '100vh',
    maxWidth: 480,
    margin: '0 auto',
    fontFamily: "'Nunito', -apple-system, sans-serif",
    position: 'relative',
  },
  header: {
    background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
    padding: '20px 20px 16px',
    borderBottom: '1px solid #1E293B',
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
    color: '#6C63FF',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 2,
    margin: 0,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#F1F5F9',
    fontSize: 22,
    fontWeight: 800,
    margin: '2px 0 0',
  },
  monthPicker: {
    background: '#1E293B',
    color: '#94A3B8',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    outline: 'none',
  },
  main: { padding: '16px 16px 110px' },
  fadeIn: { animation: 'fadeIn 0.2s ease' },
  toast: {
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    zIndex: 100,
    whiteSpace: 'nowrap',
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
    border: '3px solid #1E293B',
    borderTop: '3px solid #6C63FF',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  row3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginBottom: 14,
  },
  metricCard: {
    background: '#1E293B',
    borderRadius: 12,
    padding: '12px 10px',
    border: '1px solid #334155',
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: 700,
    margin: '0 0 4px',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: { fontSize: 13, fontWeight: 800, margin: 0 },
  card: {
    background: '#1E293B',
    borderRadius: 16,
    padding: '16px',
    border: '1px solid #334155',
    marginBottom: 14,
  },
  cardTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
    margin: '0 0 14px',
  },
  catRow: { display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 },
  catLeft: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 130 },
  catNome: { color: '#CBD5E1', fontSize: 13 },
  catRight: { flex: 1, display: 'flex', alignItems: 'center', gap: 8 },
  barWrap: { flex: 1, height: 6, background: '#0F172A', borderRadius: 10 },
  barFill: { height: 6, borderRadius: 10, transition: 'width 0.4s ease' },
  catValor: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: 700,
    minWidth: 85,
    textAlign: 'right',
  },
  metodosRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  filtrosGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  select: {
    background: '#0F172A',
    color: '#E2E8F0',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  },
  clearBtn: {
    marginTop: 10,
    background: 'transparent',
    color: '#EF4444',
    border: '1px solid #EF4444',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    cursor: 'pointer',
    width: '100%',
  },
  item: {
    background: '#1E293B',
    borderRadius: 12,
    padding: '12px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    border: '1px solid #334155',
  },
  itemLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  itemDesc: { color: '#F1F5F9', fontSize: 14, fontWeight: 600, margin: 0 },
  itemMeta: {
    color: '#64748B',
    fontSize: 12,
    margin: '2px 0 0',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    background: '#6C63FF22',
    color: '#6C63FF',
    fontSize: 11,
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 6,
  },
  itemRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
  },
  itemValor: { color: '#F1F5F9', fontWeight: 800, fontSize: 15, margin: 0 },
  parcelasWrap: {
    background: '#0F172A',
    borderRadius: '0 0 12px 12px',
    padding: '10px 14px',
    border: '1px solid #334155',
    borderTop: 'none',
  },
  parcelasTitle: {
    color: '#94A3B8',
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
    borderBottom: '1px solid #1E293B',
  },
  catGroupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: 700,
    padding: '8px 0 4px',
    borderBottom: '1px solid #0F172A',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  label: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  },
  input: {
    background: '#0F172A',
    color: '#E2E8F0',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    marginBottom: 16,
    fontFamily: 'inherit',
  },
  parcelasRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  parcelaBtn: {
    background: '#0F172A',
    color: '#64748B',
    border: '1px solid #334155',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 13,
    cursor: 'pointer',
  },
  parcelaBtnActive: {
    background: '#6C63FF',
    color: '#fff',
    borderColor: '#6C63FF',
    fontWeight: 700,
  },
  parcelaInfo: {
    color: '#6C63FF',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
    marginTop: -8,
  },
  metodoBtns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 20,
  },
  metodoBtn: {
    background: '#0F172A',
    color: '#64748B',
    border: '1px solid #334155',
    borderRadius: 10,
    padding: '10px',
    fontSize: 13,
    cursor: 'pointer',
  },
  metodoBtnActive: {
    background: '#6C63FF22',
    color: '#6C63FF',
    borderColor: '#6C63FF',
    fontWeight: 700,
  },
  saveBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #6C63FF, #9C63FF)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
  },
  nav: {
    position: 'fixed',
    bottom: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '100%',
    maxWidth: 480,
    background: '#1E293B',
    borderTop: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-around',
    padding: '8px 0 20px',
    zIndex: 20,
  },
  navBtn: {
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    cursor: 'pointer',
    padding: '4px 10px',
    borderRadius: 10,
  },
  navBtnActive: { background: '#6C63FF22' },
  navLabel: { fontSize: 9, fontWeight: 700, letterSpacing: 0.5 },
};
