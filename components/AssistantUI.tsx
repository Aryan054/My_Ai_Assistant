import React from 'react';
import type { Message, Reminder, IotDevice, AssistantStatus, IotDeviceName } from '../types';
import { AssistantStatus as StatusEnum } from '../types';
import { LightbulbIcon, ThermostatIcon, TrashIcon, MicrophoneIcon, SendIcon, StopIcon } from './icons';

interface AssistantUIProps {
  status: AssistantStatus;
  messages: Message[];
  reminders: Reminder[];
  iotDevices: IotDevice[];
  handleMainButtonPress: () => void;
  clearReminders: () => void;
  inputText: string;
  setInputText: (text: string) => void;
  handleTextSubmit: (e: React.FormEvent) => void;
}

const getStatusInfo = (status: AssistantStatus) => {
  switch (status) {
    case StatusEnum.LISTENING:
      return { text: 'Listening...', color: 'ring-sky-500', pulse: true, icon: <MicrophoneIcon className="w-8 h-8 text-white" />, enabled: false };
    case StatusEnum.THINKING:
      return { text: 'Thinking...', color: 'ring-amber-500', pulse: true, icon: <MicrophoneIcon className="w-8 h-8 text-white" />, enabled: false };
    case StatusEnum.TYPING:
      return { text: 'Typing... (Tap to stop)', color: 'ring-cyan-500', pulse: true, icon: <StopIcon className="w-8 h-8 text-white" />, enabled: true };
    case StatusEnum.SPEAKING:
      return { text: 'Speaking... (Tap to stop)', color: 'ring-teal-500', pulse: false, icon: <StopIcon className="w-8 h-8 text-white" />, enabled: true };
    default: // IDLE
      return { text: 'Tap to speak or type below', color: 'ring-indigo-600', pulse: false, icon: <MicrophoneIcon className="w-8 h-8 text-white" />, enabled: true };
  }
};

const ConversationLog: React.FC<{ messages: Message[] }> = ({ messages }) => (
  <div className="w-full h-full p-4 space-y-4 overflow-y-auto bg-gray-800/50 rounded-lg backdrop-blur-sm">
    {messages.length === 0 ? (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Conversation will appear here...</p>
      </div>
    ) : (
      messages.map((msg, index) => (
        <div key={index} className={`flex ${msg.author === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div className={`max-w-xs md:max-w-md p-3 rounded-lg ${msg.author === 'user' ? 'bg-indigo-600' : 'bg-gray-700'}`}>
            <p className="text-sm">{msg.text}</p>
            <p className="text-xs text-gray-400 text-right mt-1">{msg.timestamp}</p>
          </div>
        </div>
      ))
    )}
  </div>
);

const ReminderWidget: React.FC<{ reminders: Reminder[]; onClear: () => void }> = ({ reminders, onClear }) => (
  <div className="bg-gray-800/50 rounded-lg p-4 backdrop-blur-sm flex flex-col">
    <div className="flex justify-between items-center mb-2">
      <h3 className="font-bold">Reminders</h3>
      {reminders.length > 0 && (
         <button onClick={onClear} className="p-1 rounded-full hover:bg-gray-700 transition-colors">
            <TrashIcon className="w-5 h-5 text-gray-400" />
         </button>
      )}
    </div>
    <div className="space-y-2 overflow-y-auto flex-grow">
      {reminders.length > 0 ? (
        reminders.map(r => (
          <div key={r.id} className="bg-gray-700 p-2 rounded text-sm">{r.text}</div>
        ))
      ) : (
        <p className="text-gray-400 text-sm">No reminders set.</p>
      )}
    </div>
  </div>
);

const IotWidget: React.FC<{ devices: IotDevice[] }> = ({ devices }) => {
    const iconMap: Record<IotDeviceName, React.ReactElement> = {
        'living room light': <LightbulbIcon />,
        'bedroom light': <LightbulbIcon />,
        'thermostat': <ThermostatIcon />
    };
    return (
        <div className="bg-gray-800/50 rounded-lg p-4 backdrop-blur-sm">
            <h3 className="font-bold mb-2">Smart Home</h3>
            <div className="grid grid-cols-2 gap-4">
                {devices.map(d => (
                    <div key={d.id} className={`p-3 rounded-lg transition-all duration-300 ${d.state === 'on' ? 'bg-sky-500/30 text-sky-300' : 'bg-gray-700 text-gray-400'}`}>
                        <div className={`w-6 h-6 mb-1 ${d.state === 'on' ? 'text-sky-400' : 'text-gray-500'}`}>
                            {iconMap[d.id]}
                        </div>
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs">{d.state === 'on' ? 'On' : 'Off'}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const InputBar: React.FC<Pick<AssistantUIProps, 'status' | 'handleMainButtonPress' | 'inputText' | 'setInputText' | 'handleTextSubmit'>> = ({ status, handleMainButtonPress, inputText, setInputText, handleTextSubmit }) => {
    const { text, color, pulse, icon, enabled } = getStatusInfo(status);
    const isTextInputEnabled = status === StatusEnum.IDLE;

    return (
        <div className="flex flex-col items-center w-full max-w-2xl">
            <div className="flex items-center space-x-4">
                <button
                    onClick={handleMainButtonPress}
                    disabled={!enabled}
                    className={`relative flex items-center justify-center w-20 h-20 rounded-full bg-gray-800 focus:outline-none transition-all duration-300 ring-4 ${color} ${pulse ? 'animate-pulse' : ''} disabled:opacity-50 disabled:cursor-not-allowed`}
                    aria-label={status === StatusEnum.IDLE ? "Start listening" : "Stop assistant"}
                >
                    {icon}
                </button>
            </div>
            <p className="mt-3 mb-4 text-gray-400 h-5">{text}</p>
            <form onSubmit={handleTextSubmit} className="w-full flex items-center bg-gray-800 rounded-full p-1">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type your message..."
                    disabled={!isTextInputEnabled}
                    className="flex-grow bg-transparent text-white px-4 py-2 focus:outline-none disabled:opacity-50"
                    aria-label="Text input for assistant"
                />
                <button
                    type="submit"
                    disabled={!isTextInputEnabled || !inputText.trim()}
                    className="flex-shrink-0 bg-indigo-600 rounded-full p-3 hover:bg-indigo-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                    aria-label="Send message"
                >
                    <SendIcon className="w-5 h-5 text-white" />
                </button>
            </form>
        </div>
    );
};

export const AssistantUI: React.FC<AssistantUIProps> = (props) => {
  const { messages, reminders, iotDevices, clearReminders } = props;
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans p-4 flex flex-col">
      <header className="text-center mb-4">
        <h1 className="text-3xl font-bold text-gray-300">Aura</h1>
        <p className="text-indigo-400">Your Gemini-Powered Virtual Assistant</p>
      </header>
      
      <main className="flex-grow grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl w-full mx-auto">
        <div className="md-col-span-2 h-[60vh] md:h-auto flex flex-col">
          <ConversationLog messages={messages} />
        </div>
        
        <div className="space-y-6 h-full flex flex-col">
          <ReminderWidget reminders={reminders} onClear={clearReminders} />
          <IotWidget devices={iotDevices} />
        </div>
      </main>

      <footer className="mt-6 flex justify-center">
        <InputBar {...props} />
      </footer>
    </div>
  );
};