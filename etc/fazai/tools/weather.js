/**
 * FazAI - Plugin de Previsão do Tempo
 * 
 * Este plugin fornece comandos para obter informações meteorológicas
 * para diferentes locais usando a API OpenWeatherMap.
 * 
 * Para usar este plugin, você precisa de uma chave de API do OpenWeatherMap.
 * Registre-se em https://openweathermap.org/ e adicione sua chave no arquivo .env:
 * OPENWEATHER_API_KEY=sua_chave_aqui
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Informações do plugin
 */
const pluginInfo = {
  name: 'weather',
  description: 'Fornece informações meteorológicas',
  version: '1.0.0',
  author: 'FazAI Team'
};

// Chave de API do OpenWeatherMap
const API_KEY = process.env.OPENWEATHER_API_KEY || '';

// URL base da API
const API_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Obtém a previsão do tempo atual para uma localização
 * @param {string} location - Nome da cidade ou coordenadas
 * @param {string} lang - Código do idioma (pt_br, en, es, etc.)
 * @returns {Promise<object>} - Dados meteorológicos
 */
async function getCurrentWeather(location, lang = 'pt_br') {
  try {
    if (!API_KEY) {
      throw new Error('Chave de API do OpenWeatherMap não configurada. Adicione OPENWEATHER_API_KEY ao arquivo .env');
    }
    
    const response = await axios.get(`${API_URL}/weather`, {
      params: {
        q: location,
        appid: API_KEY,
        units: 'metric',
        lang: lang
      }
    });
    
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw new Error(`Localização não encontrada: ${location}`);
    }
    throw new Error(`Erro ao obter dados meteorológicos: ${err.message}`);
  }
}

/**
 * Obtém a previsão do tempo para 5 dias
 * @param {string} location - Nome da cidade ou coordenadas
 * @param {string} lang - Código do idioma (pt_br, en, es, etc.)
 * @returns {Promise<object>} - Dados de previsão
 */
async function getForecast(location, lang = 'pt_br') {
  try {
    if (!API_KEY) {
      throw new Error('Chave de API do OpenWeatherMap não configurada. Adicione OPENWEATHER_API_KEY ao arquivo .env');
    }
    
    const response = await axios.get(`${API_URL}/forecast`, {
      params: {
        q: location,
        appid: API_KEY,
        units: 'metric',
        lang: lang
      }
    });
    
    return response.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw new Error(`Localização não encontrada: ${location}`);
    }
    throw new Error(`Erro ao obter previsão do tempo: ${err.message}`);
  }
}

/**
 * Formata a saída de dados meteorológicos atuais
 * @param {object} data - Dados meteorológicos
 * @returns {string} - Saída formatada
 */
function formatCurrentWeather(data) {
  const weather = data.weather[0];
  const main = data.main;
  const wind = data.wind;
  const sys = data.sys;
  
  const sunrise = new Date(sys.sunrise * 1000).toLocaleTimeString('pt-BR');
  const sunset = new Date(sys.sunset * 1000).toLocaleTimeString('pt-BR');
  
  return `
=== Condições Meteorológicas Atuais ===

Local: ${data.name}, ${sys.country}
Temperatura: ${main.temp.toFixed(1)}°C (sensação térmica: ${main.feels_like.toFixed(1)}°C)
Condição: ${weather.description}
Umidade: ${main.humidity}%
Pressão: ${main.pressure} hPa
Vento: ${(wind.speed * 3.6).toFixed(1)} km/h
Visibilidade: ${(data.visibility / 1000).toFixed(1)} km
Nascer do sol: ${sunrise}
Pôr do sol: ${sunset}
`;
}

/**
 * Formata a saída de previsão do tempo
 * @param {object} data - Dados de previsão
 * @returns {string} - Saída formatada
 */
