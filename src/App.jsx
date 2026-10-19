                  {['Mês', 'Contas e outras despesas', 'Cartão', 'Total previsto'].map(x => <th key={x} style={style.td}>{x}</th>)}</tr>
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
