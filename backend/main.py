import os, logging
from datetime import datetime  # <-- ADDED THIS
from fastapi import FastAPI, Header, HTTPException, Body
from pymongo import MongoClient
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from openai import OpenAI
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import base64
from email.message import EmailMessage

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development, allow everything
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Add this right after app = FastAPI()
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Global error caught: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal Server Error", "details": str(exc)},
    )


client = MongoClient(os.getenv("MONGO_URI"))
db = client["gmail_ai_db"]
ai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Helper for AI Filtering
# UPDATE this function in main.py
def is_email_respondable(snippet, subject, sender):
    try:
        response = ai_client.chat.completions.create(
            model="gpt-4o-mini", # Mini is faster and cheaper for triage
            messages=[
                {"role": "system", "content": "You are a triage assistant. Reply ONLY 'YES' if this email needs a human reply, 'NO' if it is automated/junk."},
                {"role": "user", "content": f"Subject: {subject}\nFrom: {sender}\nSnippet: {snippet}"}
            ]
        )
        verdict = response.choices[0].message.content.strip().upper()
        return "YES" in verdict
    except Exception as e:
        logging.error(f"Triage Error: {e}")
        return True

@app.post("/sync-emails")
async def sync_emails(payload: dict = Body(...)):
    # user_email = payload.get("userId")
    user_email = payload.get("userEmail")
    user_data = db.users.find_one({"email": user_email})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")
    # Update this block inside sync_emails
    try:
        tokens = user_data.get('tokens', {})
        access_token = tokens.get('access_token')
        refresh_token = tokens.get('refresh_token')

        if not access_token:
            return {"error": "Missing access token. Please re-login."}

        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",       # Explicitly add this
            client_id=os.getenv("GOOGLE_CLIENT_ID"),               # Explicitly add this
            client_secret=os.getenv("GOOGLE_CLIENT_SECRET")  
        )
    except KeyError as e:
        return {"error": "Invalid user data structure: missing {str(e)}"}

    creds = Credentials(
        token=user_data['tokens']['access_token'],
        refresh_token=user_data['tokens']['refresh_token'],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET")
    )

    service = build('gmail', 'v1', credentials=creds)
    query = "category:primary newer_than:1d"
    results = service.users().messages().list(userId='me', q=query, maxResults=15).execute()
    messages = results.get('messages', [])

    synced_count = 0
    for msg in messages:
        email_doc = db.emails.find_one({"message_id": msg['id']})
        email_status = email_doc.get('status') 
        if email_doc and email_status == "replied":
            continue
        else:
            print(f"Processing message: {msg['id']}")
            detail = service.users().messages().get(userId='me', id=msg['id']).execute()
            headers = detail.get('payload', {}).get('headers', [])
            subject = next((h['value'] for h in headers if h['name'] == 'Subject'), "No Subject")
            sender = next((h['value'] for h in headers if h['name'] == 'From'), "Unknown")
            snippet = detail.get('snippet', "")
            thread_id = detail.get('threadId')  # thread-id

            if is_email_respondable(snippet, subject, sender):
                db.emails.update_one(
                    {"message_id": msg['id']},
                    {
                        "$set": {
                            "status": "not_replied", # Initialize new mail as not_replied
                            "user_email": user_email,
                            "subject": subject,
                            "sender": sender,
                            "snippet": snippet, # Standardized name
                            "is_respondable": True,
                            "thread_id": thread_id,
                            "synced_at": datetime.now() # Now works with import
                        }
                    },
                    upsert=True
                )
                synced_count += 1
            
        if synced_count > 0:
            return {
                "status": "success", 
                "synced": synced_count, 
                "notification": f"Found {synced_count} new important emails!"
            }

    return {"status": "success", "synced": synced_count}

@app.post("/generate-reply")
async def generate_reply(payload: dict = Body(...)):
    email_id = payload.get("emailId")
    user_style = payload.get("style", "professional")
    user_notes = payload.get("userNotes", "")
    user_email = payload.get("userEmail")

    # 1. Fetch the specific email from MongoDB
    email_data = db.emails.find_one({"message_id": email_id})
    
    if not email_data:
        raise HTTPException(status_code=404, detail="Email context not found in database")

    # 2. Define the variables the AI needs
    snippet = email_data.get("snippet", "")
    subject = email_data.get("subject", "No Subject")

    # 3. Fetch User Signature
    user_data = db.users.find_one({"email": user_email})
    user_signature = user_data.get("signature", "") if user_data else ""

    try:
        # 4. Call OpenAI with the now-defined variables
        response = ai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a professional email assistant."},
                {"role": "user", "content": f"Subject: {subject}\nContext: {snippet}\nStyle: {user_style}\nNotes: {user_notes}"}
            ]
        )
        ai_draft = response.choices[0].message.content
        
        # Append signature
        final_draft = f"{ai_draft}\n\n{user_signature}" if user_signature else ai_draft
        
        return {"draft": final_draft}

    except Exception as e:
        print(f"AI Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/list-emails")
