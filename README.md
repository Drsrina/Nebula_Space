# Nebula 🌌 — 3D Spatial File Workspace & Dev Environment

**Nebula** is an immersive 3D spatial workspace for browsing, editing, and orchestrating code files, Git repositories, notes, and automations on a native 3D canvas featuring **3 cognitive depth planes (Z-Depth)**.

Inspired by the visual freedom of spatial whiteboards (like Miro) and the speed of modern code editors, Nebula eliminates overlapping window clutter through a tangible spatial hierarchy along the Z-axis.

---

## 📐 The 3 Cognitive Depth Planes (Z-Depth) & Occlusion Engine

Nebula does not treat 3D as a superficial aesthetic gimmick; the Z-axis directly mirrors **cognitive priority**:

| Plane | Z-Depth | Priority | Visual Characteristics & Interactive Behavior |
|---|---|---|---|
| **Plane 0** | `Z = 0px` | **Focus** | Primary workspace (active Monaco code editor, document preview, active terminal). **Blur 0px, Opacity 1.0, Scale 1.0**, neon glow, fully interactive. |
| **Plane 1** | `Z = -400px` | **Context** | Git panel, project file tree, secondary reference tabs, global search. **Scale 0.94**, attenuated blur, medium ambient glow. |
| **Plane 2** | `Z = -700px` | **Archive / Reference** | Long-term research notes, parked documentation, task runners, logs, and drafts. **Scale 0.88**, recessed into background space. |

### 🔍 Optical Occlusion & Unblocked 3D Hit-Testing (`activeLayer`)
One of Nebula’s core architectural strengths is its spatial interaction engine:
- **Zero-Blocking 3D Hit-Testing**: The 3D scene stage container operates with `pointer-events: none`, allowing click rays to penetrate virtual depth planes and directly reach buttons, headers, and inputs inside windows placed at negative depths ($Z = -400px$ and $Z = -700px$).
- **Inert Window Isolation**: When focus shifts to **Plane 1** or **Plane 2**, windows positioned physically in front become **translucent frosted glass** with `[data-inert="true"]` (`pointer-events: none !important`), preventing foreground editors or controls from intercepting background clicks.
- **Single-Click Viewport Centering & Focus**: Clicking any window on any depth plane immediately activates that window and its plane, keeping spatial navigation seamless and frictionless.

---

## ✨ Specialized Modules & Windows

Nebula provides an extensive suite of built-in windows designed for every stage of development:

### 1. 📝 Advanced Multi-Tab Code Editor (`EditorWindow`) — *Plane 0 (Focus)*
- Full **Monaco Editor** with custom neon themes (`nebula-dark`, `tokyo-night`, `one-dark-pro`, `dracula-neon`).
- **Complete Application Menu Bar & Advanced Actions**:
  - **File**: *New File (`Ctrl+N`)*, *Open Local File... (`Ctrl+O`)*, *Save (`Ctrl+S`)*, **Save As...**, **Revert File**, **Line Ending Toggle (LF / CRLF)**, *Download*, *Close Tab (`Ctrl+W`)*.
  - **Edit**: *Undo (`Ctrl+Z`)*, *Redo (`Ctrl+Y`)*, *Find (`Ctrl+F`)*, *Replace (`Ctrl+H`)*.
  - **View**: *Word Wrap*, *Minimap*, *Symbol Outline Drawer*, *Switch Theme...*.
  - **Tools**: *Open New Independent Editor*, *Unsnap Window*, *Compare with Git (Diff)*.
- **Completely Independent Instances**: Duplicated or secondary editors maintain decoupled local state and isolated buffers without cross-instance leakage.
- **Real-time Git Gutter**: Visual gutter indicators (green for additions, amber for modifications, red for deletions) calculated live against `HEAD`.
- **Hierarchical Breadcrumbs Bar**: Shows active path hierarchy with interactive navigation.
- **Symbol Outline Drawer**: Extracts functions, classes, interfaces, and variables with 1-click line jumping.

### 2. ⚡ Universal Command Palette & Quick Open (`LauncherWindow`) — *Shortcut `Ctrl+P` / `Ctrl+K`*
- Instantly accessible anywhere using `Ctrl+P` or `Ctrl+K`.
- **Quick Open Mode (`Ctrl+P`)**: Instant fuzzy file search across your entire workspace with 1-click jump into Monaco.
- **Action & Window Launcher (`Ctrl+K`)**: Rapidly open specialized tools, toggle operational modes (Local vs VPS), switch spatial layout presets, and reset the 3D camera.
- Full keyboard-driven navigation with shortcut badges.

