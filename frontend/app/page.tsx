'use client'; // Ensure this is at the very top for Next.js App Router

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect} from "react";

// Inside your React component



export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [syncing, setSyncing] = useState(false); // Controls the "Syncing" button state
  const [loading, setLoading] = useState(false); // Controls the "Generate" button state
  const [syncStatus, setSyncStatus] = useState<string>("");
  const [emails, setEmails] = useState<any[]>([]); // To store the list from MongoDB
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [style, setStyle] = useState("professional");
  const [notes, setNotes] = useState("");
  const [signature, setSignature] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editableDraft, setEditableDraft] = useState(""); // Holds the text you change
// 1. Add a new state variable next to your other states
  const [selectedEmail, setSelectedEmail] = useState<any | null>(null);
    //Hadle adding signature
  // Load the signature from the user profile when the page loads
  useEffect(() => {
    const fetchProfile = async () => {
      const res = await fetch(`/api/user-profile?email=${session?.user?.email}`);
      const data = await res.json();
      if (data.signature) setSignature(data.signature);
    };
    if (session?.user?.email) fetchProfile();
  }, [session]);
  
  // Inside your DashboardPage component
  useEffect(() => {
    // Request notification permission on load
    if ("Notification" in window) {
      Notification.requestPermission();
    }

    const autoSync = setInterval(async () => {
      if (session?.user?.email) {
        const res = await fetch(`http://127.0.0.1:8000/sync-emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userEmail: session.user.email }),
        });
          const data = await res.json();
          
          if (data.synced > 0) {
            new Notification("New Mail for Satara Project", {
              body: data.notification,
              icon: "/favicon.ico"
            });
            fetchEmails(); // Refresh the list automatically
          }
        }
      }, 300000); // Check every 5 minutes
      return () => clearInterval(autoSync);
  }, [session]);
  
  useEffect(() => {
    const checkMail = async () => {
      if (session?.user?.email) {
        const res = await fetch(`http://127.0.0.1:8000/sync-emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userEmail: session.user.email })
        });
        const data = await res.json();
        if (data.synced > 0) {
          triggerNotification(data.synced);
          fetchEmails(); // Update the UI list
        }
      }
    };

    // Run every 2 minutes
    const interval = setInterval(checkMail, 120000);
    return () => clearInterval(interval);
  }, [session]);

  //Auto sync on login
  useEffect(() => {
  const initializeDashboard = async () => {
    if (session?.user?.email) {
      setSyncing(true);
      try {
        // 1. Trigger the sync to find new respondable emails
        await fetch(`http://localhost:8000/sync-emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userEmail: session.user.email }),
        });
        
        // 2. Fetch the newly synced list from your database
        const res = await fetch(`http://127.0.0.1:8000/list-emails?user_email=${session.user.email}`);
        const data = await res.json();
        setEmails(data.emails); // Update your dashboard state
      } catch (error) {
        console.error("Auto-upload failed:", error);
      } finally {
        setSyncing(false);
      }
    }
  };

  initializeDashboard();
}, [session]); // This runs automatically once the user logs in
  //sync the new mail auto
  useEffect(() => {
    const syncAndRefresh = async () => {
      if (!session?.user?.email) return;

      try {
        // 1. Trigger the backend sync (runs your 3-tier filter)
        const res = await fetch(`http://127.0.0.1:8000/sync-emails`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userEmail: session.user.email }),
        });
        
        const data = await res.json();

        // 2. If new respondable emails were found, refresh the UI list
        if (data.synced > 0) {
          fetchEmails(); // This function re-runs /list-emails
          
          // 3. Trigger a browser notification
          if (Notification.permission === "granted") {
            new Notification("New Respondable Mail", {
              body: `Found ${data.synced} new messages requiring your attention.`,
            });
          }
        }
      } catch (err) {
        console.error("Autoload failed:", err);
      }
    };

    // Run the check every 60 seconds
    const interval = setInterval(syncAndRefresh, 60000);
    return () => clearInterval(interval);
  }, [session]);


  const saveSignature = async () => {
    if (!session?.user?.email) return;

    try {
      const res = await fetch("http://127.0.0.1:8000/save-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: session.user.email, 
          signature: signature 
        }),
      });

      if (res.ok) {
        console.log("Signature saved successfully");
      }
    } catch (error) {
      console.error("Failed to save signature:", error);
    }
  };
  // 3. This handles the actual click event
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      
      if (res.ok) {
        // CRITICAL: Refresh the list immediately after sync!
        fetchEmails(); 
        alert(`Synced ${data.synced} respondable emails!`);
      }
    } catch (error) {
      console.error("Sync failed", error);
    } finally {
      setSyncing(false);
    }
  };

  if (status === "loading") {
    return <div className="p-10 text-center">Loading your dashboard...</div>;
  }

  // If the user isn't logged in, show a call-to-action
  if (!session) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="border p-8 rounded-xl shadow-lg bg-white text-center max-w-md">
          <h1 className="text-3xl font-bold mb-4 text-gray-800">AI Email Assistant</h1>
          <p className="mb-6 text-gray-600">Please sign in with your Google account to begin parsing your inbox.</p>
          <button
            onClick={() => signIn("google")}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition-all font-medium shadow"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const fetchEmails = async () => {
    // Use the session email to pull only your emails
    if (!session?.user?.email) return;
    
    const res = await fetch(`http://127.0.0.1:8000/list-emails?user_email=${session.user.email}`);
    const data = await res.json();
    setEmails(data.emails);
  };

  const getDraft = async (emailId: string) => {
    if (!session?.user?.email) {
      alert("You must be logged in to generate a draft.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          emailId: emailId, 
          style: style, 
          userNotes: notes, 
          userEmail: session?.user?.email 
        }),
      });
      const data = await res.json();
      setDraft(data.draft);
      setEditableDraft(data.draft); // Initialize the editable version
      setIsEditing(false); // Reset edit mode for new generation
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm("Are you sure you want to send this email?")) return;
    
    // Call the send-reply endpoint we discussed earlier
    const res = await fetch("http://127.0.0.1:8000/send-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        emailId: selectedEmailId, 
        replyText: editableDraft,
        userEmail: session?.user?.email 
      }),
    });

    if (res.ok) {
      // 1. Clear the current draft view
      setDraft("");
      setSelectedEmailId(null);
      
      // 2. Refresh the list - the replied email will now be gone from the UI
      fetchEmails(); 
      
      alert("Sent! Dashboard updated.");
    }
  };

  const handleReject = () => {
    setDraft("");
    setEditableDraft("");
    setIsEditing(false);
    // This effectively resets the state so the user can change notes and click "Generate" again
  };

  const triggerNotification = (count: number) => {
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification("Draftly Update", {
        body: `Successfully synced ${count} new respondable emails.`,
        icon: "/logo.png" // Ensure this path is correct
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") {
          triggerNotification(count);
        }
      });
    }
  };
  // Main UI when Logged In
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
  {/* --- HEADER --- */}
  <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
    <div>
      <h1 className="text-xl font-bold tracking-tight text-indigo-600">Draftly AI</h1>
      <p className="text-xs text-slate-500 font-medium">Smart Email Assistant</p>
    </div>
    <button 
      onClick={handleSync}
      disabled={syncing}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
        syncing 
        ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-100"
      }`}
    >
      {syncing ? "Syncing Inbox..." : "Sync Emails"}
    </button>
    <button 
      onClick={() => signOut()}
      className="bg-gray-800 text-white px-6 py-2 rounded-lg">
      Sign Out
    </button>
  </header>

  <main className="max-w-7xl mx-auto grid grid-cols-12 gap-6 p-6">
    
    {/* --- LEFT COLUMN: INBOX --- */}
    <section className="col-span-12 md:col-span-4 lg:col-span-3">
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Inbox</h2>
      <div className="space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto pr-2 custom-scrollbar">
        {emails.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
            <p className="text-sm text-slate-400">Your inbox is empty.</p>
          </div>
        )}
        {/* {emails.map((email) => (
          <div 
            key={email.message_id}
            onClick={() => {
              setSelectedEmailId(email.message_id);
              setDraft("");
            }}
            className={`p-4 cursor-pointer rounded-xl border transition-all duration-200 ${
              selectedEmailId === email.message_id 
                ? "bg-white border-indigo-500 shadow-lg ring-1 ring-indigo-500" 
                : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm"
            }`}
          >
            <p className="text-sm font-bold text-slate-800 truncate">{email.subject}</p>
            <p className="text-xs text-slate-500 mt-1 truncate">{email.sender}</p>
          </div>
        ))} */}
        {/* --- LEFT COLUMN: INBOX --- */}
        {emails.map((email) => (
          <div 
            key={email.message_id}
            onClick={() => {
              setSelectedEmailId(email.message_id);
              setSelectedEmail(email); // Save the entire email object here!
              setDraft("");            // Clear the old draft
            }}
            className={`p-4 cursor-pointer rounded-xl border transition-all duration-200 ${
              selectedEmailId === email.message_id 
                ? "bg-white border-indigo-500 shadow-lg ring-1 ring-indigo-500" 
                : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm"
            }`}
          >
            <p className="text-sm font-bold text-slate-800 truncate">{email.subject}</p>
            <p className="text-xs text-slate-500 mt-1 truncate">{email.sender}</p>
          </div>
        ))}
      </div>
    </section>

    {/* --- RIGHT COLUMN: AI GENERATOR --- */}
    <section className="col-span-12 md:col-span-8 lg:col-span-9">
      {/* --- RIGHT COLUMN: AI GENERATOR --- */}
      {!selectedEmailId ? (
        <div className="bg-white border border-slate-200 rounded-2xl h-[600px] flex flex-col items-center justify-center text-slate-400 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            📩
          </div>
          <p className="text-lg font-medium">Select an email to start drafting</p>
          <p className="text-sm">AI will help you write the perfect response.</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[700px]">
          {/* Style Selector */}
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-3">Tone & Style</label>
            <div className="flex gap-2">
              {["Professional", "Casual", "Bold", "Concise"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStyle(s.toLowerCase())}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all border ${
                    style === s.toLowerCase() 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
              {/* Dynamic Email Inspector (ADDED SECTION) */}
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 max-h-48 overflow-y-auto">
            <div className="mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Subject</span>
              <h3 className="text-sm font-bold text-slate-800">{selectedEmail?.subject || "No Subject"}</h3>
            </div>
            <div className="mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">From</span>
              <p className="text-xs text-slate-600 font-medium">{selectedEmail?.sender || "Unknown Sender"}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Message Snippet</span>
              <p className="text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-200 italic mt-1 leading-relaxed">
                {selectedEmail?.snippet || "No snippet available."}
              </p>
            </div>
          </div>
          {/* Instructions Input */}
          <div className="p-6 space-y-4 flex-grow overflow-y-auto">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Custom Instructions</label>
              <textarea 
                className="w-full border border-slate-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all resize-none h-32"
                placeholder="Ex: Mention that I will be traveling to Satara next week for the land partition..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <button 
              onClick={() => getDraft(selectedEmailId)}
              disabled={loading}
              className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all transform active:scale-[0.98] disabled:bg-slate-300 shadow-xl shadow-slate-200"
            >
              {loading ? "AI is crafting your response..." : "Generate AI Draft ✨"}
            </button>

            {/* AI Output Area */}
            {draft && (
              <div className="mt-6 p-6 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4">
                  {isEditing ? "Editing Response" : "AI Suggested Reply"}
                </h4>
                
                {isEditing ? (
                  <textarea 
                    className="w-full border border-indigo-200 rounded-xl p-4 text-sm focus:ring-2 focus:ring-indigo-100 outline-none min-h-[200px]"
                    value={editableDraft}
                    onChange={(e) => setEditableDraft(e.target.value)}
                  />
                ) : (
                  <div className="text-slate-800 text-base whitespace-pre-wrap leading-relaxed mb-6">
                    {editableDraft}
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  {/* APPROVE BUTTON */}
                  <button 
                    onClick={handleApprove}
                    className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-100"
                  >
                    Approve & Send
                  </button>

                  {/* EDIT BUTTON */}
                  {!isEditing && (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all"
                    >
                      Edit
                    </button>
                  )}

                  {/* REJECT BUTTON */}
                  <button 
                    onClick={handleReject}
                    className="px-6 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold hover:bg-red-100 transition-all"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="p-6 border-b border-slate-100 bg-white">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">My Signature</label>
          <textarea 
            className="w-full border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-400 h-20 resize-none"
            placeholder="Best regards, Your Name"
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            onBlur={saveSignature} // Save when the user clicks away
          />
        </div>
        </div>
      )}
    </section>
  </main>
</div>
  );
}

