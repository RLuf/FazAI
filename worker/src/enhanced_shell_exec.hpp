#pragma once
#include <cstdio>
#include <memory>
#include <string>
#include <cstdlib>
#include <iostream>
#include <chrono>
#include <stdexcept>

/**
 * VERSÃO MELHORADA DO SHELL_EXEC
 * Combina robustez da versão CLI com funcionalidades específicas para FazAI
 */

class EnhancedShellExecutor {
private:
    std::string model_path_;
    int default_timeout_ms_;
    
public:
    explicit EnhancedShellExecutor(const std::string& model_path = "", int timeout = 30000) 
        : model_path_(model_path), default_timeout_ms_(timeout) {
        
        // Se model_path não foi especificado, tentar pegar da env
        if (model_path_.empty()) {
            const char* env_path = std::getenv("GEMMA_WEIGHTS");
            if (env_path) {
                model_path_ = env_path;
            } else {
                model_path_ = "/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs";
            }
        }
    }
    
    // Execução básica (compatível com versão CLI)
    std::string execute_shell(const std::string& command) const {
        return execute_shell_with_timeout(command, default_timeout_ms_);
    }
    
    // Execução com timeout personalizado
    std::string execute_shell_with_timeout(const std::string& command, int timeout_ms) const {
        try {
            char buffer[256]; // Buffer maior que a versão CLI
            std::string result = "";
            
            // Sanitização desabilitada temporariamente a pedido: não bloquear comandos
            
            auto start_time = std::chrono::steady_clock::now();
            std::unique_ptr<FILE, decltype(&pclose)> pipe(popen(command.c_str(), "r"), pclose);
            
            if (!pipe) {
                return "ERRO: Não foi possível executar comando - " + command;
            }
            
            while (fgets(buffer, sizeof(buffer), pipe.get()) != nullptr) {
                result += buffer;
                
                // Verificar timeout
                auto current_time = std::chrono::steady_clock::now();
                auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
                    current_time - start_time).count();
                    
                if (elapsed > timeout_ms) {
                    return "TIMEOUT: Comando excedeu " + std::to_string(timeout_ms) + "ms - " + command;
                }
            }
            
            return result.empty() ? "Comando executado sem saída" : result;
            
        } catch (const std::exception& e) {
            return "EXCEÇÃO: " + std::string(e.what()) + " - " + command;
        }
    }
    
    // Execução com modelo Gemma (nossa versão melhorada)
    std::string execute_gemma_command(const std::string& base_command) const {
        std::string full_command = base_command + " --model " + model_path_;
        std::cout << "🤖 Executando com modelo Gemma: " << model_path_ << std::endl;
        return execute_shell_with_timeout(full_command, default_timeout_ms_);
    }
    
    // Definir caminho do modelo dinamicamente
    void set_model_path(const std::string& path) {
        model_path_ = path;
        std::cout << "🔄 Modelo atualizado para: " << model_path_ << std::endl;
    }
    
    std::string get_model_path() const {
        return model_path_;
    }
    
private:
    // Validação de segurança aprimorada
    bool is_dangerous_command(const std::string& /*command*/) const {
        // Sanitização desabilitada: sempre permitir
        return false;
    }
};

// Função global compatível com versão CLI original
inline std::string execute_shell(const std::string& command) {
    static EnhancedShellExecutor executor;
    return executor.execute_shell(command);
}

// Função global melhorada para FazAI
inline std::string execute_shell_enhanced(const std::string& command, int timeout_ms = 30000) {
    static EnhancedShellExecutor executor;
    return executor.execute_shell_with_timeout(command, timeout_ms);
}