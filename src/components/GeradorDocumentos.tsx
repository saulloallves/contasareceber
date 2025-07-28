/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import {
  FileText,
  Download,
  Eye,
  Filter,
  Calendar,
  User,
  AlertTriangle,
  CheckCircle,
  Upload,
  Trash2,
} from "lucide-react";
import { DocumentosService } from "../services/documentosService";
import {
  FiltrosDocumentos,
  EstatisticasDocumentos,
  ChecklistDocumentos,
} from "../types/documentos";
import supabase from "../lib/supabaseClient";

interface GeradorDocumentosProps {
  tituloId?: string;
  cnpj?: string;
  showUploadButton?: boolean;
}

export function GeradorDocumentos({
  tituloId,
  cnpj,
  showUploadButton = true,
}: GeradorDocumentosProps) {
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosDocumentos>({});
  const [modalAberto, setModalAberto] = useState<
    "upload" | "visualizar" | "checklist" | null
  >(null);
  const [documentoSelecionado, setDocumentoSelecionado] = useState<any>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [formUpload, setFormUpload] = useState<any>({});
  const [processando, setProcessando] = useState(false);
  const [estatisticas, setEstatisticas] =
    useState<EstatisticasDocumentos | null>(null);
  const [checklist, setChecklist] = useState<ChecklistDocumentos | null>(null);

  const documentosService = new DocumentosService();

  useEffect(() => {
    carregarDocumentos();
    carregarEstatisticas();
    if (tituloId) {
      carregarChecklist();
    }
  }, [filtros, tituloId, cnpj]);

  const carregarDocumentos = async () => {
    setCarregando(true);
    try {
      let dados;
      if (tituloId) {
        dados = await documentosService.buscarDocumentosPorCobranca(tituloId);
      } else if (cnpj) {
        dados = await documentosService.buscarDocumentosPorUnidade(cnpj);
      } else {
        dados = await documentosService.buscarDocumentos(filtros);
      }
      setDocumentos(dados);
    } catch (error) {
      console.error("Erro ao carregar documentos:", error);
    } finally {
      setCarregando(false);
    }
  };

  const carregarEstatisticas = async () => {
    try {
      const stats = await documentosService.buscarEstatisticasDocumentos();
      setEstatisticas(stats);
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const carregarChecklist = async () => {
    if (!tituloId) return;
    try {
      const checklistData = await documentosService.gerarChecklistDocumentos(
        tituloId
      );
      setChecklist(checklistData);
    } catch (error) {
      console.error("Erro ao carregar checklist:", error);
    }
  };

  const abrirModalUpload = () => {
    setFormUpload({
      tipo_documento: "outros",
      observacoes: "",
      obrigatorio: false,
    });
    setArquivo(null);
    setModalAberto("upload");
  };

  const abrirModalVisualizar = (documento: any) => {
    setDocumentoSelecionado(documento);
    setModalAberto("visualizar");
  };

  const abrirModalChecklist = () => {
    setModalAberto("checklist");
  };

  const fecharModal = () => {
    setModalAberto(null);
    setDocumentoSelecionado(null);
    setArquivo(null);
    setFormUpload({});
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setArquivo(file);
    }
  };

  const uploadDocumento = async () => {
    if (!arquivo || !tituloId) {
      alert("Arquivo e cobrança são obrigatórios");
      return;
    }

    setProcessando(true);
    try {
      // Busca dados da cobrança para preencher automaticamente
      const { data: cobranca } = await supabase
        .from("cobrancas_franqueados")
        .select(
          `
          cnpj,
          cliente,
          status,
          unidades_franqueadas (
            codigo_unidade
          )
        `
        )
        .eq("id", tituloId)
        .single();

      if (!cobranca) {
        throw new Error("Cobrança não encontrada");
      }

      const dadosDocumento = {
        titulo_id: tituloId,
        cnpj_unidade: cobranca.cnpj,
        codigo_unidade:
          (cobranca as any).unidades_franqueadas?.codigo_unidade || "",
        nome_unidade: cobranca.cliente,
        tipo_documento: formUpload.tipo_documento,
        usuario_responsavel: "usuario_atual", // Em produção, pegar do contexto
        observacoes: formUpload.observacoes,
        status_cobranca_vinculado: cobranca.status,
        obrigatorio: formUpload.obrigatorio,
      };

      await documentosService.uploadDocumento(arquivo, dadosDocumento);
      fecharModal();
      carregarDocumentos();
      carregarChecklist();
      alert("Documento enviado com sucesso!");
    } catch (error) {
      alert(`Erro ao enviar documento: ${error}`);
    } finally {
      setProcessando(false);
    }
  };

  const removerDocumento = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este documento?")) {
      return;
    }

    try {
      await documentosService.removerDocumento(id);
      carregarDocumentos();
      carregarChecklist();
    } catch (error) {
      alert(`Erro ao remover documento: ${error}`);
    }
  };

  const baixarDocumento = (documento: any) => {
    window.open(documento.arquivo_url, "_blank");
  };

  const getTipoDocumentoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      notificacao_institucional: "Notificação Institucional",
      comprovante_pagamento: "Comprovante de Pagamento",
      termo_acordo: "Termo de Acordo",
      planilha_atualizada: "Planilha Atualizada",
      print_comunicacao: "Print de Comunicação",
      resumo_reuniao: "Resumo de Reunião",
      documento_juridico: "Documento Jurídico",
      outros: "Outros",
    };
    return labels[tipo] || tipo;
  };

  const getTipoColor = (tipo: string) => {
    const colors: Record<string, string> = {
      notificacao_institucional: "bg-red-100 text-red-800",
      comprovante_pagamento: "bg-green-100 text-green-800",
      termo_acordo: "bg-blue-100 text-blue-800",
      planilha_atualizada: "bg-purple-100 text-purple-800",
      print_comunicacao: "bg-yellow-100 text-yellow-800",
      resumo_reuniao: "bg-indigo-100 text-indigo-800",
      documento_juridico: "bg-orange-100 text-orange-800",
      outros: "bg-gray-100 text-gray-800",
    };
    return colors[tipo] || "bg-gray-100 text-gray-800";
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString("pt-BR");
  };

  const formatarTamanho = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="max-w-full mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-4">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Central de Documentos da Cobrança
              </h1>
              <p className="text-gray-600">
                {tituloId
                  ? "Documentos da cobrança específica"
                  : cnpj
                  ? `Documentos da unidade ${cnpj}`
                  : "Todos os documentos do sistema"}
              </p>
            </div>
          </div>

          <div className="flex space-x-3">
            {tituloId && (
              <button
                onClick={abrirModalChecklist}
                className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Checklist
              </button>
            )}
            {showUploadButton && tituloId && (
              <button
                onClick={abrirModalUpload}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Documento
              </button>
            )}
          </div>
        </div>

        {/* Estatísticas */}
        {estatisticas && !tituloId && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                {estatisticas.total_documentos}
              </div>
              <div className="text-sm text-blue-800">Total de Documentos</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {estatisticas.documentos_pendentes}
              </div>
              <div className="text-sm text-yellow-800">
                Documentos Pendentes
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {estatisticas.uploads_mes_atual}
              </div>
              <div className="text-sm text-green-800">Uploads Este Mês</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {estatisticas.tamanho_total_mb.toFixed(1)} MB
              </div>
              <div className="text-sm text-purple-800">Tamanho Total</div>
            </div>
          </div>
        )}

        {/* Checklist de Completude */}
        {checklist && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                Completude dos Documentos -{" "}
                {checklist.status_cobranca.toUpperCase()}
              </h3>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                  <div
                    className="h-2 rounded-full bg-purple-500"
                    style={{ width: `${checklist.percentual_completude}%` }}
                  ></div>
                </div>
                <span className="text-lg font-bold text-purple-600">
                  {checklist.percentual_completude.toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {checklist.documentos_obrigatorios.map((doc, index) => (
                <div
                  key={index}
                  className={`flex items-center p-3 rounded-lg ${
                    doc.presente
                      ? "bg-green-100 border border-green-200"
                      : "bg-red-100 border border-red-200"
                  }`}
                >
                  {doc.presente ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600 mr-3" />
                  )}
                  <div>
                    <div
                      className={`font-medium ${
                        doc.presente ? "text-green-800" : "text-red-800"
                      }`}
                    >
                      {getTipoDocumentoLabel(doc.tipo)}
                    </div>
                    <div
                      className={`text-sm ${
                        doc.presente ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {doc.descricao}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros (apenas para visualização geral) */}
        {!tituloId && !cnpj && (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="flex items-center mb-4">
              <Filter className="w-5 h-5 text-gray-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-800">Filtros</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <select
                value={filtros.tipo_documento || ""}
                onChange={(e) =>
                  setFiltros({ ...filtros, tipo_documento: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os Tipos</option>
                <option value="notificacao_institucional">
                  Notificação Institucional
                </option>
                <option value="comprovante_pagamento">
                  Comprovante de Pagamento
                </option>
                <option value="termo_acordo">Termo de Acordo</option>
                <option value="planilha_atualizada">Planilha Atualizada</option>
                <option value="print_comunicacao">Print de Comunicação</option>
                <option value="resumo_reuniao">Resumo de Reunião</option>
                <option value="documento_juridico">Documento Jurídico</option>
                <option value="outros">Outros</option>
              </select>

              <select
                value={filtros.status_cobranca || ""}
                onChange={(e) =>
                  setFiltros({ ...filtros, status_cobranca: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Todos os Status</option>
                <option value="em_aberto">Em Aberto</option>
                <option value="negociando">Negociando</option>
                <option value="em_tratativa_juridica">
                  Tratativa Jurídica
                </option>
                <option value="quitado">Quitado</option>
              </select>

              <input
                type="text"
                value={filtros.cnpj || ""}
                onChange={(e) =>
                  setFiltros({ ...filtros, cnpj: e.target.value })
                }
                placeholder="CNPJ"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="date"
                value={filtros.dataInicio || ""}
                onChange={(e) =>
                  setFiltros({ ...filtros, dataInicio: e.target.value })
                }
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <input
                type="text"
                value={filtros.usuario_responsavel || ""}
                onChange={(e) =>
                  setFiltros({
                    ...filtros,
                    usuario_responsavel: e.target.value,
                  })
                }
                placeholder="Usuário"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Lista de Documentos */}
        <div className="space-y-4">
          {carregando ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Carregando documentos...</p>
            </div>
          ) : documentos.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum documento encontrado</p>
            </div>
          ) : (
            documentos.map((documento) => (
              <div
                key={documento.id}
                className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <FileText className="w-6 h-6 text-blue-600 mr-3" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">
                        {documento.nome_arquivo}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>{documento.nome_unidade}</span>
                        <span>{documento.cnpj_unidade}</span>
                        <span>
                          {formatarTamanho(documento.tamanho_arquivo)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getTipoColor(
                        documento.tipo_documento
                      )}`}
                    >
                      {getTipoDocumentoLabel(documento.tipo_documento)}
                    </span>
                    {documento.obrigatorio && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                        Obrigatório
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatarData(documento.data_upload)}
                  </div>
                  <div className="flex items-center">
                    <User className="w-4 h-4 mr-2" />
                    {documento.usuario_responsavel}
                  </div>
                  <div className="flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    {documento.status_cobranca_vinculado}
                  </div>
                </div>

                {documento.observacoes && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-700">
                      <strong>Observações:</strong> {documento.observacoes}
                    </p>
                  </div>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={() => baixarDocumento(documento)}
                    className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    Download
                  </button>
                  <button
                    onClick={() => abrirModalVisualizar(documento)}
                    className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Visualizar
                  </button>
                  <button
                    onClick={() => removerDocumento(documento.id)}
                    className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remover
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Upload */}
      {modalAberto === "upload" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Upload de Documento</h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Documento
                </label>
                <select
                  value={formUpload.tipo_documento || ""}
                  onChange={(e) =>
                    setFormUpload({
                      ...formUpload,
                      tipo_documento: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="notificacao_institucional">
                    Notificação Institucional
                  </option>
                  <option value="comprovante_pagamento">
                    Comprovante de Pagamento
                  </option>
                  <option value="termo_acordo">Termo de Acordo</option>
                  <option value="planilha_atualizada">
                    Planilha Atualizada
                  </option>
                  <option value="print_comunicacao">
                    Print de Comunicação
                  </option>
                  <option value="resumo_reuniao">Resumo de Reunião</option>
                  <option value="documento_juridico">Documento Jurídico</option>
                  <option value="outros">Outros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Arquivo (máx. 10MB)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.csv,.docx,.doc"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Formatos: PDF, JPG, PNG, CSV, DOCX
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações
                </label>
                <textarea
                  value={formUpload.observacoes || ""}
                  onChange={(e) =>
                    setFormUpload({
                      ...formUpload,
                      observacoes: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Observações sobre o documento..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="obrigatorio"
                  checked={formUpload.obrigatorio || false}
                  onChange={(e) =>
                    setFormUpload({
                      ...formUpload,
                      obrigatorio: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label
                  htmlFor="obrigatorio"
                  className="ml-2 text-sm font-medium text-gray-700"
                >
                  Documento obrigatório
                </label>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={uploadDocumento}
                disabled={processando || !arquivo}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processando ? "Enviando..." : "Enviar Documento"}
              </button>
              <button
                onClick={fecharModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Visualização */}
      {modalAberto === "visualizar" && documentoSelecionado && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Detalhes do Documento</h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nome do Arquivo
                  </label>
                  <p className="text-gray-900">
                    {documentoSelecionado.nome_arquivo}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tipo
                  </label>
                  <p className="text-gray-900">
                    {getTipoDocumentoLabel(documentoSelecionado.tipo_documento)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Tamanho
                  </label>
                  <p className="text-gray-900">
                    {formatarTamanho(documentoSelecionado.tamanho_arquivo)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Data Upload
                  </label>
                  <p className="text-gray-900">
                    {formatarData(documentoSelecionado.data_upload)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Usuário
                  </label>
                  <p className="text-gray-900">
                    {documentoSelecionado.usuario_responsavel}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Status Cobrança
                  </label>
                  <p className="text-gray-900">
                    {documentoSelecionado.status_cobranca_vinculado}
                  </p>
                </div>
              </div>

              {documentoSelecionado.observacoes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Observações
                  </label>
                  <p className="text-gray-900">
                    {documentoSelecionado.observacoes}
                  </p>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={() => baixarDocumento(documentoSelecionado)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </button>
                <button
                  onClick={fecharModal}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Checklist */}
      {modalAberto === "checklist" && checklist && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Checklist de Documentos</h3>
              <button
                onClick={fecharModal}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Status da Cobrança:</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {checklist.status_cobranca.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Completude:</span>
                  <div className="flex items-center">
                    <div className="w-32 bg-gray-200 rounded-full h-2 mr-3">
                      <div
                        className="h-2 rounded-full bg-purple-500"
                        style={{ width: `${checklist.percentual_completude}%` }}
                      ></div>
                    </div>
                    <span className="font-bold text-purple-600">
                      {checklist.percentual_completude.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {checklist.documentos_obrigatorios.map((doc, index) => (
                  <div
                    key={index}
                    className={`flex items-center p-4 rounded-lg border ${
                      doc.presente
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }`}
                  >
                    {doc.presente ? (
                      <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-600 mr-3" />
                    )}
                    <div>
                      <div
                        className={`font-medium ${
                          doc.presente ? "text-green-800" : "text-red-800"
                        }`}
                      >
                        {getTipoDocumentoLabel(doc.tipo)}
                      </div>
                      <div
                        className={`text-sm ${
                          doc.presente ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {doc.descricao}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={fecharModal}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
