# ⚡ Tutorial: Automação & Script de Timestamp Logger

Bem-vindo ao sistema de automação e workflows do **Nebula Space IDE**!
Este guia rápido demonstra como rodar e agendar tarefas no ambiente.

---

### 1. Script de Exemplo: `scripts/timestamp_logger.py`

Criamos um script utilitário pronto em `scripts/timestamp_logger.py`:

```python
import datetime
import time

print(f"[START] Iniciando pulso de logs: {datetime.datetime.now().isoformat()}")
for i in range(1, 6):
    agora = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{agora}] Pulso #{i} - Nebula automação ativa e saudável.")
    time.sleep(1)

print(f"[DONE] Concluído com sucesso em: {datetime.datetime.now().isoformat()}")
```

---

### 2. Executar via Task Runner (Auto-Descoberta)

1. Abra a janela **Tarefas & Scripts** (TopBar ou via Command Palette `Ctrl+K`).
2. Acesse a aba **Autodescobertos**.
3. O script `scripts/timestamp_logger.py` já estará listado com status pronto.
4. Clique no botão **▶** para executá-lo com streaming de saída ao vivo no terminal!
5. Se desejar interromper a qualquer momento, use o botão **■ Parar**.

---

### 3. Agendar via Crontab

1. Abra a janela **Crontab**.
2. Clique em **+ Novo Job**.
3. Escolha **Comando Shell** e defina:
   - **Nome:** `Pulso Periódico de Logs`
   - **Expressão:** `*/5 * * * *` (a cada 5 minutos) ou `0 8 * * *` (diariamente às 08:00)
   - **Comando:** `python scripts/timestamp_logger.py`
4. Clique em **Salvar e Agendar**. O servidor registrará cada execução em histórico detalhado!

---

### 4. Orquestrar em Mini-Workflows

1. Abra a janela **Mini-Workflows**.
2. Conecte um **Trigger** (modo `cron` ou `manual`) a um nó **Code Box (JS/Py)** ou **HTTP Request**.
3. A saída `$output` do nó anterior é automaticamente repassada como `$input` e `$json` para o nó seguinte.
4. Use o botão **Salvar** ou **No Workspace** para gerenciar os arquivos de automação diretamente no sistema de arquivos.
