"use client";
import dynamic from "next/dynamic";
const CustomChatbot = dynamic(() => import("@/components/CustomChatbot"), { ssr: false });

export default function CustomChatbotClientWrapper() {
  return <CustomChatbot />;
}