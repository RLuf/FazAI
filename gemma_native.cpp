#include <pybind11/pybind11.h>
#include <pybind11/stl.h>

#include <memory>
#include <mutex>
#include <random>
#include <stdexcept>
#include <string>
#include <vector>

#include "gemma/gemma.h"
#include "gemma/gemma_args.h"
#include "gemma/tokenizer.h"
#include "hwy/base.h"
#include "ops/matmul.h"
#include "util/threading_context.h"

namespace py = pybind11;

namespace {

struct GemmaConfigSnapshot {
  std::string weights_path;
  std::string tokenizer_path;
  int max_tokens = 512;
  float temperature = 0.2f;
  int top_k = 1;
  bool deterministic = true;
  bool multiturn = false;
  int prefill_tbatch = 256;
};

class GemmaNative {
 public:
  GemmaNative() = default;

  bool initialize(const std::string& weights_path,
                  const std::string& tokenizer_path,
                  int max_tokens,
                  double temperature,
                  int top_k,
                  bool deterministic,
                  bool multiturn,
                  int prefill_tbatch) {
    if (weights_path.empty()) {
      throw std::invalid_argument("weights_path obrigatório");
    }

    std::lock_guard<std::mutex> lock(mutex_);

    config_.weights_path = weights_path;
    config_.tokenizer_path = tokenizer_path;
    config_.max_tokens = max_tokens;
    config_.temperature = static_cast<float>(temperature);
    config_.top_k = top_k;
    config_.deterministic = deterministic;
    config_.multiturn = multiturn;
    config_.prefill_tbatch = prefill_tbatch;

    loader_ = std::make_unique<gcpp::LoaderArgs>(tokenizer_path, weights_path);
    threading_args_ = std::make_unique<gcpp::ThreadingArgs>();
    inference_args_ = std::make_unique<gcpp::InferenceArgs>();

    inference_args_->verbosity = 0;
    if (max_tokens > 0) {
      inference_args_->max_generated_tokens = static_cast<size_t>(max_tokens);
    }
    inference_args_->temperature = static_cast<float>(temperature);
    if (top_k > 0) {
      inference_args_->top_k = static_cast<size_t>(top_k);
    }
    inference_args_->deterministic = deterministic;
    inference_args_->multiturn = multiturn;
    if (prefill_tbatch > 0) {
      inference_args_->prefill_tbatch_size =
          static_cast<size_t>(prefill_tbatch);
    }

    ctx_ = std::make_unique<gcpp::ThreadingContext>(*threading_args_);
    env_ = std::make_unique<gcpp::MatMulEnv>(*ctx_);
    gemma_ = std::make_unique<gcpp::Gemma>(*loader_, *inference_args_, *ctx_);
    kv_cache_ = std::make_unique<gcpp::KVCache>(gemma_->Config(), *inference_args_, ctx_->allocator);

    generator_.seed(std::random_device{}());
    abs_pos_ = 0;

    return true;
  }

  bool is_initialized() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return gemma_ != nullptr;
  }

  py::dict status() const {
    std::lock_guard<std::mutex> lock(mutex_);
    py::dict info;
    info["initialized"] = gemma_ != nullptr;
    info["weights_path"] = config_.weights_path;
    info["tokenizer_path"] = config_.tokenizer_path;
    info["max_tokens"] = config_.max_tokens;
    info["temperature"] = config_.temperature;
    info["top_k"] = config_.top_k;
    info["deterministic"] = config_.deterministic;
    info["multiturn"] = config_.multiturn;
    info["prefill_tbatch"] = config_.prefill_tbatch;
    return info;
  }

  std::string generate(const std::string& prompt,
                       py::object override_max_tokens = py::none()) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!gemma_) {
      throw std::runtime_error("GemmaNative não inicializado");
    }

    const int effective_tokens = override_max_tokens.is_none()
                                     ? config_.max_tokens
                                     : override_max_tokens.cast<int>();

    // Reinicializa o KV cache se não estivermos no modo multiturn.
    if (!config_.multiturn) {
      kv_cache_ = std::make_unique<gcpp::KVCache>(gemma_->Config(), *inference_args_, ctx_->allocator);
      abs_pos_ = 0;
    }

    std::vector<int> tokens = gcpp::WrapAndTokenize(
        gemma_->Tokenizer(), gemma_->ChatTemplate(),
        gemma_->Config().wrapping, abs_pos_, prompt);

    gcpp::TimingInfo timing_info;
    gcpp::RuntimeConfig runtime_config{};
    inference_args_->CopyTo(runtime_config);
    runtime_config.max_generated_tokens = static_cast<size_t>(effective_tokens);
    runtime_config.temperature = config_.temperature;
    runtime_config.top_k = static_cast<size_t>(config_.top_k);
    runtime_config.gen = &generator_;
    runtime_config.verbosity = 0;

    std::string output;
    runtime_config.stream_token = [&](int token, float) {
      if (gemma_->Config().IsEOS(token)) {
        return true;
      }
      std::string token_text;
      HWY_ASSERT(gemma_->Tokenizer().Decode(std::vector<int>{token}, &token_text));
      output.append(token_text);
      return true;
    };

    gemma_->Generate(runtime_config, tokens, abs_pos_, *kv_cache_, *env_,
                     timing_info);

    abs_pos_ += tokens.size();
    return output;
  }

 private:
  mutable std::mutex mutex_;
  GemmaConfigSnapshot config_;

  std::unique_ptr<gcpp::LoaderArgs> loader_;
  std::unique_ptr<gcpp::ThreadingArgs> threading_args_;
  std::unique_ptr<gcpp::InferenceArgs> inference_args_;
  std::unique_ptr<gcpp::ThreadingContext> ctx_;
  std::unique_ptr<gcpp::MatMulEnv> env_;
  std::unique_ptr<gcpp::Gemma> gemma_;
  std::unique_ptr<gcpp::KVCache> kv_cache_;

  std::mt19937 generator_;
  size_t abs_pos_ = 0;
};

}  // namespace

PYBIND11_MODULE(gemma_native, m) {
  py::class_<GemmaNative>(m, "GemmaNative")
      .def(py::init<>())
      .def("initialize", &GemmaNative::initialize,
           py::arg("weights_path"),
           py::arg("tokenizer_path"),
           py::arg("max_tokens"),
           py::arg("temperature"),
           py::arg("top_k"),
           py::arg("deterministic"),
           py::arg("multiturn"),
           py::arg("prefill_tbatch"))
      .def("is_initialized", &GemmaNative::is_initialized)
      .def("status", &GemmaNative::status)
      .def("generate", &GemmaNative::generate,
           py::arg("prompt"),
           py::arg("max_tokens") = py::none());
}
