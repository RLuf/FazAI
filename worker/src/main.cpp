#include "worker.hpp"
#include "ipc.hpp"
#include "logging.hpp"
#include "qdrant_client.h"
#include <nlohmann/json.hpp>
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
        model_path = "/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs";
    }
    
    // Obter caminho do socket
    const char* socket_path = getenv("FAZAI_GEMMA_SOCKET");
    if (!socket_path) {
        socket_path = "/run/fazai/gemma.sock";
    }
    
    log_info("Iniciando FazAI Gemma Worker...", {{"model", model_path}, {"socket", socket_path}});
    // Diagnóstico: checar existência e permissão do modelo
    FILE* f = fopen(model_path, "rb");
    if (!f) {
        log_error("Arquivo de modelo não pode ser aberto. Verifique o caminho e permissões.", {{"model", model_path}});
        return 1;
    } else {
        fclose(f);
    }
    
    // Inicializar engine Gemma
    std::cout << "Inicializando GemmaEngine..." << std::endl;
    GemmaEngine engine;
    
    if (!engine.initialize_model(model_path)) {
        std::cerr << "Erro: Falha ao inicializar modelo: " << model_path << std::endl;
        return 1;
    }
    
    // Carregar personalidade do Claudio executando o loader Node.js
    std::string personality_prompt;
    {
        const char* loader = "/home/rluft/fazai/worker/qdrant_personality.js";
        if (std::filesystem::exists(loader)) {
            std::string cmd = std::string("node ") + loader;
            FILE* pf = popen(cmd.c_str(), "r");
            if (pf) {
                char buffer[4096];
                std::string out;
                while (fgets(buffer, sizeof(buffer), pf)) {
                    out += buffer;
                }
                pclose(pf);
                
                // Extrair prompt da personalidade
                size_t prompt_start = out.find("PERSONALIDADE CLAUDIO CARREGADA DO QDRANT:");
                if (prompt_start != std::string::npos) {
                    size_t prompt_end = out.find("================================================================================", prompt_start + 1);
                    if (prompt_end != std::string::npos) {
                        personality_prompt = out.substr(prompt_start, prompt_end - prompt_start);
                        engine.set_personality_prompt(personality_prompt);
                        log_info("Personalidade do Claudio carregada e integrada", {{"len", (int)personality_prompt.size()}});
                    } else {
                        log_error("Formato inválido do prompt de personalidade");
                    }
                } else {
                    log_error("Prompt de personalidade não encontrado na saída");
                }
            } else {
                log_error("Falha ao executar qdrant_personality.js");
            }
        } else {
            log_info("Loader de personalidade não encontrado, seguindo sem personalidade");
        }
    }

    // Inicializar Qdrant client (memória de contexto)
    fazai::QdrantClient qdrant;

    // Tentar iniciar MCP do Claudio (se presente)
    {
        const char* mcp = "/home/rluft/fazai/claudio_mcp.js";
        if (std::filesystem::exists(mcp)) {
            std::string cmd = std::string("nohup node ") + mcp + " >/var/log/claudio_mcp.log 2>&1 &";
            int rc = system(cmd.c_str());
            if (rc == 0) log_info("Claudio MCP iniciado em background", {{"path", mcp}});
            else log_error("Falha ao iniciar Claudio MCP", {{"rc", rc}});
        } else {
            log_info("claudio_mcp.js não encontrado; pulando inicialização do MCP");
        }
    }
    
    // Inicializar servidor IPC
    IpcServer server(socket_path);
    
    // Configurar handler de requisições
    server.on_request([&](const nlohmann::json& req, IpcConn& conn) {
        try {
            // Aceitar payloads que venham como string contendo JSON (double-encoded)
            nlohmann::json payload = req;
            if (payload.is_string()) {
                try {
                    payload = nlohmann::json::parse(payload.get<std::string>());
                } catch (const std::exception& e) {
                    std::string raw = req.dump();
                    std::cerr << "Mensagem recebida (string) não pôde ser desserializada: " << raw << " -> " << e.what() << std::endl;
                    conn.send(nlohmann::json{{"ok", false}, {"error", "invalid_request"}});
                    return;
                }
            }

            if (!payload.is_object()) {
                std::string raw = payload.dump();
                std::cerr << "Mensagem recebida não é um objeto JSON: " << raw << std::endl;
                conn.send(nlohmann::json{{"ok", false}, {"error", "invalid_request"}});
                return;
            }

            std::string type = payload.value("type", "");

            if (type == "create_session") {
                nlohmann::json params = nlohmann::json::object();
                if (payload.contains("params") && payload["params"].is_object()) params = payload["params"];
                std::string sid = engine.create_session(params);
                conn.send(nlohmann::json{{"ok", true}, {"session_id", sid}});
                return;
            }

            if (type == "generate") {
                if (!payload.contains("session_id") || !payload["session_id"].is_string()) {
                    conn.send(nlohmann::json{{"ok", false}, {"error", "missing_session_id"}});
                    return;
                }
                if (!payload.contains("prompt") || !payload["prompt"].is_string()) {
                    conn.send(nlohmann::json{{"ok", false}, {"error", "missing_prompt"}});
                    return;
                }

                std::string sid = payload["session_id"].get<std::string>();
                std::string prompt = payload["prompt"].get<std::string>();

                log_info("Querying Qdrant for context", {{"prompt", prompt}});
                // Preencher contexto: personalidade + qdrant context
                std::string full_prompt;
                if (!personality_prompt.empty()) {
                    full_prompt += personality_prompt;
                    full_prompt += "\n---\n";
                }
                // Query Qdrant for additional context fragments
                try {
                    auto ctxs = qdrant.query_context("fazai_kb", prompt, 3);
                    if (!ctxs.empty()) {
                        log_info("Context found in Qdrant", {{"fragments", ctxs.size()}});
                        for (auto &c : ctxs) {
                            if (!c.empty()) {
                                full_prompt += "CONTEXT: ";
                                full_prompt += c;
                                full_prompt += "\n";
                            }
                        }
                    } else {
                        log_info("No context found in Qdrant for this prompt.");
                    }
                } catch (const std::exception& e) {
                    log_error("Qdrant query failed", {{"error", e.what()}});
                }

                full_prompt += "USER_PROMPT:\n" + prompt + "\n";
                log_info("Final prompt constructed", {{"full_prompt_size", full_prompt.size()}});

                // Buffer de linhas para montagem de ND-JSON
                std::string linebuf;

                engine.generate_stream(sid, full_prompt, [&](const std::string& token) {
                    // Token pode ser fragmento; append
                    linebuf += token;

                    // Processar linhas completas
                    size_t pos;
                    while ((pos = linebuf.find('\n')) != std::string::npos) {
                        std::string line = linebuf.substr(0, pos);
                        linebuf.erase(0, pos + 1);

                        if (line.empty()) continue;

                        // Tentar parsear JSON
                        try {
                            nlohmann::json obj = nlohmann::json::parse(line);

                            // Se o modelo retornar um action de tipo shell, executar
                            if (obj.is_object() && obj.value("type", "") == "shell") {
                                // Agora permitimos actions de shell geradas pelo modelo, mas aplicamos
                                // whitelist e timeout para reduzir riscos. A execução é sempre
                                // autorizada aqui (controle central deve validar entrada natural-language).
                                if (obj.contains("command") && obj["command"].is_string()) {
                                    std::string cmd = obj["command"].get<std::string>();
                                    // Whitelist simples: permitir comandos básicos
                                    const std::vector<std::string> allowed_prefixes = {"bash ", "sh ", "echo ", "cat ", "touch ", "chmod ", "mkdir ", "rm ", "mv ", "cp ", "sed ", "awk ", "printf ", "tee ", "/bin/"};
                                    bool ok_prefix = false;
                                    for (auto &pfx : allowed_prefixes) {
                                        if (cmd.rfind(pfx, 0) == 0) { ok_prefix = true; break; }
                                    }
                                    if (!ok_prefix) {
                                        conn.send_stream(nlohmann::json{{"type", "shell_skipped"}, {"reason", "not_whitelisted"}});
                                    } else {
                                        // Executar com timeout para segurança
                                        std::string safe_cmd = "timeout 30s bash -lc '" + cmd + "'";
                                        FILE* f = popen(safe_cmd.c_str(), "r");
                                        if (!f) {
                                            conn.send_stream(nlohmann::json{{"type", "shell_error"}, {"error", "popen_failed"}});
                                        } else {
                                            char buf[512];
                                            while (fgets(buf, sizeof(buf), f)) {
                                                std::string l(buf);
                                                if (!l.empty() && l.back() == '\n') l.pop_back();
                                                conn.send_stream(nlohmann::json{{"type", "shell_output"}, {"line", l}});
                                            }
                                            int rc = pclose(f);
                                            conn.send_stream(nlohmann::json{{"type", "shell_exit"}, {"code", rc}});
                                        }
                                    }
                                } else {
                                    conn.send_stream(nlohmann::json{{"type", "shell_skipped"}, {"reason", "missing_command"}});
                                }
                            } else {
                                // Forward any other object directly
                                conn.send_stream(obj);
                            }
                        } catch (const std::exception& e) {
                            // Não é JSON completo; fallback: enviar como token event
                            conn.send_stream(nlohmann::json{{"type", "token"}, {"text", line}});
                        }
                    }

                    return !shutting_down.load();
                });

                // flush any remaining buffer as token
                if (!linebuf.empty()) {
                    conn.send_stream(nlohmann::json{{"type", "token"}, {"text", linebuf}});
                }

                conn.send_stream(nlohmann::json{{"type", "stop"}}, true);
                conn.send_stream(nlohmann::json{{"type", "done"}}, true);
                return;
            }

            if (type == "exec") {
                // Execução direta de comandos: sempre permitida internamente.
                if (!payload.contains("command") || !payload["command"].is_string()) {
                    conn.send(nlohmann::json{{"ok", false}, {"error", "missing_command"}});
                    return;
                }

                std::string cmd = payload["command"].get<std::string>();
                // Garantir execução no diretório raiz para evitar escritas em HOME do usuário do serviço
                if (chdir("/") != 0) {
                    // continue mesmo se chdir falhar
                }

                // Aplicar whitelist local também aqui para comandos diretos
                const std::vector<std::string> allowed_prefixes = {"bash ", "sh ", "echo ", "cat ", "touch ", "chmod ", "mkdir ", "rm ", "mv ", "cp ", "sed ", "awk ", "printf ", "tee ", "/bin/"};
                bool ok_prefix = false;
                for (auto &pfx : allowed_prefixes) {
                    if (cmd.rfind(pfx, 0) == 0) { ok_prefix = true; break; }
                }
                if (!ok_prefix) {
                    conn.send(nlohmann::json{{"ok", false}, {"error", "not_whitelisted"}});
                    return;
                }

                // Executar com timeout para segurança
                std::string safe_cmd = std::string("timeout 30s bash -lc '") + cmd + "'";
                FILE* f = popen(safe_cmd.c_str(), "r");
                if (!f) {
                    conn.send(nlohmann::json{{"ok", false}, {"error", "popen_failed"}});
                    return;
                }

                conn.send(nlohmann::json{{"ok", true}});
                char buf[512];
                while (fgets(buf, sizeof(buf), f)) {
                    std::string line(buf);
                    if (!line.empty() && line.back() == '\n') line.pop_back();
                    conn.send_stream(nlohmann::json{{"type", "shell_output"}, {"line", line}});
                }
                int rc = pclose(f);
                conn.send_stream(nlohmann::json{{"type", "shell_exit"}, {"code", rc}} , true);
                return;
            }

            if (type == "abort") {
                if (payload.contains("session_id") && payload["session_id"].is_string()) engine.abort(payload["session_id"].get<std::string>());
                conn.send(nlohmann::json{{"ok", true}});
                return;
            }

            if (type == "close_session") {
                if (payload.contains("session_id") && payload["session_id"].is_string()) engine.close_session(payload["session_id"].get<std::string>());
                conn.send(nlohmann::json{{"ok", true}});
                return;
            }

            if (type == "status") {
                conn.send(nlohmann::json{
                    {"ok", true},
                    {"status", "running"},
                    {"model_info", engine.get_model_info()}
                });
                return;
            }

            conn.send(nlohmann::json{{"ok", false}, {"error", "unknown_type"}});
        }
        catch (const std::exception& e) {
            conn.send(nlohmann::json{{"ok", false}, {"error", e.what()}});
        }
    });
    
    // Iniciar servidor
    if (!server.run([&]() { return !shutting_down.load(); })) {
        log_error("Falha ao iniciar servidor IPC");
        return 1;
    }
    
    log_info("FazAI Gemma Worker iniciado com sucesso", {{"socket", socket_path}});
    
    // Loop principal
    while (!shutting_down.load()) {
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }
    
    log_info("Encerrando FazAI Gemma Worker...");
    return 0;
}
