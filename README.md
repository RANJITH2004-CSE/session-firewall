# 🛡️ Session Firewall — Demo Banking Security Platform

A real-time behavioral risk scoring and session security platform for modern online banking applications. **Session Firewall** detects suspicious or unauthorized user sessions, calculates physical velocity anomalies (impossible travel), quarantines threat artifacts, blocks unauthorized fund transfers, and coordinates automated incident defense between customers and bank security administrators.

---

## 📌 System Highlights

- **8-Rule Behavioral Risk Scoring Engine**: Evaluates device fingerprints, IP addresses, geographical deviations, velocity anomalies, VPN exit nodes, brute force history, mid-session telemetry shifts, and transaction thresholds.
- **Automated Quarantine & Step-Up Auth**:
  - `0–29 points (Low Risk)`: Session allowed automatically.
  - `30–59 points (Medium Risk)`: Triggers simulated two-factor OTP authentication.
  - `60+ points (High Risk)`: Session quarantined, transfers locked, incident logged in Admin SOC, and critical challenge dispatched.
- **Interactive "Was this you?" Customer Security Challenge**:
  - Prompt: *"Suspicious login detected from Chrome on Windows in New York at 10:35 AM. Was this you?"*
  - **"No, secure my account"**:
    - Terminates all other active sessions except the trusted one.
    - Quarantines suspicious device signature and IP in the firewall blocklist.
    - Disables outgoing wire/ACH transfers immediately.
    - Dispatches simulated security email with password-reset instructions.
    - Escalates admin alert status to `Confirmed Fraud`.
  - **"Yes, it was me"**: Resolves alert and marks device as trusted.
- **Bank Security Operations Center (SOC)**:
  - Real-time audit log of every evaluated session and risk score breakdown.
  - Interactive status filters (`Allowed`, `MFA Required`, `Blocked`, `Confirmed Fraud`, `Resolved`).
  - 1-click IP and device quarantine / unblock controls.
  - Threat analytics chart showing 7-day login volume, suspicious attempts, and blocked threats.
  - Transfer unlock/lock controls.
- **1-Click Scenario Simulation Suite**:
  - **Scenario 1 (Safe Login)**: Known device in Mumbai, India (Score: 0, Low Risk, Session Allowed).
  - **Scenario 2 (Suspicious Login)**: New device in New York, USA, 10 minutes after Mumbai (Score: 115, High Risk, Impossible Travel > 20,000 km/h, Session Blocked, Transfers Locked).

---

## 🧱 Tech Stack

| Tier | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide Icons, Axios |
| **Backend** | Node.js, Express 4, JWT, bcryptjs, ua-parser-js, uuid |
| **Database** | MongoDB with Mongoose (with automated embedded fallback) |
| **Telemetry** | Haversine Geodesic Distance Formula, IP Geolocation Engine |
| **Notifications**| Real-time in-app notification center & simulated security email preview mailbox |

---

## ⚖️ Suspicious Session Risk-Scoring Matrix

The Session Firewall engine calculates a cumulative risk score for every authentication attempt and active session:

| # | Condition | Risk Points | Evaluation Rule |
|---|---|---|---|
| 1 | **New Device** | `+30` | Browser + OS + Hardware fingerprint not in user's trusted profile |
| 2 | **New IP Address** | `+15` | IP address has not been observed in previous sessions |
| 3 | **Unusual City or Country** | `+30` | Location differs from user's primary operating cities |
| 4 | **VPN / Proxy Detected** | `+15` | Datacenter or known proxy/Tor exit node identified |
| 5 | **Impossible Travel** | `+40` | Haversine velocity between consecutive logins exceeds commercial aircraft speed (>800 km/h over distance >200 km) |
| 6 | **Failed Login Spike** | `+25` | Account suffered 3 or more consecutive failed login attempts |
| 7 | **Active Session Telemetry Shift** | `+25` | Client IP or device signature changes mid-session during active token usage |
| 8 | **Large or Unusual Transfer** | `+25` | Transfer amount exceeds $5,000 or 50% of available account balance |

### Risk Level Actions
- **Low Risk (0–29 points)**: Session allowed. Normal banking access granted.
- **Medium Risk (30–59 points)**: Step-up authentication required. Simulated MFA OTP passcode generated.
- **High Risk (60+ points)**: Session blocked immediately, transfers locked, customer alerted via in-app & simulated email, and incident logged in Admin SOC.

