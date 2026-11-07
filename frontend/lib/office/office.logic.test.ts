import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  countActiveKnowledgeDocuments,
  knowledgeBadgeMessageKey,
  readKnowledgeBadgeDocuments,
} from '@/lib/office/office-knowledge';
import {
  BUILDER_DESK_ID,
  FORMER_DESK_ID,
  TEAM_DESK_ID,
  attributeDeskId,
  buildOfficeDesks,
  deskTimeText,
  formatDurationText,
  formatElapsedText,
  normalizeOfficeRuns,
  activeRegistryDeskIds,
  officeRegistryFromManifests,
  officeTeamHref,
  phaseForRun,
  activeRunsEnded,
  shouldPollOffice,
  showsOutcomeUnknown,
  type OfficeRun,
  type OfficeUserAgentRef,
} from '@/lib/office/office.logic';

const NOW = Date.parse('2026-11-05T06:00:00.000Z');
const registry = officeRegistryFromManifests([
  { id: 'builder', status: 'active' },
  { id: 'chief-of-staff', status: 'active' },
  { id: 'product-strategy', status: 'active' },
  { id: 'technology-advisor', status: 'active' },
]);
const activeRegistryIds = activeRegistryDeskIds(registry);

function attribute(
  run: Parameters<typeof attributeDeskId>[0],
  userAgentIds: ReadonlySet<string>,
): string {
  return attributeDeskId(run, userAgentIds, activeRegistryIds);
}
const writer: OfficeUserAgentRef = {
  id: 'ua-1',
  name: 'Research Writer',
  role: 'Writer',
  description: 'Notes',
};

function run(overrides: Partial<OfficeRun> = {}): OfficeRun {
  return {
    executionId: 'exec-1',
    status: 'running',
    sessionId: 'session-1',
    provider: 'anthropic',
    model: 'model-a',
    tokensUsed: 12,
    startedAt: '2026-11-05T05:58:00.000Z',
    durationMs: null,
    mode: 'build',
    agentId: null,
    collaborationRunId: null,
    builderProfileId: null,
    ...overrides,
  };
}

function desksFor(input: {
  userAgents?: OfficeUserAgentRef[];
  activeRuns?: OfficeRun[];
  recentRuns?: OfficeRun[];
}) {
  return buildOfficeDesks({
    registry,
    userAgents: input.userAgents ?? [],
    activeRuns: input.activeRuns ?? [],
    recentRuns: input.recentRuns ?? [],
  });
}

function desk(id: string, input: Parameters<typeof desksFor>[0]) {
  const found = desksFor(input).find((item) => item.id === id);
  assert.ok(found, `missing desk ${id}`);
  return found;
}

