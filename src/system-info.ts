import { execSync } from "child_process";

export interface SystemInfo {
  os: string;
  kernel: string;
  architecture: string;
  distribution: string;
  packageManager: string;
  services: string[];
  diskUsage: string;
  memory: string;
  cpu: string;
  network: string[];
}

export async function collectSystemInfo(): Promise<string> {
  const systemInfo: Partial<SystemInfo> = {};

  try {
    // Informações básicas do sistema
    systemInfo.os = execSync("uname -s", { encoding: "utf8" }).trim();
    systemInfo.kernel = execSync("uname -r", { encoding: "utf8" }).trim();
    systemInfo.architecture = execSync("uname -m", { encoding: "utf8" }).trim();

    // Distribuição Linux
    try {
      systemInfo.distribution = execSync("lsb_release -d -s", { encoding: "utf8" }).trim();
    } catch {
      try {
        systemInfo.distribution = execSync("cat /etc/os-release | grep PRETTY_NAME | cut -d'=' -f2 | tr -d '\"'", { encoding: "utf8" }).trim();
      } catch {
        systemInfo.distribution = "Unknown";
      }
    }

    // Gerenciador de pacotes
    const packageManagers = ["apt", "yum", "dnf", "pacman", "zypper", "emerge"];
    for (const pm of packageManagers) {
      try {
        execSync(`which ${pm}`, { stdio: "pipe" });
        systemInfo.packageManager = pm;
        break;
      } catch {}
    }

    // Serviços em execução (principais)
    try {
      const services = execSync("systemctl list-units --type=service --state=running --no-pager --no-legend | head -10 | awk '{print $1}'", { encoding: "utf8" })
        .split("\n")
        .filter(line => line.trim())
        .map(line => line.replace(".service", ""));
      systemInfo.services = services;
    } catch {
      systemInfo.services = ["systemctl não disponível"];
    }

    // Uso de disco
    try {
      systemInfo.diskUsage = execSync("df -h / | tail -1", { encoding: "utf8" }).trim();
    } catch {
      systemInfo.diskUsage = "Não disponível";
    }

    // Memória
    try {
      systemInfo.memory = execSync("free -h | grep Mem", { encoding: "utf8" }).trim();
    } catch {
      systemInfo.memory = "Não disponível";
    }

    // CPU
    try {
      systemInfo.cpu = execSync("nproc", { encoding: "utf8" }).trim() + " cores";
    } catch {
      systemInfo.cpu = "Não disponível";
    }

    // Interfaces de rede
    try {
      const interfaces = execSync("ip -brief addr show | awk '{print $1 \": \" $3}'", { encoding: "utf8" })
        .split("\n")
        .filter(line => line.trim() && !line.includes("lo:"));
      systemInfo.network = interfaces;
    } catch {
      systemInfo.network = ["Não disponível"];
    }

  } catch (error) {
    console.warn("Erro ao coletar informações do sistema:", error);
  }

  // Formatar como texto legível
  return `
SISTEMA OPERACIONAL: ${systemInfo.os || "Desconhecido"}
DISTRIBUIÇÃO: ${systemInfo.distribution || "Desconhecida"}
KERNEL: ${systemInfo.kernel || "Desconhecido"}
ARQUITETURA: ${systemInfo.architecture || "Desconhecida"}
GERENCIADOR DE PACOTES: ${systemInfo.packageManager || "Desconhecido"}

RECURSOS:
CPU: ${systemInfo.cpu || "Desconhecido"}
MEMÓRIA: ${systemInfo.memory || "Desconhecido"}
DISCO (/): ${systemInfo.diskUsage || "Desconhecido"}

SERVIÇOS PRINCIPAIS ATIVOS:
${(systemInfo.services || []).slice(0, 5).map(s => `- ${s}`).join("\n")}

INTERFACES DE REDE:
${(systemInfo.network || []).slice(0, 3).map(n => `- ${n}`).join("\n")}
`.trim();
}