function formatForecast(data) {
  const city = data.city;
  const forecasts = data.list;
  
  // Agrupa previsões por dia
  const days = {};
  
  forecasts.forEach(forecast => {
    const date = new Date(forecast.dt * 1000);
    const day = date.toLocaleDateString('pt-BR');
    
    if (!days[day]) {
      days[day] = [];
    }
    
    days[day].push(forecast);
  });
  
  // Formata a saída
  let output = `
=== Previsão do Tempo para ${city.name}, ${city.country} ===
`;
  
  Object.keys(days).forEach(day => {
    const dayForecasts = days[day];
    
    // Calcula médias e extremos
    let minTemp = 100;
    let maxTemp = -100;
    let descriptions = {};
    
    dayForecasts.forEach(forecast => {
      minTemp = Math.min(minTemp, forecast.main.temp_min);
      maxTemp = Math.max(maxTemp, forecast.main.temp_max);
      
      const desc = forecast.weather[0].description;
      descriptions[desc] = (descriptions[desc] || 0) + 1;
    });
    
    // Encontra a descrição mais comum
    let mostCommonDesc = '';
    let mostCommonCount = 0;
    
    Object.keys(descriptions).forEach(desc => {
      if (descriptions[desc] > mostCommonCount) {
        mostCommonCount = descriptions[desc];
        mostCommonDesc = desc;
      }
    });
    
    output += `
${day}:
  Temperatura: ${minTemp.toFixed(1)}°C a ${maxTemp.toFixed(1)}°C
  Condição predominante: ${mostCommonDesc}
  Detalhes:
`;
    
    // Adiciona detalhes para cada período do dia
    dayForecasts.forEach(forecast => {
      const time = new Date(forecast.dt * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      output += `    ${time}: ${forecast.main.temp.toFixed(1)}°C, ${forecast.weather[0].description}, ${forecast.main.humidity}% umidade\n`;
    });
  });
  
  return output;
}

/**
 * Extrai a localização de um comando
 * @param {string} command - Comando a ser processado
 * @returns {string|null} - Localização extraída ou null se não encontrada
 */
function extractLocation(command) {
  const lowerCommand = command.toLowerCase();
  
  // Padrões para extrair localização
  const patterns = [
    /tempo (?:em|para) ([^?.,]+)/i,
    /previsão (?:em|para|do tempo em|do tempo para) ([^?.,]+)/i,
    /clima (?:em|para|de) ([^?.,]+)/i,
    /como está o tempo (?:em|para) ([^?.,]+)/i,
    /meteorologia (?:em|para|de) ([^?.,]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = lowerCommand.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Processa comandos relacionados ao clima
 * @param {string} command - Comando a ser processado
 * @returns {Promise<object>} - Resultado do processamento
 */
async function processCommand(command) {
  const lowerCommand = command.toLowerCase();
  
  // Verifica se o comando está relacionado a este plugin
  if (lowerCommand.includes('tempo') || 
      lowerCommand.includes('clima') || 
      lowerCommand.includes('previsão') || 
      lowerCommand.includes('meteorologia')) {
    
    // Extrai a localização do comando
    const location = extractLocation(command);
    
    if (!location) {
      return {
        success: false,
        handled: true,
        message: 'Por favor, especifique uma localização. Exemplo: "Como está o tempo em São Paulo?"'
      };
    }
    
    try {
      // Verifica se é uma previsão ou tempo atual
      if (lowerCommand.includes('previsão') || lowerCommand.includes('próximos dias')) {
        const forecast = await getForecast(location);
        return {
          success: true,
          result: formatForecast(forecast),
          type: 'forecast'
        };
      } else {
        const weather = await getCurrentWeather(location);
        return {
          success: true,
          result: formatCurrentWeather(weather),
          type: 'current_weather'
        };
      }
    } catch (err) {
      return {
        success: false,
        handled: true,
        message: err.message
      };
    }
  }
  
  // Se o comando não for reconhecido por este plugin
  return {
    success: false,
    handled: false,
    message: 'Comando não reconhecido pelo plugin de clima'
  };
}

// Exporta as funções e informações do plugin
module.exports = {
  info: pluginInfo,
  processCommand,
  getCurrentWeather,
  getForecast
};
