# DAG + SAGA Orchestrator
This project is an orchestrator designed to manage complex, distributed transactions using the **SAGA Pattern**, executing tasks based on a **Directed Acyclic Graph (DAG)** workflow. It ensures high resilience, proper execution ordering, and automatic compensations (rollbacks) in the event of failures.

---

## 🏗️ Architecture

The system is built as a multi-service architecture, consisting of four main components:
1. **Orchestrator (Node.js)**: The core engine that evaluates DAG workflows, resolves dependencies, and manages SAGA compensations on failure.
2. **Mock API (Node.js)**: Simulates external downstream microservices (e.g., flight booking, hotel reservations, payment processing).
3. **Rate Limiter (C++)**: A high-performance standalone rate-limiting service that protects the downstream APIs from being overloaded.
4. **Frontend (React + Vite)**: A visual dashboard built with `@xyflow/react` that provides real-time visualization of the DAG execution and component statuses.

---

## ⚙️ Prerequisites

- **Node.js** (v18+)
- **Windows OS** (required to run the precompiled `RateLimiter.exe` and `start-all.bat` script out of the box)

---

## 🚀 Getting Started

### 1. Install Dependencies
Run this in the root directory to install all necessary Node.js packages:
```cmd
npm install
```

### 2. Running the Application

**Option A: The Easy Way (Windows)**
Run the included batch script from your File Explorer or Command Prompt to launch all services automatically.
```cmd
start-all.bat
```

**Option B: Manual Startup (PowerShell)**
Start the C++ Rate Limiter first:
```powershell
cd rate-limiter
.\RateLimiter.exe
```

In a new terminal window, start the Node services concurrently:
```powershell
npm run start:all
```

---

## 📊 Visualizing Workflows & Testing

Once all services are running, open your web browser and navigate to **http://localhost:5173**. 

You will see the React Flow dashboard where you can monitor the real-time execution of the DAG, track task statuses, and view edge dependencies.

![DAG Workflow Visualization](image-1.png)

### Running a Load Test
To test the resilience of the system and observe how the C++ rate limiter handles backpressure, run the included load test from a new terminal window (while the main services are active):
```cmd
npm run test:load
```