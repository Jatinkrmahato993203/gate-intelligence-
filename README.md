# 🏟️ Gate Intelligence Engine (FIFA World Cup 2026)

> A GenAI-enabled crowd management and operational intelligence solution designed to enhance stadium operations, reduce wait times, and improve the overall tournament experience for fans and staff during the FIFA World Cup 2026.

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB)
![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white)
![Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=google&logoColor=white)

---

## ✨ Features

- **🧠 GenAI Crowd Forecasting:** Uses Google's Gemini API to intelligently predict fan arrival curves based on transit schedules, weather, and event timings.
- **⏱️ Real-time Wait Time Engine:** Calculates dynamic wait times per gate based on hardware throughput, max queue lengths, and crowd slowdown factors.
- **📱 Smart Fan Nudges:** Proactively redirects fans to faster gates using geospatial Haversine distance calculations and predictive time-saving thresholds.
- **📊 Operations Dashboard:** A real-time data funnel allowing stadium organizers to monitor queue health and deploy staff instantly.
- **🌐 Accessible & Multilingual UI:** Built with strict WCAG semantics, keyboard operability, and localization (EN, ES, HI) for international venue staff.
- **🔒 Enterprise Security:** Fortified with JWT authentication, Joi input validation, Helmet security headers, and Redis-backed distributed rate limiting.

---

## 🏗️ Architecture & Tech Stack

- **Backend:** Node.js (v18+), Express.js, TypeScript
- **Database:** PostgreSQL (Connection pooling via `pg`)
- **Cache / Rate Limiting:** Redis
- **Testing:** Jest & `ts-jest`
- **Real-time:** WebSockets (`ws`)
- **Background Jobs:** `node-cron`
- **AI Integration:** `@google/generative-ai`

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following installed on your local machine:
- **Node.js** (v18 or higher)
- **Docker & Docker Compose** (for easy database/cache setup)

### 2. Environment Setup
Clone the repository and install the dependencies:
```bash
git clone <your-repo-url>
cd gate-intelligence
npm install
```

Copy the example environment file and fill in your secrets (like your Gemini API Key):
```bash
cp env.example .env
```

### 3. Start the Infrastructure (Database & Redis)
Use Docker Compose to spin up a local PostgreSQL database and Redis cache:
```bash
docker-compose up -d
```

### 4. Database Migrations & Seeding
Initialize the database tables and populate them with dummy World Cup venue data:
```bash
npm run db:reset
```

### 5. Run the Server
Start the development server with hot-reloading:
```bash
npm run dev
```
*The server will start on `http://localhost:3000`.*

---

## 🧪 Testing

The project is equipped with a robust automated test suite using Jest. Business logic (like wait-time calculations and geospatial distance) is heavily decoupled from the HTTP routing layer, ensuring high testability.

To run the test suite and generate a coverage report:
```bash
npm run test
```

---

## ☁️ Deployment Strategy

Because this application relies on **WebSockets** for real-time updates and **node-cron** for background aggregation jobs, deploying the backend to serverless environments (like Vercel or AWS Lambda) is **not recommended**.

**Recommended Architecture:**
1. **Frontend (`index.html`):** Deploy statically to Vercel, Netlify, or Firebase Hosting.
2. **Backend (Node API):** Deploy the provided `Dockerfile` as a long-running container to Google Cloud Run, Render, Railway, or Fly.io.
3. **Databases:** Use managed instances like Google Cloud SQL (PostgreSQL) and Memorystore (Redis).

---

## 📖 API Reference (Highlight)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api/fans/nudge` | `GET` | Get alternative gate recommendation | ❌ |
| `/api/fans/route` | `POST` | Calculate path between gates | ❌ |
| `/api/ops/wait-times` | `GET` | Get real-time wait times (Cached) | 🔒 Staff/Ops |
| `/api/ops/dashboard` | `GET` | Get daily metrics and conversion funnels | 🔒 Ops |
| `/api/ops/action` | `POST` | Log staff deployment / gate closure | 🔒 Staff/Ops |

---
*Built for the FIFA World Cup 2026.* ⚽
