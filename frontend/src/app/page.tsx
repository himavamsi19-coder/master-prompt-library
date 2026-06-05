"use client";

/* eslint-disable @next/next/no-img-element, react-hooks/set-state-in-effect */

import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Copy,
  ImagePlus,
  Layers,
  MessageSquare,
  PlusCircle,
  Search,
  Send,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import axios from "axios";

const API_BASE_URL = "http://localhost:8000";

interface Attachment {
  id: number;
  prompt_id: number;
  original_name: string;
  content_type?: string;
  note?: string;
  url: string;
}

interface Prompt {
  id: number;
  title: string;
  description: string;
  content: string;
  tags: string;
  category: string;
  model_type: string;
  attachments: Attachment[];
}

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "ai";
  promptIds?: number[];
}

const emptyPrompt = {
  title: "",
  description: "",
  content: "",
  tags: "",
  category: "",
  model_type: "",
};

export default function Home() {
  const [activeTab, setActiveTab] = useState("prompts");
  const [searchQuery, setSearchQuery] = useState("");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPrompt, setNewPrompt] = useState(emptyPrompt);
  const [workflowFiles, setWorkflowFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      text: "Ask me for a prompt by task, workflow, description, model, or tags. I will search your local library and point you to matching prompts.",
      sender: "ai",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchPrompts = async () => {
    try {
      setError("");
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/prompts/`);
      setPrompts(response.data);
    } catch {
      setError("The local backend is not responding. Start the app from the desktop shortcut.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const jumpToPrompt = (promptId: number) => {
    const prompt = prompts.find((item) => item.id === promptId);
    if (prompt) {
      setSelectedPrompt(prompt);
      setActiveTab("prompts");
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchPrompts();
      return;
    }

    try {
      setError("");
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/search/`, {
        params: { query: searchQuery },
      });
      setPrompts(response.data);
    } catch {
      setError("Search failed. Check that the local backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePrompt = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    try {
      setSaving(true);
      setError("");
      const response = await axios.post(`${API_BASE_URL}/prompts/`, newPrompt);
      const savedPrompt: Prompt = response.data;

      for (const file of workflowFiles) {
        const data = new FormData();
        data.append("file", file);
        await axios.post(`${API_BASE_URL}/prompts/${savedPrompt.id}/attachments/`, data);
      }

      setNewPrompt(emptyPrompt);
      setWorkflowFiles([]);
      setIsCreateModalOpen(false);
      await fetchPrompts();
    } catch {
      setError("Could not save the prompt. Make sure title and content are filled in.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), text: chatInput, sender: "user" };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/chat/`, { message: userMsg.text });
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: response.data.response,
        sender: "ai",
        promptIds: response.data.prompt_ids || [],
      };
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: "I could not reach the local assistant service. If Ollama is not installed yet, search still works and chat will use the built-in fallback.",
          sender: "ai",
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#101114] text-[#f4f4f5] font-sans">
      <motion.aside initial={{ x: -250 }} animate={{ x: 0 }} className="w-64 border-r border-[#2a2d33] bg-[#181a1f] p-4 flex flex-col">
        <div className="flex items-center space-x-2 mb-8 mt-2 text-white">
          <BookOpen className="w-6 h-6 text-emerald-400" />
          <h1 className="text-lg font-bold">Master Prompt Library</h1>
        </div>

        <nav className="flex-1 space-y-2">
          {[
            ["prompts", Search, "Prompts"],
            ["workflows", Layers, "Workflows"],
            ["chat", MessageSquare, "Local Assistant"],
          ].map(([id, Icon, label]) => (
            <button
              key={id as string}
              onClick={() => setActiveTab(id as string)}
              className={`flex items-center space-x-3 w-full p-2 rounded-md transition-colors ${
                activeTab === id ? "bg-[#2a2d33] text-white" : "text-gray-400 hover:text-white hover:bg-[#24272e]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label as string}</span>
            </button>
          ))}
        </nav>
      </motion.aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-16 border-b border-[#2a2d33] flex items-center justify-between px-6 bg-[#101114]">
          <div className="flex-1 max-w-xl flex items-center bg-[#181a1f] rounded-md px-3 py-2 border border-[#2a2d33]">
            <Search className="w-4 h-4 text-gray-400 mr-2" />
            <input
              type="text"
              placeholder="Search prompts, workflows, tags, descriptions..."
              className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm transition-colors ml-4"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Prompt</span>
          </button>
        </header>

        {error && <div className="mx-6 mt-4 rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">{error}</div>}

        <div className="flex-1 p-6 overflow-y-auto">
          {activeTab === "prompts" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-2xl font-semibold mb-6">Prompts</h2>
              {loading ? (
                <div className="text-gray-400">Loading your local library...</div>
              ) : prompts.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <BookOpen className="mx-auto h-12 w-12 mb-4 text-[#2a2d33]" />
                  <p>No prompts found. Create your first one.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {prompts.map((prompt) => (
                    <button
                      key={prompt.id}
                      onClick={() => setSelectedPrompt(prompt)}
                      className="text-left bg-[#181a1f] border border-[#2a2d33] rounded-lg p-5 hover:border-emerald-500/70 transition-colors flex flex-col min-h-56"
                    >
                      <div className="flex justify-between items-start mb-3 gap-3">
                        <span className="text-xs font-medium px-2 py-1 bg-emerald-950 text-emerald-300 rounded-md">
                          {prompt.model_type || "Prompt"}
                        </span>
                        {prompt.attachments?.length > 0 && (
                          <span className="text-xs text-gray-400">{prompt.attachments.length} image</span>
                        )}
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2">{prompt.title}</h3>
                      <p className="text-sm text-gray-400 line-clamp-4 mb-4 flex-1">{prompt.description || prompt.content}</p>
                      <div className="flex flex-wrap gap-2 mt-auto">
                        {prompt.category && <span className="text-xs text-gray-300 bg-[#2a2d33] px-2 py-1 rounded">{prompt.category}</span>}
                        {prompt.tags?.split(",").filter(Boolean).map((tag) => (
                          <span key={tag} className="text-xs text-gray-300 bg-[#2a2d33] px-2 py-1 rounded">#{tag.trim()}</span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === "workflows" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-2xl font-semibold mb-6">Workflow Images</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {prompts.filter((prompt) => prompt.attachments?.length).map((prompt) => (
                  <button key={prompt.id} onClick={() => setSelectedPrompt(prompt)} className="text-left bg-[#181a1f] border border-[#2a2d33] rounded-lg overflow-hidden hover:border-emerald-500/70">
                    <img src={`${API_BASE_URL}${prompt.attachments[0].url}`} alt={prompt.attachments[0].original_name} className="h-44 w-full object-cover" />
                    <div className="p-4">
                      <h3 className="font-medium">{prompt.title}</h3>
                      <p className="text-sm text-gray-400 line-clamp-2">{prompt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "chat" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col max-w-3xl mx-auto w-full">
              <div className="flex-1 bg-[#181a1f] border border-[#2a2d33] rounded-lg p-6 overflow-y-auto mb-4 flex flex-col space-y-4">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`max-w-[85%] p-3 rounded-lg ${msg.sender === "ai" ? "bg-[#2a2d33] self-start" : "bg-emerald-600 text-white self-end"}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    {!!msg.promptIds?.length && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {msg.promptIds.map((id) => (
                          <button key={id} onClick={() => jumpToPrompt(id)} className="text-xs px-2 py-1 rounded bg-[#101114] text-emerald-300 hover:text-white">
                            Open prompt #{id}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {isChatLoading && <div className="bg-[#2a2d33] self-start p-3 rounded-lg text-sm text-gray-300">Thinking locally...</div>}
                <div ref={chatEndRef} />
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ask for a workflow or describe the prompt you need..."
                  className="w-full bg-[#181a1f] border border-[#2a2d33] rounded-lg pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-emerald-500"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  disabled={isChatLoading}
                />
                <button onClick={handleSendMessage} disabled={isChatLoading || !chatInput.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50">
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <AnimatePresence>
          {isCreateModalOpen && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="bg-[#181a1f] border border-[#2a2d33] rounded-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-[#2a2d33]">
                  <h3 className="text-lg font-medium text-white">Create New Prompt</h3>
                  <button onClick={() => setIsCreateModalOpen(false)} className="text-gray-400 hover:text-white" aria-label="Close">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreatePrompt} className="flex flex-col overflow-hidden">
                  <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    <input required type="text" value={newPrompt.title} onChange={(e) => setNewPrompt({ ...newPrompt, title: e.target.value })} className="w-full bg-[#101114] border border-[#2a2d33] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="Title" />
                    <textarea required value={newPrompt.content} onChange={(e) => setNewPrompt({ ...newPrompt, content: e.target.value })} className="w-full bg-[#101114] border border-[#2a2d33] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 h-36 resize-y" placeholder="Paste the full master prompt here" />
                    <input type="text" value={newPrompt.description} onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })} className="w-full bg-[#101114] border border-[#2a2d33] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="Describe what this prompt or workflow does" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input type="text" value={newPrompt.model_type} onChange={(e) => setNewPrompt({ ...newPrompt, model_type: e.target.value })} className="bg-[#101114] border border-[#2a2d33] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="Model, e.g. Midjourney" />
                      <input type="text" value={newPrompt.category} onChange={(e) => setNewPrompt({ ...newPrompt, category: e.target.value })} className="bg-[#101114] border border-[#2a2d33] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="Category" />
                      <input type="text" value={newPrompt.tags} onChange={(e) => setNewPrompt({ ...newPrompt, tags: e.target.value })} className="bg-[#101114] border border-[#2a2d33] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="Tags, comma separated" />
                    </div>
                    <label className="flex items-center justify-center gap-2 border border-dashed border-[#3a3d45] rounded-md p-4 text-sm text-gray-300 hover:border-emerald-500 cursor-pointer">
                      <ImagePlus className="w-4 h-4" />
                      <span>{workflowFiles.length ? `${workflowFiles.length} workflow image selected` : "Attach workflow images"}</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => setWorkflowFiles(Array.from(e.target.files || []))} />
                    </label>
                  </div>

                  <div className="p-4 border-t border-[#2a2d33] flex justify-end space-x-3">
                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-sm text-gray-300 hover:text-white">
                      Cancel
                    </button>
                    <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-md disabled:opacity-50">
                      {saving ? "Saving..." : "Save Prompt"}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {selectedPrompt && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="bg-[#181a1f] border border-[#2a2d33] rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="flex justify-between items-center p-4 border-b border-[#2a2d33]">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{selectedPrompt.title}</h3>
                    <p className="text-sm text-gray-400">{selectedPrompt.category || "Uncategorized"} {selectedPrompt.model_type ? `- ${selectedPrompt.model_type}` : ""}</p>
                  </div>
                  <button onClick={() => setSelectedPrompt(null)} className="text-gray-400 hover:text-white" aria-label="Close">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-5">
                  <p className="text-gray-300">{selectedPrompt.description}</p>
                  <div className="bg-[#101114] border border-[#2a2d33] rounded-md p-4">
                    <div className="flex justify-end mb-3">
                      <button onClick={() => navigator.clipboard.writeText(selectedPrompt.content)} className="flex items-center gap-2 text-xs text-emerald-300 hover:text-white">
                        <Copy className="w-4 h-4" /> Copy prompt
                      </button>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm text-gray-100 font-sans">{selectedPrompt.content}</pre>
                  </div>
                  {!!selectedPrompt.attachments?.length && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedPrompt.attachments.map((attachment) => (
                        <img key={attachment.id} src={`${API_BASE_URL}${attachment.url}`} alt={attachment.original_name} className="rounded-md border border-[#2a2d33] w-full object-contain bg-[#101114]" />
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