> **Privacy & Identity Policy:** Session Firewall identifies suspicious behaviors and requires legitimate customer verification with simulated MFA or a *"Was this you?"* challenge screen rather than claiming absolute identity attribution of an external attacker.

---

## 👥 Demo Accounts & Personas

| Role | Email | Password | Details |
|---|---|---|---|
| **Customer** | `customer@securebank.com` | `Password123!` | Alex Mercer • Balance: $24,850.00 • Account: SB-8829-4102 |
| **Bank Administrator** | `admin@securebank.com` | `AdminSecure123!` | Sarah Connor (Security Operations Center Lead) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- *(Optional)* Local MongoDB running on `mongodb://127.0.0.1:27017` (If MongoDB is not running, the application will automatically launch an in-memory database).

### 1. Installation

Clone or open the repository folder:

```bash
cd session-firewall
```

#### Install Backend Dependencies:
```bash
cd backend
npm install
```

#### Install Frontend Dependencies:
```bash
cd ../frontend
npm install
```

---

### 2. Environment Configuration

Backend configuration file: `backend/.env`
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/session-firewall
JWT_SECRET=secure-session-firewall-jwt-secret-key-2026
NODE_ENV=development
```

---

### 3. Running the Application

You can run both backend and frontend concurrently:

#### Terminal 1: Start Backend Server (Port 5000)
```bash
cd backend
npm start
```
*The backend auto-seeds initial demo accounts, baseline sessions, and sample transactions on first start.*

#### Terminal 2: Start Frontend Dev Server (Port 5173)
```bash
cd frontend
npm run dev
```

Visit the application in your browser at:
👉 **`http://localhost:5173`**

---

## 🧪 Testing the Demo Scenarios

Once the app is running, use the top **Demo Simulation Suite** bar or the login screen controls to test:

### Scenario 1: Safe Login
1. Log in as Customer (`customer@securebank.com`).
2. Click **"Scenario 1: Safe Login"** on the top bar.
3. Telemetry: Known device (`Chrome 122 on Windows 11`) in usual location (`Mumbai, India`).
4. **Result**: Score = `0 pts` (Low Risk). Login allowed smoothly.

### Scenario 2: Suspicious Login (Impossible Travel Attack)
1. While logged in as Alex Mercer, click **"Scenario 2: Suspicious Login"** on the top bar.
2. Telemetry: New device (`Firefox 124 on macOS Sonoma`) in `New York, United States`, just 10 minutes after Mumbai.
3. Distance: `12,538 km`. Speed: `> 25,000 km/h` (> 800 km/h limit).
4. Points: `+40` (Impossible Travel) `+30` (Unrecognized Device) `+30` (Unusual Location) `+15` (New IP) = **115 pts (High Risk)**.
5. **Result**:
   - Session blocked immediately.
   - Outgoing transfers locked.
   - Real-time in-app challenge appears: *"Suspicious login detected from Firefox on macOS in New York... Was this you?"*
   - Simulated email generated in customer's mailbox.
   - Admin SOC logs incident.
6. Click **"No, secure my account"**:
   - Quarantines the attacker's IP and device.
   - Terminates unauthorized sessions.
   - Shows instructions to reset password.
   - Flags alert as `Confirmed Fraud` in Admin SOC.

### Scenario 3: Bank Security Admin SOC
1. Switch to Admin via the top-right persona menu or log in as `admin@securebank.com`.
2. Inspect the **7-Day Threat Activity Chart**.
3. View the suspicious session logged from New York with full 115-point reason breakdown.
4. Filter by status (`Confirmed Fraud`, `Blocked`, `MFA Required`).
5. Click **Block IP** / **Unblock IP** to manage the global firewall blocklist.
6. Click **Unlock Transfers** when the customer's account is verified.

---

## 📡 REST API Documentation

### Authentication (`/api/auth`)
- `POST /api/auth/login`: Authenticates credentials and evaluates session risk.
- `POST /api/auth/verify-mfa`: Validates simulated OTP passcode for medium-risk sessions.
- `GET /api/auth/me`: Retrieves current user profile, transfer lock status, and active session telemetry.
- `POST /api/auth/logout`: Revokes current active session token.

### Sessions (`/api/sessions`)
- `GET /api/sessions`: Lists all active and historical sessions for authenticated user.
- `POST /api/sessions/mark-not-me`: Customer denial workflow — quarantines IP/device, locks transfers, revokes unauthorized sessions, and notifies admin.
- `POST /api/sessions/confirm-was-me`: Customer confirms activity — resolves alert and marks device trusted.
- `DELETE /api/sessions/:sessionId`: Terminates a specific active session.

