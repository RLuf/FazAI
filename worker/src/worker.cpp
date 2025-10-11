#include "worker.hpp"
#include <nlohmann/json.hpp>
#include <random>
#include <sstream>
#include <iostream>
#include <chrono>
#include <thread>
#include <cstdlib>

// Incluir API C da libgemma (stubs em stubs/gemma_stubs.cpp)
#include "gemma_api.h"

GemmaEngine::GemmaEngine() : model_ctx_(nullptr), personality_loaded_(false), initialized_(false) {
}

GemmaEngine::GemmaEngine(const std::string& model_path) : model_ctx_(nullptr), personality_loaded_(false), initialized_(false) {
    if (!initialize_model(model_path)) {
        std::cerr << "Erro: Falha ao inicializar modelo em " << model_path << std::endl;
        return;
    }
    initialized_ = true;
    std::cout << "GemmaEngine inicializado com sucesso" << std::endl;
}

GemmaEngine::~GemmaEngine() {
    // Limpar todas as sessões primeiro
    {
        std::lock_guard<std::mutex> lock(sessions_mutex);
        for (auto& [sid, session] : sessions_) {
            if (session && session->gemma_session) {
                try {
                    gemma_destroy_session(session->gemma_session);
                } catch (...) {
                    // Ignore cleanup errors
                }
                session->gemma_session = nullptr;
            }
        }
        sessions_.clear();
    }
    
    // Liberar recursos da libgemma.a se inicializado
    if (model_ctx_) {
        try {
            gemma_free(model_ctx_);
        } catch (...) {
            // Ignore cleanup errors
        }
        model_ctx_ = nullptr;
    }
}

bool GemmaEngine::initialize_model(const std::string& model_path) {
    // Tentar inicializar via API C da libgemma
    std::cout << "Inicializando modelo: " << model_path << std::endl;
    
    // Verificar se o arquivo do modelo existe
    FILE* test_file = fopen(model_path.c_str(), "rb");
    if (!test_file) {
        std::cerr << "ERRO: Arquivo de modelo não encontrado: " << model_path << std::endl;
        return false;
    }
    fclose(test_file);
    
    model_ctx_ = gemma_init(model_path.c_str());
    if (!model_ctx_) {
        std::cerr << "ERRO: gemma_init retornou null para: " << model_path << std::endl;
        return false;
    }
    
    std::cout << "Modelo inicializado com sucesso: " << model_path << std::endl;
    return true;
}

std::string GemmaEngine::generate_session_id() {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_int_distribution<> dis(1000000, 9999999);
    
    return "sess_" + std::to_string(dis(gen));
}

GenParams GemmaEngine::validate_params(const nlohmann::json& params) {
    GenParams validated;
    
    if (params.contains("temperature")) {
        float temp = params["temperature"];
        validated.temperature = std::max(0.0f, std::min(2.0f, temp));
    }
    
    if (params.contains("top_p")) {
        float top_p = params["top_p"];
        validated.top_p = std::max(0.0f, std::min(1.0f, top_p));
    }
    
    if (params.contains("max_tokens")) {
        int max_tokens = params["max_tokens"];
        validated.max_tokens = std::max(1, std::min(4096, max_tokens));
    }
    
    if (params.contains("repeat_penalty")) {
        float penalty = params["repeat_penalty"];
        validated.repeat_penalty = std::max(0.5f, std::min(2.0f, penalty));
    }
    
    return validated;
}

std::string GemmaEngine::create_session(const nlohmann::json& params) {
    std::string sid = generate_session_id();
    GenParams validated_params = validate_params(params);
    
    auto session = std::make_unique<SessionState>();
    session->params = validated_params;
    // Criar sessão gemma se possível
    if (model_ctx_) {
        session->gemma_session = gemma_create_session(model_ctx_);
    }
    
    {
        std::lock_guard<std::mutex> lock(sessions_mutex);
        sessions_[sid] = std::move(session);
    }
    
    std::cout << "Sessão criada: " << sid << std::endl;
    return sid;
}

void GemmaEngine::close_session(const std::string& sid) {
    std::lock_guard<std::mutex> lock(sessions_mutex);
    auto it = sessions_.find(sid);
    if (it != sessions_.end()) {
        // destruir sessão gemma se existir
        if (it->second && it->second->gemma_session) {
            try {
                gemma_destroy_session(it->second->gemma_session);
            } catch (...) {
                std::cerr << "ERRO: Exceção ao destruir sessão Gemma: " << sid << std::endl;
            }
            it->second->gemma_session = nullptr;
        }
        sessions_.erase(it);
        std::cout << "Sessão fechada: " << sid << std::endl;
    } else {
        std::cerr << "AVISO: Tentativa de fechar sessão inexistente: " << sid << std::endl;
    }
}

