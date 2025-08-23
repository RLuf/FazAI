#include "worker.hpp"
#include "ipc.hpp"
#include <nlohmann/json.hpp>
#include <iostream>
#include <cstdlib>
#include <string>
#include <signal.h>
#include <filesystem>

static std::atomic<bool> shutting_down{false};

void signal_handler(int sig) {
    std::cout << "\nRecebido sinal " << sig << ", encerrando..." << std::endl;
    shutting_down.store(true);
}

int main(int argc, char* argv[]) {
    // Verificação de versão
    if (argc > 1 && std::string(argv[1]) == "--version") {
        std::cout << "fazai-gemma-worker v1.0.0" << std::endl;
        std::cout << "Build: " << __DATE__ << " " << __TIME__ << std::endl;
        return 0;
    }
    
    // Verificação de ajuda
    if (argc > 1 && (std::string(argv[1]) == "--help" || std::string(argv[1]) == "-h")) {
        std::cout << "FazAI Gemma Worker" << std::endl;
        std::cout << "Usage: fazai-gemma-worker [--version|--help]" << std::endl;
        std::cout << "Environment variables:" << std::endl;
        std::cout << "  FAZAI_GEMMA_MODEL - Path to model file" << std::endl;
        std::cout << "  FAZAI_GEMMA_SOCKET - Socket path (default: /run/fazai/gemma.sock)" << std::endl;
        return 0;
    }
    
    // Configurar handlers de sinal
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);
    
    // Criar diretório para socket se não existir
    std::filesystem::create_directories("/run/fazai");
    std::filesystem::permissions("/run/fazai", std::filesystem::perms::all);
    
    // Obter caminho do modelo
    const char* model_path = getenv("FAZAI_GEMMA_MODEL");
    if (!model_path) {
        model_path = "/opt/fazai/models/gemma2-2b-it-sfp.bin";
    }
    
    // Obter caminho do socket
    const char* socket_path = getenv("FAZAI_GEMMA_SOCKET");
    if (!socket_path) {
        socket_path = "/run/fazai/gemma.sock";
    }
    
    std::cout << "Iniciando FazAI Gemma Worker..." << std::endl;
    std::cout << "Modelo: " << model_path << std::endl;
    std::cout << "Socket: " << socket_path << std::endl;
    
    // Inicializar engine Gemma
    GemmaEngine engine(model_path);
    if (!engine.is_initialized()) {
        std::cerr << "Erro: Falha ao inicializar GemmaEngine" << std::endl;
        return 1;
    }
    
    // Inicializar servidor IPC
    IpcServer server(socket_path);
    
    // Configurar handler de requisições
    server.on_request([&](const nlohmann::json& req, IpcConn& conn) {
        std::string type = req.value("type", "");
        
        try {
            if (type == "create_session") {
                std::string sid = engine.create_session(req.value("params", nlohmann::json::object()));
                conn.send(nlohmann::json{{"ok", true}, {"session_id", sid}});
            }
            else if (type == "generate") {
                std::string sid = req.at("session_id");
                std::string prompt = req.at("prompt");
                
                engine.generate_stream(sid, prompt, [&](const std::string& token) {
                    conn.send_stream(nlohmann::json{{"type", "token"}, {"text", token}});
                    return !shutting_down.load();
                });
                
                conn.send_stream(nlohmann::json{{"type", "stop"}}, true);
            }
            else if (type == "abort") {
                engine.abort(req.at("session_id"));
                conn.send(nlohmann::json{{"ok", true}});
            }
            else if (type == "close_session") {
                engine.close_session(req.at("session_id"));
                conn.send(nlohmann::json{{"ok", true}});
            }
            else if (type == "status") {
                conn.send(nlohmann::json{
                    {"ok", true},
                    {"status", "running"},
                    {"model_info", engine.get_model_info()}
                });
            }
            else {
                conn.send(nlohmann::json{{"ok", false}, {"error", "unknown_type"}});
            }
        }
        catch (const std::exception& e) {
            conn.send(nlohmann::json{{"ok", false}, {"error", e.what()}});
        }
    });
    
    // Iniciar servidor
    if (!server.run([&]() { return !shutting_down.load(); })) {
        std::cerr << "Erro: Falha ao iniciar servidor IPC" << std::endl;
        return 1;
    }
    
    std::cout << "FazAI Gemma Worker iniciado com sucesso" << std::endl;
    std::cout << "Aguardando conexões em: " << socket_path << std::endl;
    
    // Loop principal
    while (!shutting_down.load()) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }
    
    std::cout << "Encerrando FazAI Gemma Worker..." << std::endl;
    return 0;
}
