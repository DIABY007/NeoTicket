// Déclenchement redeploy Vercel : commit test, n'impacte pas le projet
"use client";
import dynamic from "next/dynamic";
const CustomChatbot = dynamic(() => import("@/components/CustomChatbot"), { ssr: false });

export default function CustomChatbotClientWrapper() {
  return <CustomChatbot />;
}