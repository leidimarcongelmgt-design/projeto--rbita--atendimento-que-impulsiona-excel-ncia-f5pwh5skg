migrate(
  (app) => {
    const collections = ['empresas', 'dpto_pessoal', 'dpto_fiscal', 'dpto_contabil']

    function scoreRecord(colName, rec) {
      let score = 0

      // Pontua campos específicos de cada coleção
      if (colName === 'empresas') {
        const checkFields = [
          'regime_trib',
          'ramo_atividade',
          'filial',
          'grupo',
          'cliente_desde',
          'zona',
          'contabil',
          'num_func',
          'peso_folha',
          'peso_fiscal',
          'receitas',
          'desp_custos',
          'envia_sped',
          'observacoes',
          'lnk',
          'lkn',
        ]
        for (let i = 0; i < checkFields.length; i++) {
          const val = (rec.getString(checkFields[i]) || '').trim()
          if (val.length > 0 && val !== '0') {
            score += 10
          }
        }
        try {
          const cf = rec.get('customFields') || rec.get('custom_columns')
          if (cf && typeof cf === 'object' && Object.keys(cf).length > 0) {
            score += 20
          }
        } catch (_) {}
      } else if (colName === 'dpto_contabil') {
        const contabilVal = (rec.getString('contabil') || '').trim()
        if (contabilVal.length > 0) score += 20
        const zonaVal = (rec.getString('zona') || '').trim()
        if (zonaVal.length > 0) score += 10
      } else if (colName === 'dpto_fiscal') {
        const pesoVal = (rec.getString('peso') || '').trim()
        if (pesoVal.length > 0) score += 20
        const zonaVal = (rec.getString('zona') || '').trim()
        if (zonaVal.length > 0) score += 10
      } else if (colName === 'dpto_pessoal') {
        const numFuncVal = (rec.getString('num_func') || '').trim()
        if (numFuncVal.length > 0) score += 20
        const zonaVal = (rec.getString('zona') || '').trim()
        if (zonaVal.length > 0) score += 10
      }

      // Se tiver nome não vazio
      const nomeVal = (rec.getString('nome') || rec.getString('empresa') || '').trim()
      if (nomeVal.length > 0) score += 5

      // Se tiver cnpj não vazio
      const cnpjVal = (rec.getString('cnpj') || '').trim()
      if (cnpjVal.length > 0) score += 5

      return score
    }

    function normalizeName(str) {
      if (!str) return ''
      return str
        .toLowerCase()
        .trim()
        .replace(/[áàâãä]/g, 'a')
        .replace(/[éèêë]/g, 'e')
        .replace(/[íìîï]/g, 'i')
        .replace(/[óòôõö]/g, 'o')
        .replace(/[úùûü]/g, 'u')
        .replace(/[ç]/g, 'c')
        .replace(/[^a-z0-9]/g, '')
    }

    for (let c = 0; c < collections.length; c++) {
      const colName = collections[c]
      if (!app.hasTable(colName)) {
        continue
      }

      // Carrega TODOS os registros da coleção (limit=0, offset=0 busca sem paginação)
      const records = app.findRecordsByFilter(colName, '1=1', '-updated', 0, 0)
      if (!records || records.length <= 1) {
        continue
      }

      // Agrupa registros por CNPJ normalizado (somente dígitos);
      // quando CNPJ for vazio, agrupa por nome/empresa normalizado
      const groups = {}

      for (let i = 0; i < records.length; i++) {
        const rec = records[i]
        const rawCnpj = (rec.getString('cnpj') || '').trim()
        const cleanCnpj = rawCnpj.replace(/\D/g, '')

        let groupKey = ''
        if (cleanCnpj.length > 0) {
          groupKey = 'cnpj:' + cleanCnpj
        } else {
          const rawNome = (rec.getString('nome') || rec.getString('empresa') || '').trim()
          const normNome = normalizeName(rawNome)
          if (normNome.length > 0) {
            groupKey = 'nome:' + normNome
          } else {
            groupKey = 'id:' + rec.id
          }
        }

        if (!groups[groupKey]) {
          groups[groupKey] = []
        }
        groups[groupKey].push(rec)
      }

      let deletedCount = 0

      for (const key in groups) {
        const list = groups[key]
        if (list.length > 1) {
          // Ordena os registros do grupo:
          // 1. Maior pontuação de preenchimento (mais dados)
          // 2. Data de updated mais recente
          // 3. Data de created mais recente
          // 4. Desempate por id
          list.sort((a, b) => {
            const scoreA = scoreRecord(colName, a)
            const scoreB = scoreRecord(colName, b)
            if (scoreB !== scoreA) {
              return scoreB - scoreA
            }

            const timeA = new Date(a.getString('updated') || a.getString('created') || 0).getTime()
            const timeB = new Date(b.getString('updated') || b.getString('created') || 0).getTime()
            if (timeB !== timeA) {
              return timeB - timeA
            }

            return b.id.localeCompare(a.id)
          })

          // Mantém list[0] (o mais completo / mais recente) e exclui os duplicados
          for (let k = 1; k < list.length; k++) {
            app.delete(list[k])
            deletedCount++
          }
        }
      }

      console.log(
        `[Deduplicação 0019] Coleção ${colName}: removidos ${deletedCount} registros duplicados de ${records.length} totais.`,
      )
    }
  },
  () => {
    // Reversão de exclusão de dados duplicados não aplicável
  },
)
