import { supabase } from './databaseService';
import { CobrancaFranqueado } from '../types/cobranca';
import { gerarReferenciaLinha } from '../utils/planilhaProcessor';

export interface DiferencaPlanilha {
  tipo: 'novo' | 'alterado' | 'removido';
  referencia: string;
  cliente: string;
  cnpj: string;
  campo_alterado?: string;
  valor_anterior?: any;
  valor_novo?: any;
  detalhes: string;
}

export interface ResultadoComparacao {
  tem_diferencas: boolean;
  total_diferencas: number;
  resumo: {
    novos: number;
    alterados: number;
    removidos: number;
  };
  diferencas: DiferencaPlanilha[];
  ultima_importacao: {
    data: string;
    arquivo: string;
    usuario: string;
  } | null;
}

export class ComparacaoPlanilhaService {
  /**
   * Compara dados da nova planilha com a última importação salva
   */
  async compararComUltimaPlanilha(
    dadosNovaPlanilha: CobrancaFranqueado[]
  ): Promise<ResultadoComparacao> {
    try {
      // Busca a última importação realizada
      const ultimaImportacao = await this.buscarUltimaImportacao();
      
      if (!ultimaImportacao) {
        return {
          tem_diferencas: true,
          total_diferencas: dadosNovaPlanilha.length,
          resumo: {
            novos: dadosNovaPlanilha.length,
            alterados: 0,
            removidos: 0
          },
          diferencas: dadosNovaPlanilha.map(item => ({
            tipo: 'novo',
            referencia: gerarReferenciaLinha(item),
            cliente: item.cliente,
            cnpj: item.cnpj,
            detalhes: 'Primeira importação - todos os registros são novos'
          })),
          ultima_importacao: null
        };
      }

      // Busca dados da última importação
      const dadosUltimaImportacao = await this.buscarDadosUltimaImportacao(
        ultimaImportacao.referencia
      );

      // Realiza a comparação
      const diferencas = await this.compararDados(
        dadosNovaPlanilha,
        dadosUltimaImportacao
      );

      // Calcula resumo
      const resumo = {
        novos: diferencas.filter(d => d.tipo === 'novo').length,
        alterados: diferencas.filter(d => d.tipo === 'alterado').length,
        removidos: diferencas.filter(d => d.tipo === 'removido').length
      };

      return {
        tem_diferencas: diferencas.length > 0,
        total_diferencas: diferencas.length,
        resumo,
        diferencas,
        ultima_importacao: {
          data: ultimaImportacao.data_importacao,
          arquivo: ultimaImportacao.arquivo_nome,
          usuario: ultimaImportacao.usuario
        }
      };
    } catch (error) {
      console.error('Erro ao comparar planilhas:', error);
      throw error;
    }
  }

