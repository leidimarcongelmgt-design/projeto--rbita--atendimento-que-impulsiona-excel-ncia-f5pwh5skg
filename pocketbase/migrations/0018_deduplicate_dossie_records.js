migrate(
  (app) => {
    const collections = ['empresas', 'dpto_pessoal', 'dpto_fiscal', 'dpto_contabil']

    for (let c = 0; c < collections.length; c++) {
      const colName = collections[c]
      if (!app.hasTable(colName)) {
        continue
      }

      // Carrega todos os registros da coleção
      const records = app.findRecordsByFilter(colName, '1=1', '-updated', 0, 0)
      if (!records || records.length <= 1) {
        continue
      }

      // Agrupa registros por CNPJ normalizado (se existente) ou por nome/empresa normalizado
      const groups = {}

      for (let i = 0; i < records.length; i++) {
        const rec = records[i]
        const rawCnpj = (rec.getString('cnpj') || '').trim()
        const cleanCnpj = rawCnpj.replace(/\D/g, '')

        let groupKey = ''
        if (cleanCnpj.length > 0) {
          groupKey = 'cnpj:' + cleanCnpj
        } else {
          // Fallback para nome / empresa
          const rawNome = (rec.getString('nome') || rec.getString('empresa') || '')
            .trim()
            .toLowerCase()
          if (rawNome.length > 0) {
            groupKey = 'nome:' + rawNome
          } else {
            // Sem cnpj e sem nome: usa id próprio para não colidir
            groupKey = 'id:' + rec.id
          }
        }

        if (!groups[groupKey]) {
          groups[groupKey] = []
        }
        groups[groupKey].push(rec)
      }

      // Para cada grupo com duplicados, mantém o registro com updated mais recente e exclui os outros
      for (const key in groups) {
        const list = groups[key]
        if (list.length > 1) {
          // Ordena por updated decrescente (mais recente primeiro). Se updated for igual, usa id
          list.sort((a, b) => {
            const timeA = new Date(a.getString('updated') || a.getString('created') || 0).getTime()
            const timeB = new Date(b.getString('updated') || b.getString('created') || 0).getTime()
            if (timeB !== timeA) {
              return timeB - timeA
            }
            return b.id.localeCompare(a.id)
          })

          // Mantém list[0], exclui do índice 1 em diante
          for (let k = 1; k < list.length; k++) {
            app.delete(list[k])
          }
        }
      }
    }
  },
  () => {
    // Reversão de exclusão não é aplicável
  },
)
