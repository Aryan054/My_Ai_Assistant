export enum AssistantStatus {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  TYPING = 'TYPING',
  SPEAKING = 'SPEAKING',
}

export interface Message {
  author: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export interface Reminder {
  id: number;
  text: string;
}

export type IotDeviceName = 'living room light' | 'bedroom light' | 'thermostat';

export interface IotDevice {
  id: IotDeviceName;
  name: string;
  state: 'on' | 'off';
}