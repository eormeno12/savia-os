import { ImportWorker } from './import.worker';
import type { AppConfig } from '../../common/config/app.config';
import type { MemoryService } from '../memory/memory.service';
import type { JobsService } from '../jobs/jobs.service';
import type { ImportJobData } from './import.queue';
import type { Job } from 'bullmq';

function worker(addResults: ('ok' | 'fail')[]) {
  let call = 0;
  const add = jest.fn().mockImplementation(() => {
    const outcome = addResults[call++];
    return outcome === 'fail' ? Promise.reject(new Error('boom')) : Promise.resolve(['m1']);
  });
  const update = jest.fn().mockResolvedValue({});
  const memory = { add } as unknown as MemoryService;
  const jobs = { update } as unknown as JobsService;
  const w = new ImportWorker({} as AppConfig, memory, jobs);
  return { w, update };
}

function process(w: ImportWorker, chunks: string[]) {
  const job = { data: { dbJobId: 'job-1', userId: 'user-1', chunks, source: 'chatgpt' } } as Job<ImportJobData>;
  return (w as unknown as { process(job: Job<ImportJobData>): Promise<void> }).process(job);
}

describe('ImportWorker.process', () => {
  it('marks done with no error when every chunk succeeds', async () => {
    const { w, update } = worker(['ok', 'ok', 'ok']);
    await process(w, ['a', 'b', 'c']);

    expect(update).toHaveBeenLastCalledWith('job-1', { status: 'done', progress: 100, error: null });
  });

  it('marks done with a partial-failure error when some chunks fail', async () => {
    const { w, update } = worker(['ok', 'fail', 'ok']);
    await process(w, ['a', 'b', 'c']);

    expect(update).toHaveBeenLastCalledWith('job-1', { status: 'done', progress: 100, error: '1/3 conversaciones fallaron' });
  });

  it('marks failed (not done) when every chunk fails — the bug this guards against', async () => {
    const { w, update } = worker(['fail', 'fail']);
    await process(w, ['a', 'b']);

    expect(update).toHaveBeenLastCalledWith('job-1', {
      status: 'failed',
      progress: 100,
      error: 'las 2 conversaciones fallaron',
    });
  });
});
