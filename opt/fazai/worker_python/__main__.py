"""CLI entry point for FazAI Gemma Worker."""

import argparse
import logging
import sys

from .config import WorkerConfig
from .main import GemmaWorker


def setup_logging(level: str = "INFO"):
    """Configure logging for the application.

    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR)
    """
    logging.basicConfig(
        level=getattr(logging, level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )


def test_mode(config: WorkerConfig):
    """Run in test mode - quick inference test.

    Args:
        config: Worker configuration
    """
    print("Starting test mode...")
    worker = GemmaWorker(config)

    print(f"\nModel loaded in {worker.load_time:.2f}s")
    print("Running test inference...")

    test_prompt = "Hello, how are you?"
    result = worker.infer(test_prompt)

    print(f"\nPrompt: {test_prompt}")
    print(f"Response: {result}")
    print("\nTest completed successfully!")


def interactive_mode(config: WorkerConfig):
    """Run in interactive mode - REPL for testing.

    Args:
        config: Worker configuration
    """
    print("Starting interactive mode...")
    print("Loading model (this may take a few seconds)...\n")

    worker = GemmaWorker(config)

    print(f"Model loaded in {worker.load_time:.2f}s")
    print("\nInteractive mode ready. Type 'quit' to exit.\n")

    while True:
        try:
            prompt = input("You: ").strip()

            if prompt.lower() in ["quit", "exit", "q"]:
                print("Goodbye!")
                break

            if not prompt:
                continue

            result = worker.infer(prompt)
            print(f"AI: {result}\n")

        except KeyboardInterrupt:
            print("\nGoodbye!")
            break
        except Exception as e:
            print(f"Error: {e}\n")


def daemon_mode(config: WorkerConfig, host: str, port: int):
    """Run as FastAPI daemon server.

    Args:
        config: Worker configuration
        host: Host to bind to
        port: Port to bind to
    """
    import uvicorn

    # Setup logging for uvicorn
    log_config = uvicorn.config.LOGGING_CONFIG
    log_config["formatters"]["default"]["fmt"] = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    log_config["formatters"]["access"]["fmt"] = '%(asctime)s - %(name)s - %(levelname)s - %(client_addr)s - "%(request_line)s" %(status_code)s'

    print(f"Starting FazAI Gemma Worker daemon on {host}:{port}")
    print("Press CTRL+C to stop\n")

    uvicorn.run(
        "worker_python.api:app",
        host=host,
        port=port,
        log_level=config.log_level.lower(),
        log_config=log_config,
        reload=False
    )


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="FazAI Gemma Worker - Local LLM inference",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument(
        "--mode",
        choices=["test", "interactive", "daemon"],
        default="test",
        help="Execution mode (default: test)"
    )

    parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host to bind daemon to (default: 0.0.0.0)"
    )

    parser.add_argument(
        "--port",
        type=int,
        default=3125,
        help="Port to bind daemon to (default: 3125)"
    )

    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Logging level (default: INFO)"
    )

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.log_level)

    try:
        # Load configuration from environment
        config = WorkerConfig.from_env()

        # Override log level if specified
        if args.log_level:
            config.log_level = args.log_level

        # Run in specified mode
        if args.mode == "test":
            test_mode(config)
        elif args.mode == "interactive":
            interactive_mode(config)
        elif args.mode == "daemon":
            daemon_mode(config, args.host, args.port)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