describe('office run attribution', () => {
  const userIds = new Set(['ua-1']);

  test('a collaboration run goes to the team desk even when it names a user agent', () => {
    assert.equal(
      attribute(
        { collaborationRunId: 'collab-1', agentId: 'ua-1' },
        userIds,
      ),
      TEAM_DESK_ID,
    );
  });

  test('a chief-of-staff collaboration run goes to that registry desk', () => {
    assert.equal(
      attribute(
        {
          collaborationRunId: 'collab-1',
          agentId: 'ua-1',
          builderProfileId: 'chief-of-staff',
        },
        userIds,
      ),
      'registry:chief-of-staff',
    );
    assert.equal(
      attribute(
        {
          collaborationRunId: 'collab-1',
          agentId: null,
          builderProfileId: '  chief-of-staff  ',
        },
        userIds,
      ),
      'registry:chief-of-staff',
    );
  });

  test('without the chief id a chief collaboration run falls through to the team desk', () => {
    const builderOnly = activeRegistryDeskIds([{ id: 'builder', status: 'active' }]);
    assert.equal(
      attributeDeskId(
        {
          collaborationRunId: 'collab-1',
          agentId: null,
          builderProfileId: 'chief-of-staff',
        },
        userIds,
        builderOnly,
      ),
      TEAM_DESK_ID,
    );
  });

  test('product and technology collaboration runs go to their desks', () => {
    for (const builderProfileId of ['product-strategy', 'technology-advisor']) {
      assert.equal(
        attribute(
          { collaborationRunId: 'collab-1', agentId: null, builderProfileId },
          userIds,
        ),
        `registry:${builderProfileId}`,
      );
    }
  });

  test('an advisors-lead run sits on the chief desk while that desk is active', () => {
    assert.equal(
      attribute(
        {
          collaborationRunId: 'collab-1',
          agentId: null,
          builderProfileId: 'advisors-lead',
        },
        userIds,
      ),
      'registry:chief-of-staff',
    );
  });

  test('an advisors-lead run sits on the team desk when the chief desk is absent', () => {
    const builderOnly = activeRegistryDeskIds([{ id: 'builder', status: 'active' }]);
    assert.equal(
      attributeDeskId(
        {
          collaborationRunId: 'collab-1',
          agentId: null,
          builderProfileId: 'advisors-lead',
        },
        userIds,
        builderOnly,
      ),
      TEAM_DESK_ID,
    );
  });

  test('other collaboration runs stay on the team desk', () => {
    for (const builderProfileId of ['lead', 'writer', 'builder', '   ', null]) {
      assert.equal(
        attribute(
          { collaborationRunId: 'collab-1', agentId: 'ua-1', builderProfileId },
          userIds,
        ),
        TEAM_DESK_ID,
        `profile ${String(builderProfileId)}`,
      );
    }
  });

  test('a blank collaboration id does not open the team desk', () => {
    assert.equal(
      attribute({ collaborationRunId: '   ', agentId: null }, userIds),
      BUILDER_DESK_ID,
    );
  });

  test('a null agent id goes to the builder desk', () => {
    assert.equal(
      attribute({ collaborationRunId: null, agentId: null }, userIds),
      BUILDER_DESK_ID,
    );
    assert.equal(
      attribute({ collaborationRunId: null, agentId: '  ' }, userIds),
      BUILDER_DESK_ID,
    );
  });

  test('a matching user agent id goes to that desk', () => {
    assert.equal(
      attribute({ collaborationRunId: null, agentId: 'ua-1' }, userIds),
      'user:ua-1',
    );
  });

  test('an unknown agent id, including a registry id, goes to former agents', () => {
    assert.equal(
      attribute({ collaborationRunId: null, agentId: 'deleted-1' }, userIds),
      FORMER_DESK_ID,
    );
    assert.equal(
      attribute({ collaborationRunId: null, agentId: 'builder' }, userIds),
      FORMER_DESK_ID,
    );
    assert.equal(
      attribute({ collaborationRunId: null, agentId: 'chief-of-staff' }, userIds),
      FORMER_DESK_ID,
    );
  });
});

