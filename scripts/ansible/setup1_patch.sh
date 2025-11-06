#!/bin/bash
echo "🔧 Corrigindo ambiente Ansible..."

# 1. Instalar a coleção ansible.posix
echo "📦 Instalando coleção ansible.posix..."
ansible-galaxy collection install ansible.posix

# 2. Criar inventário local
echo "📁 Criando inventário local..."
cat <<EOF > selinux_setup/inventario.ini
[localhost]
localhost ansible_connection=local
EOF

# 3. Atualizar playbook para incluir a coleção
echo "📝 Atualizando playbook para usar a coleção ansible.posix..."
sed -i '/^  become: true/a \ \ collections:\n\ \ \ \ - ansible.posix' selinux_setup/playbook.yml

echo "✅ Correções aplicadas com sucesso!"
echo "🚀 Agora você pode rodar o playbook com:"
echo "cd selinux_setup && ansible-playbook -i inventario.ini playbook.yml"
