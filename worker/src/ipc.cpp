#include "ipc.hpp"
#include "logging.hpp"
#include <iostream>
#include <sstream>
#include <cstring>
#include <unistd.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <poll.h>
#include <errno.h>
#include <nlohmann/json.hpp>

class IpcConnImpl : public IpcConn {
public:
    explicit IpcConnImpl(int sock_fd) : sock_fd_(sock_fd) {}
    
    void send(const nlohmann::json& data) override {
        std::string msg = data.dump() + "\n";
        ::send(sock_fd_, msg.c_str(), msg.length(), 0);
    }
    
    void send_stream(const nlohmann::json& data, bool end) override {
        std::string msg = data.dump() + "\n";
        ::send(sock_fd_, msg.c_str(), msg.length(), 0);
    }
    
    bool is_connected() const override {
        return sock_fd_ >= 0;
    }
    
    int get_fd() const { return sock_fd_; }
    
private:
    int sock_fd_;
};

class IpcServer::Impl {
public:
    explicit Impl(const std::string& socket_path) : socket_path_(socket_path), server_fd_(-1) {}
    
    ~Impl() {
        cleanup();
    }
    
    bool setup() {
        // Criar socket Unix
        server_fd_ = socket(AF_UNIX, SOCK_STREAM, 0);
        if (server_fd_ < 0) {
            std::cerr << "Erro ao criar socket: " << strerror(errno) << std::endl;
            return false;
        }
        
        // Configurar endereço
        struct sockaddr_un addr;
        memset(&addr, 0, sizeof(addr));
        addr.sun_family = AF_UNIX;
        strncpy(addr.sun_path, socket_path_.c_str(), sizeof(addr.sun_path) - 1);
        
        // Remover socket existente se houver
        unlink(socket_path_.c_str());
        
        // Bind
        if (bind(server_fd_, (struct sockaddr*)&addr, sizeof(addr)) < 0) {
            std::cerr << "Erro no bind: " << strerror(errno) << std::endl;
            return false;
        }
        
        // Listen
        if (listen(server_fd_, 5) < 0) {
            std::cerr << "Erro no listen: " << strerror(errno) << std::endl;
            return false;
        }
        
        // Configurar permissões
        chmod(socket_path_.c_str(), 0666);
        
    log_info("Servidor IPC iniciado", {{"socket", socket_path_}});
        return true;
    }
    
    void cleanup() {
        if (server_fd_ >= 0) {
            close(server_fd_);
            server_fd_ = -1;
        }
        unlink(socket_path_.c_str());
    }
    
    bool accept_connections(std::function<void(const nlohmann::json&, IpcConn&)> handler) {
        struct pollfd pfd;
        pfd.fd = server_fd_;
        pfd.events = POLLIN;
        
        while (true) {
            int poll_result = poll(&pfd, 1, 1000); // 1 segundo timeout
            
            if (poll_result < 0) {
                if (errno == EINTR) continue;
                std::cerr << "Erro no poll: " << strerror(errno) << std::endl;
                return false;
            }
            
            if (poll_result == 0) continue; // Timeout
            
            if (pfd.revents & POLLIN) {
                struct sockaddr_un client_addr;
                socklen_t client_len = sizeof(client_addr);
                
                int client_fd = accept(server_fd_, (struct sockaddr*)&client_addr, &client_len);
                if (client_fd < 0) {
                    std::cerr << "Erro no accept: " << strerror(errno) << std::endl;
                    continue;
                }
                
                handle_client(client_fd, handler);
            }
        }
    }
    
private:
    void handle_client(int client_fd, std::function<void(const nlohmann::json&, IpcConn&)> handler) {
        IpcConnImpl conn(client_fd);
        
        char buffer[4096];
        std::string message;
        
        while (conn.is_connected()) {
            ssize_t bytes_read = recv(client_fd, buffer, sizeof(buffer) - 1, 0);
            
            if (bytes_read <= 0) {
                break;
            }
            
            buffer[bytes_read] = '\0';
            message += buffer;
            
            // Processar mensagens completas (separadas por \n)
            size_t pos;
            while ((pos = message.find('\n')) != std::string::npos) {
                std::string line = message.substr(0, pos);
                message = message.substr(pos + 1);
                
                if (!line.empty()) {
                    try {
                        nlohmann::json request(line);

                        // Se a mensagem for uma string contendo JSON, tente desserializar o conteúdo
                        if (request.is_string()) {
                            std::string inner = request.get<std::string>();
                            try {
                                nlohmann::json inner_json = nlohmann::json::parse(inner);
                                handler(inner_json, conn);
                                continue;
                            } catch (const std::exception& e) {
                                log_error("Mensagem string recebida não pôde ser desserializada", {{"error", e.what()}});
                                // cair para enviar o request original (string) ao handler para tratamento
                            }
                        }

                        handler(request, conn);
                    } catch (const std::exception& e) {
                        log_error("Erro ao processar mensagem", {{"error", e.what()}});
                    }
                }
            }
        }
        
        close(client_fd);
    }
    
    std::string socket_path_;
    int server_fd_;
};

IpcServer::IpcServer(const std::string& socket_path) 
    : socket_path_(socket_path), pimpl_(std::make_unique<Impl>(socket_path)) {
}

IpcServer::~IpcServer() {
    stop();
}

void IpcServer::on_request(std::function<void(const nlohmann::json&, IpcConn&)> handler) {
    request_handler_ = std::move(handler);
}

bool IpcServer::run(std::function<bool()> should_continue) {
    if (!pimpl_->setup()) {
        return false;
    }
    
    running_.store(true);
    
    server_thread_ = std::make_unique<std::thread>([this, should_continue]() {
        pimpl_->accept_connections(request_handler_);
    });
    
    return true;
}

void IpcServer::stop() {
    running_.store(false);
    
    if (server_thread_ && server_thread_->joinable()) {
        server_thread_->join();
    }
    
    pimpl_->cleanup();
}