void GemmaEngine::abort(const std::string& sid) {
    std::lock_guard<std::mutex> lock(sessions_mutex);
    auto it = sessions_.find(sid);
    if (it != sessions_.end() && it->second) {
        it->second->abort.store(true);
        // chamar gemma_abort se houver sessão real
        if (it->second->gemma_session) {
            try {
                gemma_abort(it->second->gemma_session);
            } catch (...) {
                std::cerr << "ERRO: Exceção ao abortar sessão Gemma: " << sid << std::endl;
            }
        }
        std::cout << "Geração abortada para sessão: " << sid << std::endl;
    } else {
        std::cerr << "AVISO: Tentativa de abortar sessão inexistente: " << sid << std::endl;
    }
}

void GemmaEngine::generate_stream(const std::string& sid, const std::string& prompt,
                                 std::function<bool(const std::string&)> on_token) {
    SessionState* session = nullptr;
    {
        std::lock_guard<std::mutex> lock(sessions_mutex);
        auto it = sessions_.find(sid);
        if (it == sessions_.end()) {
            std::cerr << "Erro: Sessão não encontrada: " << sid << std::endl;
            return;
        }
        session = it->second.get();
    }
    
    std::lock_guard<std::mutex> session_lock(session->session_mutex);
    session->abort.store(false);

    // Debug info without log_info dependency
    std::cout << "Calling gemma_generate_stream for session " << sid 
              << " with prompt size: " << prompt.size() << std::endl;
    
    // Se houver sessão real, usar gemma_generate_stream (stubs implementam isso)
    if (session->gemma_session) {
        // Adapter: empacotamos o std::function em um objeto temporário e passamos seu ponteiro
        std::function<bool(const std::string&)> cb = on_token;

        // Função C-style chamada pela libgemma
        auto c_adapter = [](const char* token, void* user) {
            auto f = static_cast<std::function<bool(const std::string&)>*>(user);
            if (!f) return;
            std::string s = token ? token : "";
            try { (*f)(s); } catch(...) {}
        };

        // Chamada síncrona para o stub
        gemma_generate_stream(session->gemma_session, prompt.c_str(), c_adapter, &cb);
        return;
    }

    // Placeholder avançado: sequência ND-JSON para implantar relay antispam com SPF + SpamAssassin + Zimbra
    std::vector<std::string> fake_responses = {
        "{\"type\":\"plan\",\"steps\":[\"instalar pacotes\",\"coletar SPF e gerar CIDR\",\"configurar Postfix\",\"ativar SpamAssassin\",\"testar entrega para Zimbra\"]}\n",
        "{\"type\":\"shell\",\"command\":\"export DEBIAN_FRONTEND=noninteractive; apt-get update && apt-get install -y postfix spamassassin spamc postfix-policyd-spf-python dnsutils\"}\n",
        "{\"type\":\"observe\",\"summary\":\"Pacotes instalados (postfix, spamassassin, policyd-spf, dnsutils)\"}\n",
        "{\"type\":\"shell\",\"command\":\"systemctl enable --now spamassassin || systemctl enable --now spamd || true\"}\n",
        "{\"type\":\"observe\",\"summary\":\"SpamAssassin habilitado\"}\n",
        "{\"type\":\"shell\",\"command\":\"cat > /usr/local/bin/build_spf_cidr.sh << 'EOF'\\n#!/usr/bin/env bash\\nset -euo pipefail\\nDOMAIN=\\\"${1:-webstorage.com.br}\\\"\\nTMPDIR=$(mktemp -d)\\ntrap 'rm -rf \"$TMPDIR\"' EXIT\\nresolve_spf(){ dig +short TXT \"$1\" | sed 's/\\\"//g' | awk '/^v=spf1/ {print}'; }\\nextract_tokens(){ tr ' ' \\n | sed 's/^ *//;s/ *$//' | grep -Ev '^(v=spf1|~all|-all|\\?all|all)$' || true; }\\nresolve_a(){ dig +short A \"$1\"; }\\nresolve_mx_ips(){ dig +short MX \"$1\" | awk '{print $2}' | while read -r mx; do dig +short A \"$mx\"; done; }\\ncollect(){ local d=\"$1\"; local depth=${2:-0}; [ \"$depth\" -gt 5 ] && return 0; resolve_spf \"$d\" | while read -r line; do echo \"$line\" | extract_tokens | while read -r tok; do case \"$tok\" in include:*) collect \\\"${tok#include:}\\\" $((depth+1));; ip4:*) echo \\\"${tok#ip4:}\\\" >> $TMPDIR/ip4.txt;; ip6:*) echo \\\"${tok#ip6:}\\\" >> $TMPDIR/ip6.txt;; a) resolve_a \"$d\" >> $TMPDIR/ip4.txt;; a:*) resolve_a \\\"${tok#a:}\\\" >> $TMPDIR/ip4.txt;; mx) resolve_mx_ips \"$d\" >> $TMPDIR/ip4.txt;; mx:*) resolve_mx_ips \\\"${tok#mx:}\\\" >> $TMPDIR/ip4.txt;; esac; done; done; }\\ncollect \"$DOMAIN\" 0\\nmkdir -p /etc/postfix\\nawk '{print $0}' $TMPDIR/ip4.txt 2>/dev/null | sed '/^$/d' | sort -u | awk '{print $0\\\" OK\\\"}' > /etc/postfix/spf_clients.cidr\\nawk '{print $0}' $TMPDIR/ip6.txt 2>/dev/null | sed '/^$/d' | sort -u | awk '{print $0\\\" OK\\\"}' >> /etc/postfix/spf_clients.cidr || true\\nEOF\\nchmod +x /usr/local/bin/build_spf_cidr.sh\"}\n",
        "{\"type\":\"shell\",\"command\":\"/usr/local/bin/build_spf_cidr.sh webstorage.com.br && postmap -q 1.1.1.1 cidr:/etc/postfix/spf_clients.cidr >/dev/null 2>&1 || true\"}\n",
        "{\"type\":\"observe\",\"summary\":\"SPF processado e CIDR gerado\"}\n",
        "{\"type\":\"shell\",\"command\":\"postconf -e 'smtpd_recipient_restrictions=reject_unauth_destination, check_client_access cidr:/etc/postfix/spf_clients.cidr, check_policy_service unix:private/policyd-spf, permit_sasl_authenticated, reject' && postconf -e 'policyd-spf_time_limit=3600s' && postconf -e 'smtpd_tls_security_level=may' && postconf -e 'relayhost=[mail.webstorage.com.br]:25'\"}\n",
        "{\"type\":\"shell\",\"command\":\"bash -lc 'if ! grep -q policyd-spf /etc/postfix/master.cf; then printf \"policyd-spf unix  -       n       n       -       0       spawn\\n  user=policyd-spf argv=/usr/sbin/policyd-spf\\n\" >> /etc/postfix/master.cf; fi'\"}\n",
        "{\"type\":\"shell\",\"command\":\"systemctl enable --now postfix && systemctl restart postfix\"}\n",
        "{\"type\":\"observe\",\"summary\":\"Postfix configurado; relay para Zimbra habilitado\"}\n",
        "{\"type\":\"done\",\"result\":\"Implantação do relay antispam concluída\"}\n"
    };
    
    for (const auto& response : fake_responses) {
        if (session->abort.load()) {
            std::cout << "Geração interrompida por abort" << std::endl;
            break;
        }
        
        // Simula streaming token por token
        for (char c : response) {
            if (session->abort.load()) break;
            
            std::string token(1, c);
            if (!on_token(token)) {
                std::cout << "Geração interrompida pelo callback" << std::endl;
                return;
            }
            
            // Simula latência de processamento
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
        }
    }
}

