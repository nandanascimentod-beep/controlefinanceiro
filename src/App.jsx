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
  const [limitDraft, setLimitDraft] = useState(DEFAULT_LIMITS);
  const [settings, setSettings] = useState({ saldo_inicial: 0, saldo_data: today(), vale_saldo: 0, receita_dia5: 6000, receita_dia20: 4200, vale_mensal: 1200 });
  const [saving, setSaving] = useState(false);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [a, b, c, d] = await Promise.all([supabase.from('transacoes').select('*').order('data', { ascending: false }).limit(10000), supabase.from('cartao_compartilhado').select('*').eq('responsavel', 'Fernanda').order('data', { ascending: false }).limit(10000), supabase.from('financeiro_config').select('*').eq('id', 1).maybeSingle(), supabase.from('financeiro_limites').select('*')]);
      if (a.error || b.error)
        throw new Error([a.error, b.error].filter(Boolean).map(x => x.message).join(' / '));
      if (c.error || d.error)
        setError('Os lançamentos carregaram, mas Ajustes/Limites exigem políticas RLS no Supabase: ' + [c.error, d.error].filter(Boolean).map(x => x.message).join(' / '));
      const personal = (a.data || []).filter(x => !['Cartão de Crédito'].includes(x.metodo_pagamento)).map(x => ({ ...x, fonte: 'transacoes', tipo_movimentacao: x.tipo_movimentacao || 'despesa' }));
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
  const bills = useMemo(() => items.filter(x => isExpense(x) && !isCard(x) && !paid(x) && due(x) <= `${mes}-31`), [items, mes]);
  const overdue = useMemo(() => items.filter(x => isExpense(x) && !isCard(x) && !paid(x) && due(x) < today()), [items]);
  const cardMonth = current.filter(isCard), debitMonth = current.filter(x => isCashPayment(x) && paid(x));
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
  const remaining = num(balance - sum(items.filter(x => isExpense(x) && !paid(x) && due(x) <= `${mes}-31`)));
  const monthExpense = sum(expenses), monthPaid = sum(expenses.filter(paid));
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
      if (!form.data || !form.data_vencimento)
        throw new Error('Preencha as datas.');
      const group = editing?.grupo_parcelamento || uid();
      const cents = Math.round(Number(form.valor) * 100);
      const base = Math.floor(cents / n);
      const rows = Array.from({ length: n }, (_, i) => { const date = addMonths(form.data, i); const venc = addMonths(form.data_vencimento || form.data, i); const value = (base + (i < cents % n ? 1 : 0)) / 100; return { descricao: form.descricao.trim(), valor: value, data: date, data_vencimento: venc, mes_referente: ym(venc), categoria: form.categoria, metodo_pagamento: form.metodo_pagamento, periodo: form.periodo, conta: form.conta, pago: !!form.pago && i === 0, data_pagamento: form.pago && i === 0 ? date : null, tipo_movimentacao: form.tipo_movimentacao, observacoes: form.observacoes, parcelado: n > 1, numero_parcela: i + 1, total_parcelas: n, grupo_parcelamento: n > 1 ? group : null }; });
      if (editing) {
        const { error } = await supabase.from('transacoes').update({ ...rows[0], parcelado: editing.parcelado, numero_parcela: editing.numero_parcela, total_parcelas: editing.total_parcelas, grupo_parcelamento: editing.grupo_parcelamento }).eq('id', editing.id);
        if (error)
          throw error;
      }
      else {
        const { error } = await supabase.from('transacoes').insert(rows);
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
    if (isCard(x)) {
      setError('Para alterar uma compra do cartão, edite-a no aplicativo Cartão da Família. Aqui você pode marcar o pagamento.');
      return;
    }
    setEditing(x);
    setForm({ tipo_movimentacao: x.tipo_movimentacao || 'despesa', descricao: x.descricao, valor: x.valor, data: x.data, data_vencimento: due(x), categoria: x.categoria || 'Outros', metodo_pagamento: x.metodo_pagamento || 'Boleto', periodo: x.periodo || '1º Período', conta: x.conta || 'Santander', pago: paid(x), parcelas: 1, observacoes: x.observacoes || '' });
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
  const nav = [['inicio', 'Início'], ['contas', 'Contas a pagar'], ['debito', 'Pagos no débito'], ['cartao', 'Cartão'], ['planejamento', 'Planejamento'], ['dividas', 'Dívidas'], ['lancamentos', 'Lançamentos'], ['novo', editing ? 'Editar' : 'Novo +'], ['ajustes', 'Ajustes']];
  const table = (rows, actions = true) => <div style={{ overflowX: 'auto' }}>
    <table style={style.table}>
      <thead>
        <tr>
          {['Vencimento', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Situação', ...(actions ? ['Ações'] : [])].map(h => <th key={h} style={{ ...style.td, color: '#667085' }}>{h}</th>)}</tr>
      </thead>
      <tbody>{rows.map(x => <tr key={`${x.fonte}-${x.id}`}>
        <td style={style.td}>{dateBR(due(x))}</td>
        <td style={style.td}>
          <strong>{x.descricao}</strong>{x.parcelado && <div style={{ fontSize: 11, color: '#667085' }}>{x.numero_parcela}/{x.total_parcelas}</div>}</td>
        <td style={style.td}>{x.categoria || 'Sem categoria'}</td>
        <td style={style.td}>{isCard(x) ? 'Cartão' : x.metodo_pagamento || 'Outros'}</td>
        <td style={{ ...style.td, fontWeight: 700, whiteSpace: 'nowrap' }}>{brl(x.valor)}</td>
        <td style={style.td}>
          <span style={{ ...style.pill, background: paid(x) ? '#E3F5EA' : due(x) < today() ? '#FDE8E8' : '#FFF2D6', color: paid(x) ? '#11673C' : due(x) < today() ? '#A52626' : '#985C05' }}>{paid(x) ? 'Pago' : due(x) < today() ? 'Vencido' : 'A pagar'}</span>
        </td>{actions && <td style={{ ...style.td, whiteSpace: 'nowrap' }}>
          <button style={style.secondary} onClick={() => toggle(x)}>{paid(x) ? 'Desfazer' : 'Pagar'}</button>
          {!isCard(x) && <button style={{ ...style.secondary, marginLeft: 4 }} onClick={() => edit(x)}>Editar</button>}{!isCard(x) && <button style={{ ...style.secondary, marginLeft: 4, color: '#C43232' }} onClick={() => remove(x)}>Excluir</button>}</td>}</tr>)}</tbody>
    </table>
    {!rows.length && <Empty>Nenhum lançamento encontrado.</Empty>}</div>;
  return <div style={style.page}>
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
      <div>
        <div style={{ color: '#168157', fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>CONTROLE FINANCEIRO FAMILIAR</div>
        <h1 style={{ fontSize: 26, margin: '4px 0' }}>Minhas Finanças</h1>
      </div>
      <input aria-label="Mês de referência" type="month" value={mes} onChange={e => setMes(e.target.value)} style={{ ...style.input, width: 170 }} />
    </header>
    <nav style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 18 }}>
      {nav.map(([key, label]) => <button key={key} style={{ ...style.secondary, ...(tab === key ? { background: '#147D52', color: '#fff', borderColor: '#147D52' } : {}) }} onClick={() => {
        if (key === 'novo' && !editing)
          setForm(formInit());
        setTab(key);
      }}>{label}</button>)}</nav>
    {error && <div role="alert" style={{ ...style.panel, borderColor: '#EF9A9A', color: '#A52626' }}>
      {error}<button style={{ ...style.secondary, marginLeft: 12 }} onClick={() => setError('')}>Fechar</button>
    </div>}
    {loading ? <Empty>Carregando dados...</Empty> : <>
      {tab === 'inicio' && <>
        <div style={style.grid}>
          <Stat label="Saldo bancário estimado" value={balance} hint="A partir do saldo-base e movimentações registradas" />
          <Stat label="Contas em aberto até o fim do mês" value={sum(items.filter(x => isExpense(x) && !paid(x) && due(x) <= `${mes}-31`))} negative />
          <Stat label="Disponível após contas" value={remaining} negative={remaining < 0} />
          <Stat label="Vale-alimentação informado" value={settings.vale_saldo} hint="Saldo manual, não somado ao dinheiro" />
        </div>
        <div style={{ ...style.panel, marginTop: 14 }}>
          <h2>Resumo de {mes}</h2>
          <div style={style.grid}>
            <Stat label="Despesas previstas" value={monthExpense} />
            <Stat label="Despesas marcadas como pagas" value={monthPaid} />
            <Stat label="Contas a pagar neste mês" value={sum(pendingThisMonth)} negative />
            <Stat label="Receitas lançadas no mês" value={sum(incomes)} />
          </div>
        </div>
        <div style={style.grid}>
          <section style={style.panel}>
            <h3>Contas atrasadas</h3>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#C43232' }}>{brl(sum(overdue))}</div>
            <p style={{ fontSize: 12, color: '#667085' }}>{overdue.length} lançamentos vencidos e não pagos, inclusive de meses anteriores.</p>
            <button style={style.button} onClick={() => setTab('dividas')}>Ver atrasos</button>
          </section>
          <section style={style.panel}>
            <h3>Maiores categorias do mês</h3>{byCategory.slice(0, 6).map(x => <div key={x.cat} style={{ display: 'flex', justifyContent: 'space-between', margin: '8px 0', gap: 8 }}>
              <span>{x.cat}</span>
              <strong>{brl(x.value)}</strong>
            </div>)}</section>
        </div>
      </>}
      {tab === 'contas' && <section style={style.panel}>
        <h2>Contas a pagar</h2>
        <p style={{ color: '#667085', fontSize: 13 }}>Contas não pagas até o fim de {mes}, inclusive atrasos anteriores. Compras individuais do cartão aparecem na aba Cartão, para não duplicar a fatura.</p>
        <div style={style.grid}>
          <Stat label="Em aberto (sem compras do cartão)" value={sum(bills)} negative />
          <Stat label="Vencidas (todas as fontes)" value={sum(overdue)} negative />
        </div>
        <div style={{ marginTop: 12, padding: 12, background: '#F0F7F3', borderRadius: 10 }}>
          <strong>Fatura do cartão de {mes}: {brl(sum(cardMonth))}</strong>
          <p style={{ fontSize: 12, margin: '5px 0' }}>A fatura fica separada dos boletos abaixo. Consulte e marque seu pagamento na aba Cartão; registre a saída bancária como Pagamento da fatura para conciliar o saldo.</p>
          <button style={style.secondary} onClick={() => setTab('cartao')}>Ver fatura</button>
        </div>
        <div style={{ marginTop: 14 }}>
          {table(bills.sort((a, b) => due(a).localeCompare(due(b))))}</div>
      </section>}
      {tab === 'debito' && <section style={style.panel}>
        <h2>Pagos no débito / Pix / dinheiro</h2>
        <p style={{ color: '#667085', fontSize: 13 }}>Somente despesas efetivamente pagas. Não inclui boletos pendentes nem compras do cartão. Transferências entre contas não são despesas.</p>
        <Stat label="Total pago no mês" value={sum(debitMonth)} />
        <div style={{ marginTop: 14 }}>
          {table(debitMonth)}</div>
      </section>}
      {tab === 'cartao' && <section style={style.panel}>
        <h2>Fatura do cartão — {mes}</h2>
        <p style={{ color: '#667085', fontSize: 13 }}>Compras da tabela compartilhada, responsável Fernanda. Marcar as compras como pagas é um controle da fatura, não uma saída bancária. Para conciliar o saldo, registre uma única movimentação do tipo Pagamento da fatura.</p>
        <div style={style.grid}>
          <Stat label="Fatura conhecida" value={sum(cardMonth)} />
          <Stat label="Compras ainda não marcadas como pagas" value={sum(cardMonth.filter(x => !paid(x)))} negative />
        </div>
        <button style={{ ...style.button, margin: '14px 0' }} onClick={toggleCard}>
          {cardMonth.every(paid) ? 'Desmarcar fatura como paga' : 'Marcar fatura como paga'}</button>
        {table(cardMonth)}</section>}
      {tab === 'planejamento' && <>
        <section style={style.panel}>
          <h2>Projeção de parcelas e contas cadastradas</h2>
          <p style={{ color: '#667085', fontSize: 13 }}>Inclui apenas lançamentos que já existem no banco. Não gera automaticamente despesas recorrentes que ainda não foram cadastradas.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={style.table}>
              <thead>
                <tr>
                  <th style={style.td}>Mês</th>
                  <th style={style.td}>Contas e outras despesas</th>
                  <th style={style.td}>Cartão</th>
                  <th style={style.td}>Total previsto</th>
                </tr>
              </thead>
              <tbody>{forecast.map(x => <tr key={x.mes}>
                <td style={style.td}>{x.mes}</td>
                <td style={style.td}>{brl(x.contas)}</td>
                <td style={style.td}>{brl(x.cartao)}</td>
                <td style={{ ...style.td, fontWeight: 800 }}>{brl(x.total)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </section>
        <section style={style.panel}>
          <h2>Limites por categoria</h2>
          <div style={style.grid}>
            {Object.entries(limitDraft).map(([cat, limit]) => {
              const spent = sum(current.filter(x => isExpense(x) && x.categoria === cat));
              const pct = limit > 0 ? spent / limit * 100 : 0;
              return <div key={cat} style={{ padding: 12, border: '1px solid #EAECF0', borderRadius: 10 }}>
                <strong>{cat}</strong>
                <div style={{ fontSize: 13, marginTop: 5 }}>{brl(spent)} / {brl(limit)}</div>
                <div style={{ height: 8, background: '#EAECF0', borderRadius: 8, overflow: 'hidden', margin: '8px 0' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: pct >= 100 ? '#C43232' : pct >= 70 ? '#E5A434' : '#168157' }} />
                </div>
                <input aria-label={`Limite ${cat}`} type="number" min="0" step="0.01" value={limit} style={style.input} onChange={e => setLimitDraft(p => ({ ...p, [cat]: e.target.value }))} />
              </div>;
            })}</div>
          <button style={{ ...style.button, marginTop: 12 }} onClick={saveLimits} disabled={saving}>Salvar limites</button>
        </section>
      </>}
      {tab === 'dividas' && <section style={style.panel}>
        <h2>Contas vencidas e dívidas</h2>
        <p style={{ color: '#667085', fontSize: 13 }}>Lista automática dos compromissos vencidos não pagos. Cadastre dívidas antigas como lançamentos com vencimento original; acordos devem ser cadastrados separadamente, evitando contar o valor original e o acordo como duas dívidas exigíveis.</p>
        <Stat label="Atrasos identificados" value={sum(overdue)} negative />
        <div style={{ marginTop: 14 }}>
          {table(overdue.sort((a, b) => due(a).localeCompare(due(b))))}</div>
      </section>}
      {tab === 'lancamentos' && <section style={style.panel}>
        <h2>Todos os lançamentos de {mes}</h2>
        <div style={{ maxWidth: 270, marginBottom: 12 }}>
          <select aria-label="Filtrar lançamentos" style={style.input} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="pagar">Contas a pagar</option>
            <option value="pagos">Pagos</option>
            <option value="receitas">Receitas</option>
            <option value="transferencias">Transferências</option>
            <option value="cartao">Cartão</option>
          </select>
        </div>
        {table(current.filter(x => filter === 'todos' || (filter === 'pagar' && isExpense(x) && !paid(x)) || (filter === 'pagos' && isExpense(x) && paid(x)) || (filter === 'receitas' && isIncome(x)) || (filter === 'transferencias' && isTransfer(x)) || (filter === 'cartao' && isCard(x))).sort((a, b) => due(b).localeCompare(due(a))))}</section>}
      {tab === 'novo' && <section style={{ ...style.panel, maxWidth: 780 }}>
        <h2>
          {editing ? 'Editar lançamento' : 'Novo lançamento'}</h2>
        <form onSubmit={save}>
          <div style={style.grid}>
            <Field label="Tipo de movimentação">
              <select style={style.input} value={form.tipo_movimentacao} onChange={e => set('tipo_movimentacao', e.target.value)}>
                <option value="despesa">Despesa / conta a pagar</option>
                <option value="receita">Receita</option>
                <option value="transferencia">Transferência entre contas</option>
                <option value="pagamento_fatura">Pagamento da fatura (fluxo de caixa)</option>
              </select>
            </Field>
            <Field label="Descrição">
              <input style={style.input} required value={form.descricao} onChange={e => set('descricao', e.target.value)} />
            </Field>
            <Field label="Valor total (R$)">
              <input style={style.input} required type="number" step="0.01" min="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} />
            </Field>
            <Field label="Data da movimentação">
              <input style={style.input} type="date" required value={form.data} onChange={e => set('data', e.target.value)} />
            </Field>
            <Field label="Vencimento">
              <input style={style.input} type="date" required value={form.data_vencimento} onChange={e => set('data_vencimento', e.target.value)} />
            </Field>
            <Field label="Categoria (inclui Moto, Trabalho, Casa e Leticia)">
              <select style={style.input} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {[...new Set([...CATS, ...items.map(x => x.categoria).filter(Boolean)])].map(c => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field label="Forma de pagamento">
              <select style={style.input} value={form.metodo_pagamento} onChange={e => set('metodo_pagamento', e.target.value)}>{METHODS.map(m => <option key={m}>{m}</option>)}</select>
            </Field>
            <Field label="Conta / origem">
              <input style={style.input} value={form.conta} onChange={e => set('conta', e.target.value)} placeholder="Santander, Nubank, Vale..." />
            </Field>
            <Field label="Período">
              <select style={style.input} value={form.periodo} onChange={e => set('periodo', e.target.value)}>{PERIODOS.map(p => <option key={p}>{p}</option>)}</select>
            </Field>
            {!editing && <Field label="Parcelas (1 = à vista)">
              <input style={style.input} type="number" min="1" max="120" value={form.parcelas} onChange={e => set('parcelas', e.target.value)} />
            </Field>}</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 15 }}>
            <input type="checkbox" checked={form.pago} onChange={e => set('pago', e.target.checked)} /> Já foi pago / recebido</label>
          <Field label="Observações">
            <textarea style={{ ...style.input, marginTop: 8 }} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} />
          </Field>
          <div style={{ display: 'flex', gap: 8, marginTop: 15 }}>
            <button style={style.button} type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar lançamento'}</button>
            {editing && <button style={style.secondary} type="button" onClick={() => { setEditing(null); setForm(formInit()); setTab('lancamentos'); }}>Cancelar</button>}</div>
        </form>
      </section>}
      {tab === 'ajustes' && <section style={{ ...style.panel, maxWidth: 750 }}>
        <h2>Configuração de saldos e receitas</h2>
        <p style={{ color: '#667085', fontSize: 13 }}>O saldo bancário é calculado a partir de um saldo-base informado por você. Configure uma data inicial e evite registrar novamente movimentações anteriores a essa data.</p>
        <div style={style.grid}>
          {[['saldo_inicial', 'Saldo bancário na data-base'], ['saldo_data', 'Data-base'], ['vale_saldo', 'Saldo atual do vale-alimentação'], ['receita_dia5', 'Receita prevista dia 5'], ['receita_dia20', 'Receita prevista dia 20'], ['vale_mensal', 'Vale previsto mensalmente']].map(([k, label]) => <Field key={k} label={label}>
            <input style={style.input} type={k === 'saldo_data' ? 'date' : 'number'} step="0.01" value={settings[k] ?? ''} onChange={e => setSettings(p => ({ ...p, [k]: k === 'saldo_data' ? e.target.value : Number(e.target.value) }))} />
          </Field>)}</div>
        <button style={{ ...style.button, marginTop: 14 }} onClick={saveSettings} disabled={saving}>Salvar configurações</button>
        <p style={{ color: '#667085', fontSize: 12 }}>Importante: receitas previstas não são adicionadas automaticamente ao saldo. Registre o recebimento real na aba Novo para evitar dupla contagem.</p>
      </section>}
    </>}
  </div>;
}
