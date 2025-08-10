#!/bin/bash
# FazAI HTML Generator v1.0
# Caminho: /opt/fazai/tools/fazai_html_v1.sh

# Função para coletar dados do sistema
collect_data() {
  case "$1" in
    processos)
      ps aux | tail -n +2 | awk '{print $2 " " $3 " " $11}' | sort -k2 -nr | head -n 10
      ;;
    memoria)
      free -h | grep Mem
      ;;
    disco)
      df -h | grep /dev/ | head -n 1
      ;;
    *)
      echo "Tipo de dados não suportado: $1"
      exit 1
      ;;
  esac
}

# Função para processar labels do gráfico
process_labels() {
  case "$1" in
    processos)
      awk '{print $3}' "$temp_file" | sed 's/"//g' | xargs | sed 's/ /","/g; s/^/"/; s/$/"/'
      ;;
    memoria)
      echo '"Total", "Usado", "Livre"'
      ;;
    disco)
      echo '"Tamanho", "Usado", "Livre"'
      ;;
  esac
}

# Função para processar dados do gráfico
process_data() {
  case "$1" in
    processos)
      awk '{print $2}' "$temp_file" | xargs | sed 's/ /,/g'
      ;;
    memoria)
      free -h | grep Mem | awk '{print $2 " " $3 " " $4}' | sed 's/ /,/g'
      ;;
    disco)
      df -h | grep /dev/ | head -n 1 | awk '{print $2 " " $3 " " $4}' | sed 's/ /,/g'
      ;;
  esac
}

# Função para obter label do dataset
get_dataset_label() {
  case "$1" in
    processos) echo "Processos por CPU" ;;
    memoria) echo "Memória (GB)" ;;
    disco) echo "Espaço em Disco (GB)" ;;
  esac
}

# Função para obter cor do gráfico
get_background_color() {
  case "$1" in
    processos) echo "['#4CAF50','#2196F3','#f44336','#FF9800','#9C27B0','#00BCD4','#795548','#607D8B','#3F51B5','#E91E63']" ;;
    memoria) echo "['#4CAF50','#2196F3','#f44336']" ;;
    disco) echo "['#4CAF50','#2196F3','#f44336']" ;;
  esac
}

# Processamento principal
if [ -z "$1" ]; then
  echo "Uso: fazai_html_v1.sh <tipo_dados> [tipo_grafico]"
  echo "Exemplo: fazai_html_v1.sh processos pie"
  exit 1
fi

data_type="$1"
chart_type="${2:-bar}"  # Default para bar
temp_file="/tmp/fazai-${data_type}-$(date +%Y%m%d%H%M%S).tmp"
output_file="/tmp/fazai-${data_type}-$(date +%Y%m%d%H%M%S).html"

# Limpa arquivos temporários antigos
find /tmp -name "fazai-*.tmp" -mtime +1 -exec rm {} \;

# Coleta dados e gera arquivo temporário
collect_data "$data_type" > "$temp_file"

# Gera HTML com Chart.js
cat << EOF > "$output_file"
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FazAI - Visualização de Dados</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        canvas { max-width: 800px; margin: 0 auto; display: block; }
        h1 { text-align: center; }
    </style>
</head>
<body>
    <h1>FazAI - Visualização de Dados</h1>
    <canvas id="chart"></canvas>
    <script>
        const ctx = document.getElementById('chart').getContext('2d');
        new Chart(ctx, {
            type: '$chart_type',
            data: {
                labels: [$(process_labels "$data_type")],
                datasets: [{
                    label: '$(get_dataset_label "$data_type")',
                    data: [$(process_data "$data_type")],
                    backgroundColor: $(get_background_color "$data_type")
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: 'Visualização de $data_type'
                    }
                }
            }
        });
    </script>
</body>
</html>
EOF

# Abre no navegador padrão
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  xdg-open "$output_file"
elif [[ "$OSTYPE" == "cygwin" || "$OSTYPE" == "msys" ]]; then
  start "$output_file"
fi

# Limpa variáveis temporárias
rm -f "$temp_file"
