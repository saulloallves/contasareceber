import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

export interface ConnectionStatus {
  isConnected: boolean;
  lastCheck: Date;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

export class ConnectionService {
  private static instance: ConnectionService;
  private connectionStatus: ConnectionStatus = {
    isConnected: true,
    lastCheck: new Date(),
    reconnectAttempts: 0,
    maxReconnectAttempts: 3
  };
  
  private checkInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private listeners: ((status: ConnectionStatus) => void)[] = [];

  static getInstance(): ConnectionService {
    if (!ConnectionService.instance) {
      ConnectionService.instance = new ConnectionService();
    }
    return ConnectionService.instance;
  }

  /**
   * Inicia monitoramento de conexão
   */
  startMonitoring(): void {
    console.log('🔍 Iniciando monitoramento de conexão com Supabase...');
    
    // Para monitoramento anterior se existir
    this.stopMonitoring();
    
    // Verifica conexão a cada 30 segundos
    this.checkInterval = window.setInterval(() => {
      this.checkConnection();
    }, 30000);
    
    // Verifica imediatamente
    this.checkConnection();
    
    // Monitora eventos de rede do navegador
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Monitora visibilidade da página
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Para monitoramento de conexão
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  /**
   * Verifica se a conexão com Supabase está funcionando
   */
  async checkConnection(): Promise<boolean> {
    try {
      console.log('🔍 Verificando conexão com Supabase...');
      
      // Faz uma query simples para testar a conexão
      const { data, error } = await supabase
        .from('configuracoes_cobranca')
        .select('id')
        .limit(1)
        .maybeSingle();

      const isConnected = !error;
      
      if (isConnected) {
        console.log('✅ Conexão com Supabase OK');
        this.updateConnectionStatus(true);
        this.connectionStatus.reconnectAttempts = 0;
      } else {
        console.warn('⚠️ Falha na conexão com Supabase:', error);
        this.updateConnectionStatus(false);
        this.attemptReconnect();
      }
      
      return isConnected;
    } catch (error) {
      console.error('❌ Erro ao verificar conexão:', error);
      this.updateConnectionStatus(false);
      this.attemptReconnect();
      return false;
    }
  }

  /**
   * Tenta reconectar automaticamente
   */
  private attemptReconnect(): void {
    if (this.connectionStatus.reconnectAttempts >= this.connectionStatus.maxReconnectAttempts) {
      console.error('❌ Máximo de tentativas de reconexão atingido');
      toast.error('Conexão perdida. Recarregue a página (F5) para continuar.', {
        duration: 10000,
        id: 'connection-lost'
      });
      return;
    }

    this.connectionStatus.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.connectionStatus.reconnectAttempts), 30000);
    
    console.log(`🔄 Tentativa de reconexão ${this.connectionStatus.reconnectAttempts}/${this.connectionStatus.maxReconnectAttempts} em ${delay}ms...`);
    
    toast.loading(`Tentando reconectar... (${this.connectionStatus.reconnectAttempts}/${this.connectionStatus.maxReconnectAttempts})`, {
      id: 'reconnecting'
    });

    this.reconnectTimeout = window.setTimeout(async () => {
      const success = await this.checkConnection();
      
      if (success) {
        toast.success('Conexão restaurada!', {
          id: 'reconnecting'
        });
      }
    }, delay);
  }

  /**
   * Atualiza status da conexão
   */
  private updateConnectionStatus(isConnected: boolean): void {
    const wasConnected = this.connectionStatus.isConnected;
    
    this.connectionStatus.isConnected = isConnected;
    this.connectionStatus.lastCheck = new Date();
    
    // Notifica listeners sobre mudança de status
    this.listeners.forEach(listener => listener(this.connectionStatus));
    
    // Log apenas quando há mudança de estado
    if (wasConnected !== isConnected) {
      console.log(`🔄 Status de conexão alterado: ${isConnected ? 'CONECTADO' : 'DESCONECTADO'}`);
    }
  }

  /**
   * Adiciona listener para mudanças de status
   */
  addStatusListener(listener: (status: ConnectionStatus) => void): () => void {
    this.listeners.push(listener);
    
    // Retorna função para remover o listener
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Força reconexão manual
   */
  async forceReconnect(): Promise<boolean> {
    console.log('🔄 Forçando reconexão...');
    this.connectionStatus.reconnectAttempts = 0;
    return await this.checkConnection();
  }

  /**
   * Obtém status atual da conexão
   */
  getStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Handlers para eventos do navegador
   */
  private handleOnline = (): void => {
    console.log('🌐 Navegador voltou online');
    toast.dismiss('connection-lost');
    this.checkConnection();
  };

  private handleOffline = (): void => {
    console.log('📴 Navegador ficou offline');
    this.updateConnectionStatus(false);
    toast.error('Sem conexão com a internet', {
      id: 'offline'
    });
  };

  private handleVisibilityChange = (): void => {
    if (!document.hidden) {
      console.log('👁️ Página voltou a ficar visível, verificando conexão...');
      // Aguarda um pouco antes de verificar para dar tempo da rede se estabilizar
      setTimeout(() => {
        this.checkConnection();
      }, 1000);
    }
  };

  /**
   * Executa query com retry automático
   */
  async executeWithRetry<T>(
    queryFn: () => Promise<{ data: T | null; error: any }>,
    maxRetries: number = 2
  ): Promise<{ data: T | null; error: any }> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        console.log(`🔄 Executando query (tentativa ${attempt}/${maxRetries + 1})...`);
        
        const result = await queryFn();
        
        if (!result.error) {
          // Query bem-sucedida, atualiza status de conexão
          this.updateConnectionStatus(true);
          this.connectionStatus.reconnectAttempts = 0;
          return result;
        }
        
        lastError = result.error;
        console.warn(`⚠️ Erro na tentativa ${attempt}:`, result.error);
        
        // Se não é a última tentativa, aguarda antes de tentar novamente
        if (attempt <= maxRetries) {
          const delay = 1000 * attempt; // Delay progressivo
          console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        lastError = error;
        console.error(`❌ Erro inesperado na tentativa ${attempt}:`, error);
        
        if (attempt <= maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    // Todas as tentativas falharam
    console.error('❌ Todas as tentativas falharam:', lastError);
    this.updateConnectionStatus(false);
    
    return { data: null, error: lastError };
  }

  /**
   * Wrapper para queries do Supabase com retry automático
   */
  async query<T>(queryFn: () => Promise<{ data: T | null; error: any }>): Promise<{ data: T | null; error: any }> {
    return this.executeWithRetry(queryFn);
  }
}

export const connectionService = ConnectionService.getInstance();