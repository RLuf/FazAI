"""Gemma Worker - Local LLM inference using llama-cpp-python."""

import logging
import time
from typing import Optional

from llama_cpp import Llama

from .config import WorkerConfig, InferenceConfig


logger = logging.getLogger(__name__)


class GemmaWorker:
    """Worker for Gemma model inference using llama-cpp-python."""

    def __init__(self, config: WorkerConfig):
        """Initialize the Gemma worker.

        Args:
            config: Worker configuration

        Raises:
            RuntimeError: If model fails to load
        """
        self.config = config
        self.model: Optional[Llama] = None
        self.load_time: float = 0.0

        logger.info(
            "Initializing GemmaWorker",
            extra={
                "model_path": config.model.model_path,
                "n_ctx": config.model.n_ctx,
                "n_gpu_layers": config.model.n_gpu_layers
            }
        )

        self._load_model()

    def _load_model(self) -> None:
        """Load the Gemma model into memory."""
        start_time = time.time()

        try:
            self.model = Llama(
                model_path=self.config.model.model_path,
                n_ctx=self.config.model.n_ctx,
                n_threads=self.config.model.n_threads,
                n_gpu_layers=self.config.model.n_gpu_layers,
                verbose=self.config.model.verbose
            )
            self.load_time = time.time() - start_time

            logger.info(
                "Model loaded successfully",
                extra={"load_time_seconds": round(self.load_time, 2)}
            )

        except Exception as e:
            logger.error(
                "Failed to load model",
                extra={"error": str(e), "model_path": self.config.model.model_path}
            )
            raise RuntimeError(f"Model loading failed: {e}") from e

    def infer(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None,
        top_k: Optional[int] = None,
        stop: Optional[list[str]] = None
    ) -> str:
        """Run inference on the model.

        Args:
            prompt: Input text prompt
            max_tokens: Maximum tokens to generate (overrides config)
            temperature: Sampling temperature (overrides config)
            top_p: Nucleus sampling threshold (overrides config)
            top_k: Top-k sampling (overrides config)
            stop: Stop sequences (overrides config)

        Returns:
            Generated text response

        Raises:
            RuntimeError: If model is not loaded
            ValueError: If inference fails
        """
        if not self.model:
            raise RuntimeError("Model not loaded")

        # Use config defaults if not overridden
        inference_params = {
            "max_tokens": max_tokens or self.config.inference.max_tokens,
            "temperature": temperature if temperature is not None else self.config.inference.temperature,
            "top_p": top_p if top_p is not None else self.config.inference.top_p,
            "top_k": top_k if top_k is not None else self.config.inference.top_k,
            "stop": stop or self.config.inference.stop,
            "echo": False
        }

        logger.debug(
            "Running inference",
            extra={"prompt_length": len(prompt), "params": inference_params}
        )

        start_time = time.time()

        try:
            response = self.model(
                prompt,
                **inference_params
            )

            inference_time = time.time() - start_time

            # ============ DEBUG PROFISSIONAL ============
            import json
            logger.error("=" * 80)
            logger.error("RESPOSTA BRUTA DO LLAMA.CPP")
            logger.error("=" * 80)
            logger.error(f"Response type: {type(response)}")
            logger.error(f"Response keys: {list(response.keys())}")
            logger.error(f"Full response (JSON):\n{json.dumps(response, indent=2)}")

            # Analisar choices
            if "choices" in response and len(response["choices"]) > 0:
                choice = response["choices"][0]
                logger.error(f"\nChoice keys: {list(choice.keys())}")
                logger.error(f"Choice full: {choice}")

                raw_text = choice.get("text", "")
                logger.error(f"\nRaw text type: {type(raw_text)}")
                logger.error(f"Raw text length: {len(raw_text)}")
                logger.error(f"Raw text repr: {repr(raw_text)}")
                logger.error(f"Raw text first 100 chars: {raw_text[:100]}")

                # Análise binária
                if raw_text:
                    logger.error(f"\nHEX DUMP (first 100 bytes):")
                    hex_dump = ' '.join(f'{ord(c):02x}' for c in raw_text[:100])
                    logger.error(hex_dump)

                    logger.error(f"\nByte values (first 20): {[ord(c) for c in raw_text[:20]]}")
                    logger.error(f"Unique chars: {set(raw_text[:100])}")
                    logger.error(f"Is all zeros (char '0')?: {all(c == '0' for c in raw_text)}")
                    logger.error(f"Is all nulls (byte 0)?: {all(ord(c) == 0 for c in raw_text)}")

            # Analisar usage
            if "usage" in response:
                logger.error(f"\nUsage: {response['usage']}")
                logger.error(f"Completion tokens: {response['usage'].get('completion_tokens', 'N/A')}")

            logger.error("=" * 80)
            # ============ FIM DEBUG ============

            generated_text = response["choices"][0]["text"].strip()

            logger.debug(
                "Inference complete",
                extra={
                    "inference_time_seconds": round(inference_time, 2),
                    "tokens_generated": response["usage"]["completion_tokens"],
                    "text_length": len(generated_text)
                }
            )

            return generated_text

        except Exception as e:
            logger.error(
                "Inference failed",
                extra={"error": str(e), "prompt_preview": prompt[:100]}
            )
            raise ValueError(f"Inference failed: {e}") from e

    def get_stats(self) -> dict:
        """Get worker statistics.

        Returns:
            Dictionary with worker stats
        """
        return {
            "model_loaded": self.model is not None,
            "model_path": self.config.model.model_path,
            "load_time_seconds": round(self.load_time, 2),
            "n_ctx": self.config.model.n_ctx,
            "n_gpu_layers": self.config.model.n_gpu_layers
        }

    def __del__(self):
        """Cleanup on deletion."""
        if self.model:
            logger.info("Unloading model")
            del self.model
