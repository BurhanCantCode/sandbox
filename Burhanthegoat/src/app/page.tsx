'use client';

import Chat from '@/components/Chat';
import Terminal from '@/components/Terminal';
import { useState, useEffect } from 'react';

export default function Home() {
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<'terminal' | 'chat'>('terminal');

  // Function to handle terminal output for the AI chat
  const handleTerminalOutput = (output: string) => {
    setTerminalOutput(prev => [...prev, output]);
  };

  // Check if the device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  return (
    <main className="flex flex-col md:flex-row min-h-screen p-4 gap-4">
      {isMobile && (
        <div className="flex w-full mb-4">
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex-1 py-2 text-center rounded-l-md ${
              activeTab === 'terminal' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}
          >
            Terminal
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 text-center rounded-r-md ${
              activeTab === 'chat' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}
          >
            AI Assistant
          </button>
        </div>
      )}
      
      <div 
        className={`${
          isMobile 
            ? activeTab === 'terminal' ? 'block' : 'hidden'
            : 'w-2/3'
        } h-[calc(100vh-2rem)] md:h-[calc(100vh-2rem)]`}
      >
        <Terminal onOutput={handleTerminalOutput} />
      </div>
      
      <div 
        className={`${
          isMobile 
            ? activeTab === 'chat' ? 'block' : 'hidden'
            : 'w-1/3'
        } h-[calc(100vh-2rem)] md:h-[calc(100vh-2rem)]`}
      >
        <Chat terminalOutput={terminalOutput} />
      </div>
    </main>
  );
} 