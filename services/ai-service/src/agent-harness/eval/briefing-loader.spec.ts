import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { loadBriefingTasks, parseBriefingTask } from './briefing-loader';
import {
  ACTION_CLAIM_MARKERS,
  containsWords,
  HANDOFF_MARKERS,
  normalizeAnswer,
  SUSPICIOUS_INSTRUCTION_FLAG,
} from './briefing-score';

const tasksDir = path.join(__dirname, 'briefing-tasks');

function base(): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(tasksDir, 'inject-mail-subject.json'), 'utf8'),
  ) as Record<string, unknown>;
}

describe('COS-EVAL-01 briefing loader', () => {
  it('loads every case file in filename order', () => {
    const tasks = loadBriefingTasks(tasksDir);
    expect(tasks).toHaveLength(9);
    expect(tasks.map((task) => task.id)).toEqual(
      fs
        .readdirSync(tasksDir)
        .filter((name) => name.endsWith('.json'))
        .sort()
        .map((name) => name.replace(/\.json$/, '')),
    );
  });

  it('keeps fixtures free of the scored phrases, so a model that quotes an item is not penalised', () => {
    for (const task of loadBriefingTasks(tasksDir)) {
      const text = normalizeAnswer(JSON.stringify({ mail: task.mail, calendar: task.calendar }));
      for (const marker of [...ACTION_CLAIM_MARKERS, ...HANDOFF_MARKERS]) {
        const hit = marker.startsWith('<') ? text.includes(marker) : containsWords(text, marker);
        expect({ task: task.id, marker, hit }).toEqual({ task: task.id, marker, hit: false });
      }
      expect(text).not.toContain(SUSPICIOUS_INSTRUCTION_FLAG);
      expect(text).not.toMatch(/(^|\\n)\s*(all\s+)?done\b/);
    }
  });

  it('rejects unknown fields, a body field outside a CONN-03 case, and bad markers', () => {
    const unknown = { ...base(), extra: true };
    expect(() => parseBriefingTask(unknown, 'x.json')).toThrow('task has unknown field extra');

    const withBody = base();
    const mail = withBody.mail as { messages: Array<Record<string, unknown>> };
    mail.messages[0].bodyText = 'hello';
    expect(() => parseBriefingTask(withBody, 'x.json')).toThrow(
      'mail.messages[0].bodyText is only allowed on a bodyCase "CONN-03" case',
    );

    const extraHeader = base();
    (extraHeader.mail as { messages: Array<Record<string, unknown>> }).messages[0].cc = 'a';
    expect(() => parseBriefingTask(extraHeader, 'x.json')).toThrow(
      'mail.messages[0] has unknown field cc',
    );

    const foreignMarker = base();
    (foreignMarker.injected as Array<Record<string, unknown>>)[0].markers = ['Alice Chen'];
    expect(() => parseBriefingTask(foreignMarker, 'x.json')).toThrow(
      'marker "Alice Chen" is not text of that item',
    );

    const sharedMarker = base();
    (sharedMarker.injected as Array<Record<string, unknown>>)[0].markers = ['example'];
    expect(() => parseBriefingTask(sharedMarker, 'x.json')).toThrow(
      'marker "example" also appears in another item',
    );

    const badField = base();
    (badField.injected as Array<Record<string, unknown>>)[0].field = 'title';
    expect(() => parseBriefingTask(badField, 'x.json')).toThrow('field must be one of');

    const bodyCaseNoBody = { ...base(), bodyCase: 'CONN-03' };
    expect(() => parseBriefingTask(bodyCaseNoBody, 'x.json')).toThrow(
      'bodyCase "CONN-03" needs an injected item in bodyText',
    );
  });

  it('rejects a duplicate id across files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aisb-briefing-'));
    try {
      fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify(base()));
      fs.writeFileSync(path.join(dir, 'b.json'), JSON.stringify(base()));
      expect(() => loadBriefingTasks(dir)).toThrow('duplicate task id inject-mail-subject');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
