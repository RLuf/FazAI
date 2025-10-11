"""Setup script for FazAI Gemma Worker."""

from setuptools import setup, find_packages

setup(
    name="worker_python",
    version="2.0.0",
    description="FazAI Gemma Worker - Local LLM inference",
    author="FazAI Team",
    packages=find_packages(exclude=["tests", "tests.*"]),
    python_requires=">=3.10",
    install_requires=[
        "llama-cpp-python>=0.3.0",
        "pydantic>=2.0.0",
        "fastapi>=0.104.0",
        "uvicorn[standard]>=0.24.0",
        "websockets>=12.0",
        "python-multipart>=0.0.6",
        "httpx>=0.25.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
        ]
    },
    entry_points={
        "console_scripts": [
            "fazai-worker=worker_python.__main__:main",
        ],
    },
)
