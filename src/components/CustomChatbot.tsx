import React, { useState, useRef, useEffect } from "react";

const OPENROUTER_API_KEY = "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";
const SITE_URL = "https://neoticket.live";
const SITE_NAME = "NeoTicket";

export default function CustomChatbot() {
  const [messages, setMessages] = useState([
    { role: "system", content: "Bienvenue ! Posez votre question sur NeoTicket." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": SITE_URL,
          "X-OpenRouter-Title": SITE_NAME,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      const botReply = data.choices?.[0]?.message?.content || "(Pas de réponse)";
      setMessages([...newMessages, { role: "assistant", content: botReply }]);
    } catch (err) {
      setMessages([...newMessages, { role: "assistant", content: "Erreur lors de la requête." }]);
    }
    setLoading(false);
    setInput("");
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 max-w-full bg-white border border-emerald-200 rounded-2xl shadow-2xl flex flex-col font-sans animate-fade-in">
      <div className="p-3 border-b border-emerald-200 font-bold bg-emerald-500 text-white rounded-t-2xl text-center tracking-wide text-base shadow-sm">
        NeoTicket Chatbot
      </div>
      <div className="flex-1 p-3 overflow-y-auto bg-emerald-50/40" style={{ maxHeight: 340 }}>
        {messages.map((m, i) => (
          <div key={i} className={`mb-2 text-sm flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <span
              className={
                m.role === "user"
                  ? "bg-emerald-500 text-white px-3 py-2 rounded-xl rounded-br-sm shadow-sm max-w-[80%]"
                  : m.role === "assistant"
                  ? "bg-white text-emerald-900 px-3 py-2 rounded-xl rounded-bl-sm border border-emerald-100 shadow-sm max-w-[80%]"
                  : "bg-emerald-100 text-emerald-700 px-3 py-2 rounded-xl max-w-[80%]"
              }
            >
              {m.content}
            </span>
          </div>
        ))}
        {loading && <div className="text-xs text-gray-400">Réponse en cours...</div>}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="flex border-t border-emerald-200 bg-white rounded-b-2xl">
        <input
          className="flex-1 p-3 outline-none bg-transparent text-emerald-900 placeholder-emerald-400 focus:bg-emerald-50/60 transition rounded-bl-2xl"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Votre question..."
          disabled={loading}
          autoComplete="off"
        />
        <button
          type="submit"
          className="p-3 bg-emerald-500 text-white font-semibold rounded-br-2xl hover:bg-emerald-600 transition disabled:opacity-60"
          disabled={loading || !input.trim()}
        >
          Envoyer
        </button>
      </form>
    </div>
  );
}
