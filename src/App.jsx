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
// Débito e Pix são pagamentos de despesas, mesmo quando registros antigos
// foram classificados com tipo_movimentacao = 'transferencia'.
const normalizedMethod = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const hasDebitOrPixMethod = x => ['debito', 'pix'].includes(normalizedMethod(x.metodo_pagamento));
const isTransfer = x => x.tipo_movimentacao === 'transferencia' && !hasDebitOrPixMethod(x);
const isIncome = x => x.tipo_movimentacao === 'receita';
const isExpense = x => !isTransfer(x) && !isIncome(x) && x.tipo_movimentacao !== 'pagamento_fatura';
const due = x => x.data_vencimento || x.data || `${ym(x.mes_referente) || ym(today())}-01`;
const paid = x => x.pago === true;
const isDebitOrPix = x => !isCard(x) && isExpense(x) && hasDebitOrPixMethod(x);
const isPaidDebitOrPix = x => isDebitOrPix(x) && paid(x);
const isAccount = x => !isCard(x) && isExpense(x) && !isDebitOrPix(x);
const isOverdue = x => isExpense(x) && !paid(x) && due(x) < today();
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
      const legacyMethods=['outros','pix','debito'];
      const personal = (a.data || []).filter(x =>
        legacyMethods.includes(normalizedMethod(x.metodo_pagamento)) ||
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
  const current = useMemo(() => items.filter(x => inMonth(x, mes)), [items, mes]);
  const bills = useMemo(() => items.filter(x => isAccount(x) && inMonth(x,mes)), [items, mes]);
  const overdue = useMemo(() => items.filter(x => !isCard(x) && isOverdue(x)), [items]);
  const cardMonth = current.filter(isCard), debitMonth = current.filter(isDebitOrPix);
  const paidDebitMonth = debitMonth.filter(paid);
  const toPay = current.filter(x => isExpense(x) && !paid(x));
  const expenses = current.filter(isExpense);
  const incomes = current.filter(isIncome);
  const bankMoves = items.filter(x => x.fonte === 'transacoes' && (x.data_pagamento || x.data) > settings.saldo_data && (x.data_pagamento || x.data) <= today());
  const balance = num(Number(settings.saldo_inicial || 0) + bankMoves.reduce((s, x) => {
    if (x.conta === 'Vale-alimentação' || x.metodo_pagamento === 'Vale-alimentação')
      return s;
    if (isIncome(x) && paid(x))
      return s + Number(x.valor);
    if (isTransfer(x))
      return s; // Transferência interna não altera o saldo consolidado.
    if (isExpense(x) && paid(x) && !['Cartão de Crédito'].includes(x.metodo_pagamento))
      return s - Number(x.valor);
    if (x.tipo_movimentacao === 'pagamento_fatura' && paid(x))
      return s - Number(x.valor);
    return s;
  }, 0));
  const pendingThisMonth = items.filter(x => isExpense(x) && !paid(x) && due(x) >= `${mes}-01` && due(x) <= `${mes}-31`);
  const remaining = num(balance - sum(current.filter(x => isExpense(x) && !isCard(x) && !paid(x))));
  const monthExpense = sum(expenses), monthPaid = sum(expenses.filter(paid));
  const monthPending = sum(expenses.filter(x => !paid(x)));
  const monthNonCardPending = sum(current.filter(x => isExpense(x) && !isCard(x) && !paid(x)));
  const monthCashPaid = sum(current.filter(x => isExpense(x) && !isCard(x) && paid(x)));
  const monthName = new Date(Number(mes.slice(0,4)), Number(mes.slice(5,7))-1, 1).toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
  const cardTotal = sum(cardMonth);
  const otherMonth = current.filter(x=>isExpense(x)&&!isCard(x));
  const accountsMonth = current.filter(isAccount);
  const totalAccounts = sum(accountsMonth);
  const totalDebit = sum(paidDebitMonth);
  // A soma não inclui transferências internas nem pagamentos da fatura já contada no cartão.
  const totalMonthlyExpenses = num(cardTotal + totalAccounts + totalDebit);
  const totalMonthlyIncome = sum(incomes);
  // Resumo exclusivamente do mês selecionado; pagamentos do cartão não são
  // debitados uma segunda vez como despesa de consumo.
  const totalPaidThisMonth = sum(expenses.filter(paid));
  // Atraso exige vencimento real: não inferir vencimento de compras do cartão.
  const totalOverdueThisMonth = sum(accountsMonth.filter(x => !paid(x) && due(x) < today()));
  const totalOpenThisMonth = sum(accountsMonth.filter(x => !paid(x) && due(x) >= today()));
  const periodRows = PERIODOS.map(periodo=>{
    const others=otherMonth.filter(x=>(x.periodo||'1º Período')===periodo && (!isDebitOrPix(x) || paid(x)));
    const cards=periodo==='1º Período'?cardMonth:[];
    return {periodo,others,cards,all:[...others,...cards],total:sum([...others,...cards]),cartao:sum(cards),outros:sum(others),pago:sum([...others,...cards].filter(paid)),pendente:sum([...others,...cards].filter(x=>!paid(x)))};
  });
  const oldUnpaidCard=items.filter(x=>isCard(x)&&inMonth(x,mes)===false && ym(x.mes_referente||due(x))<mes&&!paid(x));
  const cardCategories=[...new Set(cardMonth.map(x=>x.categoria||'Sem categoria'))].map(cat=>({cat,value:sum(cardMonth.filter(x=>(x.categoria||'Sem categoria')===cat))})).sort((a,b)=>b.value-a.value);
  const otherCategories=[...new Set(otherMonth.map(x=>x.categoria||'Sem categoria'))].map(cat=>({cat,value:sum(otherMonth.filter(x=>(x.categoria||'Sem categoria')===cat))})).sort((a,b)=>b.value-a.value);
  const categoriesForFilter=[...new Set([...CATS,...items.map(x=>x.categoria).filter(Boolean)])];
  const applyFilters = rows=>rows.filter(x=>
    (!fCategoria||(x.categoria||'Sem categoria')===fCategoria)&&
    (!fPeriodo||(isCard(x)?'1º Período':(x.periodo||'1º Período'))===fPeriodo)&&
    (!fPagamento||(fPagamento==='cartao'?isCard(x):fPagamento==='outros'?!isCard(x):normalizedMethod(x.metodo_pagamento)===normalizedMethod(fPagamento)))&&
    (!fBusca||String(x.descricao||'').toLowerCase().includes(fBusca.toLowerCase()))&&
    (!fInicio||String(x.data||'')>=fInicio)&&(!fFim||String(x.data||'')<=fFim)&&
    (filter==='todos'||filter==='pagar'&&isExpense(x)&&!paid(x)&&!isOverdue(x)||filter==='atrasados'&&isOverdue(x)||filter==='pagos'&&isExpense(x)&&paid(x)||filter==='receitas'&&isIncome(x)||filter==='transferencias'&&isTransfer(x)||filter==='cartao'&&isCard(x)||filter==='outros'&&!isCard(x))
  );
  const forecast = Array.from({ length: 5 }, (_, i) => { const m = ym(addMonths(`${mes}-05`, i)); const known = items.filter(x => isExpense(x) && ym(x.mes_referente || due(x)) === m); return { mes: m, contas: sum(known.filter(x => !isCard(x))), cartao: sum(known.filter(isCard)), total: sum(known) }; });
  const byCategory = [...new Set([...CATS, ...expenses.map(x => x.categoria || 'Sem categoria')])].map(cat => ({ cat, value: sum(expenses.filter(x => (x.categoria || 'Sem categoria') === cat)) })).filter(x => x.value > 0).sort((a, b) => b.value - a.value);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const save = async (e) => {
    e.preventDefault();
    if (!form.descricao.trim() || !(Number(form.valor) > 0)) {
      setError('Preencha descrição e valor positivo.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const n = editing ? 1 : Math.max(1, Math.min(120, Math.floor(Number(form.parcelas) || 1)));
      const savingCard = form.tipo_movimentacao === 'cartao';
      if (!form.data || !form.data_vencimento)
        throw new Error('Preencha as datas.');
      const group = editing?.grupo_parcelamento || uid();
      const cents = Math.round(Number(form.valor) * 100);
      const base = Math.floor(cents / n);
      const rows = Array.from({ length: n }, (_, i) => { const date = addMonths(form.data, i); const venc = addMonths(form.data_vencimento || form.data, i); const value = (base + (i < cents % n ? 1 : 0)) / 100; return { descricao: form.descricao.trim(), valor: value, data: date, data_vencimento: venc, mes_referente: ym(venc), categoria: form.categoria, metodo_pagamento: form.metodo_pagamento, periodo: form.periodo, conta: form.conta, pago: !!form.pago && i === 0, data_pagamento: form.pago && i === 0 ? date : null, tipo_movimentacao: form.tipo_movimentacao, observacoes: form.observacoes, parcelado: n > 1, numero_parcela: i + 1, total_parcelas: n, grupo_parcelamento: n > 1 ? group : null }; });
      if (editing) {
        const payload = isCard(editing)
          ? { descricao:form.descricao.trim(), valor:Number(form.valor), data:form.data, mes_referente:ym(form.data_vencimento), categoria:form.categoria, pago:!!form.pago }
          : { ...rows[0], parcelado: editing.parcelado, numero_parcela: editing.numero_parcela, total_parcelas: editing.total_parcelas, grupo_parcelamento: editing.grupo_parcelamento };
        const { error } = await supabase.from(isCard(editing)?'cartao_compartilhado':'transacoes').update(payload).eq('id', editing.id);
        if (error)
          throw error;
      }
      else {
        // Cartão é gravado na mesma tabela que o aplicativo Cartão da Família.
        // Só envia campos usados pelo cadastro original para não exigir nova migração.
        const payload = savingCard ? rows.map(r=>({
          descricao:r.descricao,valor:r.valor,data:r.data,mes_referente:r.mes_referente,
          categoria:r.categoria,pago:r.pago,responsavel:'Fernanda',
          parcelado:r.parcelado,numero_parcela:r.numero_parcela,total_parcelas:r.total_parcelas
        })) : rows;
        const { error } = await supabase.from(savingCard?'cartao_compartilhado':'transacoes').insert(payload);
        if (error)
          throw error;
      }
      setForm(formInit());
      setEditing(null);
      setTab('lancamentos');
      await load();
    }
    catch (e) {
      setError(e.message);
    }
    finally {
      setSaving(false);
    }
  };
  const toggle = async (x) => {
    setError('');
    const table = isCard(x) ? 'cartao_compartilhado' : 'transacoes';
    const val = !paid(x);
    const payload = isCard(x) ? { pago: val } : { pago: val, data_pagamento: val ? today() : null };
    const { error } = await supabase.from(table).update(payload).eq('id', x.id);
    if (error)
      setError(error.message);
    else
      await load();
  };
  const toggleCard = async () => {
    const ids = cardMonth.map(x => x.id);
    if (!ids.length)
      return;
    const val = !cardMonth.every(paid);
    const { error } = await supabase.from('cartao_compartilhado').update({ pago: val }).in('id', ids);
    if (error)
      setError(error.message);
    else
      await load();
  };
  const settlePastCards = async () => {
    if (!oldUnpaidCard.length) return;
    if (!window.confirm(`Marcar como pagas ${oldUnpaidCard.length} compras de cartão de meses anteriores a ${mes}? Isso atualizará os registros no Supabase. Confira antes de confirmar.`)) return;
    setSaving(true);setError('');
    try {
      const ids=oldUnpaidCard.map(x=>x.id);
      for(let i=0;i<ids.length;i+=100){
        const {error}=await supabase.from('cartao_compartilhado').update({pago:true}).in('id',ids.slice(i,i+100));
        if(error)throw error;
      }
      await load();
    }catch(e){setError(e.message)}finally{setSaving(false)}
  };
  const remove = async (x) => {
    if (isCard(x)) {
      setError('Exclua as compras compartilhadas no aplicativo Cartão da Família.');
      return;
    }
    if (!window.confirm(`Excluir ${x.descricao}?`))
      return;
    const { error } = await supabase.from(isCard(x) ? 'cartao_compartilhado' : 'transacoes').delete().eq('id', x.id);
    if (error)
      setError(error.message);
    else
      await load();
  };
  const edit = x => {
    setEditing(x);
    setForm({ tipo_movimentacao: isCard(x)?'cartao':(x.tipo_movimentacao || 'despesa'), descricao: x.descricao, valor: x.valor, data: x.data, data_vencimento: due(x), categoria: x.categoria || 'Outros', metodo_pagamento: x.metodo_pagamento || 'Boleto', periodo: x.periodo || '1º Período', conta: x.conta || 'Santander', pago: paid(x), parcelas: 1, observacoes: x.observacoes || '' });
    setTab('novo');
  };
  const saveSettings = async () => {
    setSaving(true);
    const { error } = await supabase.from('financeiro_config').upsert({ ...settings, id: 1 });
    setSaving(false);
    if (error)
      setError(error.message);
    else
      await load();
  };
  const saveLimits = async () => {
    setSaving(true);
    const rows = Object.entries(limitDraft).map(([categoria, limite]) => ({ categoria, limite: Number(limite) || 0 }));
    const { error } = await supabase.from('financeiro_limites').upsert(rows, { onConflict: 'categoria' });
    setSaving(false);
    if (error)
      setError(error.message);
    else
      await load();
  };

const CSS = `
*{box-sizing:border-box}body{margin:0}.mf-app{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;color:#20334a;background:#f3f6fb;min-height:100vh;font-size:14px}.mf-app button,.mf-app input,.mf-app select,.mf-app textarea{font:inherit}.mf-app button{cursor:pointer}.mf-shell{max-width:1230px;margin:auto;padding:30px 22px 65px}.mf-header{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:23px}.mf-eyebrow{color:#64748b;font-size:11px;font-weight:800;letter-spacing:1.7px;text-transform:uppercase}.mf-header h1{font-size:29px;letter-spacing:-1px;margin:4px 0 0;color:#10263f}.mf-month{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #e1e8f0;border-radius:13px;padding:7px 10px;box-shadow:0 3px 14px #233c6110}.mf-month button{border:0;background:#eef3f8;border-radius:8px;width:31px;height:32px;color:#38516b;font-size:20px}.mf-month input{border:0;background:transparent;padding:6px;font-weight:700;color:#20334a;min-width:143px;outline:none}.mf-nav{display:flex;gap:6px;flex-wrap:wrap;padding:7px;background:#fff;border:1px solid #e6ebf2;border-radius:15px;margin-bottom:22px;box-shadow:0 5px 22px #1b365a09}.mf-nav button{border:0;background:transparent;color:#5a6b81;padding:10px 13px;border-radius:10px;font-weight:650;font-size:13px;white-space:nowrap}.mf-nav button:hover{background:#f1f5f9}.mf-nav button.active{background:#e7f5ef;color:#0a7956}.mf-nav button.mf-add{margin-left:auto;background:#137d5d;color:white;padding:10px 18px}.mf-nav button.mf-add.active{background:#0b654a}.mf-panel{background:#fff;border:1px solid #e5eaf2;border-radius:17px;padding:23px;margin-bottom:18px;box-shadow:0 6px 28px #20385508}.mf-panel h2{font-size:18px;letter-spacing:-.35px;margin:0 0 5px;color:#142a43}.mf-panel h3{font-size:15px;margin:0 0 10px}.mf-sub{font-size:12.5px;color:#7b8a9e;line-height:1.65;margin:4px 0 16px}.mf-section-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px}.mf-section-head .mf-sub{margin-bottom:0}.mf-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-bottom:18px}.mf-metric{background:#fff;border:1px solid #e5eaf2;border-radius:16px;padding:19px;box-shadow:0 5px 22px #1b365a07;position:relative;overflow:hidden}.mf-metric:before{content:'';height:3px;position:absolute;top:0;left:0;right:0;background:#91a5c0}.mf-metric.green:before{background:#19a178}.mf-metric.red:before{background:#e97d73}.mf-metric.blue:before{background:#628eea}.mf-metric.amber:before{background:#f1b65b}.mf-metric .label{font-size:12px;color:#6d7f95;font-weight:600;min-height:31px}.mf-metric .value{font-size:clamp(20px,2vw,27px);letter-spacing:-.8px;font-weight:800;color:#162d47;margin:5px 0}.mf-metric .hint{font-size:11px;color:#94a1b2}.mf-grid2{display:grid;grid-template-columns:1.25fr 1fr;gap:18px}.mf-grid2.equal{grid-template-columns:1fr 1fr}.mf-btn{border:0;background:#137d5d;color:#fff;padding:11px 17px;border-radius:10px;font-weight:750}.mf-btn:hover{background:#0c694c}.mf-btn.secondary{background:#eef4f7;color:#33536c}.mf-btn.ghost{background:#fff;color:#38536b;border:1px solid #dfe6ef}.mf-btn.danger{color:#b83742;background:#fff0f1}.mf-btn:disabled{opacity:.55;cursor:not-allowed}.mf-btn.small{padding:7px 10px;font-size:12px}.mf-tablewrap{overflow:auto;border:1px solid #edf0f4;border-radius:12px}.mf-table{width:100%;border-collapse:collapse;min-width:710px;text-align:left}.mf-table th{font-size:11px;text-transform:uppercase;letter-spacing:.55px;color:#8b99aa;background:#f8fafc;font-weight:750;padding:14px 13px}.mf-table td{border-top:1px solid #edf0f4;padding:13px;vertical-align:middle;font-size:13px}.mf-table tr:hover td{background:#fbfcfe}.mf-desc{font-weight:700;color:#273c54}.mf-muted{font-size:11px;color:#91a0b0;margin-top:3px}.mf-money{font-weight:800;white-space:nowrap;color:#1b334b}.mf-badge{display:inline-block;padding:5px 9px;border-radius:99px;font-size:11px;font-weight:750;white-space:nowrap}.mf-badge.paid{background:#e6f7ef;color:#0e875b}.mf-badge.overdue{background:#fff0ef;color:#b84440}.mf-badge.pending{background:#fff6e5;color:#a16a11}.mf-actions{display:flex;gap:5px;flex-wrap:wrap;min-width:190px}.mf-empty{padding:25px;text-align:center;color:#8a98aa;font-size:13px}.mf-chartrow{display:flex;gap:28px;align-items:center;flex-wrap:wrap}.mf-donut{width:174px;height:174px;border-radius:50%;flex:none;display:grid;place-items:center}.mf-donut-inner{width:115px;height:115px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column}.mf-donut-inner strong{font-size:21px;color:#162e47}.mf-donut-inner small{color:#8898a8;font-size:10px}.mf-legend{flex:1;min-width:165px}.mf-legendline{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #f0f3f6;font-size:12px}.mf-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px}.mf-barline{margin-bottom:15px}.mf-barlabel{display:flex;justify-content:space-between;gap:8px;font-size:12px;margin-bottom:6px}.mf-barlabel span{color:#5d7087}.mf-barlabel strong{color:#243b53}.mf-track{height:9px;background:#eef2f7;border-radius:20px;overflow:hidden}.mf-fill{height:100%;border-radius:20px;min-width:0}.mf-info{background:#eef7f3;border:1px solid #d7eae1;border-radius:11px;padding:13px 15px;font-size:12px;color:#326451;line-height:1.6;margin-bottom:16px}.mf-warning{background:#fff5e8;border:1px solid #f9e0b8;color:#8d5c19}.mf-formhead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:20px}.mf-formgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:17px}.mf-field{display:flex;flex-direction:column;gap:7px;min-width:0}.mf-field label,.mf-field .mf-fieldlabel{font-size:12px;color:#596c83;font-weight:750}.mf-control{display:block;width:100%;min-width:0;max-width:100%;height:43px;padding:9px 11px;border:1px solid #d9e2ed;border-radius:10px;background:#fff;color:#23364d;outline:none}.mf-control:focus{border-color:#15815e;box-shadow:0 0 0 3px #17a06b1c}.mf-control.area{height:auto;min-height:88px;resize:vertical}.mf-formsection{margin:21px 0 13px;font-size:12px;font-weight:850;letter-spacing:.8px;text-transform:uppercase;color:#8291a4;border-bottom:1px solid #edf0f5;padding-bottom:10px}.mf-formactions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px;align-items:center}.mf-check{display:flex;gap:10px;align-items:center;font-weight:650;color:#39516a;font-size:13px}.mf-check input{accent-color:#147d5d;width:17px;height:17px}.mf-limitgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.mf-limit{border:1px solid #e7edf3;border-radius:13px;padding:14px;background:#fff}.mf-limit .top{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:10px}.mf-limit .top strong{font-size:13px}.mf-limit .amount{font-size:12px;color:#7b8a9b;margin-bottom:9px}.mf-limit .limitrow{display:flex;gap:8px;align-items:center;margin-top:12px}.mf-limit .limitrow label{font-size:11px;color:#8290a2;white-space:nowrap}.mf-limit .limitrow input{width:100%;min-width:0;height:36px}.mf-forecast{display:flex;gap:10px;align-items:flex-end;height:180px;margin:22px 0 9px}.mf-forecastcol{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;gap:6px}.mf-forecastbar{width:min(64px,85%);border-radius:8px 8px 3px 3px;background:linear-gradient(180deg,#5c91e9,#a8c8ff);min-height:3px}.mf-forecastcol strong{font-size:11px;color:#304b67}.mf-forecastcol span{font-size:11px;color:#7e8fa5}.mf-note{font-size:12px;color:#8a9aab;line-height:1.6}.mf-error{padding:13px 16px;background:#fff1f1;color:#a43b40;border:1px solid #ffd3d3;border-radius:12px;margin-bottom:16px;display:flex;justify-content:space-between;gap:15px;align-items:center}.mf-toplink{border:0;background:none;color:#138060;font-size:12px;font-weight:750}.mf-monthchip{background:#edf4ff;color:#35609c;padding:7px 12px;border-radius:99px;font-size:12px;font-weight:750}.mf-inlinefilters{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px}.mf-inlinefilters select{width:220px}.mf-split{display:grid;grid-template-columns:1fr 1fr;gap:13px}.mf-totalbox{background:#f6f9fc;border-radius:13px;padding:16px}.mf-totalbox span{font-size:12px;color:#72849a}.mf-totalbox strong{display:block;font-size:23px;margin-top:7px;color:#233951}.mf-highlight{background:linear-gradient(120deg,#0c6f55,#168b67);color:white;border:0}.mf-highlight h2,.mf-highlight .mf-sub{color:white}.mf-highlight .mf-sub{opacity:.85}.mf-highlight .mf-big{font-size:33px;font-weight:850;letter-spacing:-1px;margin:13px 0 8px}.mf-compact{margin-bottom:12px}.mf-compact h2{margin-bottom:0}.mf-app input[type=number]{appearance:textfield}.mf-app input::-webkit-inner-spin-button{opacity:.35}
.mf-periodgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin-bottom:20px}.mf-period-detail{display:flex;justify-content:space-between;gap:8px;font-size:12px;padding:7px 0;border-top:1px solid #edf0f4}.mf-period-detail span{color:#70839a}.mf-inlinefilters select,.mf-inlinefilters input{width:auto;flex:1 1 170px;min-width:150px}.mf-filterdates{display:flex;gap:9px;flex-wrap:wrap}.mf-filterdates label{font-size:11px;color:#64748b}.mf-filterdates input{width:160px}
.mf-centered-title{text-align:center;font-weight:850;font-size:22px;margin:0 auto!important}.mf-center-head{justify-content:center}.mf-metrics-five{grid-template-columns:repeat(5,minmax(0,1fr))}.mf-period-card .label{text-align:center;font-weight:800}.mf-period-card .value{text-align:center}.mf-period-empty{color:#94a3b8;text-align:center;padding:20px 0;font-size:12px}.mf-metric .label{font-weight:800}.mf-panel h2{font-weight:800}

/* V6: resumo mensal em quatro cartões e aviso de não pago centralizado */
.mf-metrics-summary{grid-template-columns:repeat(4,minmax(0,1fr))}
.mf-expense-summary .mf-period-detail,.mf-month-summary .mf-period-detail{margin-top:7px}
.mf-expense-summary .mf-period-detail span,.mf-month-summary .mf-period-detail span{font-weight:650}
.mf-month-summary .mf-overdue-detail strong{color:#b42318}
.mf-unpaid-pill{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:14px;padding:10px 12px;border-radius:12px;background:#fff0ef;border:1px solid #f6c7c3;color:#b42318;text-align:center;font-size:12px;font-weight:800}
.mf-unpaid-pill strong{color:#b42318;font-size:14px}
@media(max-width:950px){.mf-metrics-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.mf-metrics-summary{grid-template-columns:1fr}}

@media(max-width:1150px){.mf-metrics-five{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:1000px){.mf-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.mf-grid2,.mf-grid2.equal{grid-template-columns:1fr}.mf-limitgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:680px){.mf-metrics-five{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:680px){.mf-periodgrid{grid-template-columns:1fr}.mf-filterdates{width:100%}}
@media(max-width:680px){.mf-shell{padding:18px 12px 40px}.mf-header{align-items:flex-start;flex-direction:column}.mf-header h1{font-size:25px}.mf-nav{flex-wrap:nowrap;overflow:auto;padding:6px}.mf-nav button.mf-add{margin-left:0}.mf-panel{padding:16px}.mf-metrics{gap:9px}.mf-metric{padding:13px}.mf-metric .value{font-size:19px}.mf-formgrid{grid-template-columns:1fr}.mf-limitgrid{grid-template-columns:1fr}.mf-chartrow{justify-content:center}.mf-section-head{align-items:flex-start;flex-direction:column}.mf-split{grid-template-columns:1fr}}
`;

  const nav = [['inicio','Visão geral'],['contas','Contas'],['debito','Transferências'],['cartao','Cartão'],['planejamento','Planejamento'],['dividas','Atrasadas'],['lancamentos','Lançamentos'],['ajustes','Ajustes']];
  const go = key => { setTab(key); setError(''); };
  const formForMonth = () => ({...formInit(),data:mes+'-01',data_vencimento:mes+'-01'});
  const badge = x => <span className={'mf-badge ' + (paid(x) ? 'paid' : due(x) < today() ? 'overdue' : 'pending')}>{paid(x) ? 'Pago' : due(x) < today() ? 'Atrasado' : 'A vencer'}</span>;
  const table = (rows, actions = true) => <div className="mf-tablewrap"><table className="mf-table"><thead><tr>{['Data / vencimento','Descrição','Período','Categoria','Pagamento','Valor','Status',...(actions ? ['Ações'] : [])].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(x=><tr key={`${x.fonte}-${x.id}`}><td style={{whiteSpace:'nowrap'}}>{dateBR(due(x))}</td><td><div className="mf-desc">{x.descricao}</div>{x.parcelado && <div className="mf-muted">Parcela {x.numero_parcela}/{x.total_parcelas}</div>}</td><td>{isCard(x)?'1º Período':(x.periodo||'1º Período')}</td><td>{x.categoria||'Outros'}</td><td>{isCard(x)?'Cartão':x.metodo_pagamento||'Outros'}</td><td className="mf-money">{brl(x.valor)}</td><td>{badge(x)}</td>{actions&&<td><div className="mf-actions"><button className="mf-btn small secondary" onClick={()=>toggle(x)}>{paid(x)?'Desfazer':'Marcar pago'}</button><button className="mf-btn small ghost" onClick={()=>edit(x)}>Editar</button>{!isCard(x)&&<button className="mf-btn small danger" onClick={()=>remove(x)}>Excluir</button>}</div></td>}</tr>)}</tbody></table>{rows.length===0&&<div className="mf-empty">Nenhum lançamento encontrado neste período.</div>}</div>;
  const metric = (label, value, tone, hint) => <div className={'mf-metric '+(tone||'')}><div className="label">{label}</div><div className="value">{brl(value)}</div><div className="hint">{hint||'No mês selecionado'}</div></div>;
  const categoryColors = ['#168b69','#638de2','#f1b55d','#ed8a7e','#9b83d4','#4aa6ad','#d97db0','#92a8be'];
  const categories = byCategory.slice(0,7);
  const catTotal = categories.reduce((a,x)=>a+x.value,0);
  let offset = 0;
  const donutStops = categories.map((x,i)=>{const start=offset;offset+=catTotal?x.value/catTotal*100:0;return `${categoryColors[i%categoryColors.length]} ${start}% ${offset}%`;});
  const donutBackground = categories.length ? `conic-gradient(${donutStops.join(', ')})` : '#e8eef4';
  const categoryChart = (title,subtitle,rows,colors,centerLabel) => {
    const top=rows.slice(0,8);const total=rows.reduce((a,x)=>a+x.value,0);
    let off=0;const stops=top.map((x,i)=>{const start=off;off+=total?x.value/total*100:0;return `${colors[i%colors.length]} ${start}% ${off}%`});
    if(top.length&&off<100)stops.push(`#dfe6ee ${off}% 100%`);
    return <section className="mf-panel"><h2>{title}</h2><p className="mf-sub">{subtitle}</p>{total>0?<div className="mf-chartrow"><div className="mf-donut" style={{background:`conic-gradient(${stops.join(',')})`}}><div className="mf-donut-inner"><small>{centerLabel}</small><strong style={{fontSize:17}}>{brl(total)}</strong></div></div><div className="mf-legend">{top.map((x,i)=><div className="mf-legendline" key={x.cat}><span><i className="mf-dot" style={{background:colors[i%colors.length]}}/>{x.cat}</span><strong>{brl(x.value)}</strong></div>)}</div></div>:<div className="mf-empty">Sem gastos desse tipo no mês selecionado.</div>}</section>;
  };
  const field = (label, element) => <div className="mf-field"><span className="mf-fieldlabel">{label}</span>{element}</div>;
  const input = (key,type='text',props={}) => <input className="mf-control" type={type} value={form[key]??''} onChange={e=>set(key,e.target.value)} {...props}/>;
  const select = (key, options) => <select className="mf-control" value={form[key]} onChange={e=>set(key,e.target.value)}>{options.map(x=>typeof x==='string'?<option key={x} value={x}>{x}</option>:<option key={x[0]} value={x[0]}>{x[1]}</option>)}</select>;
  return <div className="mf-app"><style>{CSS}</style><main className="mf-shell">
    <header className="mf-header"><div><div className="mf-eyebrow">Seu dinheiro, com clareza</div><h1>Minhas Finanças</h1></div><div className="mf-month"><button aria-label="Mês anterior" onClick={()=>setMes(ym(addMonths(`${mes}-01`,-1)))}>‹</button><input type="month" aria-label="Mês selecionado" value={mes} onChange={e=>setMes(e.target.value)}/><button aria-label="Próximo mês" onClick={()=>setMes(ym(addMonths(`${mes}-01`,1)))}>›</button></div></header>
    <nav className="mf-nav">{nav.map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>go(key)}>{label}</button>)}<button className={'mf-add '+(tab==='novo'?'active':'')} onClick={()=>{setEditing(null);setForm(formForMonth());go('novo')}}>+ Novo lançamento</button></nav>
    {error&&<div role="alert" className="mf-error"><span>{error}</span><button className="mf-btn small ghost" onClick={()=>setError('')}>Fechar</button></div>}
    {loading?<section className="mf-panel"><p className="mf-sub">Carregando suas finanças...</p></section>:<>
    {tab==='inicio'&&<>
      <div className="mf-section-head"><div><h2 className="mf-centered-title">Resumo do mês</h2></div><span className="mf-monthchip">{current.length} lançamentos no mês</span></div>
      <div className="mf-metrics mf-metrics-summary">
        <div className="mf-metric green mf-expense-summary">
          <div className="label">Total de despesas</div>
          <div className="value">{brl(totalMonthlyExpenses)}</div>
          <div className="mf-period-detail"><span>Total cartão</span><strong>{brl(cardTotal)}</strong></div>
          <div className="mf-period-detail"><span>Total contas</span><strong>{brl(totalAccounts)}</strong></div>
        </div>
        {metric('Total débito',totalDebit,'green','Débito e Pix já pagos')}
        {metric('Receitas registradas',totalMonthlyIncome,'blue','Receitas do mês selecionado')}
        <div className="mf-metric amber mf-month-summary">
          <div className="label">Resumo</div>
          <div className="mf-period-detail"><span>Valor pago</span><strong>{brl(totalPaidThisMonth)}</strong></div>
          <div className="mf-period-detail"><span>Valor em aberto</span><strong>{brl(totalOpenThisMonth)}</strong></div>
          <div className="mf-period-detail mf-overdue-detail"><span>Valor em atraso</span><strong>{brl(totalOverdueThisMonth)}</strong></div>
        </div>
      </div>
      <div className="mf-section-head mf-center-head"><h2 className="mf-centered-title">Despesas por período</h2></div>
      <div className="mf-periodgrid">{periodRows.map(p=><div className="mf-metric mf-period-card" key={p.periodo}><div className="label">{p.periodo}</div>{p.total>0?<><div className="value">{brl(p.total)}</div>{p.cartao>0&&<div className="mf-period-detail"><span>Cartão</span><strong>{brl(p.cartao)}</strong></div>}{p.outros>0&&<div className="mf-period-detail"><span>Outros gastos</span><strong>{brl(p.outros)}</strong></div>}{p.pago>0&&<div className="mf-period-detail"><span>Pago</span><strong>{brl(p.pago)}</strong></div>}{p.pendente>0&&<div className="mf-unpaid-pill" role="status"><span>Não pago</span><strong>{brl(p.pendente)}</strong></div>}</>:<div className="mf-period-empty">Nenhum gasto neste período</div>}</div>)}</div>
      <div className="mf-grid2 equal">{categoryChart('Gastos do cartão','Categorias das compras do cartão no mês selecionado',cardCategories,categoryColors,'Cartão')}{categoryChart('Outros gastos','Categorias das despesas fora do cartão no mês selecionado',otherCategories,categoryColors,'Outros')}</div>

    </>}
    {tab==='contas'&&<><div className="mf-section-head"><div><h2>Contas · {monthName}</h2><p className="mf-sub">Contas do mês, pagas ou a vencer, sem cartão, débito ou Pix.</p></div></div><div className="mf-metrics" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}>{metric('Total de contas',totalAccounts,'amber')}{metric('Contas pagas',sum(accountsMonth.filter(paid)),'green')}</div><section className="mf-panel">{table([...accountsMonth].sort((a,b)=>due(a).localeCompare(due(b))))}</section></>}
    {tab==='debito'&&<><div className="mf-section-head"><div><h2>Transferências · {monthName}</h2><p className="mf-sub">Todos os registros de débito e Pix do mês, com indicação de pago ou não pago. O total considera apenas os pagos.</p></div></div><div className="mf-metrics" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}>{metric('Débito e Pix pagos',totalDebit,'green')}<div className="mf-metric blue"><div className="label">Registros de Débito e Pix</div><div className="value">{debitMonth.length}</div></div></div><section className="mf-panel">{table(debitMonth)}</section></>}
    {tab==='cartao'&&<><div className="mf-section-head"><div><h2>Cartão de crédito · {monthName}</h2><p className="mf-sub">Compras de Fernanda na tabela compartilhada; valores originais preservados.</p></div></div><div className="mf-metrics" style={{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}>{metric('Fatura do mês',cardTotal,'blue')}{metric('Compras não marcadas como pagas',sum(cardMonth.filter(x=>!paid(x))),'amber')}</div><section className="mf-panel"><div className="mf-info">Marcar as compras como pagas não reduz o saldo bancário. Registre o pagamento real da fatura apenas uma vez, como “Pagamento da fatura”.</div><button className="mf-btn" style={{marginBottom:15}} onClick={toggleCard}>{cardMonth.every(paid)?'Desmarcar fatura como paga':'Marcar fatura como paga'}</button>{table(cardMonth)}{oldUnpaidCard.length>0&&<div className="mf-info mf-warning" style={{marginTop:16}}>Há {oldUnpaidCard.length} compras de cartão anteriores a {mes} marcadas como não pagas no banco. Se você confirmou que todas estão quitadas, pode corrigir o status sem alterar os valores. <button className="mf-btn small secondary" style={{marginLeft:12}} disabled={saving} onClick={settlePastCards}>Marcar cartões anteriores como pagos</button></div>}</section></>}
    {tab==='planejamento'&&<><div className="mf-section-head"><div><h2>Planejamento financeiro</h2><p className="mf-sub">Previsão de cinco meses com base nas contas e parcelas cadastradas.</p></div></div><section className="mf-panel"><h2>Compromissos previstos</h2><p className="mf-sub">Somente valores já lançados; contas recorrentes futuras não cadastradas ficam fora da projeção.</p><div className="mf-forecast">{forecast.map(x=><div className="mf-forecastcol" key={x.mes}><strong>{brl(x.total)}</strong><div className="mf-forecastbar" style={{height:`${Math.max(4,forecast.some(z=>z.total>0)?x.total/Math.max(...forecast.map(z=>z.total))*125:4)}px`}}/><span>{new Date(Number(x.mes.slice(0,4)),Number(x.mes.slice(5,7))-1,1).toLocaleDateString('pt-BR',{month:'short'})}</span></div>)}</div><div className="mf-tablewrap"><table className="mf-table" style={{minWidth:520}}><thead><tr><th>Mês</th><th>Contas e despesas</th><th>Cartão</th><th>Compromissos</th></tr></thead><tbody>{forecast.map(x=><tr key={x.mes}><td>{x.mes}</td><td>{brl(x.contas)}</td><td>{brl(x.cartao)}</td><td className="mf-money">{brl(x.total)}</td></tr>)}</tbody></table></div></section>
      <section className="mf-panel"><div className="mf-section-head"><div><h2>Orçamento por categoria</h2><p className="mf-sub">Compare os gastos do mês com os limites que você definiu.</p></div><button className="mf-btn secondary" onClick={()=>setShowLimits(v=>!v)}>{showLimits?'Ocultar edição':'Editar limites'}</button></div><div className="mf-limitgrid">{[...new Set([...CATS,...Object.keys(limitDraft),...current.map(x=>x.categoria).filter(Boolean)])].filter(cat=>Number(limitDraft[cat]||0)>0||sum(current.filter(x=>isExpense(x)&&x.categoria===cat))>0||showLimits).map(cat=>{const limit=Number(limitDraft[cat]||0),spent=sum(current.filter(x=>isExpense(x)&&x.categoria===cat)),pct=limit>0?spent/limit*100:0;return <div className="mf-limit" key={cat}><div className="top"><strong>{cat}</strong><span className={'mf-badge '+(limit>0&&spent>limit?'overdue':'paid')}>{limit>0?Math.round(pct)+'%':'Sem limite'}</span></div><div className="amount">{brl(spent)} de {limit>0?brl(limit):'limite não definido'}</div><div className="mf-track"><div className="mf-fill" style={{width:`${Math.min(100,pct)}%`,background:limit>0&&pct>=100?'#e27772':pct>=75?'#e9b054':'#1b9b78'}}/></div>{showLimits&&<div className="limitrow"><label>Limite R$</label><input className="mf-control" type="number" min="0" step="0.01" value={limitDraft[cat]??0} onChange={e=>setLimitDraft(p=>({...p,[cat]:e.target.value}))}/></div>}</div>})}</div>{showLimits&&<button className="mf-btn" style={{marginTop:16}} onClick={saveLimits} disabled={saving}>{saving?'Salvando...':'Salvar limites'}</button>}<p className="mf-note" style={{marginTop:14}}>Os gastos exibidos consideram lançamentos do mês, inclusive despesas fixas e compras no cartão classificadas na categoria. Ajuste os limites conforme o que deseja acompanhar.</p></section>
    </>}
    {tab==='dividas'&&<><div className="mf-section-head"><div><h2>Contas atrasadas</h2><p className="mf-sub">Compromissos vencidos e ainda não pagos, inclusive de meses anteriores.</p></div></div><section className="mf-panel"><div className="mf-info mf-warning">Esta aba mostra contas vencidas registradas no aplicativo. Não representa automaticamente o saldo de dívidas negociadas ou não cadastradas.</div>{table([...overdue].sort((a,b)=>due(a).localeCompare(due(b))))}</section></>}
    {tab==='lancamentos'&&<section className="mf-panel"><div className="mf-section-head"><div><h2>Lançamentos de {monthName}</h2><p className="mf-sub">Consulte e atualize as movimentações deste mês.</p></div></div><div className="mf-inlinefilters"><select className="mf-control" value={filter} onChange={e=>setFilter(e.target.value)}><option value="todos">Todos os status</option><option value="pagar">A vencer</option><option value="atrasados">Atrasados</option><option value="pagos">Pagos</option><option value="receitas">Receitas</option><option value="transferencias">Transferências</option><option value="cartao">Cartão</option><option value="outros">Outros</option></select><select className="mf-control" value={fCategoria} onChange={e=>setFCategoria(e.target.value)}><option value="">Todas as categorias</option>{categoriesForFilter.map(c=><option key={c}>{c}</option>)}<option>Sem categoria</option></select><select className="mf-control" value={fPeriodo} onChange={e=>setFPeriodo(e.target.value)}><option value="">Todos os períodos</option>{PERIODOS.map(p=><option key={p}>{p}</option>)}</select><select className="mf-control" value={fPagamento} onChange={e=>setFPagamento(e.target.value)}><option value="">Todos os pagamentos</option><option value="cartao">Cartão</option><option value="outros">Outros</option>{METHODS.filter(x=>x!=='Cartão de Crédito').map(m=><option key={m}>{m}</option>)}</select><input className="mf-control" placeholder="Buscar descrição" value={fBusca} onChange={e=>setFBusca(e.target.value)}/><div className="mf-filterdates"><label>De <input type="date" className="mf-control" value={fInicio} onChange={e=>setFInicio(e.target.value)}/></label><label>Até <input type="date" className="mf-control" value={fFim} onChange={e=>setFFim(e.target.value)}/></label></div><button className="mf-btn small ghost" onClick={()=>{setFilter('todos');setFCategoria('');setFPeriodo('');setFPagamento('');setFBusca('');setFInicio('');setFFim('')}}>Limpar filtros</button></div><div className="mf-note" style={{marginBottom:12}}>{applyFilters(current).length} de {current.length} lançamentos neste mês</div>{table(applyFilters(current).sort((a,b)=>due(b).localeCompare(due(a))))}</section>}
    {tab==='novo'&&<section className="mf-panel"><div className="mf-formhead"><div><h2>{editing?'Editar lançamento':'Novo lançamento'}</h2><p className="mf-sub">Preencha os dados abaixo. Os campos se adaptam ao tamanho da tela.</p></div><button className="mf-btn ghost" onClick={()=>go('lancamentos')}>Voltar</button></div><form onSubmit={save}><div className="mf-formsection">Informações principais</div><div className="mf-formgrid">{field('Tipo de movimentação',select('tipo_movimentacao',[['despesa','Despesa / conta a pagar'],['cartao','Compra no cartão'],['receita','Receita'],['transferencia','Transferência'],['pagamento_fatura','Pagamento da fatura']]))}{field('Descrição',input('descricao','text',{required:true,placeholder:'Ex.: Conta de energia'}))}{field('Valor total (R$)',input('valor','number',{required:true,min:'0.01',step:'0.01',placeholder:'0,00'}))}{field('Data do lançamento',input('data','date',{required:true}))}{field('Data de vencimento',input('data_vencimento','date',{required:true}))}{field('Categoria',select('categoria',[...new Set([...CATS,...items.map(x=>x.categoria).filter(Boolean)])]))}</div>{form.tipo_movimentacao==='cartao'&&<div className="mf-info">A compra será cadastrada na tabela compartilhada do cartão com responsável Fernanda. Por padrão, ela entra no 1º Período. O pagamento da fatura não deve ser lançado novamente como despesa de consumo.</div>}<div className="mf-formsection">Pagamento e organização</div><div className="mf-formgrid">{form.tipo_movimentacao!=='cartao'&&field('Forma de pagamento',select('metodo_pagamento',METHODS))}{field('Conta / origem',input('conta','text',{placeholder:'Ex.: Santander'}))}{form.tipo_movimentacao!=='cartao'&&field('Período',select('periodo',PERIODOS))}{!editing&&field('Número de parcelas',input('parcelas','number',{min:1,max:120}))}</div><div style={{marginTop:18}}><label className="mf-check"><input type="checkbox" checked={!!form.pago} onChange={e=>set('pago',e.target.checked)}/>{form.tipo_movimentacao==='receita'?'Já recebi':'Já foi pago'}</label></div><div style={{marginTop:20}}>{field('Observações',<textarea className="mf-control area" value={form.observacoes} onChange={e=>set('observacoes',e.target.value)} placeholder="Opcional"/>)}</div><div className="mf-formactions"><button className="mf-btn" type="submit" disabled={saving}>{saving?'Salvando...':editing?'Salvar alterações':'Salvar lançamento'}</button>{editing&&<button className="mf-btn ghost" type="button" onClick={()=>{setEditing(null);setForm(formForMonth());go('lancamentos')}}>Cancelar</button>}</div></form></section>}
    {tab==='ajustes'&&<section className="mf-panel"><h2>Ajustes e saldos</h2><p className="mf-sub">Os saldos são opcionais. O painel principal sempre mostra apenas os valores do mês selecionado.</p><div className="mf-formgrid">{[['saldo_inicial','Saldo bancário na data-base'],['saldo_data','Data-base'],['vale_saldo','Saldo do vale-alimentação'],['receita_dia5','Receita prevista dia 5'],['receita_dia20','Receita prevista dia 20'],['vale_mensal','Vale previsto mensalmente']].map(([k,label])=><div className="mf-field" key={k}><span className="mf-fieldlabel">{label}</span><input className="mf-control" type={k==='saldo_data'?'date':'number'} step="0.01" value={settings[k]??''} onChange={e=>setSettings(p=>({...p,[k]:k==='saldo_data'?e.target.value:Number(e.target.value)}))}/></div>)}</div><div className="mf-formactions"><button className="mf-btn" onClick={saveSettings} disabled={saving}>Salvar ajustes</button></div><p className="mf-note">Receitas previstas não são lançadas automaticamente como dinheiro recebido. Cadastre os recebimentos reais para evitar contagem duplicada.</p></section>}
    </>}
  </main></div>;
}
