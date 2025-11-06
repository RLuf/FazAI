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