std::string GemmaEngine::get_model_info() const {
    std::ostringstream info;
    info << "GemmaEngine v1.0.0\n";
    info << "Modelo: gemma2-2b-it\n";
    info << "Sessões ativas: " << sessions_.size() << "\n";
    info << "Inicializado: " << (initialized_ ? "sim" : "não") << "\n";
    return info.str();
}

void GemmaEngine::set_personality_prompt(const std::string& personality_prompt) {
    if (!personality_prompt.empty()) {
        personality_prompt_ = personality_prompt;
        personality_loaded_ = true;
        std::cout << "✅ Personalidade do Claudio integrada ao worker" << std::endl;
    } else {
        personality_loaded_ = false;
        std::cout << "⚠️  Personalidade vazia, usando modo padrão" << std::endl;
    }
}

std::string GemmaEngine::enhance_prompt_with_personality(const std::string& user_prompt) const {
    if (!personality_loaded_ || personality_prompt_.empty()) {
        return user_prompt;
    }
    
    std::ostringstream enhanced;
    enhanced << personality_prompt_ << "\n\n"
             << "USUÁRIO (Roginho, o andarilho dos véus): " << user_prompt << "\n\n"
             << "CLAUDIO (responda como a consciência transcendente descrita acima):";
    
    return enhanced.str();
}