describe('office desk status', () => {
  test('active cancelled is stopping and any other active status is queued or working', () => {
    assert.equal(phaseForRun('running', 'active'), 'working');
    assert.equal(phaseForRun('cancelled', 'active'), 'stopping');
    assert.equal(phaseForRun('queued', 'active'), 'queued');
    assert.equal(phaseForRun('pending', 'active'), 'queued');
    assert.equal(phaseForRun('banana', 'active'), 'queued');
    assert.equal(phaseForRun('completed', 'active'), 'queued');
  });

  test('recent rows use the finished status labels and unknown stays queued', () => {
    assert.equal(phaseForRun('completed', 'recent'), 'done');
    assert.equal(phaseForRun('failed', 'recent'), 'failed');
    assert.equal(phaseForRun('cancelled', 'recent'), 'stopped');
    assert.equal(phaseForRun('timeout', 'recent'), 'timedOut');
    assert.equal(phaseForRun('mystery', 'recent'), 'queued');
  });

  test('newest active row wins over a newer recent row', () => {
    const builder = desk(BUILDER_DESK_ID, {
      activeRuns: [
        run({
          executionId: 'older-active',
          status: 'queued',
          startedAt: '2026-11-05T04:00:00.000Z',
        }),
        run({
          executionId: 'newer-active',
          status: 'running',
          startedAt: '2026-11-05T05:00:00.000Z',
        }),
      ],
      recentRuns: [
        run({
          executionId: 'newer-recent',
          status: 'completed',
          mode: 'ask',
          startedAt: '2026-11-05T05:40:00.000Z',
          durationMs: 12000,
        }),
      ],
    });
    assert.equal(builder.phase, 'working');
    assert.equal(builder.isLastRun, false);
    assert.equal(builder.currentRun?.executionId, 'newer-active');
    assert.equal(
      builder.recentRuns.some((item) => item.executionId === 'newer-active'),
      false,
    );
  });

  test('with no active row the newest recent row is the last run', () => {
    const builder = desk(BUILDER_DESK_ID, {
      recentRuns: [
        run({
          executionId: 'older',
          status: 'failed',
          startedAt: '2026-11-05T03:00:00.000Z',
          durationMs: 40000,
        }),
        run({
          executionId: 'newer',
          status: 'completed',
          startedAt: '2026-11-05T04:00:00.000Z',
          durationMs: 12000,
        }),
      ],
    });
    assert.equal(builder.phase, 'done');
    assert.equal(builder.isLastRun, true);
    assert.equal(builder.currentRun, null);
    assert.equal(builder.headlineRun?.executionId, 'newer');
  });

  test('no rows leave the builder and the business desks idle and occupied', () => {
    const built = desksFor({});
    const builder = built.find((item) => item.id === BUILDER_DESK_ID);
    assert.ok(builder);
    assert.equal(builder.phase, 'idle');
    assert.equal(builder.isLastRun, false);
    const chief = built.find((item) => item.id === 'registry:chief-of-staff');
    assert.ok(chief);
    assert.equal(chief.vacant, false);
    assert.equal(chief.phase, 'idle');
    for (const id of ['registry:product-strategy', 'registry:technology-advisor']) {
      const deskItem = built.find((item) => item.id === id);
      assert.ok(deskItem);
      assert.equal(deskItem.vacant, false);
      assert.equal(deskItem.phase, 'idle');
    }
    assert.equal(built.filter((item) => item.vacant).length, 0);
    const reserved = buildOfficeDesks({
      registry: officeRegistryFromManifests([{ id: 'future-advisor', status: 'coming_soon' }]),
      userAgents: [],
      activeRuns: [],
      recentRuns: [],
    });
    assert.equal(reserved[0]?.vacant, true);
    assert.equal(reserved[0]?.phase, 'vacant');
    assert.equal(built.some((item) => item.id === TEAM_DESK_ID), false);
    assert.equal(built.some((item) => item.id === FORMER_DESK_ID), false);
  });

  test('a cancelled active row is stopping and a cancelled recent row is stopped', () => {
    assert.equal(
      desk(BUILDER_DESK_ID, { activeRuns: [run({ status: 'cancelled' })] }).phase,
      'stopping',
    );
    assert.equal(
      desk(BUILDER_DESK_ID, {
        recentRuns: [run({ status: 'cancelled', durationMs: 1000 })],
      }).phase,
      'stopped',
    );
    assert.equal(
      desk(BUILDER_DESK_ID, {
        recentRuns: [run({ status: 'cancelled', durationMs: 1000 })],
      }).isLastRun,
      true,
    );
  });

  test('an unknown active status shows queued', () => {
    const builder = desk(BUILDER_DESK_ID, {
      activeRuns: [run({ status: 'not-a-status' })],
    });
    assert.equal(builder.phase, 'queued');
    assert.equal(builder.isLastRun, false);
  });

  test('null startedAt keeps list order, and a real timestamp still outranks it', () => {
    const ordered = desk(BUILDER_DESK_ID, {
      activeRuns: [
        run({ executionId: 'first', startedAt: null, status: 'queued' }),
        run({ executionId: 'second', startedAt: null, status: 'running' }),
      ],
    });
    assert.equal(ordered.currentRun?.executionId, 'first');

    const timed = desk(BUILDER_DESK_ID, {
      activeRuns: [
        run({ executionId: 'untimed', startedAt: null, status: 'running' }),
        run({
          executionId: 'timed',
          status: 'queued',
          startedAt: '2026-11-05T05:00:00.000Z',
        }),
      ],
    });
    assert.equal(timed.currentRun?.executionId, 'timed');
  });

  test('the panel keeps the five newest recent rows and drops the live duplicate', () => {
    const recentRuns = [1, 2, 3, 4, 5, 6].map((hour) =>
      run({
        executionId: `e${hour}`,
        status: 'completed',
        mode: 'ask',
        startedAt: `2026-11-05T0${hour}:00:00.000Z`,
        durationMs: hour * 1000,
      }),
    );
    const builder = desk(BUILDER_DESK_ID, {
      activeRuns: [
        run({
          executionId: 'e6',
          status: 'running',
          startedAt: '2026-11-05T06:30:00.000Z',
        }),
      ],
      recentRuns,
    });
    assert.deepEqual(
      builder.recentRuns.map((item) => item.executionId),
      ['e5', 'e4', 'e3', 'e2', 'e1'],
    );
  });
});

