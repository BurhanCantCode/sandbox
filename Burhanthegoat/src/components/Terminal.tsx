'use client';

import { Sandbox } from '@e2b/code-interpreter';
import { useEffect, useRef, useState } from 'react';
import 'xterm/css/xterm.css';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Maximize2, Minimize2, X, Circle } from 'lucide-react';

interface TerminalProps {
  onOutput?: (output: string) => void;
}

export default function Terminal({ onOutput }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [terminal, setTerminal] = useState<any | null>(null);
  const [sandbox, setSandbox] = useState<any | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [localInput, setLocalInput] = useState<string>('');
  const [localOutput, setLocalOutput] = useState<string[]>([
    'Welcome to the terminal!',
    'Attempting to connect to E2B sandbox...',
    'Type commands below:',
    '',
  ]);
  const [useFallbackMode, setUseFallbackMode] = useState(false);
  const [initAttempts, setInitAttempts] = useState(0); // Track initialization attempts
  const maxInitAttempts = 3; // Maximum number of initialization attempts

  // Initialize xterm.js
  useEffect(() => {
    console.log("Initializing terminal...");
    let term: any = null;
    let fitAddon: any = null;
    let isMounted = true;

    const initTerminal = async () => {
      try {
        const { Terminal } = await import('xterm');
        const { FitAddon } = await import('xterm-addon-fit');
        const { WebLinksAddon } = await import('xterm-addon-web-links');

        if (!isMounted) return;

        term = new Terminal({
          cursorBlink: true,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          fontSize: 14,
          theme: {
            background: 'hsl(var(--terminal-bg))',
            foreground: 'hsl(var(--terminal-text))',
            cursor: 'hsl(var(--terminal-cursor))',
            selectionBackground: 'hsl(var(--terminal-selection))',
            black: 'hsl(var(--terminal-black))',
            red: 'hsl(var(--terminal-red))',
            green: 'hsl(var(--terminal-green))',
            yellow: 'hsl(var(--terminal-yellow))',
            blue: 'hsl(var(--terminal-blue))',
            magenta: 'hsl(var(--terminal-magenta))',
            cyan: 'hsl(var(--terminal-cyan))',
            white: 'hsl(var(--terminal-white))',
            brightBlack: 'hsl(var(--terminal-bright-black))',
            brightRed: 'hsl(var(--terminal-bright-red))',
            brightGreen: 'hsl(var(--terminal-bright-green))',
            brightYellow: 'hsl(var(--terminal-bright-yellow))',
            brightBlue: 'hsl(var(--terminal-bright-blue))',
            brightMagenta: 'hsl(var(--terminal-bright-magenta))',
            brightCyan: 'hsl(var(--terminal-bright-cyan))',
            brightWhite: 'hsl(var(--terminal-bright-white))',
          },
        });

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());

        if (terminalRef.current) {
          console.log("Opening terminal in ref...");
          terminalRef.current.innerHTML = ''; // Clear any previous content
          term.open(terminalRef.current);
          
          // Add a small delay to ensure the terminal is properly rendered
          setTimeout(() => {
            console.log("Fitting terminal...");
            fitAddon.fit();
            term.focus();
            
            // Write initial content
            term.writeln('Terminal initialized. Connecting to sandbox...');
          }, 100);
        } else {
          console.error("Terminal ref is null");
        }

        setTerminal(term);

        // Handle window resize
        const handleResize = () => {
          console.log("Resizing terminal...");
          if (fitAddon) {
            fitAddon.fit();
          }
        };

        window.addEventListener('resize', handleResize);

        // Setup local terminal mode (fallback)
        term.onData((data: string) => {
          if (useFallbackMode) {
            // Handle local terminal input
            if (data === '\r') { // Enter key
              const command = localInput;
              setLocalInput('');
              
              // Echo the command and execute it
              term.writeln(''); // Add a newline
              
              // Simple command handling
              if (command === 'clear') {
                term.clear();
              } else if (command === 'help') {
                term.writeln('Available commands: clear, help, echo, date, ls');
                term.writeln('This is a fallback terminal as the E2B connection failed.');
              } else if (command.startsWith('echo ')) {
                term.writeln(command.substring(5));
              } else if (command === 'date') {
                term.writeln(new Date().toString());
              } else if (command === 'ls') {
                term.writeln('Documents/');
                term.writeln('Downloads/');
                term.writeln('Pictures/');
                term.writeln('example.txt');
                term.writeln('README.md');
              } else if (command) {
                term.writeln(`Command not found: ${command}`);
              }
              
              // Show prompt after command execution
              term.write('$ ');
            } else if (data === '\u007F') { // Backspace
              if (localInput.length > 0) {
                setLocalInput(localInput.substring(0, localInput.length - 1));
                term.write('\b \b'); // Erase character
              }
            } else {
              setLocalInput(localInput + data);
              term.write(data); // Echo input
            }
          }
        });

        return { term, fitAddon, handleResize };
      } catch (error) {
        console.error('Failed to initialize terminal:', error);
        setError(`Terminal initialization error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
      }
    };

    let cleanup: { term: any; fitAddon: any; handleResize: () => void } | null = null;

    initTerminal().then((result) => {
      if (result) {
        cleanup = result;
      }
      setIsLoading(false);
    });

    return () => {
      if (cleanup) {
        cleanup.term.dispose();
        window.removeEventListener('resize', cleanup.handleResize);
      }
    };
  }, [useFallbackMode, localInput]);

  // Connect to E2B sandbox
  useEffect(() => {
    let isMounted = true;
    let shellProcess: any = null;
    let initTimeout: NodeJS.Timeout | null = null;
    
    const initSandbox = async () => {
      if (!terminal) return;
      
      try {
        setIsLoading(true);
        terminal.writeln('Connecting to E2B sandbox...');
        console.log("Connecting to E2B sandbox with API key:", process.env.NEXT_PUBLIC_E2B_API_KEY);
        
        // Check if API key is available
        if (!process.env.NEXT_PUBLIC_E2B_API_KEY) {
          throw new Error("E2B API key is not set. Please set NEXT_PUBLIC_E2B_API_KEY in your environment variables.");
        }
        
        // Initialize e2b sandbox with API key from environment variables
        const newSandbox = await Sandbox.create({
          apiKey: process.env.NEXT_PUBLIC_E2B_API_KEY,
        });

        console.log("Sandbox created successfully:", newSandbox);
        
        if (!isMounted) {
          // Component unmounted during async operation
          try {
            await newSandbox.destroy();
          } catch (e) {
            console.error("Error destroying sandbox after unmount:", e);
          }
          return;
        }
        
        setSandbox(newSandbox);
        setIsConnected(true);
        setIsLoading(false);
        setInitAttempts(0); // Reset attempts on success

        terminal.clear();
        terminal.writeln('\x1b[32mConnected to Linux terminal!\x1b[0m');
        terminal.writeln('Type commands to interact with the terminal.');
        terminal.writeln('');
        terminal.write('$ '); // Add initial prompt
        
        // Set up terminal input handling with command buffer
        let commandBuffer = '';
        
        terminal.onData((data: string) => {
          if (newSandbox && newSandbox.commands && !useFallbackMode) {
            // Handle special keys
            if (data === '\r') { // Enter key
              // Run the command when Enter is pressed
              terminal.write('\r\n'); // Always add a newline when Enter is pressed
              
              if (commandBuffer.trim()) {
                // Only run non-empty commands
                runCommand(commandBuffer);
                commandBuffer = '';
                // Note: prompt will be added by runCommand after completion
              } else {
                // For empty commands, just add a new prompt
                terminal.write('$ ');
              }
            } else if (data === '\u007F') { // Backspace
              if (commandBuffer.length > 0) {
                commandBuffer = commandBuffer.substring(0, commandBuffer.length - 1);
                terminal.write('\b \b'); // Erase character
              }
            } else {
              // Add to buffer and echo to terminal
              commandBuffer += data;
              terminal.write(data);
            }
          }
        });

        // Function to run commands
        const runCommand = async (cmd: string) => {
          try {
            console.log("Running command:", cmd);
            
            // Run the command and set up handlers for stdout and stderr
            shellProcess = await newSandbox.commands.run(cmd, {
              onStdout: (data: string) => {
                console.log("Received stdout:", data);
                if (terminal) {
                  // Ensure data starts with a newline if it doesn't already have one
                  if (!data.startsWith('\r\n') && !data.startsWith('\n')) {
                    terminal.write('\r\n');
                  }
                  terminal.write(data);
                }
                if (onOutput) {
                  onOutput(data);
                }
              },
              onStderr: (data: string) => {
                console.log("Received stderr:", data);
                if (terminal) {
                  // Ensure data starts with a newline if it doesn't already have one
                  if (!data.startsWith('\r\n') && !data.startsWith('\n')) {
                    terminal.write('\r\n');
                  }
                  terminal.write(data);
                }
                if (onOutput) {
                  onOutput(data);
                }
              }
            });
            
            console.log("Command completed");
            // Add a prompt after command completes
            if (terminal) {
              terminal.write('\r\n$ ');
            }
          } catch (error) {
            console.error("Error running command:", error);
            if (terminal) {
              terminal.writeln(`\r\nError: ${error instanceof Error ? error.message : 'Unknown error'}`);
              terminal.write('$ '); // Add prompt after error
            }
          }
        };

      } catch (error) {
        console.error('Failed to initialize e2b sandbox:', error);
        if (isMounted) {
          setError(`E2B connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setIsLoading(false);
          
          // Increment initialization attempts
          const newAttempts = initAttempts + 1;
          setInitAttempts(newAttempts);
          
          if (terminal) {
            terminal.writeln('\x1b[31mFailed to connect to Linux terminal.\x1b[0m');
            terminal.writeln(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            if (newAttempts < maxInitAttempts) {
              terminal.writeln(`\x1b[33mRetrying connection (attempt ${newAttempts}/${maxInitAttempts})...\x1b[0m`);
              // Retry after a delay
              if (initTimeout) clearTimeout(initTimeout);
              initTimeout = setTimeout(() => {
                if (isMounted) initSandbox();
              }, 2000);
            } else {
              terminal.writeln('Switching to fallback terminal mode...');
              terminal.writeln('Type commands below:');
              terminal.write('$ ');
              
              // Switch to fallback mode
              setUseFallbackMode(true);
            }
          }
        }
      }
    };

    if (terminal && !sandbox && !useFallbackMode) {
      // Clear any existing timeout
      if (initTimeout) clearTimeout(initTimeout);
      initSandbox();
    }

    return () => {
      isMounted = false;
      
      // Clear any pending timeouts
      if (initTimeout) {
        clearTimeout(initTimeout);
      }
      
      // Kill any running process
      if (shellProcess) {
        try {
          shellProcess.kill().catch((e: Error) => {
            console.error("Error killing process:", e);
          });
        } catch (error) {
          console.error('Error killing process:', error);
        }
      }
      
      // Destroy the sandbox
      if (sandbox) {
        try {
          console.log("Destroying sandbox...");
          // Use the destroy method from the code-interpreter SDK
          sandbox.destroy().catch((e: Error) => {
            console.error("Error destroying sandbox:", e);
          });
        } catch (error) {
          console.error('Error closing sandbox:', error);
        }
      }
    };
  }, [terminal, sandbox, onOutput, useFallbackMode, initAttempts, maxInitAttempts]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    // Trigger a resize event to make sure the terminal fits properly
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  };

  return (
    <Card className={`terminal-card border-none shadow-md ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'h-full'}`}>
      <CardHeader className="terminal-header flex flex-row items-center justify-between space-y-0 p-2 bg-muted/50">
        <div className="terminal-controls flex items-center space-x-2">
          <Circle className="h-3 w-3 fill-red-500 text-red-500" />
          <Circle className="h-3 w-3 fill-yellow-500 text-yellow-500" />
          <Circle className="h-3 w-3 fill-green-500 text-green-500" />
        </div>
        <div className="terminal-title text-sm font-medium">
          <Tabs defaultValue="bash" className="w-[200px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bash">bash</TabsTrigger>
              <TabsTrigger value="zsh">zsh</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="terminal-actions">
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4 cursor-pointer" onClick={toggleFullscreen} />
          ) : (
            <Maximize2 className="h-4 w-4 cursor-pointer" onClick={toggleFullscreen} />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 h-[calc(100%-40px)] relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-terminal-bg/80 z-10">
            <div className="flex flex-col items-center">
              <div className="flex space-x-2 mb-2">
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse delay-75"></div>
                <div className="w-3 h-3 bg-primary rounded-full animate-pulse delay-150"></div>
              </div>
              <div className="text-sm text-muted-foreground">Connecting...</div>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute top-2 right-2 left-2 p-2 bg-destructive/10 text-destructive text-sm rounded z-20">
            {error}
            <button 
              className="ml-2 underline"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        <div id="terminal-container" ref={terminalRef} className="h-full w-full p-2" />
      </CardContent>
    </Card>
  );
} 