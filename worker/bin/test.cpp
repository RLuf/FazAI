#include <iostream>

// protótipo mínimo pra testar linkagem
extern "C" void* gemma_init();

int main() {
    void* ctx = gemma_init();
    if (ctx)
        std::cout << "✅ libgemma.so carregado com sucesso!\\n";
    else
        std::cout << "❌ Erro ao carregar libgemma.so\\n";
    return 0;
}
