# AiUnit71

## Overview

**AiUnit71** is a modular, production-ready **multi-room AI agent factory** designed for low-to-mid tier creative and automation markets (2026–2027).

The system delivers **full-stack AI production capabilities** at **3–10× lower cost** than traditional agencies while maintaining **90%+ output quality**.

Built on **OpenClaw** as the execution framework, AiUnit71 operates through a dynamic **Rooms Warehouse** architecture — a living AI production studio supporting parallel workflows, cost-aware routing, and adjustable autonomy.

---

## Strategic Mission

AiUnit71 is designed to:

- Occupy automation niches early
- Compress agency-level production into AI pipelines
- Enable scalable creative and technical output

Primary domains:

- Content creation
- UI/UX prototyping
- Video production
- 3D rendering
- SMM & advertising
- Music & audio production
- Brand asset generation
- Product visualization

---

## Core Value Proposition

AiUnit71 provides:

- ✅ Agency-level output
- ✅ Radical cost reduction
- ✅ Niche-specific adaptability
- ✅ Continuous creative flow
- ✅ Human-controlled autonomy

---

## Key Features

### Modular Adaptation

Automatically adapts to client niches.

**Example Inputs**

- Skincare brand
- Fintech startup
- Crypto application
- E-commerce catalog

**Example Outputs**

- AI Video Packages
- SMM Content Calendars
- UI Prototype Concepts
- Brand Asset Sets

---

### Rooms Warehouse Architecture

AiUnit71 uses dynamically instantiated workspaces (“Rooms”) specialized for discrete tasks.

Rooms are:

- Context-isolated
- Task-optimized
- Parallel-capable
- Expandable

---

### Smart Cost-Aware Routing

Execution priority:

1. **Local models (Ollama)** → Preferred
2. **OpenRouter / Cloud APIs** → Fallback
3. **Premium generative tools** → When required

Objectives:

- Minimize token costs
- Optimize latency
- Maintain quality thresholds

---

### Cost Awareness Engine

AiUnit71:

- Logs token usage
- Calculates API spend
- Tracks credit consumption
- Provides per-operation cost breakdown

---

### Unbreakable Creative Continuity

Parallel agents maintain creative flow across:

- Visual generation
- Copywriting
- Audio production
- Motion design

Prevents:

- Context loss
- Style drift
- Pipeline fragmentation

---

### Human-in-the-Loop Control

Four autonomy levels:

| Level | Description |
|------|-------------|
| **0** | Fully manual |
| **1** | Assisted execution |
| **2** | Semi-autonomous |
| **3** | Autonomous freeride |

Operators may:

- Enter Rooms
- Override decisions
- Adjust routing
- Inject constraints

---

### Agent Activities

Agents may:

- Brainstorm
- Debate solutions
- Simulate team workflows
- Maintain internal CRM logic
- Operate pseudo Discord / Slack collaboration

---

## Rooms Warehouse

Default Rooms (expandable):

- **Brainstorm Room** → Ideas, moodboards, concept generation
- **Copywriting & Text Room** → Scripts, posts, lyrics
- **Image Gen & Editing Room** → Visuals, retouching
- **UX/UI Design Room** → Interfaces, validation
- **Animation & Motion Room** → Lottie, motion assets
- **Video Production Room** → Full video pipelines
- **3D & Render Room** → Models & rendering
- **Music & Audio Room** → Tracks & voiceovers
- **Code & Deployment Room** → Applications & releases
- **Cost & Routing Room** → Optimization & accounting
- **Human-in-the-Loop Room** → Monitoring & controls
- **Client Niche Adapter Room** → Service generation

---

## Technology Stack

### Base Framework

- OpenClaw (latest)
- skills.sh ecosystem

---

### Local Models (Ollama)

Offline-first execution:

- Llama3.2-vision:11b
- Qwen2.5-VL:7b
- DeepSeek-Coder-V2:16b
- GLM-4.7-Flash
- Additional models as required

---

### Cloud & Generative Services

Primary router:

- OpenRouter

Supported tools:

- Claude / GPT / Gemini
- Veo / Kling / Sora / Luma
- Midjourney / Firefly
- Higgsfield / Nanobanana 3 PRO
- Adobe Student Pro
- Topaz Labs

---

### Infrastructure

- Vercel → Deployment
- Make.com / Zapier → Orchestration

---

## Skills System

All tools are wrapped as:

- OpenClaw skills
- Markdown skill modules

Security policy:

- Mandatory VirusTotal scanning
- Permission-based execution
- Local-first preference

---

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-repo/aiunit71.git


⸻

2. Install Dependencies

npm install
# or
pip install -r requirements.txt


⸻

3. Configure Local Models

Install and run Ollama models.

⸻

4. Configure API Keys

Create .env file:

OPENROUTER_API_KEY=
GEMINI_API_KEY=
...


⸻

5. Initialize Framework

npx openclaw init


⸻

6. Launch Orchestrator

python orchestrator.py
# or
node orchestrator.js


⸻

Usage

Example Task

aiunit71 run \
  --task "Generate SMM campaign for skincare brand" \
  --autonomy 2

System Workflow
	1.	Task decomposition
	2.	Room allocation
	3.	Cost routing
	4.	Parallel execution
	5.	Output assembly

Possible Outputs
	•	Visual assets
	•	Scripts & copy
	•	UI prototypes
	•	Video / motion content
	•	Deployable builds

⸻

Development Roadmap

Planned milestones:
	1.	Core architecture definition
	2.	Orchestrator engine
	3.	Cost & Routing module
	4.	Initial Rooms implementation
	5.	Skills ecosystem expansion
	6.	Local performance optimization

⸻

Security Principles

AiUnit71 follows:
	•	Local-first execution
	•	Explicit permission model
	•	Skill verification
	•	Cost transparency
	•	Data leak minimization

⸻

Contributing

Contributions are welcome:
	•	New Rooms
	•	Skill modules
	•	Routing optimizations
	•	Cost engines
	•	Pipeline integrations

Workflow:
	1.	Fork repository
	2.	Submit PR
	3.	Document Room / Skill logic

⸻

License

MIT License
See LICENSE file.

