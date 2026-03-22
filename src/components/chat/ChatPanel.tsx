import React, { useState, useRef, useEffect } from 'react';
import { Send, Crown } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { useSessionStore, useIsGM } from '../../stores/sessionStore';
import { Button } from '../shared/Button';

export const ChatPanel: React.FC = () => {
  const { messages, sendMessage, markAsRead } = useChat();
  const currentUser = useSessionStore((state) => state.currentUser);
  const isGM = useIsGM();

  const [newMessage, setNewMessage] = useState('');
  const [isGmAnnouncement, setIsGmAnnouncement] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    markAsRead();
  }, [messages, markAsRead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    await sendMessage(newMessage, isGmAnnouncement);
    setNewMessage('');
    setIsSending(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.username === currentUser?.username;

            return (
              <div
                key={msg.id}
                className={`
                  ${msg.isGmAnnouncement
                    ? 'bg-yellow-900/20 border-l-4 border-yellow-600 pl-3'
                    : ''
                  }
                `}
              >
                <div className="flex items-baseline gap-2">
                  {msg.isGmAnnouncement && (
                    <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                  )}
                  <span
                    className={`
                      font-medium text-sm
                      ${msg.isGmAnnouncement ? 'text-yellow-400' : 'text-slate-300'}
                      ${isOwn ? 'text-slate-200' : ''}
                    `}
                  >
                    {msg.username}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatTime(msg.createdAt)}
                  </span>
                </div>
                <p
                  className={`
                    text-sm mt-1
                    ${msg.isGmAnnouncement ? 'text-yellow-100 italic' : 'text-slate-100'}
                  `}
                >
                  {msg.message}
                </p>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-slate-700">
        {isGM && (
          <label className="flex items-center gap-2 mb-2 text-sm text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={isGmAnnouncement}
              onChange={(e) => setIsGmAnnouncement(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-yellow-500 focus:ring-yellow-500"
            />
            <Crown className="w-3 h-3" />
            Send as GM announcement
          </label>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-tempest-400"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!newMessage.trim() || isSending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
};
