import NextAuth from "next-auth";
import { authOptions } from "@/auth"; // Import from your new config file

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
console.log("Checking MONGO_URI:", process.env.MONGO_URI ? "Found" : "NOT FOUND");