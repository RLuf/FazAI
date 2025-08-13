#include <iostream>

// Implementação mínima do worker
void worker_init() {
    std::cout << "Worker inicializado" << std::endl;
}

void worker_cleanup() {
    std::cout << "Worker finalizado" << std::endl;
}