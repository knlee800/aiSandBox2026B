import enMessages from '@/messages/en.json';
import zhTwMessages from '@/messages/zh-TW.json';
import zhCnMessages from '@/messages/zh-CN.json';

export function getRecoveryCopy(locale: string): typeof enMessages.recovery {
  if (locale === 'zh-TW') return zhTwMessages.recovery;
  if (locale === 'zh-CN') return zhCnMessages.recovery;
  return enMessages.recovery;
}

export const recoveryCopy = enMessages.recovery;

export type RecoveryCopy = typeof enMessages.recovery;
