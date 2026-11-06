import type { ApiGatewayHttpClient } from '../../../clients/api-gateway-http.client';
import { ToolDispatcher, TOOL_DISPATCH_ERROR_RESULT_TOO_LARGE } from '../tool-dispatcher';
import {
  createReadKnowledgeHandler,
  createSearchKnowledgeHandler,
} from './knowledge-tool-handlers';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const DOCUMENT_ID = '33333333-3333-4333-8333-333333333333';

function clientMock() {
  return {
    searchKnowledge: jest.fn(),
    readKnowledge: jest.fn(),
  };
}

describe('knowledge tool handlers', () => {
  it('rejects a blank query or document id before HTTP', async () => {
    const client = clientMock();
    const search = createSearchKnowledgeHandler({
      client: client as unknown as ApiGatewayHttpClient,
      userId: USER_ID,
      scopes: ['policies'],
    });
    const read = createReadKnowledgeHandler({
      client: client as unknown as ApiGatewayHttpClient,
      userId: USER_ID,
      scopes: ['policies'],
      maxToolResultBytes: 262144,
    });

    await expect(search({ query: '   ' })).rejects.toThrow(
      'query is required and must be a non-empty string',
    );
    await expect(search({})).rejects.toThrow(
      'query is required and must be a non-empty string',
    );
    await expect(read({ documentId: '  ' })).rejects.toThrow(
      'documentId is required and must be a non-empty string',
    );
    await expect(read({})).rejects.toThrow(
      'documentId is required and must be a non-empty string',
    );
    expect(client.searchKnowledge).not.toHaveBeenCalled();
    expect(client.readKnowledge).not.toHaveBeenCalled();
  });

  it('sends the closed-over user and scopes and ignores args.userId', async () => {
    const client = clientMock();
    client.searchKnowledge.mockResolvedValue({
      query: 'leave',
      results: [
        {
          documentId: DOCUMENT_ID,
          title: 'Handbook',
          scopeId: 'policies',
          heading: 'Leave',
          preview: 'Employees may take leave.',
          content: 'secret body',
        },
      ],
      truncated: false,
    });
    client.readKnowledge.mockResolvedValue({
      documentId: DOCUMENT_ID,
      title: 'Handbook',
      scopeId: 'policies',
      heading: null,
      content: 'short',
      truncated: false,
    });
    const deps = {
      client: client as unknown as ApiGatewayHttpClient,
      userId: USER_ID,
      scopes: ['policies'] as const,
    };
    const search = createSearchKnowledgeHandler(deps);
    const read = createReadKnowledgeHandler({ ...deps, maxToolResultBytes: 262144 });

    await expect(
      search({ query: 'leave', userId: 'user-attacker', scopes: ['market-data'] }),
    ).resolves.toEqual({
      query: 'leave',
      results: [
        {
          documentId: DOCUMENT_ID,
          title: 'Handbook',
          scopeId: 'policies',
          heading: 'Leave',
          preview: 'Employees may take leave.',
        },
      ],
      truncated: false,
    });
    expect(client.searchKnowledge).toHaveBeenCalledWith(
      { userId: USER_ID, scopes: ['policies'], query: 'leave' },
      undefined,
    );

    await expect(
      read({
        documentId: DOCUMENT_ID,
        heading: 'Leave',
        userId: 'user-attacker',
      }),
    ).resolves.toEqual({
      documentId: DOCUMENT_ID,
      title: 'Handbook',
      scopeId: 'policies',
      heading: null,
      content: 'short',
      truncated: false,
    });
    expect(client.readKnowledge).toHaveBeenCalledWith(
      {
        userId: USER_ID,
        scopes: ['policies'],
        documentId: DOCUMENT_ID,
        heading: 'Leave',
      },
      undefined,
    );
  });

  it('replaces a gateway failure with a fixed sentence', async () => {
    const client = clientMock();
    client.searchKnowledge.mockRejectedValue(new Error('secret gateway body'));
    client.readKnowledge.mockRejectedValue(new Error('secret gateway body'));
    const deps = {
      client: client as unknown as ApiGatewayHttpClient,
      userId: USER_ID,
      scopes: ['policies'] as const,
    };

    await expect(
      createSearchKnowledgeHandler(deps)({ query: 'leave' }),
    ).rejects.toThrow('Knowledge search failed.');
    await expect(
      createReadKnowledgeHandler({ ...deps, maxToolResultBytes: 262144 })({
        documentId: DOCUMENT_ID,
      }),
    ).rejects.toThrow('Knowledge document not found.');
  });

  it('slices read content on a UTF-8 boundary when the byte cap is small', async () => {
    const content = 'é'.repeat(80);
    const client = clientMock();
    client.readKnowledge.mockResolvedValue({
      documentId: DOCUMENT_ID,
      title: 'T',
      scopeId: 'policies',
      heading: null,
      content,
      truncated: false,
    });
    const deps = {
      client: client as unknown as ApiGatewayHttpClient,
      userId: USER_ID,
      scopes: ['policies'] as const,
    };
    const full = await createReadKnowledgeHandler({
      ...deps,
      maxToolResultBytes: 262144,
    })({ documentId: DOCUMENT_ID });
    const envelope = Buffer.byteLength(
      JSON.stringify({ ...full, content: '', truncated: true }),
      'utf8',
    );
    const cap = envelope + 20;
    const sliced = await createReadKnowledgeHandler({
      ...deps,
      maxToolResultBytes: cap,
    })({ documentId: DOCUMENT_ID });

    const slicedContent = sliced.content as string;
    expect(sliced.truncated).toBe(true);
    expect(slicedContent.length).toBeGreaterThan(0);
    expect(slicedContent.length).toBeLessThan(content.length);
    expect(Buffer.byteLength(JSON.stringify(sliced), 'utf8')).toBeLessThanOrEqual(cap);
    expect(slicedContent.includes('\uFFFD')).toBe(false);
    expect(Buffer.from(slicedContent, 'utf8').toString('utf8')).toBe(slicedContent);
  });

  it('returns RESULT_TOO_LARGE when the handler result still exceeds the dispatcher cap', async () => {
    const client = clientMock();
    client.readKnowledge.mockResolvedValue({
      documentId: DOCUMENT_ID,
      title: 'T',
      scopeId: 'policies',
      heading: null,
      content: 'é'.repeat(40),
      truncated: false,
    });
    const dispatcher = new ToolDispatcher({ maxToolResultBytes: 8 });
    dispatcher.registerHandler(
      'read_knowledge',
      createReadKnowledgeHandler({
        client: client as unknown as ApiGatewayHttpClient,
        userId: USER_ID,
        scopes: ['policies'],
        maxToolResultBytes: 8,
      }),
    );

    const result = await dispatcher.dispatch({
      callId: 'call-1',
      toolName: 'read_knowledge',
      arguments: { documentId: DOCUMENT_ID },
      providerKind: 'stub',
    });

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe(TOOL_DISPATCH_ERROR_RESULT_TOO_LARGE);
  });
});
