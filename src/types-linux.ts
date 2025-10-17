import { z } from "zod";

export const LinuxCommandSchema = z.object({
  explain: z.string(), // Explicação do que o comando faz
  command: z.string(), // Comando Linux a executar
  riskLevel: z.enum(["low", "medium", "high", "critical"]), // Nível de risco
  requiresConfirmation: z.boolean(), // Se precisa confirmação extra
  rollbackCommand: z.string().nullable().optional(), // Comando para reverter se possível
  safetyChecks: z.array(z.string()).nullable().optional(), // Verificações de segurança a fazer antes
  expectedOutput: z.string().nullable().optional(), // Saída esperada para validação
  researchNeeded: z.boolean().optional(), // Se o modelo acredita que precisa de pesquisa adicional
  researchQuery: z.string().nullable().optional(), // Consulta de pesquisa recomendada
  researchReason: z.string().nullable().optional(), // Motivo da pesquisa recomendada
});

export type LinuxCommand = z.infer<typeof LinuxCommandSchema>;

export type LinuxCommandPackets =
  | { type: "command"; command: LinuxCommand }
  | { type: "error"; error: string }
  | { type: "allcommands"; commands: LinuxCommand[] };

export type LinuxCommandGenerator = AsyncGenerator<LinuxCommandPackets, void, undefined>;

export const LinuxCommandTypeStr = `export type LinuxCommand = {
  explain: string; // Explicação clara do que o comando faz e por quê
  command: string; // Comando Linux completo a executar
  riskLevel: "low" | "medium" | "high" | "critical"; // Nível de risco do comando
  requiresConfirmation: boolean; // Se precisa confirmação extra do usuário
  rollbackCommand?: string; // Comando opcional para reverter a operação
  safetyChecks?: string[]; // Verificações de segurança a fazer antes da execução
  expectedOutput?: string; // Padrão de saída esperada para validação
  researchNeeded?: boolean; // Defina como true se precisar de contexto externo antes de executar
  researchQuery?: string | null; // Consulta curta para pesquisas (context7 ou web)
  researchReason?: string | null; // Explique por que a pesquisa ajuda
}[];

Responda APENAS com um array JSON válido seguindo esta estrutura.`;

// Lista de comandos considerados críticos
export const CRITICAL_COMMANDS = [
  /^rm\s+(-rf|--force)/,  // rm -rf
  /^dd\s/,                // dd (perigoso)
  /^mkfs/,                // Formatação de disco
  /^fdisk/,               // Particionamento
  /^wipefs/,              // Apagar assinatura de sistema de arquivos
  /^shred/,               // Sobrescrever arquivos
  /sudo.*rm/,             // rm com sudo
  /sudo.*dd/,             // dd com sudo
  /sudo.*mkfs/,           // mkfs com sudo
  /sudo.*fdisk/,          // fdisk com sudo
  /sudo.*format/,         // format com sudo
];

// Lista de comandos que precisam de confirmação extra
export const HIGH_RISK_COMMANDS = [
  /^systemctl.*(restart|stop|disable)/,  // Controle de serviços
  /^apt.*(remove|purge)/,                // Remoção de pacotes
  /^yum.*(remove|erase)/,                // Remoção de pacotes
  /^pacman.*(-R)/,                       // Remoção de pacotes
  /^userdel/,                            // Remoção de usuários
  /^groupdel/,                           // Remoção de grupos
  /^iptables/,                           // Regras de firewall
  /^ufw/,                                // Firewall
  /^mount/,                              // Montagem de sistemas
  /^umount/,                             // Desmontagem
];
