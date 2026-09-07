'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

/* ═══════════════════════════════════════════════════════════════════════
   Este app junta DUAS fontes de dados do Supabase:
   1) tabela "transacoes"          -> seus lançamentos pessoais ("Outros")
   2) tabela "cartao_compartilhado" -> fatura do cartão da família, filtrada
                                        apenas pelo responsável "Fernanda"

   ⚠️ IMPORTANTE — schema necessário na tabela "transacoes":
      Precisa existir a coluna "periodo" (texto, aceita null), com os
      valores: "1º Período", "2º Período" ou "Extra".
      Se ela ainda não existir, rode no Supabase:
        alter table transacoes add column periodo text;
      O campo metodo_pagamento passa a aceitar também o valor "Outros"
      (além de "Cartão de Crédito" e "Boleto" que já existiam).
   ═══════════════════════════════════════════════════════════════════════ */

/* ─── CATEGORIAS (copiadas do app "Cartão da Família") ─────────────────── */
const CATEGORIAS = [
  'Apartamento',
  'Carro',
  'Cosméticos',
  'Comida Besteira',
  'Dinheiro',
  'Entretenimento',
  'Estética',
  'Farmácia',
  'Mercado',
  'Outros',
  'Presentes',
  'Roupas',
];
const CAT_COLORS = {
  Apartamento: '#2F6FED',
  Carro: '#F79009',
  Cosméticos: '#EE46BC',
  'Comida Besteira': '#F04438',
  Dinheiro: '#12B76A',
  Entretenimento: '#7A5AF8',
  Estética: '#D6409F',
  Farmácia: '#E31B54',
  Mercado: '#15B79E',
  Outros: '#667085',
  Presentes: '#EAAA08',
  Roupas: '#0BA5EC',
};
const CAT_ICONS = {
  Apartamento: '🏠',
  Carro: '🚗',
  Cosméticos: '💄',
  'Comida Besteira': '🍔',
  Dinheiro: '💵',
  Entretenimento: '🎬',
  Estética: '✂️',
  Farmácia: '💊',
  Mercado: '🛒',
  Outros: '📦',
  Presentes: '🎁',
  Roupas: '👗',
};

const PERIODOS = ['1º Período', '2º Período', 'Extra'];
const PERIODO_COLORS = {
  '1º Período': '#2F6FED',
  '2º Período': '#7A5AF8',
  Extra: '#F79009',
};

const RESPONSAVEL_CARTAO = 'Fernanda';

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

/* Extrai a data DD/MM contida no texto da descrição (usada como critério
   de ordenação na aba Listagem, como no app do cartão) */
function extrairDataDaDescricao(descricao) {
  if (!descricao) return null;
  const m = descricao.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (!m) return null;
  const dia = parseInt(m[1], 10);
  const mes = parseInt(m[2], 10);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  return mes * 100 + dia;
}
function chaveOrdenacao(t) {
  const doTexto = extrairDataDaDescricao(t.descricao);
  if (doTexto !== null) return doTexto;
  if (t.data) {
    const [, mes, dia] = t.data.split('-').map(Number);
    return mes * 100 + dia;
  }
  return 0;
}

const FORM_VAZIO = {
  periodo: PERIODOS[0],
  data: '',
  categoria: CATEGORIAS[0],
  descricao: '',
  valor: '',
  parcelas: 1,
};

/* ─── PALETA / ESTILOS (copiados do app "Cartão da Família") ───────────── */
const C = {
  bg: '#F6F5F0',
  surface: '#FFFFFF',
  surface2: '#F1F0E9',
  border: '#E7E4DA',
  text: '#181C19',
  muted: '#8A8F86',
  accent: '#1E9E56',
  accentDark: '#167A43',
  accentLight: '#34C979',
  success: '#1E9E56',
  danger: '#E5484D',
  warning: '#D97706',
  shadow: '0 1px 2px rgba(24,28,25,0.04), 0 8px 24px rgba(24,28,25,0.06)',
  shadowSm: '0 1px 2px rgba(21,33,26,0.05)',
};