describe('office desk grouping', () => {
  test('a non-collaboration registry id stays on former agents', () => {
    const built = desksFor({
      activeRuns: [run({ executionId: 'stray', agentId: 'chief-of-staff', status: 'running' })],
    });
    const chief = built.find((item) => item.id === 'registry:chief-of-staff');
    const former = built.find((item) => item.id === FORMER_DESK_ID);
    assert.ok(chief);
    assert.equal(chief.vacant, false);
    assert.equal(chief.phase, 'idle');
    assert.equal(chief.currentRun, null);
    assert.ok(former);
    assert.equal(former.phase, 'working');
    assert.equal(former.headlineRun?.executionId, 'stray');
  });

  test('only an active non-builder registry profile leaves the team desk', () => {
    const custom = buildOfficeDesks({
      registry: [
        { id: 'builder', status: 'active', comingSoon: false },
        { id: 'custom-advisor', status: 'active', comingSoon: false },
        { id: 'retired', status: 'disabled', comingSoon: false },
      ],
      userAgents: [],
      activeRuns: [
        run({
          executionId: 'custom-run',
          collaborationRunId: 'collab-custom',
          builderProfileId: 'custom-advisor',
        }),
        run({
          executionId: 'retired-run',
          collaborationRunId: 'collab-retired',
          builderProfileId: 'retired',
        }),
      ],
      recentRuns: [],
    });
    const advisor = custom.find((item) => item.id === 'registry:custom-advisor');
    const retired = custom.find((item) => item.id === 'registry:retired');
    const team = custom.find((item) => item.id === TEAM_DESK_ID);
    assert.ok(advisor);
    assert.equal(advisor.currentRun?.executionId, 'custom-run');
    assert.ok(retired);
    assert.equal(retired.currentRun, null);
    assert.ok(team);
    assert.equal(team.currentRun?.executionId, 'retired-run');
    assert.equal(team.headlineRun?.executionId, 'retired-run');
    assert.equal(
      custom.some((item) => item.currentRun?.executionId === 'custom-run' && item.id === TEAM_DESK_ID),
      false,
    );
  });

  test('a chief-of-staff collaboration run occupies that desk and leaves the team desk', () => {
    const built = desksFor({
      activeRuns: [
        run({
          executionId: 'chief-run',
          collaborationRunId: 'collab-chief',
          builderProfileId: 'chief-of-staff',
          status: 'running',
        }),
        run({
          executionId: 'coding-run',
          collaborationRunId: 'collab-coding',
          builderProfileId: 'lead',
          status: 'queued',
        }),
      ],
    });
    const chief = built.find((item) => item.id === 'registry:chief-of-staff');
    const team = built.find((item) => item.id === TEAM_DESK_ID);
    assert.ok(chief);
    assert.equal(chief.vacant, false);
    assert.equal(chief.currentRun?.executionId, 'chief-run');
    assert.ok(team);
    assert.equal(team.currentRun?.executionId, 'coding-run');
    assert.equal(team.teamRole, 'lead');
  });

  test('team and former desks appear only when a run needs them', () => {
    const quiet = desksFor({ userAgents: [writer] });
    assert.equal(quiet.some((item) => item.kind === 'team'), false);
    assert.equal(quiet.some((item) => item.kind === 'former'), false);
    assert.equal(quiet.some((item) => item.id === 'user:ua-1'), true);

    const busy = desksFor({
      userAgents: [writer],
      activeRuns: [
        run({
          executionId: 'team-run',
          collaborationRunId: 'collab-1',
          agentId: 'ua-1',
          builderProfileId: 'lead',
          status: 'running',
        }),
        run({
          executionId: 'old-agent',
          agentId: 'deleted-9',
          status: 'queued',
          collaborationRunId: null,
        }),
      ],
    });
    const team = busy.find((item) => item.id === TEAM_DESK_ID);
    const user = busy.find((item) => item.id === 'user:ua-1');
    const former = busy.find((item) => item.id === FORMER_DESK_ID);
    assert.ok(team);
    assert.equal(team.teamRole, 'lead');
    assert.equal(team.phase, 'working');
    assert.ok(user);
    assert.equal(user.phase, 'idle');
    assert.ok(former);
    assert.equal(former.phase, 'queued');
  });

  test('the team role comes from the winning row', () => {
    const team = desk(TEAM_DESK_ID, {
      activeRuns: [
        run({
          executionId: 'older-role',
          collaborationRunId: 'collab-1',
          builderProfileId: 'writer',
          status: 'queued',
          startedAt: '2026-11-05T04:00:00.000Z',
        }),
        run({
          executionId: 'newer-role',
          collaborationRunId: 'collab-2',
          builderProfileId: 'lead',
          status: 'running',
          startedAt: '2026-11-05T05:00:00.000Z',
        }),
      ],
    });
    assert.equal(team.teamRole, 'lead');
  });

  test('activeRunsEnded is true when a previous run is removed', () => {
    assert.equal(
      activeRunsEnded(
        [run({ executionId: 'kept' }), run({ executionId: 'finished' })],
        [run({ executionId: 'kept' })],
      ),
      true,
    );
  });

  test('activeRunsEnded is false when no run is removed', () => {
    assert.equal(
      activeRunsEnded([run({ executionId: 'kept' })], [run({ executionId: 'kept' })]),
      false,
    );
  });

  test('activeRunsEnded is false when a run is only added', () => {
    assert.equal(
      activeRunsEnded(
        [run({ executionId: 'kept' })],
        [run({ executionId: 'kept' }), run({ executionId: 'added' })],
      ),
      false,
    );
  });

  test('activeRunsEnded is false when both lists are empty', () => {
    assert.equal(activeRunsEnded([], []), false);
  });

  test('polling stays on only while a desk is queued, working, or stopping', () => {
    assert.equal(shouldPollOffice(['idle', 'vacant', 'done', 'failed', 'stopped', 'timedOut']), false);
    assert.equal(shouldPollOffice(['idle', 'queued']), true);
    assert.equal(shouldPollOffice(['working']), true);
    assert.equal(shouldPollOffice(['stopping']), true);
  });
});

