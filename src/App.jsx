'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
/* Minhas Finanças v2 — mantém transacoes e cartao_compartilhado.
   Execute migracao.sql antes de substituir o App.jsx. */
const CATS = ['Apartamento', 'Carro', 'Cosméticos', 'Comida Besteira', 'Dinheiro', 'Entretenimento', 'Estética', 'Farmácia', 'Mercado', 'Moto', 'Trabalho', 'Casa', 'Leticia', 'Outros', 'Presentes', 'Roupas'];
const PERIODOS = ['1º Período', '2º Período', 'Extra'];
const METHODS = ['Boleto', 'Pix', 'Débito', 'Cartão de Crédito', 'Dinheiro', 'Vale-alimentação', 'Transferência'];
const DEFAULT_LIMITS = { Mercado: 1200, Carro: 500, Moto: 0, Trabalho: 0, Casa: 0, Leticia: 0, 'Comida Besteira': 75, Entretenimento: 75, Roupas: 50, Presentes: 25, Cosméticos: 25, Estética: 100, Farmácia: 200 };
const today = () => { const d = new Date(); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 10); };
const ym = d => {
  const v = String(d || '').trim();
  if (/^\d{4}-\d{2}/.test(v))
    return v.slice(0, 7);
  if (/^\d{2}\/\d{2,4}$/.test(v)) {
    const [m, y] = v.split('/');
    return `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}`;
  }
  return '';
};
const brl = n => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = n => Math.round((Number(n) || 0) * 100) / 100;
const sum = xs => num(xs.reduce((a, x) => a + Number(x.valor || 0), 0));
const addMonths = (s, n) => { const [y, m, d] = s.split('-').map(Number); const date = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`; };
const formInit = () => ({ tipo_movimentacao: 'despesa', descricao: '', valor: '', data: today(), data_vencimento: today(), categoria: 'Outros', metodo_pagamento: 'Boleto', periodo: '1º Período', conta: 'Santander', pago: false, parcelas: 1, observacoes: '' });
const isCard = x => x.fonte === 'cartao';
const isTransfer = x => x.tipo_movimentacao === 'transferencia';
const isIncome = x => x.tipo_movimentacao === 'receita';
const isExpense = x => !isTransfer(x) && !isIncome(x) && x.tipo_movimentacao !== 'pagamento_fatura';
const due = x => x.data_vencimento || x.data || `${ym(x.mes_referente) || ym(today())}-01`;
const paid = x => x.pago === true;
const isCashPayment = x => !isCard(x) && isExpense(x) && ['debito', 'Débito', 'Debito', 'débito', 'Pix', 'PIX', 'pix', 'Dinheiro', 'Vale-alimentação'].includes(x.metodo_pagamento);
const inMonth = (x, month) => ym(x.mes_referente || due(x)) === month;
const style = { page: { fontFamily: 'Inter, system-ui, sans-serif', background: '#F6F7F8', minHeight: '100vh', color: '#1F2937', padding: '18px max(14px, calc((100vw - 1180px)/2))' }, panel: { background: '#fff', border: '1px solid #E4E7EC', borderRadius: 14, padding: 18, marginBottom: 14 }, grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }, button: { border: 0, background: '#147D52', color: '#fff', padding: '10px 14px', borderRadius: 9, cursor: 'pointer', fontWeight: 650 }, secondary: { border: '1px solid #D0D5DD', background: '#fff', color: '#344054', padding: '9px 12px', borderRadius: 9, cursor: 'pointer' }, input: { border: '1px solid #D0D5DD', borderRadius: 8, padding: '9px 10px', width: '100%', background: '#fff', fontSize: 14 }, label: { display: 'block', fontSize: 12, color: '#667085', marginBottom: 5, fontWeight: 600 }, pill: { borderRadius: 999, padding: '3px 9px', fontSize: 12, display: 'inline-block' }, table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 }, td: { borderBottom: '1px solid #EEF0F3', padding: '11px 7px', textAlign: 'left' } };
const dateBR = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—';
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
function Stat({ label, value, hint, negative = false }) {
  return <div style={{ ...style.panel, margin: 0 }}>
    <div style={{ color: '#667085', fontSize: 12 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: negative ? '#C43232' : '#184F3B', marginTop: 6 }}>{brl(value)}</div>{hint && <div style={{ fontSize: 11, color: '#667085', marginTop: 4 }}>{hint}</div>}</div>;
}
function Field({ label, children }) {
  return <label style={{ display: 'block' }}>
    <span style={style.label}>{label}</span>{children}</label>;
}
function Empty({ children }) { return <p style={{ color: '#667085', fontSize: 14 }}>{children}</p>; }
export default function App() {
  const [tab, setTab] = useState('inicio');
  const [mes, setMes] = useState(ym(today()));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(formInit);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('todos');
  const [fCategoria,setFCategoria]=useState('');
  const [fPeriodo,setFPeriodo]=useState('');
  const [fPagamento,setFPagamento]=useState('');
  const [fBusca,setFBusca]=useState('');
  const [fInicio,setFInicio]=useState('');
  const [fFim,setFFim]=useState('');
  const [limitDraft, setLimitDraft] = useState(DEFAULT_LIMITS);
  const [settings, setSettings] = useState({ saldo_inicial: 0, saldo_data: today(), vale_saldo: 0, receita_dia5: 6000, receita_dia20: 4200, vale_mensal: 1200 });
  const [saving, setSaving] = useState(false);
  const [showLimits, setShowLimits] = useState(false);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [a, b, c, d] = await Promise.all([supabase.from('transacoes').select('*').order('data', { ascending: false }).limit(10000), supabase.from('cartao_compartilhado').select('*').eq('responsavel', 'Fernanda').order('data', { ascending: false }).limit(10000), supabase.from('financeiro_config').select('*').eq('id', 1).maybeSingle(), supabase.from('financeiro_limites').select('*')]);
      if (a.error || b.error)
        throw new Error([a.error, b.error].filter(Boolean).map(x => x.message).join(' / '));
      if (c.error || d.error)
        setError('Os lançamentos carregaram, mas Ajustes/Limites exigem políticas RLS no Supabase: ' + [c.error, d.error].filter(Boolean).map(x => x.message).join(' / '));
      // Preserva a mesma seleção de registros usada no aplicativo original.
      // Lançamentos novos criados na versão atual têm data_vencimento preenchida.
      const legacyMethods=['Outros','Pix','PIX','pix','debito','Debito','Débito','débito'];
      const personal = (a.data || []).filter(x =>
        legacyMethods.includes(x.metodo_pagamento) ||
        (x.data_vencimento && x.metodo_pagamento !== 'Cartão de Crédito')
      ).map(x => ({ ...x, fonte: 'transacoes', tipo_movimentacao: x.tipo_movimentacao || 'despesa' }));
      const card = (b.data || []).map(x => ({ ...x, fonte: 'cartao', tipo_movimentacao: 'despesa', metodo_pagamento: 'Cartão de Crédito', data_vencimento: x.data_vencimento || null }));
      setItems([...personal, ...card]);
      if (c.data)
        setSettings(c.data);
      if (d.data?.length)
        setLimitDraft(Object.fromEntries(d.data.map(x => [x.categoria, Number(x.limite)])));
    }
    catch (e) {
      setError(e.message);
    }
    finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
