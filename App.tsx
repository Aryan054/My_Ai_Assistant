import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AssistantUI } from './components/AssistantUI';
import { createChat } from './services/geminiService';
import type { Message, Reminder, IotDevice, AssistantStatus, IotDeviceName } from './types';
import { AssistantStatus as StatusEnum } from './types';
import type { Chat } from '@google/genai';

// Fix: Add global declarations for SpeechRecognition API to fix TypeScript errors.
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// Speech Recognition and Synthesis setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
}
const synth = window.speechSynthesis;

const App: React.FC = () => {
  const [status, setStatus] = useState<AssistantStatus>(StatusEnum.IDLE);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [iotDevices, setIotDevices] = useState<IotDevice[]>([
    { id: 'living room light', name: 'Living Room', state: 'off' },
    { id: 'bedroom light', name: 'Bedroom', state: 'off' },
    { id: 'thermostat', name: 'Thermostat', state: 'off' },
  ]);
  const [inputText, setInputText] = useState('');

  const geminiChat = useRef<Chat | null>(null);
  const typingIntervalRef = useRef<number | null>(null);

  const addMessage = useCallback((author: 'user' | 'assistant', text: string) => {
    setMessages(prev => [
      ...prev,
      { author, text, timestamp: new Date().toLocaleTimeString() },
    ]);
  }, []);
  
  const speakAndShowResponse = useCallback((text: string, stream: boolean = false) => {
    if (!text) {
        setStatus(StatusEnum.IDLE);
        return;
    }

    if (stream) {
        setStatus(StatusEnum.TYPING);
        const timestamp = new Date().toLocaleTimeString();
        setMessages(prev => [...prev, { author: 'assistant', text: '', timestamp }]);
        
        let i = 0;
        typingIntervalRef.current = window.setInterval(() => {
            if (i < text.length) {
                setMessages(prev => {
                    const currentMessages = [...prev];
                    currentMessages[currentMessages.length - 1].text = text.substring(0, i + 1);
                    return currentMessages;
                });
                i++;
            } else {
                if(typingIntervalRef.current) clearInterval(typingIntervalRef.current);
                typingIntervalRef.current = null;
                setStatus(StatusEnum.SPEAKING);
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.onend = () => {
                    setStatus(currentStatus => {
                        // Only transition to IDLE if we were speaking.
                        // This prevents a race condition if stopAll() was called.
                        if (currentStatus === StatusEnum.SPEAKING) {
                            return StatusEnum.IDLE;
                        }
                        return currentStatus;
                    });
                };
                synth.speak(utterance);
            }
        }, 40); // Typing speed
    } else {
        setStatus(StatusEnum.SPEAKING);
        addMessage('assistant', text);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setStatus(StatusEnum.IDLE);
        synth.speak(utterance);
    }
  }, [addMessage]);

  useEffect(() => {
    geminiChat.current = createChat();
    if (!geminiChat.current) {
      speakAndShowResponse("Error: Gemini API key not configured or invalid. Please check your environment variables.");
    }
    if (!recognition) {
        speakAndShowResponse("Speech recognition is not supported in this browser. Please try Chrome or Safari.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processCommand = useCallback((command: any) => {
    switch (command.action) {
      case 'ADD_REMINDER':
        setReminders(prev => [...prev, { id: Date.now(), text: command.payload.reminderText }]);
        speakAndShowResponse(`OK, I've set a reminder for you: ${command.payload.reminderText}`, true);
        break;
      case 'TOGGLE_IOT':
        const { deviceName, state } = command.payload;
        setIotDevices(prev =>
          prev.map(d => (d.id === deviceName ? { ...d, state } : d))
        );
        speakAndShowResponse(`Sure, I've turned the ${deviceName} ${state}.`, true);
        break;
      case 'CLEAR_REMINDERS':
        setReminders([]);
        speakAndShowResponse("I've cleared all your reminders.", true);
        break;
      default:
        speakAndShowResponse("Sorry, I didn't understand that command.", true);
    }
  }, [speakAndShowResponse]);
  
  const processTranscript = useCallback(async (transcript: string) => {
      setStatus(StatusEnum.THINKING);
      
      if (!geminiChat.current) {
        speakAndShowResponse("I'm having trouble connecting to my brain. Please check the API key configuration.", true);
        return;
      }

      try {
        const result = await geminiChat.current.sendMessage({ message: transcript });
        const responseText = result.text.trim();

        try {
          // Check if response is a JSON command
          const command = JSON.parse(responseText);
          processCommand(command);
        } catch (e) {
          // If not JSON, it's a regular text response
          speakAndShowResponse(responseText, true);
        }
      } catch (error) {
        console.error("Gemini API error:", error);
        speakAndShowResponse("I'm sorry, I'm having a bit of trouble right now. Please try again later.", true);
      }
  }, [processCommand, speakAndShowResponse]);

  const stopAll = useCallback(() => {
    // Stop speaking
    if (synth.speaking) {
        synth.cancel();
    }
    // Stop typing animation
    if (typingIntervalRef.current) {
        clearInterval(typingIntervalRef.current);
        typingIntervalRef.current = null;
    }
    // Reset status to IDLE
    setStatus(StatusEnum.IDLE);
  }, []);

  const startListening = useCallback(() => {
    if (!recognition || status !== StatusEnum.IDLE) {
      return;
    }

    setStatus(StatusEnum.LISTENING);
    recognition.start();

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      addMessage('user', transcript);
      processTranscript(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setStatus(currentStatus => {
        if (currentStatus === StatusEnum.LISTENING) {
          return StatusEnum.IDLE;
        }
        return currentStatus;
      });
    };

    recognition.onend = () => {
       setStatus(currentStatus => {
         if (currentStatus === StatusEnum.LISTENING) {
            return StatusEnum.IDLE;
         }
         return currentStatus;
       });
    };
  }, [status, addMessage, processTranscript]);

  const handleMainButtonPress = useCallback(() => {
    if (status === StatusEnum.IDLE) {
        startListening();
    } else if (status === StatusEnum.SPEAKING || status === StatusEnum.TYPING) {
        stopAll();
    }
  }, [status, startListening, stopAll]);
  
  const handleTextSubmit = useCallback((e: React.FormEvent) => {
      e.preventDefault();
      if (!inputText.trim() || status !== StatusEnum.IDLE) {
          return;
      }
      addMessage('user', inputText);
      processTranscript(inputText);
      setInputText('');
  }, [inputText, status, addMessage, processTranscript]);
  
  const clearReminders = useCallback(() => {
     setReminders([]);
     speakAndShowResponse("Reminders cleared.", true);
  }, [speakAndShowResponse]);

  return (
    <AssistantUI
      status={status}
      messages={messages}
      reminders={reminders}
      iotDevices={iotDevices}
      handleMainButtonPress={handleMainButtonPress}
      clearReminders={clearReminders}
      inputText={inputText}
      setInputText={setInputText}
      handleTextSubmit={handleTextSubmit}
    />
  );
};

export default App;