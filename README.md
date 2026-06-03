# Draftly
Draftly — AI-Powered Email Response Assistant
Draftly is an automated, context-aware email dashboard designed to turn your inbox into an actionable to-do list. It intelligently filters Gmail messages, generates AI-powered drafts, and manages the lifecycle of a response with automated retries and status tracking.

🚀 Features
State-Tracked Dashboard: Emails are filtered by status (not_replied, sending, replied, failed). Once a reply is sent, the email automatically vanishes from the active list.

Contextual AI Drafting: View the original message subject and snippet directly above the drafting area to provide precise custom instructions.

Gmail Synchronization: Automatically marks emails as Read in your Gmail inbox once a response is successfully sent through the dashboard.

Web Push Notifications: Uses Service Workers and VAPID protocol to alert you of new actionable mail even if your browser tab is closed or you are logged out.

Fail-Safe Send Queue: Implements background tracking to ensure high-priority replies (such as legal or project-related updates) are delivered, retrying automatically on network failure.

🛠️ Tech Stack
Frontend: Next.js 14+ (App Router), Tailwind CSS, NextAuth.js (Google OAuth 2.0).

Backend: FastAPI (Python 3.10+), PyMongo, PyWebPush.

Database: MongoDB (Tracking message_id, status, and is_respondable flags).

📂 Project Structure
Plaintext
├── backend/
│   ├── main.py               # FastAPI Controller (Sync, Send, Mark-as-Read)
│   └── requirements.txt      # pywebpush, pymongo, cryptography, fastapi
│
└── frontend/
    ├── app/
    │   ├── page.tsx          # Unified Dashboard UI & Auto-Refresh Logic
    │   └── api/auth/         # NextAuth Config (Scope: gmail.modify)
    └── public/
        └── sw.js             # Service Worker for Background Push
⚙️ Setup Instructions
1. Google Cloud Configuration
Enable Gmail API.

Configure OAuth Scopes to include: https://www.googleapis.com/auth/gmail.modify.

(Note: This scope is required to remove the 'UNREAD' label from messages).

2. Backend Setup
Install Dependencies:

Bash
pip install fastapi uvicorn pymongo pywebpush cryptography
Environment Variables: Ensure VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are set in main.py for Web Push functionality.

Run Server:

Bash
uvicorn main:app --reload
3. Frontend Setup
Install Dependencies: npm install

Service Worker: Ensure public/sw.js is present to handle the push event.

Run Development: npm run dev

🔄 Lifecycle of an Email
Draftly ensures data integrity by following a strict state transition. This prevents duplicate replies and ensures your dashboard stays clean.

Syncing: New unread emails are analyzed; if actionable, they enter the DB as status: "not_replied".

Dashboard: The UI calls /list-emails which strictly filters for status: "not_replied".

Sending: Upon clicking "Approve", the backend sets status to sending.

Completion: Once Gmail API confirms delivery, the backend removes the UNREAD label in Gmail and updates the DB to status: "replied".

🛑 Common Troubleshooting
Hydration Error: If browser extensions interfere with the DOM, use suppressHydrationWarning on the loading state <div>.

403 Forbidden: If the app fails to mark as read, you must re-authenticate to approve the updated gmail.modify scope.

404 Not Found: Ensure your frontend fetch calls point to the correct FastAPI port (usually :8000) and match the @app.post decorators exactly.