### Banking Operations (`/api/bank`)
- `GET /api/bank/dashboard`: Account balance, recent transactions, and transfer restriction status.
- `POST /api/bank/transfer`: Executes money transfer with real-time transfer lock and risk checks.
- `GET /api/bank/notifications`: Retrieves customer in-app notifications and simulated email logs.
- `POST /api/bank/notifications/read`: Marks notifications as read.

### Security Administration (`/api/admin`)
- `GET /api/admin/sessions`: Filterable audit log of suspicious sessions.
- `GET /api/admin/metrics`: Aggregated SOC metrics and 7-day threat trend series.
- `GET /api/admin/blocklist`: Active quarantined IP addresses and device signatures.
- `POST /api/admin/blocklist/toggle`: Blocks or unblocks a specific IP or device.
- `PATCH /api/admin/sessions/:sessionId/status`: Updates session status (`Allowed`, `Blocked`, `Confirmed Fraud`, `Resolved`).
- `PATCH /api/admin/users/:userId/transfers`: Locks or unlocks customer fund transfers.

### Demo Scenarios (`/api/demo`)
- `POST /api/demo/reset`: Resets demo state and re-seeds baseline data.
- `POST /api/demo/scenario-safe`: Triggers Scenario 1 (Safe login).
- `POST /api/demo/scenario-suspicious`: Triggers Scenario 2 (Suspicious login with impossible travel).

---

## 📁 Project Directory Structure

```
session-firewall/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                 # MongoDB connection & in-memory fallback
│   │   │   └── seed.js               # Demo accounts & transactions seeder
│   │   ├── controllers/
│   │   │   ├── authController.js     # Login & MFA risk evaluation
│   │   │   ├── sessionController.js  # Active sessions & "Was this not me" logic
│   │   │   ├── bankController.js     # Balances, transfers & risk checks
│   │   │   ├── adminController.js    # Security operations & blocklist
│   │   │   └── demoController.js     # 1-click test scenario runners
│   │   ├── middleware/
│   │   │   └── authMiddleware.js     # JWT token & blocklist enforcement
│   │   ├── models/
│   │   │   ├── User.js               # Customers, admins & lock attributes
│   │   │   ├── Session.js            # Telemetry, risk score & status
│   │   │   ├── SecurityAlert.js      # Security incidents & resolution logs
│   │   │   ├── Blocklist.js          # Quarantined IPs and devices
│   │   │   ├── Transaction.js        # Banking transaction ledger
│   │   │   └── Notification.js       # In-app alerts & simulated email logs
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── sessions.js
│   │   │   ├── bank.js
│   │   │   ├── admin.js
│   │   │   └── demo.js
│   │   ├── services/
│   │   │   ├── riskEngine.js         # 8-rule scoring & risk tiering
│   │   │   ├── geoService.js         # Haversine distance & velocity math
│   │   │   └── notificationService.js# In-app alert & simulated email generation
│   │   └── server.js                 # Express server bootstrap
│   ├── test_risk_engine.js           # Automated risk engine verification tests
│   ├── package.json
│   ├── .env
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx            # Banking header & role switcher
│   │   │   ├── ScenarioBar.jsx       # 1-click demo scenario runner
│   │   │   ├── WasThisYouModal.jsx   # Suspicious login challenge modal
│   │   │   ├── MfaModal.jsx          # Step-up 6-digit OTP verification
│   │   │   ├── TransferModal.jsx     # Money transfer with lock enforcement
│   │   │   ├── EmailInboxModal.jsx   # Simulated outgoing security emails
│   │   │   ├── SessionCard.jsx       # Telemetry card with denial button
│   │   │   ├── ThreatChart.jsx       # 7-day SVG threat activity chart
│   │   │   └── RiskBadge.jsx         # Colored risk level badges
│   │   ├── context/
│   │   │   ├── AuthContext.jsx       # User authentication & token state
│   │   │   └── SecurityContext.jsx   # Real-time alerts & challenge triggers
│   │   ├── pages/
│   │   │   ├── Login.jsx             # Login with persona selection & telemetry tester
│   │   │   ├── CustomerDashboard.jsx # Account overview & balance
│   │   │   ├── ActiveSessions.jsx    # Session management & lockdown
│   │   │   └── AdminDashboard.jsx    # SOC threat monitoring & quarantine
│   │   ├── services/
│   │   │   └── api.js                # Axios REST API client
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css                 # Tailwind directives & banking theme
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── package.json
└── README.md
```
