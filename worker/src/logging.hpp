// logging.hpp - helper simples para logs estruturados (JSON)
#pragma once
#include <nlohmann/json.hpp>
#include <iostream>
#include <chrono>
#include <ctime>

inline std::string iso_ts() {
    using namespace std::chrono;
    auto now = system_clock::now();
    std::time_t t = system_clock::to_time_t(now);
    std::tm tm = *std::gmtime(&t);
    char buf[64];
    std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &tm);
    return std::string(buf);
}

inline void log_info(const std::string& msg, const nlohmann::json& extra = {}) {
    nlohmann::json j;
    j["ts"] = iso_ts();
    j["level"] = "info";
    j["msg"] = msg;
    if (!extra.is_null()) j["extra"] = extra;
    std::cout << j.dump() << std::endl;
}

inline void log_error(const std::string& msg, const nlohmann::json& extra = {}) {
    nlohmann::json j;
    j["ts"] = iso_ts();
    j["level"] = "error";
    j["msg"] = msg;
    if (!extra.is_null()) j["extra"] = extra;
    std::cerr << j.dump() << std::endl;
}
