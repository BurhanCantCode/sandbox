'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Circle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatProps {
  terminalOutput: string[];
}

export default function Chat({ terminalOutput }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m Sir Faisal, your AI assistant. I can help you with terminal commands and answer questions. How can I assist you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [apiKey, setApiKey] = useState<string>(process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || '');

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle terminal output changes
  useEffect(() => {
    if (terminalOutput.length > 0) {
      const lastOutput = terminalOutput[terminalOutput.length - 1];
      // Only process non-empty outputs
      if (lastOutput && lastOutput.trim()) {
        // You could add logic here to analyze terminal output and provide suggestions
        // For now, we'll just log it
        console.log('Terminal output:', lastOutput);
      }
    }
  }, [terminalOutput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Check if the message is setting the API key
    if (input.startsWith('/setkey ')) {
      const key = input.replace('/setkey ', '').trim();
      setApiKey(key);
      setMessages(prev => [
        ...prev,
        { role: 'user', content: '/setkey [API KEY HIDDEN]' },
        { role: 'assistant', content: 'API key has been set successfully!' },
      ]);
      setInput('');
      return;
    }

    // Add user message
    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      if (!apiKey) {
        throw new Error('Please set your OpenRouter API key using /setkey YOUR_API_KEY');
      }

      // Prepare conversation history for the API
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Add the new user message
      conversationHistory.push({
        role: 'user',
        content: input,
      });

      // Call OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://burhanthegoat.com',
          'X-Title': 'Burhanthegoat Terminal',
        },
        body: JSON.stringify({
          model: 'openai/gpt-3.5-turbo', // You can change this to any model supported by OpenRouter
          messages: conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.choices[0].message.content,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      // Add error message
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="chat-card h-full border-none shadow-md flex flex-col">
      <CardHeader className="chat-header flex flex-row items-center justify-between space-y-0 p-2 bg-muted/50">
        <div className="chat-controls flex items-center space-x-2">
          <Circle className="h-3 w-3 fill-red-500 text-red-500" />
          <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500" />
          <Circle className="h-3 w-3 fill-green-500 text-green-500" />
        </div>
        <div className="chat-title text-sm font-medium">Sir Faisal - AI Assistant</div>
        <div className="w-16"></div> {/* Spacer for alignment */}
      </CardHeader>
      <CardContent className="chat-messages flex-grow overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message p-3 rounded-lg max-w-[85%] ${
              message.role === 'user' 
                ? 'user-message bg-primary/10 ml-auto' 
                : 'ai-message bg-muted mr-auto'
            }`}
          >
            {message.content}
          </div>
        ))}
        {isLoading && (
          <div className="message ai-message bg-muted p-3 rounded-lg mr-auto">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-75"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>
      <CardFooter className="p-2 border-t">
        <form onSubmit={handleSubmit} className="w-full flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={apiKey ? "Ask Sir Faisal a question..." : "Set API key with /setkey YOUR_API_KEY"}
            className="flex-grow p-2 rounded-md bg-muted/50 border border-input focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading || !input.trim()}
            className="rounded-md"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
} 