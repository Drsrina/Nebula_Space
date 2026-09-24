#!/usr/bin/env python3
"""
Timestamp Logger — Script de Exemplo do Nebula Workspace
Demonstra a execução periódica de tarefas, automação e registro de logs com timestamp.
Pode ser executado diretamente pelo Task Runner, Terminal ou agendado no Crontab/Workflows.
"""

import time
from datetime import datetime

def log_timestamps():
    print("=" * 55)
    print("⏱️  NEBULA TIMESTAMP LOGGER — INICIANDO EXECUÇÃO")
    print("=" * 55)
    
    start_time = datetime.now()
    print(f"Horário de Início: {start_time.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]}")
    
    for i in range(1, 6):
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{i}/5] Pulso registrado: {now} | Status: OK")
        time.sleep(1)
        
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    print("-" * 55)
    print(f"✓ Concluído com sucesso em {duration:.2f}s!")
    print("=" * 55)

if __name__ == '__main__':
    log_timestamps()
