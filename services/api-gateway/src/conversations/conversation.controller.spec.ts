import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ChatMessageRole } from '../entities/chat-message-role.enum';

describe('ConversationController', () => {
  const conversationService = {
    getConversationBySession: jest.fn(),
    getConversationById: jest.fn(),
  };
  const chatMessageService = {
    getMessageHistory: jest.fn(),
    addMessageBySession: jest.fn(),
  };
  const sessionService = {
    getSessionById: jest.fn(),
  };

  let controller: ConversationController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ConversationController(
      conversationService as never,
      chatMessageService as never,
      sessionService as never,
    );
  });

  it('loads conversation for owned session', async () => {
    (sessionService.getSessionById as any).mockResolvedValue({ id: 's1', userId: 'u1' });
    (conversationService.getConversationBySession as any).mockResolvedValue({
      id: 'c1',
      sessionId: 's1',
    });

    const result = await controller.getConversationBySession('s1', { user: { userId: 'u1' } });
    expect(result).toEqual({ id: 'c1', sessionId: 's1' });
  });

  it('rejects conversation access when session owner mismatches', async () => {
    (sessionService.getSessionById as any).mockResolvedValue({
      id: 's1',
      userId: 'other-user',
    });

    await expect(
      controller.getConversationBySession('s1', { user: { userId: 'u1' } }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persists session-scoped message for owned session', async () => {
    (sessionService.getSessionById as any).mockResolvedValue({ id: 's1', userId: 'u1' });
    (chatMessageService.addMessageBySession as any).mockResolvedValue({ id: 'm1' });

    const result = await controller.addMessageBySession(
      's1',
      { role: ChatMessageRole.USER, content: 'hello' },
      { user: { userId: 'u1' } },
    );

    expect(result).toEqual({ id: 'm1' });
    expect(chatMessageService.addMessageBySession).toHaveBeenCalledWith({
      sessionId: 's1',
      role: ChatMessageRole.USER,
      content: 'hello',
    });
  });

  it('rejects message persistence for unowned session', async () => {
    (sessionService.getSessionById as any).mockResolvedValue({
      id: 's1',
      userId: 'other-user',
    });

    await expect(
      controller.addMessageBySession(
        's1',
        { role: ChatMessageRole.ASSISTANT, content: 'response' },
        { user: { userId: 'u1' } },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('loads messages for owned conversation', async () => {
    (conversationService.getConversationById as any).mockResolvedValue({
      id: 'c1',
      sessionId: 's1',
    });
    (sessionService.getSessionById as any).mockResolvedValue({ id: 's1', userId: 'u1' });
    (chatMessageService.getMessageHistory as any).mockResolvedValue([
      { id: 'm1', role: ChatMessageRole.USER, content: 'hello' },
      { id: 'm2', role: ChatMessageRole.ASSISTANT, content: 'hi' },
    ]);

    const result = await controller.getMessages('c1', { user: { userId: 'u1' } }, 50, 0);
    expect(result).toHaveLength(2);
    expect(chatMessageService.getMessageHistory).toHaveBeenCalledWith('c1', 50, 0);
  });

  it('rejects message loading for unowned conversation session', async () => {
    (conversationService.getConversationById as any).mockResolvedValue({
      id: 'c1',
      sessionId: 's1',
    });
    (sessionService.getSessionById as any).mockResolvedValue({
      id: 's1',
      userId: 'other-user',
    });

    await expect(
      controller.getMessages('c1', { user: { userId: 'u1' } }, 50, 0),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