async def list_emails(user_email: str):
    cursor = db.emails.find({
        "user_email": user_email, 
        "is_respondable": True,
        "status": "not_replied"
     }).sort("synced_at", -1)
    email_list = []
    for email in cursor:
        email_list.append({
            "message_id": email["message_id"],
            "subject": email.get("subject", "No Subject"),
            "sender": email.get("sender", "Unknown"),
            "snippet": email.get("snippet", ""),
            "date": email.get("synced_at").isoformat() if email.get("synced_at") else None
        })
    return {"emails": email_list}
    # cursor = db.emails.find({"user_email": user_email, "is_respondable": True}).sort("synced_at", -1)
    # email_list = []
    # for email in cursor:
    #     email_list.append({
    #         "message_id": email["message_id"],
    #         "subject": email.get("subject", "No Subject"),
    #         "sender": email.get("sender", "Unknown"),
    #         "snippet": email.get("snippet", ""),
    #         "date": email.get("synced_at").isoformat() if email.get("synced_at") else None
    #     })
    # return {"emails": email_list}

@app.post("/send-reply")
async def send_reply(payload: dict = Body(...)):
    email_id = payload.get("emailId")
    reply_text = payload.get("replyText")
    user_email = payload.get("userEmail")
    
    # 1. Fetch data from your MongoDB
    user_data = db.users.find_one({"email": user_email})
    current_email = db.emails.find_one({"message_id": email_id})
    
    if not current_email:
        raise HTTPException(status_code=404, detail="Original email data not found")

    # 2. Build the Gmail Service
    creds = Credentials(
        token=user_data['tokens']['access_token'],
        refresh_token=user_data['tokens'].get('refresh_token'),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.getenv("GOOGLE_CLIENT_ID"),
        client_secret=os.getenv("GOOGLE_CLIENT_SECRET")
    )
    service = build('gmail', 'v1', credentials=creds)

    # 3. FETCH THE ACTUAL MESSAGE-ID HEADER (Crucial for the Receiver)
    # The receiver needs the internal <...@@mail.gmail.com> ID, not our DB ID.
    original_msg = service.users().messages().get(userId='me', id=email_id).execute()
    headers = original_msg.get('payload', {}).get('headers', [])
    orig_msg_id = next((h['value'] for h in headers if h['name'].lower() == 'message-id'), None)

    # 4. Construct the MIME Message with Chaining Headers
    message = EmailMessage()
    message.set_content(reply_text)
    message["To"] = current_email["sender"]
    # Receiver's clients often require "Re: " to trigger threading
    message["Subject"] = f"Re: {current_email['subject']}"
    
    if orig_msg_id:
        # These headers act as the "glue" for the receiver's inbox
        message["In-Reply-To"] = orig_msg_id
        message["References"] = orig_msg_id

    # 5. Send with both Raw Data and ThreadId
    encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    send_payload = {
        "raw": encoded_message,
        "threadId": current_email.get("thread_id") # Linking it on YOUR end
    }
    
    try:
        # 2. Send the Reply
        service.users().messages().send(userId='me', body=send_payload).execute()
       
        # Mark as responded so it leaves your "Autoload" list
        db.emails.update_one(
            {"message_id": email_id},
            {"$set": {
                "status": "replied",
                "last_action_at": datetime.now()
            }}
        )
        return {"status": "sent"}
    except Exception as e:
        db.emails.update_one(
            {"message_id": email_id},
            {"$set": {"status": "failed", "error": str(e)}}
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/save-signature")
async def save_signature(payload: dict = Body(...)):
    user_email = payload.get("email")
    signature_text = payload.get("signature")
    
    if not user_email:
        raise HTTPException(status_code=400, detail="User email missing")

    # Update the user document in the 'users' collection
    db.users.update_one(
        {"email": user_email},
        {"$set": {"signature": signature_text}},
        upsert=True
    )
    return {"status": "saved"}