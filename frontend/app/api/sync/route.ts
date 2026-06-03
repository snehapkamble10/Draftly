import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth"; // Double-check this path!
import { NextResponse } from "next/server";

export async function POST() {
  try {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Call your FastAPI backend
    const response = await fetch("http://127.0.0.1:8000/sync-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.user.email }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("FastAPI Error:", errorData);
      return NextResponse.json({ error: "FastAPI failed", details: errorData }, { status: 502 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Next.js Sync Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });

}
}
  