### 3. 📌 Spatial Notes & Multi-Format Export (`NoteWindow`) — *Plane 2*
- Rich Markdown note editor with instant live preview, code highlighting, and interactive task checklists.
- **1-Click Multi-Format Exporting**:
  - **HTML**: Clean, styled standalone HTML document ready for external viewing.
  - **PDF**: Print-optimized stylesheet for clean reporting and archiving.
  - **Markdown (.md)**: Raw markdown file download.
- Visual categorization via vibrant neon tags (cyan, purple, blue, amber, green, red).
- Real-time word and character statistics.

### 4. 🎛️ 3D Spatial Layout Presets (Saved Workspaces)
- Instant 1-click switching between curated spatial window layouts across the 3 cognitive depth planes:
  - **Preset "Coding"**: Monaco Editor focused on Plane 0, Diff on Plane 1, Git Panel on Plane 2.
  - **Preset "Review / Notes"**: Side-by-side Notes on Plane 0, File Browser on Plane 1.
  - **Preset "Full Stack"**: Code Editor on Plane 0, Interactive Terminal on Plane 1, Docker Monitor on Plane 2.
- Smooth camera transitions with precise damping (lerp) running at a fluid 60 FPS.

### 5. 💻 Interactive Web Terminal (xterm.js + WebSocket / PTY) — *Plane 2*
- Real PTY terminal session connected directly to container shell (`/bin/bash` or `sh`).
- Full support for interactive CLI tools (`htop`, `vim`, `nano`, `git`, `npm`, `python`).
- Command history, hotkeys (`Ctrl+C`, `Ctrl+L`), and dynamic window resize syncing.

### 6. 🔄 Mini-Workflows & Integrated Crontab Automation
- Visual node-based pipeline builder with chained data flow.
- **Trigger Node**: Manual trigger or automated execution scheduled via **Crontab**.
- **HTTP Request Node**: Full REST API caller (GET, POST, PUT, DELETE) passing JSON payloads downstream.
- **Code-Box Node (Python / JavaScript)**: Execute custom logic and script transformations with input/output payloads.
- Live streaming execution logs via Server-Sent Events (SSE).

### 7. 📦 Task Runner & Scripts with Auto-Discovery
- Process and script dashboard with real-time detection of active processes and `package.json` scripts.
- Includes a sample onboarding script `timestamp-logger.js` automatically generated for rapid testing.

### 8. 🛡️ Enterprise Security, MFA/2FA & Global Settings
- **Full-Screen Authentication Gate (`FullScreenLoginGate`)**: Blocks unauthorized web viewing of the 3D canvas before login.
- **Global Settings Security Panel**:
  - **Admin Password Change**: Change password on-the-fly with persistent `/data/auth-config.json` storage (no container restarts needed).
  - **Two-Factor Authentication (TOTP / MFA)**: Crisp QR Code generation for Google Authenticator, Authy, Microsoft Authenticator, and 1Password, with 6-digit confirmation.
  - **Device Revocation & Safe MFA Disabling**: Requires confirmation with current admin password.
  - **Path Traversal Protection (`NEBULA_ROOTS`)**: Strict file isolation to authorized root paths.
- Execution history with exit codes, timestamps, and live log view.
- Path traversal protection and sandboxed execution.

### 7. 🧪 Code Sandbox (`CodeSandboxWindow`)
- Fast interactive scratchpad for testing snippets in **Python 3** and **JavaScript**.
- Runs in an isolated runtime with real-time stdout, stderr, and execution duration reporting.

### 8. 📋 Kanban Board (`KanbanWindow`)
- Spatial project and sprint tracking board.
- Draggable cards across customizable columns (*Backlog*, *In Progress*, *Testing*, *Done*).
- Tagging, priorities, and local storage persistence.

### 9. 🌐 Web Embed & Safe Anti-X-Frame Proxy (`WebEmbedWindow`)
- In-canvas web browser for reading documentation, API references, or internal web dashboards.
- **Anti-X-Frame Streaming Proxy** (`/api/proxy/web?url=...`):
  - Safely strips `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'none'` headers.
  - Injects `<base>` tags to preserve relative styles and assets.
  - Built-in SSRF protection blocking private IPs, RFC 1918 subnets, loopback addresses, and cloud metadata endpoints.
  - 1-click button to open external links directly in a new browser tab.

### 10. 🤖 Nebula AI Chat Assistant (`AiChatWindow`) — *Plane 1*
- Integrated AI coding assistant powered by **Google Gemini 2.0 Flash** (`POST /api/ai/chat`).
- **Context Awareness**: Automatically injects the active code editor file when prompts reference words like "code", "function", or "this file".
- Formatted Markdown responses with syntax-highlighted code blocks and 1-click copying.