  /**
   * Busca a última importação realizada
   */
  private async buscarUltimaImportacao() {
    const { data, error } = await supabase
      .from('importacoes_planilha')
      .select('*')
      .order('data_importacao', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar última importação: ${error.message}`);
    }

    return data;
  }

  /**
   * Busca dados da última importação baseado na referência
   */
  private async buscarDadosUltimaImportacao(referencia: string): Promise<CobrancaFranqueado[]> {
    const { data, error } = await supabase
      .from('cobrancas_franqueados')
      .select('*')
      .eq('referencia_importacao', referencia);

    if (error) {
      throw new Error(`Erro ao buscar dados da última importação: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Compara os dados entre duas planilhas
   */
  private async compararDados(
    dadosNovos: CobrancaFranqueado[],
    dadosAntigos: CobrancaFranqueado[]
  ): Promise<DiferencaPlanilha[]> {
    const diferencas: DiferencaPlanilha[] = [];

    // Cria mapas para facilitar a comparação
    const mapaAntigos = new Map<string, CobrancaFranqueado>();
    const mapaNovos = new Map<string, CobrancaFranqueado>();

    // Popula mapa dos dados antigos
    dadosAntigos.forEach(item => {
      const referencia = gerarReferenciaLinha(item);
      mapaAntigos.set(referencia, item);
    });

    // Popula mapa dos dados novos
    dadosNovos.forEach(item => {
      const referencia = gerarReferenciaLinha(item);
      mapaNovos.set(referencia, item);
    });

    // Verifica novos registros e alterações
    for (const [referencia, itemNovo] of mapaNovos) {
      const itemAntigo = mapaAntigos.get(referencia);

      if (!itemAntigo) {
        // Registro novo
        diferencas.push({
          tipo: 'novo',
          referencia,
          cliente: itemNovo.cliente,
          cnpj: itemNovo.cnpj,
          detalhes: 'Novo registro adicionado na planilha'
        });
      } else {
        // Verifica alterações
        const alteracoes = this.compararRegistros(itemAntigo, itemNovo);
        if (alteracoes.length > 0) {
          alteracoes.forEach(alteracao => {
            diferencas.push({
              tipo: 'alterado',
              referencia,
              cliente: itemNovo.cliente,
              cnpj: itemNovo.cnpj,
              campo_alterado: alteracao.campo,
              valor_anterior: alteracao.valorAnterior,
              valor_novo: alteracao.valorNovo,
              detalhes: `${alteracao.campo} alterado: ${alteracao.valorAnterior} → ${alteracao.valorNovo}`
            });
          });
        }
      }
    }

    // Verifica registros removidos
    for (const [referencia, itemAntigo] of mapaAntigos) {
      if (!mapaNovos.has(referencia)) {
        diferencas.push({
          tipo: 'removido',
          referencia,
          cliente: itemAntigo.cliente,
          cnpj: itemAntigo.cnpj,
          detalhes: 'Registro removido da planilha (será marcado como quitado)'
        });
      }
    }

    return diferencas;
  }

  /**
   * Compara dois registros e retorna as diferenças
   */
  private compararRegistros(
    itemAntigo: CobrancaFranqueado,
    itemNovo: CobrancaFranqueado
  ): Array<{ campo: string; valorAnterior: any; valorNovo: any }> {
    const alteracoes: Array<{ campo: string; valorAnterior: any; valorNovo: any }> = [];

    // Campos a serem comparados
    const camposComparacao = [
      { campo: 'valor_original', label: 'Valor Original' },
      { campo: 'valor_recebido', label: 'Valor Recebido' },
      { campo: 'data_vencimento', label: 'Data de Vencimento' },
      { campo: 'data_vencimento_original', label: 'Data de Vencimento Original' },
      { campo: 'tipo_cobranca', label: 'Tipo de Cobrança' },
      { campo: 'descricao', label: 'Descrição' },
      { campo: 'email_cobranca', label: 'Email de Cobrança' },
      { campo: 'status', label: 'Status' }
    ];

    camposComparacao.forEach(({ campo, label }) => {
      const valorAntigo = (itemAntigo as any)[campo];
      const valorNovo = (itemNovo as any)[campo];

      // Normaliza valores para comparação
      const valorAntigoNormalizado = this.normalizarValor(valorAntigo);
      const valorNovoNormalizado = this.normalizarValor(valorNovo);

      if (valorAntigoNormalizado !== valorNovoNormalizado) {
        alteracoes.push({
          campo: label,
          valorAnterior: valorAntigoNormalizado,
          valorNovo: valorNovoNormalizado
        });
      }
    });

    return alteracoes;
  }

  /**
   * Normaliza valores para comparação
   */
  private normalizarValor(valor: any): any {
    if (valor === null || valor === undefined) {
      return '';
    }

    if (typeof valor === 'string') {
      return valor.trim();
    }

    if (typeof valor === 'number') {
      return Number(valor.toFixed(2));
    }

    return valor;
  }

  /**
   * Gera relatório textual das diferenças
   */
  gerarRelatorioComparacao(resultado: ResultadoComparacao): string {
    if (!resultado.tem_diferencas) {
      return 'Nenhuma diferença encontrada entre a nova planilha e a última importação.';
    }

    let relatorio = `RELATÓRIO DE COMPARAÇÃO DE PLANILHAS\n`;
    relatorio += `=====================================\n\n`;

    if (resultado.ultima_importacao) {
      relatorio += `Última importação:\n`;
      relatorio += `- Data: ${new Date(resultado.ultima_importacao.data).toLocaleString('pt-BR')}\n`;
      relatorio += `- Arquivo: ${resultado.ultima_importacao.arquivo}\n`;
      relatorio += `- Usuário: ${resultado.ultima_importacao.usuario}\n\n`;
    }

    relatorio += `RESUMO DAS DIFERENÇAS:\n`;
    relatorio += `- Novos registros: ${resultado.resumo.novos}\n`;
    relatorio += `- Registros alterados: ${resultado.resumo.alterados}\n`;
    relatorio += `- Registros removidos: ${resultado.resumo.removidos}\n`;
    relatorio += `- Total de diferenças: ${resultado.total_diferencas}\n\n`;

    if (resultado.resumo.novos > 0) {
      relatorio += `NOVOS REGISTROS (${resultado.resumo.novos}):\n`;
      resultado.diferencas
        .filter(d => d.tipo === 'novo')
        .forEach((diff, index) => {
          relatorio += `${index + 1}. ${diff.cliente} (${diff.cnpj})\n`;
        });
      relatorio += `\n`;
    }

    if (resultado.resumo.alterados > 0) {
      relatorio += `REGISTROS ALTERADOS (${resultado.resumo.alterados}):\n`;
      const alterados = resultado.diferencas.filter(d => d.tipo === 'alterado');
      const agrupadosPorCliente = new Map<string, DiferencaPlanilha[]>();
      
      alterados.forEach(diff => {
        const chave = `${diff.cliente} (${diff.cnpj})`;
        if (!agrupadosPorCliente.has(chave)) {
          agrupadosPorCliente.set(chave, []);
        }
        agrupadosPorCliente.get(chave)!.push(diff);
      });

      let contador = 1;
      agrupadosPorCliente.forEach((diffs, cliente) => {
        relatorio += `${contador}. ${cliente}:\n`;
        diffs.forEach(diff => {
          relatorio += `   - ${diff.detalhes}\n`;
        });
        contador++;
      });
      relatorio += `\n`;
    }

    if (resultado.resumo.removidos > 0) {
      relatorio += `REGISTROS REMOVIDOS (${resultado.resumo.removidos}):\n`;
      resultado.diferencas
        .filter(d => d.tipo === 'removido')
        .forEach((diff, index) => {
          relatorio += `${index + 1}. ${diff.cliente} (${diff.cnpj}) - ${diff.detalhes}\n`;
        });
      relatorio += `\n`;
    }

    relatorio += `Relatório gerado em: ${new Date().toLocaleString('pt-BR')}\n`;

    return relatorio;
  }
}

export const comparacaoPlanilhaService = new ComparacaoPlanilhaService();