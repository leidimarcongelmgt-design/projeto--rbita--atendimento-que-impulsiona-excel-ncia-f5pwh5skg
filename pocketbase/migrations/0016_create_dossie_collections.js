migrate(
  (app) => {
    function ensureCollection(name, fieldDefs) {
      if (!app.hasTable(name)) {
        const col = new Collection({
          name: name,
          type: 'base',
          listRule: "@request.auth.id != ''",
          viewRule: "@request.auth.id != ''",
          createRule: "@request.auth.id != ''",
          updateRule: "@request.auth.id != ''",
          deleteRule: "@request.auth.id != ''",
          fields: fieldDefs,
        })
        app.save(col)
        return
      }

      // Coleção já existe: adiciona campos faltantes de forma idempotente
      const col = app.findCollectionByNameOrId(name)
      let needsSave = false

      if (!col.listRule) {
        col.listRule = "@request.auth.id != ''"
        needsSave = true
      }
      if (!col.viewRule) {
        col.viewRule = "@request.auth.id != ''"
        needsSave = true
      }
      if (!col.createRule) {
        col.createRule = "@request.auth.id != ''"
        needsSave = true
      }
      if (!col.updateRule) {
        col.updateRule = "@request.auth.id != ''"
        needsSave = true
      }
      if (!col.deleteRule) {
        col.deleteRule = "@request.auth.id != ''"
        needsSave = true
      }

      for (let i = 0; i < fieldDefs.length; i++) {
        const f = fieldDefs[i]
        if (!col.fields.getByName(f.name)) {
          switch (f.type) {
            case 'text':
              col.fields.add(new TextField({ name: f.name }))
              break
            case 'number':
              col.fields.add(new NumberField({ name: f.name }))
              break
            case 'bool':
              col.fields.add(new BoolField({ name: f.name }))
              break
            case 'json':
              col.fields.add(new JSONField({ name: f.name }))
              break
            case 'autodate':
              col.fields.add(
                new AutodateField({
                  name: f.name,
                  onCreate: Boolean(f.onCreate),
                  onUpdate: Boolean(f.onUpdate),
                }),
              )
              break
            default:
              break
          }
          needsSave = true
        }
      }

      if (needsSave) {
        app.save(col)
      }
    }

    // 1. Coleção 'empresas'
    ensureCollection('empresas', [
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
      { name: 'lnk', type: 'text' },
      { name: 'is_manual', type: 'bool' },
      { name: 'isManual', type: 'bool' },
      { name: 'custom_columns', type: 'json' },
      { name: 'customFields', type: 'json' },
      { name: 'ordem', type: 'number' },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ])

    // 2. Coleção 'dpto_pessoal'
    ensureCollection('dpto_pessoal', [
      { name: 'nome', type: 'text' },
      { name: 'empresa', type: 'text' },
      { name: 'cnpj', type: 'text' },
      { name: 'zona', type: 'text' },
      { name: 'num_func', type: 'text' },
      { name: 'ordem', type: 'number' },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ])

    // 3. Coleção 'dpto_fiscal'
    ensureCollection('dpto_fiscal', [
      { name: 'nome', type: 'text' },
      { name: 'empresa', type: 'text' },
      { name: 'cnpj', type: 'text' },
      { name: 'zona', type: 'text' },
      { name: 'peso', type: 'text' },
      { name: 'ordem', type: 'number' },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ])

    // 4. Coleção 'dpto_contabil'
    ensureCollection('dpto_contabil', [
      { name: 'nome', type: 'text' },
      { name: 'empresa', type: 'text' },
      { name: 'cnpj', type: 'text' },
      { name: 'zona', type: 'text' },
      { name: 'contabil', type: 'text' },
      { name: 'ordem', type: 'number' },
      { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
    ])
  },
  (app) => {
    if (app.hasTable('dpto_contabil')) {
      try {
        const c = app.findCollectionByNameOrId('dpto_contabil')
        app.delete(c)
      } catch (_) {}
    }
    if (app.hasTable('dpto_fiscal')) {
      try {
        const c = app.findCollectionByNameOrId('dpto_fiscal')
        app.delete(c)
      } catch (_) {}
    }
    if (app.hasTable('dpto_pessoal')) {
      try {
        const c = app.findCollectionByNameOrId('dpto_pessoal')
        app.delete(c)
      } catch (_) {}
    }
    if (app.hasTable('empresas')) {
      try {
        const c = app.findCollectionByNameOrId('empresas')
        app.delete(c)
      } catch (_) {}
    }
  },
)