### 11. ⚖️ Visual Diff Viewer (`DiffWindow`)
- Side-by-side or unified diff comparison.
- Real-time line addition/removal counters with crisp neon blue/red syntax highlighting.

### 12. 🗂️ File Browser & Directory Tree (`FileBrowserWindow` & `FileTreeWindow`) — *Plane 1*
- Hierarchical tree expand/collapse.
- **Progressive Chunk Loading**: Prevents DOM freeze on massive folders (`node_modules`, `.git`) by loading items in 80-item progressive slices with a *"Load More"* trigger.
- Direct local filesystem access via Chromium's native File System Access API.

### 13. 🔍 Workspace Global Search (`GlobalSearchWindow`) — *Plane 1*
- Accessible via global shortcut `Ctrl + Shift + F` or TopBar.
- Fast recursive text and regex grep (`/api/fs/grep`).
- Result grouping by file, occurrence counters, line numbers, and highlighted code snippets with 1-click jump into Monaco.

### 14. 🧭 Interactive 3D Minimap (`Minimap.tsx`)
- Dynamic 2D radar view of the entire 3D canvas showing all windows and camera bounds.
- **Drag-to-Pan**: Click or drag the viewport rectangle to smoothly glide the camera across the workspace.
- Collapse/expand toggle, live zoom level display, and 1-click depth plane focus buttons (`D0`, `D1`, `D2`).

### 15. 🧲 Magnetic Window Snapping & Real Fullscreen Portal
- **Window Snapping**: Dragging windows near each other magnetically snaps them into unified groups. Can be toggled on/off globally in Settings.
- **One-Click Unsnap**: Dedicated button on grouped window headers to break windows apart.
- **Real Fullscreen**: Window maximize uses **React Portals** (`createPortal(..., document.body)`) to break out of CSS 3D matrix containers, occupying 100% of the monitor cleanly.

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Description |
|---|---|
| `1` or `Digit 1` | Glide camera and activate **Plane 0 (Focus)** |
| `2` or `Digit 2` | Glide camera and activate **Plane 1 (Context)** |
| `3` or `Digit 3` | Glide camera and activate **Plane 2 (Archive)** |
| `Esc` or `0` | Return camera focus immediately to **Plane 0** |
| `W`, `A`, `S`, `D` / `Arrow Keys` | Pan the 3D camera across the workspace (hold `Shift` for 2.5x speed) |
| `Ctrl + P` / `Cmd + P` | **Quick Open** (fuzzy search files by name across the workspace) |
| `Ctrl + Shift + F` | **Global Search** (regex/text grep across all files) |
| `Ctrl + K` / `Cmd + K` | Open Command Palette / Nebula Launcher |
| `Ctrl + S` / `Cmd + S` | Save active file in code editor |
| `F` | Toggle **Focus Mode** (dims/hides inactive depth planes) |
| `Space + Click & Drag` | Pan the infinite 3D canvas |
| `Middle Mouse Drag` | Freehand canvas pan |
| `Mouse Wheel` | Smooth zoom in / zoom out |
| `Mouse Wheel on Window Header` | Elevate or lower window between depth planes (Z-axis elevation) |

---

## 🛠️ Architecture & Technical Stack

- **Frontend**: React 19 + TypeScript + Vite 6.
- **Styling**: Tailwind CSS v4 (*Deep Space* dark palette `#050810`, neon cyan `#3ba9ff`, teal `#5eead4`, and violet `#a78bfa`).
- **DOM-Native 3D Projection**:
  - Master container: `perspective: 3000px` with `transform-style: preserve-3d`.
  - Floating stages: Hardware-accelerated `translate3d(X, Y, Z)` powered by **Framer Motion** (`motion/react`).
  - *Architectural Choice*: **Zero WebGL/Three.js overhead**. Text is 100% selectable native DOM, inputs remain accessible, and Monaco Editor retains full subpixel font rendering and native browser context menus.
- **State Management**: Zustand stores (`useCanvasStore`, `useWindowsStore`, `useEditorStore`, `useFSStore`, `useGitStore`).
- **Persistence**: IndexedDB (`idb`) with automatic normalization and schema migration.
- **Backend**: Node.js + Express, bundled into a standalone single-file binary `dist/server.cjs` via `esbuild`.
- **Containerization**: Alpine-based Docker container with integrated Node.js 22 runtime and Python 3.

---

