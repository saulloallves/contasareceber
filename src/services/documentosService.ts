import { createClient } from '@supabase/supabase-js';
import { DocumentoCobranca, DocumentoGerado, VariaveisNotificacao, TemplateNotificacao, FiltrosDocumentos, EstatisticasDocumentos, ChecklistDocumentos } from '../types/documentos';
import { TrativativasService } from './tratativasService';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export class DocumentosService {
  private tratativasService: TrativativasService;

  constructor() {
    this.tratativasService = new TrativativasService();
  }

  /**
   * Faz upload de documento vinculado à cobrança
   */
  async uploadDocumento(
    arquivo: File,
    dadosDocumento: Omit<DocumentoCobranca, 'id' | 'arquivo_url' | 'tamanho_arquivo' | 'formato_arquivo' | 'created_at' | 'updated_at'>
  ): Promise<DocumentoCobranca> {
    try {
      // Valida tamanho do arquivo (máximo 10MB)
      if (arquivo.size > 10 * 1024 * 1024) {
        throw new Error('Arquivo deve ter no máximo 10MB');
      }

      // Valida formato do arquivo
      const formatosPermitidos = ['pdf', 'jpg', 'jpeg', 'png', 'csv', 'docx', 'doc'];
      const extensao = arquivo.name.split('.').pop()?.toLowerCase();
      if (!extensao || !formatosPermitidos.includes(extensao)) {
        throw new Error('Formato de arquivo não permitido. Use: PDF, JPG, PNG, CSV, DOCX');
      }

      // Gera nome único para o arquivo
      const timestamp = Date.now();
      const nomeArquivo = `${dadosDocumento.cnpj_unidade}_${dadosDocumento.tipo_documento}_${timestamp}.${extensao}`;

      // Upload para Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documentos-cobranca')
        .upload(nomeArquivo, arquivo);

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      // Obtém URL pública do arquivo
      const { data: urlData } = supabase.storage
        .from('documentos-cobranca')
        .getPublicUrl(nomeArquivo);

      // Salva metadados no banco
      const documento: Omit<DocumentoCobranca, 'id' | 'created_at' | 'updated_at'> = {
        ...dadosDocumento,
        nome_arquivo: arquivo.name,
        arquivo_url: urlData.publicUrl,
        tamanho_arquivo: arquivo.size,
        formato_arquivo: extensao
      };

      const { data, error } = await supabase
        .from('documentos_cobranca')
        .insert(documento)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao salvar documento: ${error.message}`);
      }

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        dadosDocumento.titulo_id,
        dadosDocumento.usuario_responsavel,
        `Documento anexado: ${dadosDocumento.tipo_documento} - ${arquivo.name}. ${dadosDocumento.observacoes || ''}`
      );

      return data;
    } catch (error) {
      console.error('Erro ao fazer upload do documento:', error);
      throw error;
    }
  }

  /**
   * Busca documentos com filtros
   */
  async buscarDocumentos(filtros: FiltrosDocumentos = {}) {
    try {
      let query = supabase
        .from('documentos_cobranca')
        .select(`
          *,
          cobrancas_franqueados (
            cliente,
            cnpj,
            valor_original,
            valor_atualizado,
            status,
            data_vencimento
          )
        `)
        .order('data_upload', { ascending: false });

      if (filtros.tipo_documento) {
        query = query.eq('tipo_documento', filtros.tipo_documento);
      }

      if (filtros.status_cobranca) {
        query = query.eq('status_cobranca_vinculado', filtros.status_cobranca);
      }

      if (filtros.cnpj) {
        query = query.ilike('cnpj_unidade', `%${filtros.cnpj}%`);
      }

      if (filtros.dataInicio) {
        query = query.gte('data_upload', filtros.dataInicio);
      }

      if (filtros.dataFim) {
        query = query.lte('data_upload', filtros.dataFim);
      }

      if (filtros.usuario_responsavel) {
        query = query.ilike('usuario_responsavel', `%${filtros.usuario_responsavel}%`);
      }

      if (filtros.obrigatorio !== undefined) {
        query = query.eq('obrigatorio', filtros.obrigatorio);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar documentos: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
      throw error;
    }
  }

  /**
   * Busca documentos de uma cobrança específica
   */
  async buscarDocumentosPorCobranca(tituloId: string) {
    try {
      const { data, error } = await supabase
        .from('documentos_cobranca')
        .select('*')
        .eq('titulo_id', tituloId)
        .order('data_upload', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar documentos: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar documentos por cobrança:', error);
      throw error;
    }
  }

  /**
   * Busca documentos de uma unidade (CNPJ)
   */
  async buscarDocumentosPorUnidade(cnpj: string) {
    try {
      const { data, error } = await supabase
        .from('documentos_cobranca')
        .select(`
          *,
          cobrancas_franqueados (
            cliente,
            valor_original,
            valor_atualizado,
            status,
            data_vencimento
          )
        `)
        .eq('cnpj_unidade', cnpj)
        .order('data_upload', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar documentos: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar documentos por unidade:', error);
      throw error;
    }
  }

  /**
   * Atualiza documento existente
   */
  async atualizarDocumento(
    id: string,
    dadosAtualizacao: Partial<DocumentoCobranca>
  ): Promise<DocumentoCobranca> {
    try {
      const { data, error } = await supabase
        .from('documentos_cobranca')
        .update(dadosAtualizacao)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao atualizar documento: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Erro ao atualizar documento:', error);
      throw error;
    }
  }

  /**
   * Remove documento
   */
  async removerDocumento(id: string): Promise<void> {
    try {
      // Busca dados do documento para remover arquivo do storage
      const { data: documento } = await supabase
        .from('documentos_cobranca')
        .select('arquivo_url, nome_arquivo')
        .eq('id', id)
        .single();

      if (documento) {
        // Remove arquivo do storage
        const nomeArquivo = documento.arquivo_url.split('/').pop();
        if (nomeArquivo) {
          await supabase.storage
            .from('documentos-cobranca')
            .remove([nomeArquivo]);
        }
      }

      // Remove registro do banco
      const { error } = await supabase
        .from('documentos_cobranca')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao remover documento: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao remover documento:', error);
      throw error;
    }
  }

  /**
   * Gera checklist de documentos obrigatórios
   */
  async gerarChecklistDocumentos(tituloId: string): Promise<ChecklistDocumentos> {
    try {
      // Busca status da cobrança
      const { data: cobranca } = await supabase
        .from('cobrancas_franqueados')
        .select('status')
        .eq('id', tituloId)
        .single();

      if (!cobranca) {
        throw new Error('Cobrança não encontrada');
      }

      // Busca documentos existentes
      const documentosExistentes = await this.buscarDocumentosPorCobranca(tituloId);
      const tiposExistentes = documentosExistentes.map(d => d.tipo_documento);

      // Define documentos obrigatórios por status
      const documentosObrigatorios = this.getDocumentosObrigatoriosPorStatus(cobranca.status);

      // Verifica quais estão presentes
      const documentosComStatus = documentosObrigatorios.map(doc => ({
        tipo: doc.tipo,
        descricao: doc.descricao,
        presente: tiposExistentes.includes(doc.tipo)
      }));

      // Calcula percentual de completude
      const presentes = documentosComStatus.filter(d => d.presente).length;
      const percentualCompletude = documentosObrigatorios.length > 0 
        ? (presentes / documentosObrigatorios.length) * 100 
        : 100;

      return {
        status_cobranca: cobranca.status,
        documentos_obrigatorios: documentosComStatus,
        percentual_completude: percentualCompletude
      };
    } catch (error) {
      console.error('Erro ao gerar checklist:', error);
      throw error;
    }
  }

  /**
   * Define documentos obrigatórios por status da cobrança
   */
  private getDocumentosObrigatoriosPorStatus(status: string) {
    const documentos: Record<string, { tipo: string; descricao: string }[]> = {
      'em_aberto': [
        { tipo: 'notificacao_institucional', descricao: 'Notificação de cobrança enviada' }
      ],
      'negociando': [
        { tipo: 'resumo_reuniao', descricao: 'Resumo da reunião de negociação' },
        { tipo: 'termo_acordo', descricao: 'Termo de acordo assinado (se aplicável)' }
      ],
      'em_tratativa_juridica': [
        { tipo: 'notificacao_institucional', descricao: 'Notificação extrajudicial' },
        { tipo: 'documento_juridico', descricao: 'Documentos jurídicos formais' },
        { tipo: 'resumo_reuniao', descricao: 'Histórico de tentativas de contato' }
      ],
      'quitado': [
        { tipo: 'comprovante_pagamento', descricao: 'Comprovante de pagamento' }
      ]
    };

    return documentos[status] || [];
  }

  /**
   * Busca estatísticas dos documentos
   */
  async buscarEstatisticasDocumentos(): Promise<EstatisticasDocumentos> {
    try {
      const { data: documentos } = await supabase
        .from('documentos_cobranca')
        .select('tipo_documento, tamanho_arquivo, data_upload, obrigatorio');

      if (!documentos) {
        return this.getEstatisticasVazias();
      }

      const agora = new Date();
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);

      const stats: EstatisticasDocumentos = {
        total_documentos: documentos.length,
        por_tipo: {},
        documentos_pendentes: 0,
        tamanho_total_mb: 0,
        uploads_mes_atual: 0
      };

      documentos.forEach(doc => {
        // Por tipo
        stats.por_tipo[doc.tipo_documento] = (stats.por_tipo[doc.tipo_documento] || 0) + 1;
        
        // Tamanho total
        stats.tamanho_total_mb += doc.tamanho_arquivo / (1024 * 1024);
        
        // Uploads do mês atual
        if (new Date(doc.data_upload) >= inicioMes) {
          stats.uploads_mes_atual++;
        }
        
        // Documentos pendentes (obrigatórios não anexados)
        if (doc.obrigatorio) {
          stats.documentos_pendentes++;
        }
      });

      return stats;
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      return this.getEstatisticasVazias();
    }
  }

  /**
   * Gera relatório de documentos por período
   */
  async gerarRelatorioDocumentos(dataInicio: string, dataFim: string): Promise<string> {
    try {
      const documentos = await this.buscarDocumentos({
        dataInicio,
        dataFim
      });

      // Cabeçalho CSV
      const cabecalho = [
        'Data Upload',
        'CNPJ',
        'Nome Unidade',
        'Tipo Documento',
        'Nome Arquivo',
        'Tamanho (MB)',
        'Usuário Responsável',
        'Status Cobrança',
        'Obrigatório',
        'Observações'
      ].join(',');

      // Dados
      const linhas = documentos.map(doc => [
        new Date(doc.data_upload!).toLocaleDateString('pt-BR'),
        doc.cnpj_unidade,
        doc.nome_unidade,
        doc.tipo_documento,
        doc.nome_arquivo,
        (doc.tamanho_arquivo / (1024 * 1024)).toFixed(2),
        doc.usuario_responsavel,
        doc.status_cobranca_vinculado,
        doc.obrigatorio ? 'Sim' : 'Não',
        (doc.observacoes || '').replace(/,/g, ';')
      ].join(','));

      return [cabecalho, ...linhas].join('\n');
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      throw error;
    }
  }

  /**
   * Verifica documentos pendentes por unidade
   */
  async verificarDocumentosPendentes(cnpj: string): Promise<string[]> {
    try {
      // Busca cobranças ativas da unidade
      const { data: cobrancas } = await supabase
        .from('cobrancas_franqueados')
        .select('id, status')
        .eq('cnpj', cnpj)
        .neq('status', 'quitado');

      if (!cobrancas) return [];

      const documentosPendentes: string[] = [];

      for (const cobranca of cobrancas) {
        const checklist = await this.gerarChecklistDocumentos(cobranca.id);
        const pendentes = checklist.documentos_obrigatorios
          .filter(d => !d.presente)
          .map(d => `${cobranca.status}: ${d.descricao}`);
        
        documentosPendentes.push(...pendentes);
      }

      return documentosPendentes;
    } catch (error) {
      console.error('Erro ao verificar documentos pendentes:', error);
      return [];
    }
  }

  /**
   * Marca documento como obrigatório
   */
  async marcarComoObrigatorio(id: string, obrigatorio: boolean = true): Promise<void> {
    try {
      const { error } = await supabase
        .from('documentos_cobranca')
        .update({ obrigatorio })
        .eq('id', id);

      if (error) {
        throw new Error(`Erro ao marcar documento: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao marcar como obrigatório:', error);
      throw error;
    }
  }

  /**
   * Busca documentos por tipo
   */
  async buscarDocumentosPorTipo(tipo: string) {
    try {
      const { data, error } = await supabase
        .from('documentos_cobranca')
        .select(`
          *,
          cobrancas_franqueados (
            cliente,
            cnpj,
            status
          )
        `)
        .eq('tipo_documento', tipo)
        .order('data_upload', { ascending: false });

      if (error) {
        throw new Error(`Erro ao buscar documentos: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar documentos por tipo:', error);
      throw error;
    }
  }

  private getEstatisticasVazias(): EstatisticasDocumentos {
    return {
      total_documentos: 0,
      por_tipo: {},
      documentos_pendentes: 0,
      tamanho_total_mb: 0,
      uploads_mes_atual: 0
    };
  }

  /**
   * Templates de notificação predefinidos
   */
  private getTemplates(): Record<DocumentoGerado['tipo_documento'], TemplateNotificacao> {
    return {
      notificacao_inadimplencia: {
        tipo: 'notificacao_inadimplencia',
        titulo: 'NOTIFICAÇÃO DE INADIMPLÊNCIA RECORRENTE',
        prazo_dias: 15,
        consequencia: 'execução das garantias contratuais e medidas judiciais cabíveis',
        conteudo: `
          <div class="documento-formal">
            <div class="cabecalho">
              <h1>NOTIFICAÇÃO EXTRAJUDICIAL</h1>
              <h2>{{tipo_notificacao}}</h2>
            </div>
            
            <div class="destinatario">
              <p><strong>Ao(À):</strong> {{cliente}}</p>
              <p><strong>CNPJ:</strong> {{cnpj}}</p>
              <p><strong>Código da Unidade:</strong> {{codigo_unidade}}</p>
              <p><strong>Endereço:</strong> {{endereco_completo}}</p>
            </div>
            
            <div class="conteudo">
              <p>Vimos por meio desta, <strong>NOTIFICÁ-LO(A)</strong> sobre a existência de débito(s) em aberto referente ao contrato de franquia, conforme detalhado abaixo:</p>
              
              <div class="dados-debito">
                <h3>DADOS DO DÉBITO:</h3>
                <ul>
                  <li><strong>Valor Total em Aberto:</strong> R$ {{valor_total_em_aberto}}</li>
                  <li><strong>Data de Vencimento mais Antiga:</strong> {{data_vencimento_mais_antiga}}</li>
                  <li><strong>Dias em Atraso:</strong> {{dias_em_atraso_max}} dias</li>
                  <li><strong>Status Atual:</strong> {{status_cobranca}}</li>
                </ul>
              </div>
              
              <div class="historico-tratativas">
                <h3>HISTÓRICO DE TRATATIVAS:</h3>
                <p>Registramos {{qtd_reunioes_agendadas}} tentativa(s) de contato/negociação.</p>
                <p><strong>Última Tratativa:</strong> {{ultima_tratativa_resumida}}</p>
              </div>
              
              <div class="fundamento-legal">
                <h3>FUNDAMENTO CONTRATUAL:</h3>
                <p>Conforme previsto no contrato de franquia firmado entre as partes, o franqueado obriga-se ao pagamento pontual das taxas e royalties estabelecidos, sob pena de aplicação das sanções contratuais cabíveis.</p>
              </div>
              
              <div class="exigencia">
                <h3>EXIGÊNCIA:</h3>
                <p>Diante do exposto, <strong>EXIGIMOS</strong> a regularização do débito no prazo de <strong>{{prazo_regularizacao}} (quinze) dias corridos</strong>, contados do recebimento desta notificação.</p>
              </div>
              
              <div class="consequencia">
                <h3>CONSEQUÊNCIAS DO NÃO CUMPRIMENTO:</h3>
                <p>O não atendimento desta notificação no prazo estabelecido implicará na adoção das medidas cabíveis para cobrança, incluindo {{consequencia}}.</p>
              </div>
            </div>
            
            <div class="rodape">
              <p>{{data_atual}}</p>
              <br>
              <p><strong>Departamento Jurídico</strong><br>
              Rede Cresci e Perdi<br>
              juridico@crescieperdi.com.br</p>
            </div>
          </div>
        `
      },
      notificacao_ausencia_tratativas: {
        tipo: 'notificacao_ausencia_tratativas',
        titulo: 'NOTIFICAÇÃO POR AUSÊNCIA EM TRATATIVAS',
        prazo_dias: 10,
        consequencia: 'encerramento das tratativas amigáveis e início de cobrança judicial',
        conteudo: `
          <div class="documento-formal">
            <div class="cabecalho">
              <h1>NOTIFICAÇÃO EXTRAJUDICIAL</h1>
              <h2>{{tipo_notificacao}}</h2>
            </div>
            
            <div class="destinatario">
              <p><strong>Ao(À):</strong> {{cliente}}</p>
              <p><strong>CNPJ:</strong> {{cnpj}}</p>
              <p><strong>Código da Unidade:</strong> {{codigo_unidade}}</p>
            </div>
            
            <div class="conteudo">
              <p>Vimos comunicar que, apesar das múltiplas tentativas de contato e agendamento de reuniões para tratativa amigável dos débitos pendentes, V.Sa. não tem comparecido ou respondido às nossas solicitações.</p>
              
              <div class="dados-debito">
                <h3>SITUAÇÃO ATUAL:</h3>
                <ul>
                  <li><strong>Valor em Aberto:</strong> R$ {{valor_total_em_aberto}}</li>
                  <li><strong>Reuniões Agendadas sem Comparecimento:</strong> {{qtd_reunioes_agendadas}}</li>
                  <li><strong>Dias em Atraso:</strong> {{dias_em_atraso_max}} dias</li>
                </ul>
              </div>
              
              <p>Esta é nossa <strong>ÚLTIMA TENTATIVA</strong> de resolução amigável. Solicitamos contato imediato no prazo de {{prazo_regularizacao}} dias para regularização ou acordo de parcelamento.</p>
              
              <p>O não atendimento resultará em {{consequencia}}.</p>
            </div>
            
            <div class="rodape">
              <p>{{data_atual}}</p>
              <br>
              <p><strong>Departamento Jurídico</strong><br>
              Rede Cresci e Perdi</p>
            </div>
          </div>
        `
      },
      notificacao_vencimento: {
        tipo: 'notificacao_vencimento',
        titulo: 'NOTIFICAÇÃO DE VENCIMENTO NÃO QUITADO',
        prazo_dias: 5,
        consequencia: 'cobrança judicial e aplicação de multas contratuais',
        conteudo: `
          <div class="documento-formal">
            <div class="cabecalho">
              <h1>NOTIFICAÇÃO DE VENCIMENTO</h1>
              <h2>{{tipo_notificacao}}</h2>
            </div>
            
            <div class="destinatario">
              <p><strong>Ao(À):</strong> {{cliente}}</p>
              <p><strong>CNPJ:</strong> {{cnpj}}</p>
            </div>
            
            <div class="conteudo">
              <p>Comunicamos que constam em nossos registros débitos vencidos e não quitados, conforme detalhamento:</p>
              
              <div class="dados-debito">
                <ul>
                  <li><strong>Valor Total:</strong> R$ {{valor_total_em_aberto}}</li>
                  <li><strong>Vencimento:</strong> {{data_vencimento_mais_antiga}}</li>
                  <li><strong>Atraso:</strong> {{dias_em_atraso_max}} dias</li>
                </ul>
              </div>
              
              <p>Solicitamos a quitação imediata no prazo de {{prazo_regularizacao}} dias úteis.</p>
              
              <p>O descumprimento acarretará {{consequencia}}.</p>
            </div>
            
            <div class="rodape">
              <p>{{data_atual}}</p>
              <br>
              <p><strong>Departamento Financeiro</strong><br>
              Rede Cresci e Perdi</p>
            </div>
          </div>
        `
      },
      notificacao_quebra_acordo: {
        tipo: 'notificacao_quebra_acordo',
        titulo: 'NOTIFICAÇÃO DE QUEBRA DE ACORDO',
        prazo_dias: 7,
        consequencia: 'vencimento antecipado de todas as parcelas e execução judicial',
        conteudo: `
          <div class="documento-formal">
            <div class="cabecalho">
              <h1>NOTIFICAÇÃO DE QUEBRA DE ACORDO</h1>
              <h2>{{tipo_notificacao}}</h2>
            </div>
            
            <div class="destinatario">
              <p><strong>Ao(À):</strong> {{cliente}}</p>
              <p><strong>CNPJ:</strong> {{cnpj}}</p>
            </div>
            
            <div class="conteudo">
              <p>Vimos por meio desta <strong>NOTIFICAR</strong> V.Sa. sobre o descumprimento do acordo de parcelamento firmado anteriormente.</p>
              
              <div class="dados-debito">
                <h3>SITUAÇÃO:</h3>
                <ul>
                  <li><strong>Valor em Aberto:</strong> R$ {{valor_total_em_aberto}}</li>
                  <li><strong>Última Tratativa:</strong> {{ultima_tratativa_resumida}}</li>
                  <li><strong>Dias em Atraso:</strong> {{dias_em_atraso_max}} dias</li>
                </ul>
              </div>
              
              <p>O não cumprimento do acordo firmado caracteriza quebra contratual e implica no {{consequencia}}.</p>
              
              <p>Concedemos o prazo final de {{prazo_regularizacao}} dias para quitação integral do débito.</p>
            </div>
            
            <div class="rodape">
              <p>{{data_atual}}</p>
              <br>
              <p><strong>Departamento Jurídico</strong><br>
              Rede Cresci e Perdi</p>
            </div>
          </div>
        `
      },
      notificacao_preventiva: {
        tipo: 'notificacao_preventiva',
        titulo: 'NOTIFICAÇÃO PREVENTIVA PRÉ-JURÍDICO',
        prazo_dias: 20,
        consequencia: 'encaminhamento do caso para o departamento jurídico',
        conteudo: `
          <div class="documento-formal">
            <div class="cabecalho">
              <h1>NOTIFICAÇÃO PREVENTIVA</h1>
              <h2>{{tipo_notificacao}}</h2>
            </div>
            
            <div class="destinatario">
              <p><strong>Ao(À):</strong> {{cliente}}</p>
              <p><strong>CNPJ:</strong> {{cnpj}}</p>
            </div>
            
            <div class="conteudo">
              <p>Esta é uma <strong>NOTIFICAÇÃO PREVENTIVA</strong> sobre débitos pendentes que, se não regularizados, serão encaminhados para cobrança judicial.</p>
              
              <div class="dados-debito">
                <h3>DÉBITOS PENDENTES:</h3>
                <ul>
                  <li><strong>Valor Total:</strong> R$ {{valor_total_em_aberto}}</li>
                  <li><strong>Atraso:</strong> {{dias_em_atraso_max}} dias</li>
                  <li><strong>Status:</strong> {{status_cobranca}}</li>
                </ul>
              </div>
              
              <p>Ainda há tempo para resolução amigável. Entre em contato conosco no prazo de {{prazo_regularizacao}} dias para negociação.</p>
              
              <p>Caso contrário, procederemos com {{consequencia}}.</p>
            </div>
            
            <div class="rodape">
              <p>{{data_atual}}</p>
              <br>
              <p><strong>Departamento Financeiro</strong><br>
              Rede Cresci e Perdi</p>
            </div>
          </div>
        `
      },
      carta_encerramento: {
        tipo: 'carta_encerramento',
        titulo: 'CARTA DE ENCERRAMENTO DE TRATATIVA AMIGÁVEL',
        prazo_dias: 0,
        consequencia: 'início imediato de cobrança judicial',
        conteudo: `
          <div class="documento-formal">
            <div class="cabecalho">
              <h1>CARTA DE ENCERRAMENTO</h1>
              <h2>{{tipo_notificacao}}</h2>
            </div>
            
            <div class="destinatario">
              <p><strong>Ao(À):</strong> {{cliente}}</p>
              <p><strong>CNPJ:</strong> {{cnpj}}</p>
            </div>
            
            <div class="conteudo">
              <p>Comunicamos o <strong>ENCERRAMENTO</strong> das tratativas amigáveis para resolução dos débitos pendentes, tendo em vista a ausência de resposta ou acordo satisfatório.</p>
              
              <div class="dados-debito">
                <h3>RESUMO FINAL:</h3>
                <ul>
                  <li><strong>Valor Total Devido:</strong> R$ {{valor_total_em_aberto}}</li>
                  <li><strong>Tentativas de Contato:</strong> {{qtd_reunioes_agendadas}}</li>
                  <li><strong>Período de Tratativas:</strong> {{dias_em_atraso_max}} dias</li>
                </ul>
              </div>
              
              <p>Esgotadas as possibilidades de acordo amigável, o caso será encaminhado para {{consequencia}}.</p>
              
              <p>Esta é nossa comunicação final sobre o assunto na esfera administrativa.</p>
            </div>
            
            <div class="rodape">
              <p>{{data_atual}}</p>
              <br>
              <p><strong>Departamento Jurídico</strong><br>
              Rede Cresci e Perdi</p>
            </div>
          </div>
        `
      }
    };
  }

  /**
   * Coleta variáveis para preenchimento do template
   */
  async coletarVariaveis(tituloId: string): Promise<VariaveisNotificacao> {
    try {
      // Busca dados da cobrança
      const { data: cobranca, error: errorCobranca } = await supabase
        .from('cobrancas_franqueados')
        .select(`
          *,
          unidades_franqueadas (
            codigo_unidade,
            nome_franqueado,
            endereco_completo
          )
        `)
        .eq('id', tituloId)
        .single();

      if (errorCobranca) {
        throw new Error(`Erro ao buscar cobrança: ${errorCobranca.message}`);
      }

      // Busca tratativas
      const { data: tratativas } = await supabase
        .from('tratativas_cobranca')
        .select('*')
        .eq('titulo_id', tituloId)
        .order('data_interacao', { ascending: false })
        .limit(1);

      // Busca reuniões
      const { data: reunioes } = await supabase
        .from('reunioes_negociacao')
        .select('*')
        .eq('titulo_id', tituloId);

      // Busca outras cobranças da mesma unidade
      const { data: outrasCobrancas } = await supabase
        .from('cobrancas_franqueados')
        .select('valor_atualizado, valor_original')
        .eq('cnpj', cobranca.cnpj)
        .eq('status', 'em_aberto');

      const valorTotalEmAberto = outrasCobrancas?.reduce((sum, c) => 
        sum + (c.valor_atualizado || c.valor_original), 0) || 0;

      const ultimaTratativa = tratativas?.[0]?.descricao || 'Nenhuma tratativa registrada';

      return {
        cliente: cobranca.cliente,
        cnpj: cobranca.cnpj,
        codigo_unidade: (cobranca as any).unidades_franqueadas?.codigo_unidade || 'N/A',
        endereco_completo: (cobranca as any).unidades_franqueadas?.endereco_completo || 'Não informado',
        responsavel_legal: (cobranca as any).unidades_franqueadas?.nome_franqueado || cobranca.cliente,
        valor_total_em_aberto: valorTotalEmAberto,
        dias_em_atraso_max: cobranca.dias_em_atraso || 0,
        data_vencimento_mais_antiga: new Date(cobranca.data_vencimento).toLocaleDateString('pt-BR'),
        qtd_reunioes_agendadas: reunioes?.length || 0,
        ultima_tratativa_resumida: ultimaTratativa.substring(0, 200) + (ultimaTratativa.length > 200 ? '...' : ''),
        status_cobranca: cobranca.status,
        tipo_notificacao: '',
        data_atual: new Date().toLocaleDateString('pt-BR'),
        prazo_regularizacao: 15
      };
    } catch (error) {
      console.error('Erro ao coletar variáveis:', error);
      throw error;
    }
  }

  /**
   * Gera documento com base no template e variáveis
   */
  async gerarDocumento(
    tituloId: string,
    tipoDocumento: DocumentoGerado['tipo_documento'],
    usuario: string
  ): Promise<DocumentoGerado> {
    try {
      const variaveis = await this.coletarVariaveis(tituloId);
      const templates = this.getTemplates();
      const template = templates[tipoDocumento];

      // Atualiza variáveis específicas do template
      variaveis.tipo_notificacao = template.titulo;
      variaveis.prazo_regularizacao = template.prazo_dias;

      // Substitui variáveis no template
      let conteudoHtml = template.conteudo;
      Object.entries(variaveis).forEach(([chave, valor]) => {
        const regex = new RegExp(`{{${chave}}}`, 'g');
        conteudoHtml = conteudoHtml.replace(regex, String(valor));
      });

      // Adiciona CSS para formatação
      const conteudoCompleto = `
        <style>
          .documento-formal { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; }
          .cabecalho { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .cabecalho h1 { font-size: 24px; margin: 0; color: #333; }
          .cabecalho h2 { font-size: 18px; margin: 10px 0 0 0; color: #666; }
          .destinatario { margin-bottom: 30px; background: #f5f5f5; padding: 15px; border-left: 4px solid #007bff; }
          .conteudo { line-height: 1.6; }
          .dados-debito, .historico-tratativas, .fundamento-legal, .exigencia, .consequencia { margin: 20px 0; }
          .dados-debito h3, .historico-tratativas h3, .fundamento-legal h3, .exigencia h3, .consequencia h3 { 
            color: #333; border-bottom: 1px solid #ddd; padding-bottom: 5px; 
          }
          .dados-debito ul { background: #fff3cd; padding: 15px; border-radius: 5px; }
          .rodape { margin-top: 50px; text-align: right; border-top: 1px solid #ddd; padding-top: 20px; }
          strong { color: #d32f2f; }
        </style>
        ${conteudoHtml}
      `;

      // Salva no banco
      const documento: Omit<DocumentoGerado, 'id' | 'created_at' | 'updated_at'> = {
        tipo_documento: tipoDocumento,
        titulo_id: tituloId,
        unidade_id: undefined, // Pode ser implementado futuramente
        conteudo_html: conteudoCompleto,
        arquivo_pdf_url: undefined, // Implementar geração de PDF futuramente
        gerado_por: usuario
      };

      const { data, error } = await supabase
        .from('documentos_gerados')
        .insert(documento)
        .select()
        .single();

      if (error) {
        throw new Error(`Erro ao salvar documento: ${error.message}`);
      }

      // Registra tratativa
      await this.tratativasService.registrarObservacao(
        tituloId,
        usuario,
        `Documento gerado: ${template.titulo}`,
        'em_tratativa_juridica'
      );

      return data;
    } catch (error) {
      console.error('Erro ao gerar documento:', error);
      throw error;
    }
  }

  /**
   * Exporta documento como HTML para impressão/PDF
   */
  async exportarDocumentoHTML(documentoId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('documentos_gerados')
        .select('conteudo_html')
        .eq('id', documentoId)
        .single();

      if (error) {
        throw new Error(`Erro ao buscar documento: ${error.message}`);
      }

      return data.conteudo_html;
    } catch (error) {
      console.error('Erro ao exportar documento:', error);
      throw error;
    }
  }

  /**
   * Lista tipos de documento disponíveis
   */
  getTiposDocumento() {
    const templates = this.getTemplates();
    return Object.entries(templates).map(([key, template]) => ({
      value: key,
      label: template.titulo,
      prazo_dias: template.prazo_dias
    }));
  }
}