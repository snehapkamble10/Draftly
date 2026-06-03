
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { MongoClient } from "mongodb";

// Initialize your MongoDB client
// const client = new MongoClient(process.env.MONGO_URI!);
// const db = client.db("draftme");


if (!process.env.MONGO_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGO_URI"');
}

const uri = process.env.MONGO_URI;
const options = {};
console.log(uri);
let client: MongoClient;
let clientPromise: Promise<MongoClient>;
//let db = client.db("draftme");

// This prevents creating multiple connections during hot-reloads in development
if (process.env.NODE_ENV === "development") {
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
console.log("I am here");
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Scopes for reading and sending Gmail
          scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
          access_type: "offline", // Essential to get the Refresh Token
          prompt: "consent",     // Forces Google to provide the Refresh Token
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account && user) {
        // Sync the Google data to your MongoDB immediately
        console.log("hello");
        const client = await clientPromise;
        const db = client.db("gmail_ai_db");
        await db.collection("users").updateOne(
          { email: user.email },
          {
            $set: {
              name: user.name,
              tokens: {
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
              },
            },
          },
          { upsert: true }
        );
      }
      return true;
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }: any) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};