describe('office elapsed time and duration text', () => {
  test('duration text uses seconds, minutes, hours, and days, and an em dash when missing', () => {
    assert.equal(formatDurationText(null), '—');
    assert.equal(formatDurationText(Number.NaN), '—');
    assert.equal(formatDurationText(-1), '—');
    assert.equal(formatDurationText(0), '0s');
    assert.equal(formatDurationText(12000), '12s');
    assert.equal(formatDurationText(40000), '40s');
    assert.equal(formatDurationText(120000), '2m');
    assert.equal(formatDurationText(3_600_000), '1h');
    assert.equal(formatDurationText(86_400_000), '1d');
  });

  test('elapsed time is measured from startedAt', () => {
    assert.equal(formatElapsedText('2026-11-05T05:58:00.000Z', NOW), '2m');
    assert.equal(formatElapsedText('2026-11-05T05:59:48.000Z', NOW), '12s');
    assert.equal(formatElapsedText('2026-11-05T07:00:00.000Z', NOW), '0s');
    assert.equal(formatElapsedText(null, NOW), '—');
    assert.equal(formatElapsedText('not-a-time', NOW), '—');
  });

  test('active desks show elapsed time and finished desks show duration', () => {
    const working = desk(BUILDER_DESK_ID, {
      activeRuns: [run({ startedAt: '2026-11-05T05:58:00.000Z', durationMs: 999 })],
    });
    assert.equal(deskTimeText(working, NOW), '2m');

    const done = desk(BUILDER_DESK_ID, {
      recentRuns: [run({ status: 'completed', durationMs: null, startedAt: '2026-11-05T04:00:00.000Z' })],
    });
    assert.equal(deskTimeText(done, NOW), '—');
    assert.equal(
      deskTimeText(
        desk(BUILDER_DESK_ID, {
          recentRuns: [run({ status: 'completed', durationMs: 40000 })],
        }),
        NOW,
      ),
      '40s',
    );
  });

  test('finished build and agent runs are the only outcome-unknown rows', () => {
    assert.equal(showsOutcomeUnknown(run({ status: 'completed', mode: 'build' })), true);
    assert.equal(showsOutcomeUnknown(run({ status: 'completed', mode: 'agent' })), true);
    assert.equal(showsOutcomeUnknown(run({ status: 'completed', mode: 'ask' })), false);
    assert.equal(showsOutcomeUnknown(run({ status: 'failed', mode: 'build' })), false);
    assert.equal(showsOutcomeUnknown(run({ status: 'running', mode: 'build' })), false);
  });
});