## 🔒 Security Architecture & Guardrails

Nebula includes enterprise-grade security guardrails:

1. **Full-Screen Authentication Gate**: Blocks web access and protects all canvas data behind JWT-backed authentication.
2. **SSRF Guardrails on Web Proxy**: Validates target URLs, disallowing loopback addresses (`127.0.0.1`), private RFC 1918 networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and AWS/GCP cloud metadata endpoints (`169.254.169.254`).
3. **Command Injection Prevention**: Task Runner routes reject shell metacharacters (`;`, `&&`, `|`, `` ` ``) and only execute pre-declared scripts from `package.json`.
4. **Path Traversal Protection**: File system endpoints validate all requested paths strictly against authorized `NEBULA_ROOTS`.
5. **Sandboxed Code Execution**: Workflow and Sandbox runners enforce strict memory and context isolation, preventing prototype leakage.

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- Node.js 20+ (Node 22 recommended)
- npm 10+
- Modern Chromium-based browser (Chrome, Edge, Brave, Arc) for File System Access API features

### Installation & Run

1. Clone the repository:
```bash
git clone https://github.com/your-username/nebula.git
cd nebula/nebula_gitv2
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment variables:
```bash
cp .env.example .env
```

4. Start the development server:
```bash
npm run dev
```

5. Open in your browser:
```
http://localhost:3000
```
Log in using:
- **Username**: `admin`
- **Password**: `admin123`

---

## 🐳 Self-Hosting & Production Deployment

### Docker & Docker Compose (Recommended)

Nebula is production-ready for self-hosting on VPS, home servers, or container dashboards (**1Panel**, **Portainer**, **Coolify**). A fully-documented template is available at the repository root (`docker-compose.yml`):

```bash
docker compose up -d --build
```

Example `docker-compose.yml`:
```yaml
services:
  nebula:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nebula-workspace
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - NEBULA_PASSWORD=your_strong_password_here
      - NEBULA_ADMIN_PASSWORD=your_strong_password_here
      - NEBULA_ADMIN_USER=admin
      - NEBULA_MFA_SETUP=true
      - NEBULA_JWT_SECRET=replace_with_a_secure_random_string_min_32_characters
      - NEBULA_ROOTS=/:/workspace:/data
      - NEBULA_READONLY=false
    volumes:
      # Persistent configuration, notes, changed credentials, auth-config.json
      - ./data:/data
      # Primary workspace code volume
      - ./workspace:/workspace
```

---

## 🔒 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port on which the Express server listens. |
| `NODE_ENV` | `development` | Runtime environment (`development` or `production`). |
| `NEBULA_PASSWORD` / `NEBULA_ADMIN_PASSWORD` | `admin123` | Master password for administrator access (supports plain text or bcrypt hash). |
| `NEBULA_ADMIN_USER` | `admin` | Username displayed in TOTP authenticator issuer. |
| `NEBULA_MFA_SETUP` | `true` | Enables MFA/2FA generation and setup inside Global Settings. |
| `NEBULA_MFA_SECRET` | *Empty* | Pre-defined base32 TOTP secret (optional; can be generated via UI). |
| `NEBULA_JWT_SECRET` | *Default* | Secret key for signing session JWT tokens (minimum 32 characters). |
| `NEBULA_ROOTS` | `/:/workspace:/data` | Colon-separated list of allowed root directories to prevent path traversal. |
| `NEBULA_READONLY` | `false` | When `true`, prevents all file write, creation, deletion, and shell execution. |
| `GEMINI_API_KEY` | *Optional* | Google Gemini API key for the AI coding assistant. |

---

## 🧪 Automated Testing Suite

Nebula includes an automated test suite covering all critical security and backend routes:

```bash
npm test
```

```
✔ Auth Routes — Rate Limiting & MFA Setup Protection (3 tests)
✔ Cron Routes — Crontab API & Path Traversal Protection (4 tests)
✔ Proxy Routes — SSRF & Security Validations (7 tests)
✔ Task Runner Routes — Command Injection & Execution Guardrails (4 tests)
✔ Workflow Engine — Unit Tests & Graph Execution (7 tests)
✔ Workflow Routes — Mini-n8n API, SSE Streaming & Security (6 tests)

ℹ tests 31 | pass 31 | fail 0
```

---

## 📄 License

Distributed under the **GNU General Public License v3.0 (GPLv3)**. See [LICENSE](LICENSE) for more details.

Free Software: You are free to run, study, modify, and redistribute this software under the terms of the GNU GPLv3. Any derivative works must also be open source under the GPLv3.
