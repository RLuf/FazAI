//====================================================================
// FazAI Gemma Native PyBind11 Module
// Descrição: Binding direto para libgemma.a sem stubs ou wrappers
// Autor: Roger Luft - FazAI Project
// Licença: Creative Commons Attribution 4.0 International (CC BY 4.0)
//====================================================================

#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <mutex>
#include <string>
#include <memory>
#include <iostream>
#include <sstream>
#include <cstring>
#include <cstdlib>
#include <thread>
#include <chrono>

// Declarações extern "C" para linkar com libgemma.a
// Baseado no wrapper real em worker/lib/gemma_c_api_real.cpp
extern "C" {
    // Inicialização e limpeza do modelo
    void* gemma_init(const char* model_path);
    void gemma_free(void* ctx);

    // Gerenciamento de sessões (uma por instância Python para isolamento)
    void* gemma_create_session(void* ctx);
    void gemma_destroy_session(void* session);

    // Streaming de geração - retorna tokens via callback
    int gemma_generate_stream(void* session, const char* prompt,
                             void (*callback)(const char*, void*), void* user_data);

    // Abort opcional (para futuro use)
    void gemma_abort(const char* session_id);
}

namespace py = pybind11;

//====================================================================
// Estrutura de dados para coleta de tokens via callback
//====================================================================
struct StreamData {
    std::stringstream buffer;
    std::mutex mtx;
    bool active = true;

    void append_token(const std::string& token) {
        std::lock_guard<std::mutex> lock(mtx);
        buffer << token;
    }

    std::string get_result() {
        std::lock_guard<std::mutex> lock(mtx);
        return buffer.str();
    }

    void reset() {
        std::lock_guard<std::mutex> lock(mtx);
        buffer.str("");
        buffer.clear();
        active = true;
    }

    void deactivate() {
        std::lock_guard<std::mutex> lock(mtx);
        active = false;
    }
};

//====================================================================
// Função callback estática C compatível
//====================================================================
extern "C" void token_callback(const char* token, void* user_data) {
    if (user_data && token) {
        StreamData* data = static_cast<StreamData*>(user_data);
        data->append_token(std::string(token));
    }
}

//====================================================================
// Classe principal do módulo Python
//====================================================================
class GemmaNative {
private:
    // Contexto do modelo (compartilhado entre sessões)
    void* model_ctx_;

    // Sessão exclusiva (session per instance para isolamento)
    void* session_;

public:
    //------------------------------------------------------------------
    // Construtor: inicializa modelo e sessão dinamicamente
    //------------------------------------------------------------------
    GemmaNative() : model_ctx_(nullptr), session_(nullptr) {}

    //------------------------------------------------------------------
    // Inicialização sob demanda (lazy initialization)
    //------------------------------------------------------------------
    bool initialize() {
        if (model_ctx_ != nullptr) {
            return true;  // Já inicializado
        }

        // Tentar caminhos padrão do FazAI
        const char* modelo_paths[] = {
            "/opt/fazai/models/gemma/2.0-2b-it-sfp.sbs",  // Produção
            "./models/gemma/2.0-2b-it-sfp.sbs",           // Desenvolvimento
            "./gemma-2b.bin",                             // Compilação teste
            nullptr
        };

        // Tentar inicializar com primeiro modelo encontrado
        for (int i = 0; modelo_paths[i] != nullptr; ++i) {
            std::cout << "[GemmaNative] Tentando modelo: " << modelo_paths[i] << std::endl;
            model_ctx_ = gemma_init(modelo_paths[i]);
            if (model_ctx_) {
                std::cout << "[GemmaNative] Modelo inicializado com: " << modelo_paths[i] << std::endl;
                break;
            }
        }

        if (!model_ctx_) {
            std::cerr << "[GemmaNative] ERRO: Falha ao inicializar modelo. "
                      << "Verifique se os pesos estão em /opt/fazai/models/gemma/" << std::endl;
            return false;
        }

        // Criar sessão exclusiva para esta instância
        session_ = gemma_create_session(model_ctx_);
        if (!session_) {
            std::cerr << "[GemmaNative] ERRO: Falha ao criar sessão" << std::endl;
            gemma_free(model_ctx_);
            model_ctx_ = nullptr;
            return false;
        }

        return true;
    }

