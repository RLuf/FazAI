#!/bin/bash

set -e

echo "🔧 Instalando pacotes necessários..."
sudo dnf install -y ansible policycoreutils-python-utils

echo "📁 Criando estrutura da role selinux_config..."
mkdir -p selinux_setup/roles/selinux_config/{tasks,handlers,defaults,meta}

echo "📄 Populando arquivos da role..."


# tasks/main.yml
cat <<'EOF' > selinux_setup/roles/selinux_config/tasks/main.yml
---
- name: Ativar booleans SELinux
  command: semanage boolean -m --on {{ item }}
  loop: "{{ selinux_booleans }}"
  tags: selinux

- name: Adicionar fcontext para /dados
  command: semanage fcontext -a -f a -t samba_share_t -r 's0' /dados
  tags: selinux
  notify: Aplicar restorecon
EOF


# handlers/main.yml
cat <<'EOF' > selinux_setup/roles/selinux_config/handlers/main.yml
---
- name: Aplicar restorecon
  command: restorecon -Rv {{ selinux_fcontext.target }}
EOF

# defaults/main.yml
cat <<'EOF' > selinux_setup/roles/selinux_config/defaults/main.yml
---
selinux_booleans:
  - name: samba_export_all_rw
  - name: virt_sandbox_use_all_caps
  - name: virt_use_nfs

selinux_fcontext:
  target: "/dados"
  setype: "samba_share_t"
  ftype: "a"
  selevel: "s0"
EOF

# meta/main.yml
cat <<'EOF' > selinux_setup/roles/selinux_config/meta/main.yml
---
dependencies: []
EOF

# playbook principal
cat <<'EOF' > selinux_setup/playbook.yml
---
- name: Aplicar configurações SELinux
  hosts: localhost
  become: true
  roles:
    - selinux_config
EOF


./setup1_patch.sh

echo "✅ Tudo pronto! Para rodar o playbook, use:"
echo "cd selinux_setup && ansible-playbook playbook.yml"
