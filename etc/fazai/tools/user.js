/**
 * FazAI - Plugin de Gerenciamento de Usuários
 * 
 * Este plugin lida com comandos relacionados à criação e gerenciamento de usuários.
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Extrai parâmetros de um comando de texto
 * @param {string} command - Comando completo
 * @returns {Object} - Objeto com os parâmetros extraídos
 */
const extractParams = (command) => {
  const params = {};
  
  // Extrai parâmetros no formato "nome=valor"
  const paramRegex = /(\w+)=([^\s]+)/g;
  let match;
  
  while ((match = paramRegex.exec(command)) !== null) {
    params[match[1]] = match[2];
  }
  
  // Tenta extrair parâmetros de linguagem natural
  if (command.includes('nome') && !params.nome) {
    const nomeMatch = command.match(/nome\s+(\w+)/i);
    if (nomeMatch) params.nome = nomeMatch[1];
  }
  
  if (command.includes('senha') && !params.senha) {
    const senhaMatch = command.match(/senha\s+(\w+)/i);
    if (senhaMatch) params.senha = senhaMatch[1];
  }
  
  if (command.includes('grupo') && !params.grupo) {
    const grupoMatch = command.match(/grupo\s+(\w+)/i);
    if (grupoMatch) params.grupo = grupoMatch[1];
  }
  
  return params;
};

/**
 * Cria um novo usuário no sistema
 * @param {string} username - Nome do usuário
 * @param {string} password - Senha do usuário
 * @param {string} group - Grupo do usuário (opcional)
 * @returns {Promise<Object>} - Resultado da operação
 */
const createUser = async (username, password, group) => {
  try {
    // Verifica se o usuário já existe
    try {
      await execPromise(`id ${username}`);
      return {
        success: false,
        message: `Usuário ${username} já existe.`
      };
    } catch (error) {
      // Usuário não existe, podemos continuar
    }
    
    // Cria o usuário
    await execPromise(`useradd -m ${username}`);
    
    // Define a senha
    await execPromise(`echo "${username}:${password}" | chpasswd`);
    
    // Adiciona ao grupo, se especificado
    if (group) {
      try {
        // Verifica se o grupo existe
        await execPromise(`getent group ${group}`);
        
        // Adiciona o usuário ao grupo
        await execPromise(`usermod -a -G ${group} ${username}`);
      } catch (error) {
        return {
          success: true,
          message: `Usuário ${username} criado com sucesso, mas não foi possível adicioná-lo ao grupo ${group}: ${error.message}`
        };
      }
    }
    
    return {
      success: true,
      message: `Usuário ${username} criado com sucesso${group ? ` e adicionado ao grupo ${group}` : ''}.`
    };
  } catch (error) {
    return {
      success: false,
      message: `Erro ao criar usuário: ${error.message}`,
      error: error.toString()
    };
  }
};

/**
 * Executa o plugin com base no comando fornecido
 * @param {string} command - Comando completo
 * @returns {Promise<Object>} - Resultado da operação
 */
exports.execute = async (command) => {
  // Verifica se é um comando de criação de usuário
  if (command.includes('cria') && command.includes('usuario')) {
    const params = extractParams(command);
    
    if (!params.nome) {
      return {
        success: false,
        message: 'Nome de usuário não especificado. Use: nome=usuario ou "nome usuario".'
      };
    }
    
    if (!params.senha) {
      return {
        success: false,
        message: 'Senha não especificada. Use: senha=senha123 ou "senha senha123".'
      };
    }
    
    return await createUser(params.nome, params.senha, params.grupo);
  }
  
  // Comando não reconhecido por este plugin
  return {
    success: false,
    message: 'Comando não reconhecido pelo plugin de usuários.'
  };
};