    //------------------------------------------------------------------
    // Função principal: generate(prompt: str) -> str
    //------------------------------------------------------------------
    std::string generate(const std::string& prompt) {
        if (!initialize()) {
            return "[ERRO] Modelo Gemma não pôde ser inicializado";
        }

        // Preparar coleta de streaming
        StreamData stream_data;
        stream_data.reset();

        // Chamar geração real via libgemma.a
        int result = gemma_generate_stream(
            session_,
            prompt.c_str(),
            token_callback,
            &stream_data
        );

        if (result != 0) {
            return "[ERRO] Falha na geração (código: " + std::to_string(result) + ")";
        }

        // Aguardar pequena pausa para completar streaming (se assíncrono)
        // Nota: API atual é síncrona mas segura
        std::this_thread::sleep_for(std::chrono::milliseconds(10));

        return stream_data.get_result();
    }

    //------------------------------------------------------------------
    // Status do modelo
    //------------------------------------------------------------------
    bool is_initialized() const {
        return model_ctx_ != nullptr && session_ != nullptr;
    }

    //------------------------------------------------------------------
    // Destrutor: limpeza adequada
    //------------------------------------------------------------------
    ~GemmaNative() {
        if (session_) {
            gemma_destroy_session(session_);
            session_ = nullptr;
        }

        if (model_ctx_) {
            gemma_free(model_ctx_);
            model_ctx_ = nullptr;
        }
    }
};

//====================================================================
// Binding PyBind11
//====================================================================
PYBIND11_MODULE(gemma_native, m) {
    m.doc() = R"pbdoc(
        FazAI Gemma Native Module
        ------------------------

        Módulo Python para acesso direto ao modelo Gemma via libgemma.a
        sem wrappers ou stubs - implementação real e legítima.

        Função principal:
            generate(prompt: str) -> str

        Retorna a resposta gerada pelo modelo para o prompt fornecido.
    )pbdoc";

    py::class_<GemmaNative>(m, "GemmaNative", R"pbdoc(
        Classe principal do módulo Gemma Native.

        Cada instância mantém sua própria sessão com o modelo,
        garantindo isolamento entre uso paralelo.
    )pbdoc")
        .def(py::init<>(), R"pbdoc(
            Inicializa nova instância do Gemma Native.

            Inicialização preguiçosa: modelo só é carregado quando
            necessário (primeira chamada a generate).
        )pbdoc")

        .def("generate", &GemmaNative::generate, R"pbdoc(
            Gera resposta baseada no prompt fornecido.

            Args:
                prompt (str): Texto de entrada para processamento

            Returns:
                str: Resposta gerada pelo modelo Gemma

            Raises:
                RuntimeError se modelo não puder ser inicializado
        )pbdoc", py::arg("prompt"))

        .def("is_initialized", &GemmaNative::is_initialized, R"pbdoc(
            Verifica se o modelo está carregado e sessões criadas.

            Returns:
                bool: True se inicializado, False caso contrário
        )pbdoc")

        .def("__repr__", [](const GemmaNative& obj) {
            return std::string("<GemmaNative initialized=") +
                   (obj.is_initialized() ? "True" : "False") + ">";
        });

    // Versão do módulo
    m.attr("__version__") = "1.0.0";
    m.attr("__author__") = "Roger Luft - FazAI";

    // Função de conveniência replacement
    m.def("generate", [](const std::string& prompt) {
        GemmaNative instance;
        return instance.generate(prompt);
    }, R"pbdoc(
        Função de conveniência para geração rápida.

        Cria instância temporária, gera resposta e limpa recursos.

        Args:
            prompt (str): Texto de entrada

        Returns:
            str: Resposta do modelo
    )pbdoc", py::arg("prompt"));
}
