migrate(
  (app) => {
    // 1. Coleção 'empresas'
    const empresasCol = new Collection({
      name: 'empresas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text' },
        { name: 'cnpj', type: 'text' },
        { name: 'regime_trib', type: 'text' },
        { name: 'ramo_atividade', type: 'text' },
        { name: 'filial', type: 'text' },
        { name: 'grupo', type: 'text' },
        { name: 'cliente_desde', type: 'text' },
        { name: 'zona', type: 'text' },
        { name: 'contabil', type: 'text' },
        { name: 'num_func', type: 'text' },
        { name: 'peso_folha', type: 'text' },
        { name: 'peso_fiscal', type: 'text' },
        { name: 'receitas', type: 'text' },
        { name: 'desp_custos', type: 'text' },
        { name: 'envia_sped', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'lkn', type: 'text' },
        { name: 'EMPRESAS', type: 'text' },
        { name: 'CNPJ', type: 'text' },
        { name: 'REGIME_TRIB', type: 'text' },
        { name: 'RAMO_ATIVIDADE_2', type: 'text' },
        { name: 'FILIAL', type: 'text' },
        { name: 'GRUPO', type: 'text' },
        { name: 'CLIENTE_DESDE', type: 'text' },
        { name: 'ZONA', type: 'text' },
        { name: 'CONTABIL', type: 'text' },
        { name: 'NUM_FUNC', type: 'number' },
        { name: 'PESO_FOLHA', type: 'number' },
        { name: 'PESO_FISCAL', type: 'number' },
        { name: 'RECEITAS', type: 'number' },
        { name: 'DESP_CUSTOS', type: 'number' },
        { name: 'ENVIA_SPED', type: 'text' },
        { name: 'OBSERVACOES', type: 'text' },
        { name: 'LNK', type: 'text' },
        { name: 'empresas', type: 'text' },
        { name: 'regimeTrib', type: 'text' },
        { name: 'ramoAtividade', type: 'text' },
        { name: 'entrada', type: 'text' },
        { name: 'numFunc', type: 'number' },
        { name: 'pesoFolha', type: 'number' },
        { name: 'pesoFiscal', type: 'number' },
        { name: 'despCustos', type: 'number' },
        { name: 'enviaSped', type: 'text' },
        { name: 'isManual', type: 'bool' },
        { name: 'customFields', type: 'json' },
        { name: 'custom_columns', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(empresasCol)

    // 2. Coleção 'dpto_pessoal'
    const dptoPessoalCol = new Collection({
      name: 'dpto_pessoal',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text' },
        { name: 'cnpj', type: 'text' },
        { name: 'zona', type: 'text' },
        { name: 'num_func', type: 'text' },
        { name: 'EMPRESAS', type: 'text' },
        { name: 'CNPJ', type: 'text' },
        { name: 'ZONA', type: 'text' },
        { name: 'NUM_FUNC', type: 'number' },
        { name: 'empresa', type: 'text' },
        { name: 'numFunc', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(dptoPessoalCol)

    // 3. Coleção 'dpto_fiscal'
    const dptoFiscalCol = new Collection({
      name: 'dpto_fiscal',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text' },
        { name: 'cnpj', type: 'text' },
        { name: 'zona', type: 'text' },
        { name: 'peso', type: 'text' },
        { name: 'EMPRESAS', type: 'text' },
        { name: 'CNPJ', type: 'text' },
        { name: 'ZONA', type: 'text' },
        { name: 'PESO', type: 'number' },
        { name: 'empresa', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(dptoFiscalCol)

    // 4. Coleção 'dpto_contabil'
    const dptoContabilCol = new Collection({
      name: 'dpto_contabil',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'nome', type: 'text' },
        { name: 'cnpj', type: 'text' },
        { name: 'zona', type: 'text' },
        { name: 'contabil', type: 'text' },
        { name: 'EMPRESAS', type: 'text' },
        { name: 'CNPJ', type: 'text' },
        { name: 'ZONA', type: 'text' },
        { name: 'CONTABIL', type: 'text' },
        { name: 'empresa', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(dptoContabilCol)
  },
  (app) => {
    try {
      const col4 = app.findCollectionByNameOrId('dpto_contabil')
      app.delete(col4)
    } catch (_) {}

    try {
      const col3 = app.findCollectionByNameOrId('dpto_fiscal')
      app.delete(col3)
    } catch (_) {}

    try {
      const col2 = app.findCollectionByNameOrId('dpto_pessoal')
      app.delete(col2)
    } catch (_) {}

    try {
      const col1 = app.findCollectionByNameOrId('empresas')
      app.delete(col1)
    } catch (_) {}
  },
)
