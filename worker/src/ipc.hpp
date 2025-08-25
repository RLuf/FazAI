#pragma once
#include <string>
#include <functional>
#include <memory>
#include <thread>
#include <atomic>
#include <nlohmann/json.hpp>

class IpcConn {
public:
    virtual ~IpcConn() = default;
    virtual void send(const nlohmann::json& data) = 0;
    virtual void send_stream(const nlohmann::json& data, bool end = false) = 0;
    virtual bool is_connected() const = 0;
};

class IpcServer {
public:
    explicit IpcServer(const std::string& socket_path);
    ~IpcServer();
    
    // Configurar handler de requisições
    void on_request(std::function<void(const nlohmann::json&, IpcConn&)> handler);
    
    // Iniciar servidor
    bool run(std::function<bool()> should_continue = nullptr);
    
    // Parar servidor
    void stop();
    
    // Status
    bool is_running() const { return running_.load(); }
    std::string get_socket_path() const { return socket_path_; }
    
private:
    std::string socket_path_;
    std::atomic<bool> running_{false};
    std::function<void(const nlohmann::json&, IpcConn&)> request_handler_;
    std::unique_ptr<std::thread> server_thread_;
    
    // Implementação específica da plataforma
    class Impl;
    std::unique_ptr<Impl> pimpl_;
};
