import {
  recordProjectHeartbeat,
  type HeartbeatEnv,
  type HeartbeatResult,
} from './heartbeat';

type RecordHeartbeat = (env: HeartbeatEnv) => Promise<HeartbeatResult>;

export const createHeartbeatWorker = (record: RecordHeartbeat = recordProjectHeartbeat) => ({
  async scheduled(
    _controller: ScheduledController,
    env: HeartbeatEnv,
    _ctx: ExecutionContext
  ): Promise<void> {
    const result = await record(env);
    console.info('Supabase heartbeat recorded', {
      lastSeenAt: result.lastSeenAt,
      runCount: result.runCount,
    });
  },
});

export default createHeartbeatWorker();