const S = {
  shell: {
    background: C.bg,
    minHeight: '100vh',
    fontFamily: "'DM Sans', -apple-system, sans-serif",
    color: C.text,
  },
  root: {
    maxWidth: 600,
    margin: '0 auto',
    position: 'relative',
    minHeight: '100vh',
    background: C.bg,
  },
  header: {
    background: C.surface,
    padding: '18px 20px 14px',
    borderBottom: `1px solid ${C.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerInner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerSub: {
    color: C.accent,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 3,
    margin: 0,
    textTransform: 'uppercase',
  },
  headerTitle: { color: C.text, fontSize: 20, fontWeight: 800, margin: '3px 0 0' },
  monthPicker: {
    background: C.surface2,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 13,
    outline: 'none',
    fontFamily: "'DM Sans', sans-serif",
  },
  main: { padding: '16px 16px 110px' },
  toast: {
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#fff',
    padding: '10px 22px',
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    zIndex: 200,
    whiteSpace: 'nowrap',
  },
  card: {
    background: C.surface,
    borderRadius: 16,
    padding: 18,
    border: `1px solid ${C.border}`,
    boxShadow: C.shadow,
    marginBottom: 12,
  },
  cardTitle: {
    color: C.muted,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    textTransform: 'uppercase',
    margin: '0 0 14px',
  },
  totalBox: {
    background: `linear-gradient(135deg, ${C.accent} 0%, ${C.accentLight} 100%)`,
    border: 'none',
    borderRadius: 18,
    padding: '20px 20px',
    marginBottom: 14,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: `0 10px 24px ${C.accent}33`,
  },
  periodoRow3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginBottom: 14,
  },
  periodoCard: {
    background: C.surface,
    borderRadius: 14,
    padding: '14px 12px',
    border: `1px solid ${C.border}`,
    boxShadow: C.shadowSm,
  },
  donutTotal: {
    fontSize: 30,
    fontWeight: 800,
    color: C.accent,
    margin: '2px 0 18px',
    textAlign: 'center',
  },
  legendGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: '0 24px', marginTop: 22 },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 0',
    borderBottom: `1px solid ${C.border}`,
  },
  legendDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  legendName: {
    flex: '1 1 160px',
    minWidth: 120,
    fontSize: 15,
    fontWeight: 700,
    color: C.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  legendPct: { fontSize: 13, color: C.muted, width: 52, textAlign: 'right', flexShrink: 0 },
  legendValor: { fontSize: 15, fontWeight: 800, color: C.text, width: 104, textAlign: 'right', flexShrink: 0 },
  respCard: {
    background: C.surface,
    borderRadius: 16,
    border: `1px solid ${C.border}`,
    boxShadow: C.shadowSm,
    marginBottom: 12,
    overflow: 'hidden',
  },
  item: {
    background: C.surface2,
    padding: '11px 14px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    borderTop: `1px solid ${C.border}`,
  },
  editBtn: {
    background: 'none',
    border: 'none',
    color: C.muted,
    fontSize: 15,
    cursor: 'pointer',
    padding: '0 2px',
    flexShrink: 0,
  },
  badge: {
    background: C.border,
    color: C.muted,
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: 5,
  },
  filtrosGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  select: {
    background: C.surface2,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '9px 10px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
    fontFamily: "'DM Sans', sans-serif",
  },
  dateField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    background: C.surface2,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '6px 10px',
  },
  dateLabel: { color: C.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateInput: {
    background: 'transparent',
    color: C.text,
    border: 'none',
    fontSize: 13,
    outline: 'none',
    padding: '2px 0',
    fontFamily: "'DM Sans', sans-serif",
    width: '100%',
  },
  clearBtn: {
    marginTop: 10,
    background: 'transparent',
    color: C.danger,
    border: `1px solid ${C.danger}44`,
    borderRadius: 8,
    padding: '7px 12px',
    fontSize: 12,
    cursor: 'pointer',
    width: '100%',
    fontFamily: "'DM Sans', sans-serif",
  },
  label: {
    color: C.muted,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: 6,
  },
  input: {
    background: C.surface2,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    width: '100%',
    boxSizing: 'border-box',
    outline: 'none',
    marginBottom: 14,
    fontFamily: "'DM Sans', sans-serif",
  },
  periodoBtns: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 },
  periodoBtn: {
    background: C.surface2,
    color: C.muted,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    padding: '10px 4px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.15s',
  },
  saveBtn: {
    width: '100%',
    padding: '13px',
    background: C.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.75)',
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
    border: `1px solid ${C.border}`,
    borderBottom: 'none',
  },
  deleteBtn: {
    width: '100%',
    marginTop: 10,
    padding: '11px',
    background: 'transparent',
    color: C.danger,
    border: `1px solid ${C.danger}44`,
    borderRadius: 10,
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 700,
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
  },
  checkRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: `2px solid ${C.border}`,
    background: C.surface2,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
    padding: '10px 0 24px',
    zIndex: 20,
    boxShadow: '0 -2px 12px rgba(21,33,26,0.06)',
  },
  navBtn: {
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    cursor: 'pointer',
    padding: '4px 12px',
    borderRadius: 10,
  },
  navLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 0.3, fontFamily: "'DM Sans', sans-serif" },
};

/* ═══════════════════════════════════════════════════════════════════════ */
export default function App() {
  const [tab, setTab] = useState('dashboard');
  const [outros, setOutros] = useState([]); // tabela "transacoes" (metodo_pagamento = 'Outros')
  const [cartao, setCartao] = useState([]); // tabela "cartao_compartilhado" (responsavel = 'Fernanda')
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroFonte, setFiltroFonte] = useState(''); // '', 'outros', 'cartao'
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');

  const [editando, setEditando] = useState(null); // { origem: 'outros'|'cartao', ...registro }
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
    const [{ data: dataOutros, error: errOutros }, { data: dataCartao, error: errCartao }] =
      await Promise.all([
        supabase
          .from('transacoes')
          .select('*')
          .eq('metodo_pagamento', 'Outros')
          .order('data', { ascending: false }),
        supabase
          .from('cartao_compartilhado')
          .select('*')
          .eq('responsavel', RESPONSAVEL_CARTAO)
          .order('data', { ascending: false }),
      ]);
    if (errOutros || errCartao) showToast('Erro ao buscar dados', 'error');
    setOutros(dataOutros || []);
    setCartao(dataCartao || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  /* ── ADICIONAR (sempre grava em "transacoes" com metodo = "Outros") ── */
  const handleAdd = async () => {
    if (!form.data || !form.valor) {
      showToast('Preencha data e valor', 'error');
      return;
    }
    const qtd = Math.max(1, parseInt(form.parcelas) || 1);
    setSaving(true);
    const valorParcela = Number(form.valor) / qtd;
    const novas = [];
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
        metodo_pagamento: 'Outros',
        periodo: form.periodo,
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
    setTab('listagem');
  };

  /* ── Agrupamento de parcelas (cada fonte tem sua própria chave) ── */
  const getGrupo = (t) => {
    if (!t.parcelado) return [t];
    const lista = t._origem === 'cartao' ? cartao : outros;
    return lista
      .filter(
        (x) =>
          x.parcelado &&
          x.descricao === t.descricao &&
          x.categoria === t.categoria &&
          x.total_parcelas === t.total_parcelas &&
          Number(x.valor) === Number(t.valor)
      )
      .sort((a, b) => a.numero_parcela - b.numero_parcela);
  };
  const getProximasParcelas = (t) => {
    if (!t.parcelado) return [];
    return getGrupo(t).filter((x) => x.numero_parcela !== t.numero_parcela);
  };

  /* ── Edição ── */
  const abrirEdicao = (t, e) => {
    e?.stopPropagation();
    setEditando(t);
    setEditForm({
      data: t.data,
      categoria: t.categoria || '',
      descricao: t.descricao || '',
      valor: t.valor,
      periodo: t.periodo || PERIODOS[0],
    });
    setEditarProximas(false);
    setConfirmDelete(false);
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    const tabela = editando._origem === 'cartao' ? 'cartao_compartilhado' : 'transacoes';
    const payload = {
      data: editForm.data,
      categoria: editForm.categoria || null,
      descricao: editForm.descricao,
      valor: Number(editForm.valor),
    };
    if (editando._origem === 'outros') payload.periodo = editForm.periodo;

    let ids = [editando.id];
    if (editarProximas && editando.parcelado) {
      const irmas = getGrupo(editando).filter((x) => x.numero_parcela > editando.numero_parcela);
      ids = [editando.id, ...irmas.map((x) => x.id)];
    }
    const { error } = await supabase.from(tabela).update(payload).in('id', ids);
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
    const tabela = editando._origem === 'cartao' ? 'cartao_compartilhado' : 'transacoes';
    let ids = [editando.id];
    if (!apenasEsta && editando.parcelado) ids = getGrupo(editando).map((x) => x.id);
    const { error } = await supabase.from(tabela).delete().in('id', ids);
    setSavingEdit(false);
    if (error) {
      showToast('Erro ao excluir', 'error');
      return;
    }
    showToast('Excluído!');
    setEditando(null);
    fetchData();
  };

  /* ── DADOS DO MÊS ── */
  const outrosDoMes = outros.filter((t) => normalizarMes(t.mes_referente) === mes);
  const cartaoDoMes = cartao.filter((t) => normalizarMes(t.mes_referente) === mes);

  const totalOutros = outrosDoMes.reduce((a, b) => a + Number(b.valor || 0), 0);
  const totalCartao = cartaoDoMes.reduce((a, b) => a + Number(b.valor || 0), 0);
  const totalGeral = totalOutros + totalCartao;

  const porPeriodo = PERIODOS.map((p) => {
    // o cartão (Fernanda) é sempre somado dentro do 1º Período
    const itensOutros = outrosDoMes.filter((t) => t.periodo === p);
    const itensCartao = p === '1º Período' ? cartaoDoMes : [];
    const itens = [...itensOutros, ...itensCartao];
    return {
      periodo: p,
      itens,
      total: itens.reduce((a, b) => a + Number(b.valor || 0), 0),
      totalCartao: itensCartao.reduce((a, b) => a + Number(b.valor || 0), 0),
      totalOutros: itensOutros.reduce((a, b) => a + Number(b.valor || 0), 0),
      porCategoria: CATEGORIAS.map((cat) => ({
        nome: cat,
        valor: itens
          .filter((t) => t.categoria === cat)
          .reduce((a, b) => a + Number(b.valor || 0), 0),
      })).filter((c) => c.valor > 0),
    };
  });

  /* ── LISTAGEM (combina as duas fontes, ordenado pela data no texto) ── */
  const unificados = [
    ...outrosDoMes.map((t) => ({ ...t, _origem: 'outros' })),
    ...cartaoDoMes.map((t) => ({ ...t, _origem: 'cartao' })),
  ];
  const listagem = unificados
    .filter((t) => {
      if (filtroCategoria && t.categoria !== filtroCategoria) return false;
      if (filtroFonte && t._origem !== filtroFonte) return false;
      if (filtroDataInicio && t.data < filtroDataInicio) return false;
      if (filtroDataFim && t.data > filtroDataFim) return false;
      return true;
    })
    .sort((a, b) => {
      const diff = chaveOrdenacao(b) - chaveOrdenacao(a);
      if (diff !== 0) return diff;
      return (b.descricao || '').localeCompare(a.descricao || '');
    });

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'listagem', label: 'Listagem', icon: '📋' },
    { id: 'novo', label: 'Novo', icon: '＋' },
  ];

  /* ═══════════════════════════════ RENDER ═══════════════════════════════ */
  return (
    <div style={S.shell} className="app-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D8D5C9; border-radius: 10px; }
        input[type='date']::-webkit-calendar-picker-indicator { filter: invert(0.35); }
        input[type='month']::-webkit-calendar-picker-indicator { filter: invert(0.35); }
        @keyframes spin { to { transform: rotate(360deg); } }
        .app-topnav { display: none; }
        .app-desktop-header { display: none; }
        @media (min-width: 900px) {
          .app-header, .app-nav { display: none !important; }
          .app-content { max-width: none !important; width: 100% !important; }
          .app-topnav {
            display: flex !important;
            align-items: center;
            justify-content: space-between;
            gap: 24px;
            background: linear-gradient(120deg, ${C.accent} 0%, ${C.accentDark} 100%);
            border-radius: 20px;
            padding: 12px 20px;
            margin: 20px clamp(20px, 3vw, 48px) 0;
            box-shadow: 0 12px 28px ${C.accent}33;
            position: sticky;
            top: 16px;
            z-index: 30;
          }
          .app-topnav-brand { display: flex; align-items: center; gap: 10px; color: #fff; font-weight: 800; font-size: 15px; white-space: nowrap; }
          .app-topnav-links { display: flex; align-items: center; gap: 6px; flex: 1; }
          .app-topnav-btn {
            background: none; border: none; color: rgba(255,255,255,0.78);
            font-family: 'DM Sans', sans-serif; font-weight: 700; font-size: 13px;
            letter-spacing: 0.2px; padding: 9px 16px; border-radius: 999px; cursor: pointer;
            display: flex; align-items: center; gap: 7px; transition: background 0.15s, color 0.15s;
          }
          .app-topnav-btn:hover { background: rgba(255,255,255,0.10); color: #fff; }
          .app-topnav-btn.active { background: rgba(255,255,255,0.96); color: ${C.accentDark}; }
          .app-topnav-month {
            background: rgba(255,255,255,0.14); color: #fff; border: 1px solid rgba(255,255,255,0.3);
            border-radius: 10px; padding: 7px 10px; font-size: 13px; font-family: 'DM Sans', sans-serif; outline: none;
          }
          .app-topnav-month::-webkit-calendar-picker-indicator { filter: invert(1); }
          .app-desktop-header { display: flex !important; align-items: center; justify-content: space-between; padding: 26px clamp(20px, 3vw, 48px) 4px; }
          .app-desktop-header h1 { font-size: 26px; font-weight: 800; color: ${C.text}; margin: 0; }
          .app-desktop-header p { color: ${C.accent}; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 4px; }
          .app-main { max-width: none !important; width: 100% !important; padding: 12px clamp(20px, 3vw, 48px) 56px !important; }
          .dash-grid { display: flex !important; flex-direction: column !important; gap: 18px !important; }
          .app-row-item { padding-top: 10px !important; padding-bottom: 10px !important; gap: 14px !important; }
          .app-row-item p { font-size: 14px !important; }
          .app-mobile-list { display: none !important; }
          .app-table-wrap { display: block !important; background: ${C.surface}; border: 1px solid ${C.border}; border-radius: 16px; box-shadow: ${C.shadowSm}; overflow: hidden; }
          .app-periodo-row3 { grid-template-columns: repeat(3, 1fr) !important; }
        }
        .app-table-wrap { display: none; }
        .app-table { width: 100%; border-collapse: collapse; font-family: 'DM Sans', sans-serif; }
        .app-table thead th {
          text-align: left; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
          color: ${C.muted}; background: ${C.surface2}; padding: 13px 16px; border-bottom: 1px solid ${C.border}; white-space: nowrap;
        }
        .app-table tbody td { padding: 11px 16px; font-size: 15px; color: ${C.text}; border-bottom: 1px solid ${C.border}; white-space: nowrap; }
        .app-table tbody tr:hover td { background: ${C.surface2}; }
        .app-table tbody tr:last-child td { border-bottom: none; }
        .app-table-desc { font-weight: 600; max-width: 420px; overflow: hidden; text-overflow: ellipsis; }
        .app-table-valor { text-align: right; font-weight: 800; font-size: 15px; }
        .app-table-pill { display: inline-block; padding: 4px 11px; border-radius: 999px; font-size: 13px; font-weight: 700; }
        .app-table-editbtn { background: none; border: none; cursor: pointer; font-size: 14px; padding: 0; margin-right: 10px; vertical-align: middle; }
        @media (min-width: 900px) {
          .app-form-wrap { margin: 0; }
          .app-form-toprow { display: flex !important; align-items: flex-start; gap: 24px; }
          .app-field-date { flex: 0 0 200px; }
          .app-field-periodo { flex: 1; min-width: 0; }
          .app-form-grid { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 0 24px !important; }
          .app-field-full { grid-column: 1 / -1 !important; }
          .app-legend-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* TOP NAV (desktop) */}
      <div className="app-topnav">
        <div className="app-topnav-brand">
          <span style={{ fontSize: 18 }}>💰</span>
          Minhas Finanças
        </div>
        <div className="app-topnav-links">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`app-topnav-btn${tab === item.id ? ' active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="app-topnav-month" />
      </div>
      <div className="app-desktop-header">
        <div>
          <p>💰 controle financeiro</p>
          <h1>Minhas Finanças</h1>
        </div>
      </div>

      <div style={S.root} className="app-content">
        {/* HEADER (mobile) */}
        <header style={S.header} className="app-header">
          <div style={S.headerInner}>
            <div>
              <p style={S.headerSub}>💰 controle financeiro</p>
              <h1 style={S.headerTitle}>Minhas Finanças</h1>
            </div>
            <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={S.monthPicker} />
          </div>
        </header>

        {toast && (
          <div style={{ ...S.toast, background: toast.type === 'error' ? C.danger : C.success }}>{toast.msg}</div>
        )}

        {/* MODAL EDIÇÃO */}
        {editando && (
          <div style={S.modalOverlay} onClick={() => setEditando(null)}>
            <div style={S.modalBox} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <p style={{ color: C.text, fontSize: 16, fontWeight: 800, margin: 0 }}>
                  Editar lançamento {editando._origem === 'cartao' ? '(Cartão)' : '(Outros)'}
                </p>
                <button
                  style={{ background: 'none', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer' }}
                  onClick={() => setEditando(null)}
                >
                  ×
                </button>
              </div>
              <label style={S.label}>Data</label>
              <div style={{ ...S.dateField, marginBottom: 14 }}>
                <span style={S.dateLabel}>Data</span>
                <input
                  type="date"
                  style={S.dateInput}
                  value={editForm.data}
                  onChange={(e) => setEditForm({ ...editForm, data: e.target.value })}
                />
              </div>
              {editando._origem === 'outros' && (
                <>
                  <label style={S.label}>Período</label>
                  <div style={{ ...S.periodoBtns, marginBottom: 14 }}>
                    {PERIODOS.map((p) => (
                      <button
                        key={p}
                        style={{
                          ...S.periodoBtn,
                          ...(editForm.periodo === p
                            ? { background: PERIODO_COLORS[p] + '22', borderColor: PERIODO_COLORS[p], color: PERIODO_COLORS[p] }
                            : {}),
                        }}
                        onClick={() => setEditForm({ ...editForm, periodo: p })}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </>
              )}
              <label style={S.label}>Categoria</label>
              <select
                style={{ ...S.select, marginBottom: 14 }}
                value={editForm.categoria}
                onChange={(e) => setEditForm({ ...editForm, categoria: e.target.value })}
              >
                <option value="">Sem categoria</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {CAT_ICONS[c]} {c}
                  </option>
                ))}
              </select>
              <label style={S.label}>Descrição</label>
              <input
                type="text"
                style={S.input}
                value={editForm.descricao}
                onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
              />
              <label style={S.label}>Valor (R$)</label>
              <input
                type="number"
                style={S.input}
                value={editForm.valor}
                onChange={(e) => setEditForm({ ...editForm, valor: e.target.value })}
              />
              {editando.parcelado && getProximasParcelas(editando).length > 0 && (
                <div style={S.checkRow}>
                  <div
                    style={{ ...S.checkbox, ...(editarProximas ? { background: C.accent, borderColor: C.accent } : {}) }}
                    onClick={() => setEditarProximas(!editarProximas)}
                  >
                    {editarProximas && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
                  </div>
                  <span style={{ color: C.muted, fontSize: 13 }}>
                    Aplicar para {getProximasParcelas(editando).length} próximas parcelas também
                  </span>
                </div>
              )}
              <button style={{ ...S.saveBtn, marginTop: 6 }} onClick={handleSaveEdit} disabled={savingEdit}>
                {savingEdit ? 'Salvando...' : 'Salvar alterações'}
              </button>
              {!confirmDelete ? (
                <button style={S.deleteBtn} onClick={() => setConfirmDelete(true)}>
                  Excluir lançamento
                </button>
              ) : (
                <div style={{ marginTop: 10, padding: 12, background: C.surface2, borderRadius: 10 }}>
                  <p style={{ color: C.text, fontSize: 13, margin: '0 0 10px' }}>Confirmar exclusão:</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={S.deleteBtnSm} onClick={() => handleDelete(true)}>
                      Apenas esta
                    </button>
                    {editando.parcelado && (
                      <button style={S.deleteBtnSm} onClick={() => handleDelete(false)}>
                        Todo parcelamento
                      </button>
                    )}
                    <button style={S.cancelBtnSm} onClick={() => setConfirmDelete(false)}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <main style={S.main} className="app-main">
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: `3px solid ${C.border}`,
                  borderTop: `3px solid ${C.accent}`,
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <p style={{ color: C.muted, marginTop: 12 }}>Carregando...</p>
            </div>
          ) : (
            <>
              {/* ── DASHBOARD ── */}
              {tab === 'dashboard' && (
                <div>
                  <div style={S.totalBox}>
                    <div>
                      <p
                        style={{
                          color: 'rgba(255,255,255,0.85)',
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: 'uppercase',
                          margin: '0 0 4px',
                        }}
                      >
                        Total geral do mês
                      </p>
                      <p style={{ fontSize: 32, fontWeight: 800, color: '#fff', margin: 0 }}>{fmt(totalGeral)}</p>
                      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: '4px 0 0' }}>
                        {outrosDoMes.length + cartaoDoMes.length} lançamentos
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, margin: '0 0 4px' }}>Cartão (no 1º Período)</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0 }}>{fmt(totalCartao)}</p>
                      <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, margin: '4px 0 0' }}>
                        Outros: {fmt(totalOutros)}
                      </p>
                    </div>
                  </div>

                  <div className="dash-grid">
                    <div style={S.periodoRow3} className="app-periodo-row3">
                      {porPeriodo.map((p) => (
                        <div key={p.periodo} style={{ ...S.periodoCard, borderTop: `3px solid ${PERIODO_COLORS[p.periodo]}` }}>
                          <p
                            style={{
                              color: C.muted,
                              fontSize: 10,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                              margin: '0 0 6px',
                            }}
                          >
                            {p.periodo}
                          </p>
                          <p style={{ fontSize: 17, fontWeight: 800, color: PERIODO_COLORS[p.periodo], margin: 0 }}>
                            {fmt(p.total)}
                          </p>
                          <p style={{ fontSize: 11, color: C.muted, margin: '4px 0 0' }}>
                            {p.itens.length} lançamento{p.itens.length !== 1 ? 's' : ''}
                          </p>
                          {p.periodo === '1º Período' && (p.totalCartao > 0 || p.totalOutros > 0) && (
                            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted }}>
                                <span>💳 Cartão</span>
                                <span style={{ fontWeight: 700, color: C.text }}>{fmt(p.totalCartao)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.muted, marginTop: 2 }}>
                                <span>📦 Outros</span>
                                <span style={{ fontWeight: 700, color: C.text }}>{fmt(p.totalOutros)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {porPeriodo.map(
                      (p) =>
                        p.total > 0 && (
                          <div key={p.periodo} style={S.card}>
                            <p style={{ ...S.cardTitle, textAlign: 'center' }}>{p.periodo}</p>
                            <p style={{ ...S.donutTotal, color: PERIODO_COLORS[p.periodo] }}>{fmt(p.total)}</p>
                            {p.periodo === '1º Período' && (p.totalCartao > 0 || p.totalOutros > 0) && (
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'center',
                                  gap: 24,
                                  marginTop: -10,
                                  marginBottom: 18,
                                }}
                              >
                                <div style={{ textAlign: 'center' }}>
                                  <p style={{ margin: 0, fontSize: 11, color: C.muted }}>💳 Cartão</p>
                                  <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: C.text }}>
                                    {fmt(p.totalCartao)}
                                  </p>
                                </div>
                                <div style={{ width: 1, background: C.border }} />
                                <div style={{ textAlign: 'center' }}>
                                  <p style={{ margin: 0, fontSize: 11, color: C.muted }}>📦 Outros</p>
                                  <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 800, color: C.text }}>
                                    {fmt(p.totalOutros)}
                                  </p>
                                </div>
                              </div>
                            )}
                            <DonutChart
                              dados={p.porCategoria.map((c) => ({ valor: c.valor, cor: CAT_COLORS[c.nome] || '#98A2B3' }))}
                              total={p.total}
                            />
                            <div style={S.legendGrid} className="app-legend-grid">
                              {p.porCategoria.map((c) => {
                                const pct = p.total ? (c.valor / p.total) * 100 : 0;
                                const cor = CAT_COLORS[c.nome] || '#98A2B3';
                                return (
                                  <div key={c.nome} style={S.legendRow}>
                                    <span style={{ ...S.legendDot, background: cor }} />
                                    <span style={S.legendName}>
                                      {CAT_ICONS[c.nome]} {c.nome}
                                    </span>
                                    <span style={S.legendPct}>{pct.toFixed(1)}%</span>
                                    <span style={S.legendValor}>{fmt(c.valor)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )
                    )}

                    {outrosDoMes.length === 0 && cartaoDoMes.length === 0 && (
                      <EmptyState msg="Nenhum lançamento neste mês." />
                    )}
                  </div>
                </div>
              )}

              {/* ── LISTAGEM ── */}
              {tab === 'listagem' && (
                <div>
                  <div style={S.card}>
                    <p style={S.cardTitle}>Filtros</p>
                    <div style={S.filtrosGrid}>
                      <select style={S.select} value={filtroFonte} onChange={(e) => setFiltroFonte(e.target.value)}>
                        <option value="">Todas as origens</option>
                        <option value="outros">Outros</option>
                        <option value="cartao">Cartão</option>
                      </select>
                      <select style={S.select} value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
                        <option value="">Todas categorias</option>
                        {CATEGORIAS.map((c) => (
                          <option key={c} value={c}>
                            {c}
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
                    {(filtroCategoria || filtroFonte || filtroDataInicio || filtroDataFim) && (
                      <button
                        style={S.clearBtn}
                        onClick={() => {
                          setFiltroCategoria('');
                          setFiltroFonte('');
                          setFiltroDataInicio('');
                          setFiltroDataFim('');
                        }}
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>

                  {listagem.length === 0 ? (
                    <EmptyState msg="Nenhum lançamento encontrado." />
                  ) : (
                    <>
                      <div className="app-mobile-list" style={S.respCard}>
                        {listagem.map((t, idx) => {
                          const isOpen = expandedId === `${t._origem}-${t.id}`;
                          const proximas = isOpen ? getProximasParcelas(t) : [];
                          const cor =
                            t._origem === 'cartao'
                              ? C.accentDark
                              : PERIODO_COLORS[t.periodo] || CAT_COLORS[t.categoria] || C.border;
                          return (
                            <div key={`${t._origem}-${t.id}`}>
                              <div
                                className="app-row-item"
                                style={{
                                  ...S.item,
                                  borderTop: idx === 0 ? 'none' : S.item.borderTop,
                                  borderLeft: `3px solid ${cor}`,
                                  cursor: t.parcelado ? 'pointer' : 'default',
                                }}
                                onClick={() => t.parcelado && setExpandedId(isOpen ? null : `${t._origem}-${t.id}`)}
                              >
                                <button style={S.editBtn} onClick={(e) => abrirEdicao(t, e)} title="Editar">
                                  ✏️
                                </button>
                                <span style={{ fontSize: 17 }}>{CAT_ICONS[t.categoria] || '📦'}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: 14,
                                      fontWeight: 600,
                                      color: C.text,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {t.descricao || t.categoria || '(sem descrição)'}
                                  </p>
                                  <p
                                    style={{
                                      margin: '2px 0 0',
                                      fontSize: 11,
                                      color: C.muted,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    {t.data}
                                    <span
                                      style={{
                                        ...S.badge,
                                        color: t._origem === 'cartao' ? C.accentDark : PERIODO_COLORS[t.periodo] || C.muted,
                                      }}
                                    >
                                      {t._origem === 'cartao' ? '💳 Cartão' : t.periodo || 'Outros'}
                                    </span>
                                    {t.parcelado && (
                                      <span style={S.badge}>
                                        {t.numero_parcela}/{t.total_parcelas}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <p style={{ margin: 0, fontWeight: 800, fontSize: 14, flexShrink: 0, color: C.text }}>
                                  {fmt(t.valor)}
                                </p>
                              </div>
                              {isOpen && proximas.length > 0 && (
                                <div style={{ background: C.bg, padding: '8px 16px', borderTop: `1px solid ${C.border}` }}>
                                  {proximas.map((p) => (
                                    <div
                                      key={p.id}
                                      style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13 }}
                                    >
                                      <span style={{ color: C.muted }}>
                                        {p.numero_parcela}/{p.total_parcelas} — {p.data}
                                      </span>
                                      <span style={{ color: C.text, fontWeight: 700 }}>{fmt(p.valor)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="app-table-wrap">
                        <table className="app-table">
                          <thead>
                            <tr>
                              <th>Descrição</th>
                              <th>Origem</th>
                              <th>Categoria</th>
                              <th>Data</th>
                              <th>Parcela</th>
                              <th style={{ textAlign: 'right' }}>Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {listagem.map((t) => (
                              <tr key={`${t._origem}-${t.id}`}>
                                <td className="app-table-desc">
                                  <button className="app-table-editbtn" onClick={(e) => abrirEdicao(t, e)} title="Editar">
                                    ✏️
                                  </button>
                                  {t.descricao || '(sem descrição)'}
                                </td>
                                <td>
                                  <span
                                    className="app-table-pill"
                                    style={{
                                      background:
                                        (t._origem === 'cartao' ? C.accentDark : PERIODO_COLORS[t.periodo] || C.muted) + '1F',
                                      color: t._origem === 'cartao' ? C.accentDark : PERIODO_COLORS[t.periodo] || C.muted,
                                    }}
                                  >
                                    {t._origem === 'cartao' ? '💳 Cartão' : t.periodo || 'Outros'}
                                  </span>
                                </td>
                                <td style={{ color: C.muted }}>
                                  {CAT_ICONS[t.categoria] || ''} {t.categoria || '—'}
                                </td>
                                <td>{t.data}</td>
                                <td>{t.parcelado ? `${t.numero_parcela}/${t.total_parcelas}` : '—'}</td>
                                <td className="app-table-valor">{fmt(t.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── NOVO ── */}
              {tab === 'novo' && (
                <div className="app-form-wrap">
                  <div style={S.card}>
                    <p style={S.cardTitle}>Novo Lançamento</p>
                    <div className="app-form-toprow">
                      <div className="app-field app-field-date">
                        <label style={S.label}>Data *</label>
                        <div style={{ ...S.dateField, marginBottom: 14 }}>
                          <span style={S.dateLabel}>Data</span>
                          <input
                            type="date"
                            style={S.dateInput}
                            value={form.data}
                            onChange={(e) => setForm({ ...form, data: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="app-field app-field-periodo">
                        <label style={S.label}>Período</label>
                        <div style={S.periodoBtns}>
                          {PERIODOS.map((p) => (
                            <button
                              key={p}
                              style={{
                                ...S.periodoBtn,
                                ...(form.periodo === p
                                  ? { background: PERIODO_COLORS[p] + '22', borderColor: PERIODO_COLORS[p], color: PERIODO_COLORS[p] }
                                  : {}),
                              }}
                              onClick={() => setForm({ ...form, periodo: p })}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="app-form-grid">
                      <div className="app-field">
                        <label style={S.label}>Categoria</label>
                        <select
                          style={{ ...S.select, marginBottom: 14 }}
                          value={form.categoria}
                          onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                        >
                          {CATEGORIAS.map((c) => (
                            <option key={c} value={c}>
                              {CAT_ICONS[c]} {c}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="app-field">
                        <label style={S.label}>Descrição</label>
                        <input
                          type="text"
                          placeholder="Ex: Supermercado Extra"
                          style={S.input}
                          value={form.descricao}
                          onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                        />
                      </div>
                      <div className="app-field">
                        <label style={S.label}>Valor total (R$) *</label>
                        <input
                          type="number"
                          placeholder="0,00"
                          style={S.input}
                          value={form.valor}
                          onChange={(e) => setForm({ ...form, valor: e.target.value })}
                        />
                      </div>
                      <div className="app-field">
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
                              parcelas: e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                        />
                      </div>
                      {Number(form.valor) > 0 && Number(form.parcelas) > 1 && (
                        <div className="app-field-full">
                          <div style={{ background: C.surface2, borderRadius: 10, padding: '10px 14px', marginBottom: 14, textAlign: 'center' }}>
                            <p style={{ margin: 0, color: C.accentDark, fontWeight: 700, fontSize: 14 }}>
                              {form.parcelas}× de {fmt(Number(form.valor) / Number(form.parcelas))}/mês
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="app-field-full">
                        <button style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }} onClick={handleAdd} disabled={saving}>
                          {saving ? 'Salvando...' : 'Salvar lançamento'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* NAV (mobile) */}
      <nav style={S.nav} className="app-nav">
        {navItems.map((item) => {
          const active = tab === item.id;
          return (
            <button key={item.id} style={S.navBtn} onClick={() => setTab(item.id)}>
              <span
                style={{
                  fontSize: item.id === 'novo' ? 22 : 18,
                  ...(item.id === 'novo' && active ? { filter: `drop-shadow(0 0 6px ${C.accent})` } : {}),
                }}
              >
                {item.icon}
              </span>
              <span style={{ ...S.navLabel, color: active ? C.accent : C.muted }}>{item.label}</span>
              {active && <div style={{ width: 20, height: 2, borderRadius: 2, background: C.accent, marginTop: 1 }} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function EmptyState({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '50px 20px' }}>
      <p style={{ fontSize: 40 }}>🌿</p>
      <p style={{ color: '#7C8B82', marginTop: 8, fontSize: 14 }}>{msg}</p>
    </div>
  );
}

/* Gráfico de pizza (donut) feito com conic-gradient, sem dependências */
function DonutChart({ dados, total, size = 160, corVazio = '#E7E4DA' }) {
  let acumulado = 0;
  const slices = dados.map((d) => {
    const pct = total ? (d.valor / total) * 100 : 0;
    const inicio = acumulado;
    acumulado += pct;
    return { ...d, pct, inicio, fim: acumulado };
  });
  const fatias = slices.map((s) => `${s.cor} ${s.inicio}% ${s.fim}%`);
  const gradiente = fatias.length > 0 ? `conic-gradient(${fatias.join(', ')})` : corVazio;
  const R = size / 2;
  const linhaExterna = R + 14;
  const rotuloR = R + 22;
  const margem = 56;
  const canvas = size + margem * 2;
  const cx = canvas / 2;
  const cy = canvas / 2;
  const rotulos = slices
    .filter((s) => s.pct >= 4)
    .map((s) => {
      const anguloDeg = ((s.inicio + s.fim) / 2 / 100) * 360;
      const rad = (anguloDeg * Math.PI) / 180;
      const seno = Math.sin(rad);
      const cosseno = Math.cos(rad);
      const x1 = cx + R * seno;
      const y1 = cy - R * cosseno;
      const x2 = cx + linhaExterna * seno;
      const y2 = cy - linhaExterna * cosseno;
      const lx = cx + rotuloR * seno;
      const ly = cy - rotuloR * cosseno;
      const ladoDireito = seno >= 0;
      return { ...s, x1, y1, x2, y2, lx, ly, ladoDireito };
    });
  return (
    <div style={{ position: 'relative', width: canvas, height: canvas, flexShrink: 0, margin: '0 auto' }}>
      <svg width={canvas} height={canvas} style={{ position: 'absolute', inset: 0 }}>
        {rotulos.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={r.cor} strokeWidth={1.5} />
        ))}
      </svg>
      <div
        style={{
          position: 'absolute',
          left: margem,
          top: margem,
          width: size,
          height: size,
          borderRadius: '50%',
          background: gradiente,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: margem + size * 0.36,
          top: margem + size * 0.36,
          width: size * 0.28,
          height: size * 0.28,
          borderRadius: '50%',
          background: '#FFFFFF',
        }}
      />
      {rotulos.map((r, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: r.lx,
            top: r.ly,
            transform: `translate(${r.ladoDireito ? '4px' : 'calc(-100% - 4px)'}, -50%)`,
            fontSize: 11,
            fontWeight: 800,
            color: r.cor,
            whiteSpace: 'nowrap',
          }}
        >
          {r.pct.toFixed(1)}%
        </div>
      ))}
    </div>
  );
}