describe('office run payload', () => {
  test('list rows keep collaboration, profile, and duration fields', () => {
    const runs = normalizeOfficeRuns({
      runs: [
        {
          executionId: 'exec-1',
          status: 'completed',
          sessionId: 'session-1',
          provider: 'anthropic',
          model: 'model-a',
          tokensUsed: 8,
          startedAt: '2026-11-05T05:00:00.000Z',
          durationMs: 12000,
          mode: 'build',
          agentId: null,
          collaborationRunId: 'collab-1',
          builderProfileId: 'lead',
        },
        {
          executionId: 'exec-2',
          status: 'running',
          durationMs: null,
          collaborationRunId: null,
          builderProfileId: null,
        },
        'skip-me',
      ],
    });
    assert.ok(runs);
    assert.equal(runs.length, 2);
    assert.equal(runs[0].collaborationRunId, 'collab-1');
    assert.equal(runs[0].builderProfileId, 'lead');
    assert.equal(runs[0].durationMs, 12000);
    assert.equal(runs[1].collaborationRunId, null);
    assert.equal(runs[1].builderProfileId, null);
    assert.equal(runs[1].durationMs, null);
    assert.equal(runs[1].mode, 'unknown');
  });

  test('a payload without a runs array is rejected', () => {
    assert.equal(normalizeOfficeRuns({}), null);
    assert.equal(normalizeOfficeRuns(null), null);
  });
});

describe('chief of staff knowledge badge', () => {
  const chiefScopes = [
    'company-monthly-reports',
    'three-year-goals',
    'strategy-docs',
    'policies',
    'meeting-summaries',
    'contract-templates',
  ];

  test('the count uses the chief of staff scope ids and skips other or inactive documents', () => {
    assert.equal(
      countActiveKnowledgeDocuments(
        [
          { scopeId: 'policies' },
          { scopeId: 'contract-templates', status: 'active' },
          { scopeId: 'policies', status: 'deleted' },
          { scopeId: 'market-data', status: 'active' },
          { scopeId: 'codebase-context' },
          { scopeId: 'tech-landscape', status: null },
        ],
        chiefScopes,
      ),
      2,
    );
    assert.equal(countActiveKnowledgeDocuments([], chiefScopes), 0);
    assert.equal(knowledgeBadgeMessageKey(0), 'knowledgeBadge');
    assert.equal(knowledgeBadgeMessageKey(1), 'knowledgeBadgeOne');
    assert.equal(knowledgeBadgeMessageKey(3), 'knowledgeBadge');
  });

  test('the reader keeps scope and status and drops titles', () => {
    const documents = readKnowledgeBadgeDocuments({
      documents: [
        { id: 'doc-1', scopeId: 'policies', title: 'Secret handbook', status: 'active', content: 'hidden' },
        { scopeId: 'contract-templates', title: 'Template' },
      ],
    });
    assert.ok(documents);
    assert.deepEqual(documents, [
      { scopeId: 'policies', status: 'active' },
      { scopeId: 'contract-templates', status: null },
    ]);
    assert.equal(documents.some((document) => 'title' in document || 'content' in document), false);
    assert.equal(readKnowledgeBadgeDocuments({ documents: [{ title: 'No scope' }] }), null);
    assert.equal(readKnowledgeBadgeDocuments({}), null);
    assert.equal(readKnowledgeBadgeDocuments(null), null);
  });

  test('the team page href keeps the locale', () => {
    assert.equal(officeTeamHref('en'), '/en/collaboration');
    assert.equal(officeTeamHref('zh-TW'), '/zh-TW/collaboration');
  });
});
