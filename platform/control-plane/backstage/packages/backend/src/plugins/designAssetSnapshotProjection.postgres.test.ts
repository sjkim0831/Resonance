import { randomUUID } from 'node:crypto';
import {
  synchronizeGlobalDesignAssetSnapshots,
  type SourceDesignAssetMutation,
} from './designAssetSourceImmediate';
import {
  reconcileDesignSnapshotSyncBatch,
  type DesignSnapshotSyncClaim,
} from './receiptReconciliation';

type PgResult = { rows: Record<string, unknown>[] };
type PgClient = {
  connect: () => Promise<void>;
  end: () => Promise<void>;
  query: (sql: string, bindings?: unknown[]) => Promise<PgResult>;
};
const { Client } = require('pg') as {
  Client: new (connection: Record<string, unknown>) => PgClient;
};

const configured = Boolean(process.env.DESIGN_ASSET_PG_HOST);
const describePostgres = configured ? describe : describe.skip;

describePostgres(
  'global common-design snapshot projection (PostgreSQL)',
  () => {
    const connection = {
      host: process.env.DESIGN_ASSET_PG_HOST,
      port: Number(process.env.DESIGN_ASSET_PG_PORT ?? 5432),
      database: process.env.DESIGN_ASSET_PG_DATABASE ?? 'postgres',
      user: process.env.DESIGN_ASSET_PG_USER ?? 'postgres',
      password: process.env.DESIGN_ASSET_PG_PASSWORD ?? '',
    };
    const schema = `design_projection_${randomUUID().replace(/-/g, '')}`;
    let admin: PgClient;
    let client: PgClient;

    const transaction = {
      raw: async (sql: string, bindings: unknown[] = []): Promise<PgResult> => {
        let index = 0;
        const parameterized = sql.replace(/\?/g, () => `$${(index += 1)}`);
        return client.query(parameterized, bindings);
      },
    };

    beforeAll(async () => {
      admin = new Client(connection);
      await admin.connect();
      await admin.query(`create schema "${schema}"`);
      client = new Client(connection);
      await client.connect();
      await client.query(`set search_path to "${schema}"`);
      await client.query(`
      create table resonance_projects__project(
        project_id varchar(64) primary key
      );
      create table resonance_projects__design_asset_snapshot(
        snapshot_id bigserial primary key,
        project_id varchar(64) not null references resonance_projects__project(project_id),
        asset_type varchar(32) not null,
        asset_id varchar(200) not null,
        asset_name varchar(300) not null,
        route_path varchar(500) not null default '',
        asset_version varchar(80) not null default 'v1',
        active boolean not null default true,
        asset_payload jsonb not null,
        asset_sha256 varchar(64) not null,
        synced_at timestamptz not null,
        unique(project_id,asset_type,asset_id)
      );
      create table resonance_projects__design_asset_source_sync(
        sync_id varchar(64) primary key,
        project_id varchar(64) not null,
        asset_type varchar(32) not null,
        asset_id varchar(200) not null,
        snapshot_base_fingerprint varchar(64) not null,
        asset_fingerprint varchar(64) not null,
        mutation_payload jsonb not null,
        actor_ref varchar(200) not null,
        status varchar(32) not null,
        claim_token varchar(64),
        lease_expires_at timestamptz,
        retry_attempt integer not null default 0,
        next_attempt_at timestamptz not null default current_timestamp,
        runtime_receipt jsonb not null default '{}'::jsonb,
        last_error text not null default '',
        synchronized_at timestamptz,
        updated_at timestamptz not null default current_timestamp
      );
      create table test_runtime_design_head(
        asset_type varchar(32) not null,
        asset_id varchar(200) not null,
        asset_fingerprint varchar(64) not null,
        primary key(asset_type,asset_id)
      )
    `);
    });

    afterAll(async () => {
      if (client) await client.end();
      if (admin) {
        await admin.query(`drop schema if exists "${schema}" cascade`);
        await admin.end();
      }
    });

    beforeEach(async () => {
      await client.query(
        `truncate resonance_projects__design_asset_source_sync,
                  resonance_projects__design_asset_snapshot,
                  resonance_projects__project,
                  test_runtime_design_head cascade`,
      );
    });

    it('upserts the winner into every existing and missing project projection', async () => {
      await client.query(`
      insert into resonance_projects__project(project_id)
      values('PROJECT_A'),('PROJECT_B'),('PROJECT_C');
      insert into resonance_projects__design_asset_snapshot(
        project_id,asset_type,asset_id,asset_name,asset_payload,asset_sha256,synced_at)
      values
        ('PROJECT_A','THEME','GLOBAL_THEME','Before','{}',repeat('0',64),current_timestamp),
        ('PROJECT_B','THEME','GLOBAL_THEME','Before','{}',repeat('0',64),current_timestamp)
    `);
      const after = 'a'.repeat(64);
      await client.query('begin');
      const synchronized = await synchronizeGlobalDesignAssetSnapshots(
        transaction,
        {
          assetType: 'THEME',
          assetId: 'GLOBAL_THEME',
          assetName: 'Winner',
          routePath: '',
          version: 'v2',
          active: true,
          payload: { schemaVersion: '1.0.0' },
          assetFingerprint: after,
        },
        new Date('2026-08-16T12:00:00.000Z'),
      );
      await client.query('commit');

      expect(synchronized).toBe(3);
      const rows = await client.query(`
      select project_id,asset_name,asset_sha256,asset_payload
        from resonance_projects__design_asset_snapshot
       order by project_id
    `);
      expect(rows.rows).toHaveLength(3);
      expect(rows.rows.map(row => row.project_id)).toEqual([
        'PROJECT_A',
        'PROJECT_B',
        'PROJECT_C',
      ]);
      expect(new Set(rows.rows.map(row => row.asset_sha256))).toEqual(
        new Set([after]),
      );
      expect(new Set(rows.rows.map(row => row.asset_name))).toEqual(
        new Set(['Winner']),
      );
    });

    it('recovers a PREPARED receipt after a runtime commit and projects it to every project', async () => {
      const before = '0'.repeat(64);
      const after = 'a'.repeat(64);
      const syncId = randomUUID();
      const mutation: SourceDesignAssetMutation = {
        activationPolicy: 'SOURCE_IMMEDIATE_V1',
        authorityMode: 'SOURCE',
        assetType: 'THEME',
        assetId: 'GLOBAL_THEME',
        assetName: 'Recovered winner',
        routePath: '',
        version: 'v2',
        active: true,
        payload: { schemaVersion: '1.0.0' },
        dependencies: [],
        baseAsset: {
          assetType: 'THEME',
          assetId: 'GLOBAL_THEME',
          assetName: 'Before',
          routePath: '',
          version: 'v1',
          active: true,
          payload: {},
        },
        baseFingerprint: before,
        assetFingerprint: after,
      };
      await client.query(
        `insert into resonance_projects__project(project_id)
         values('PROJECT_A'),('PROJECT_B')`,
      );
      await client.query(
        `insert into resonance_projects__design_asset_snapshot(
           project_id,asset_type,asset_id,asset_name,asset_payload,
           asset_sha256,synced_at)
         values('PROJECT_A','THEME','GLOBAL_THEME','Before','{}',$1,current_timestamp)`,
        [before],
      );
      await client.query(
        `insert into test_runtime_design_head(asset_type,asset_id,asset_fingerprint)
         values('THEME','GLOBAL_THEME',$1)`,
        [after],
      );
      await client.query(
        `insert into resonance_projects__design_asset_source_sync(
           sync_id,project_id,asset_type,asset_id,snapshot_base_fingerprint,
           asset_fingerprint,mutation_payload,actor_ref,status,next_attempt_at)
         values($3,'PROJECT_A','THEME','GLOBAL_THEME',$1,$2,$4::jsonb,
                'user:default/approver','PREPARED',current_timestamp)`,
        [before, after, syncId, JSON.stringify(mutation)],
      );

      const summary = await reconcileDesignSnapshotSyncBatch({
        concurrency: 1,
        claimDue: async limit => {
          const claimToken = randomUUID();
          const claimed = await client.query(
            `with candidate as (
               select sync_id
                 from resonance_projects__design_asset_source_sync
                where status in ('PREPARED','PENDING','RUNNING')
                  and next_attempt_at <= current_timestamp
                  and (lease_expires_at is null or lease_expires_at <= current_timestamp)
                order by next_attempt_at,sync_id
                for update skip locked
                limit $1
             )
             update resonance_projects__design_asset_source_sync sync
                set status='RUNNING', claim_token=$2,
                    lease_expires_at=current_timestamp + interval '30 seconds',
                    updated_at=current_timestamp
               from candidate
              where sync.sync_id=candidate.sync_id
          returning sync.*`,
            [limit, claimToken],
          );
          return claimed.rows.map(
            row =>
              ({
                syncId: String(row.sync_id),
                projectId: String(row.project_id),
                assetType: String(row.asset_type),
                assetId: String(row.asset_id),
                snapshotBaseFingerprint: String(row.snapshot_base_fingerprint),
                assetFingerprint: String(row.asset_fingerprint),
                mutation: row.mutation_payload as Record<string, unknown>,
                actorRef: String(row.actor_ref),
                claimToken: String(row.claim_token),
                retryAttempt: Number(row.retry_attempt),
              } satisfies DesignSnapshotSyncClaim),
          );
        },
        replaySource: async claim => {
          const runtime = await client.query(
            `select asset_fingerprint
               from test_runtime_design_head
              where asset_type=$1 and asset_id=$2`,
            [claim.assetType, claim.assetId],
          );
          return {
            sourceCommitted:
              String(runtime.rows[0]?.asset_fingerprint) ===
              claim.assetFingerprint,
            assetFingerprint: runtime.rows[0]?.asset_fingerprint,
          };
        },
        commitSnapshot: async (claim, receipt) => {
          await client.query('begin');
          try {
            const fenced = await client.query(
              `select sync_id
                 from resonance_projects__design_asset_source_sync
                where sync_id=$1 and status='RUNNING' and claim_token=$2
                for update`,
              [claim.syncId, claim.claimToken],
            );
            if (fenced.rows.length !== 1) {
              await client.query('rollback');
              return false;
            }
            const synchronizedProjectCount =
              await synchronizeGlobalDesignAssetSnapshots(
                transaction,
                claim.mutation as SourceDesignAssetMutation,
                new Date('2026-08-16T12:00:00.000Z'),
              );
            const committed = await client.query(
              `update resonance_projects__design_asset_source_sync
                  set status='SYNCHRONIZED',runtime_receipt=$3::jsonb,
                      claim_token=null,lease_expires_at=null,
                      synchronized_at=current_timestamp,updated_at=current_timestamp
                where sync_id=$1 and status='RUNNING' and claim_token=$2
            returning sync_id`,
              [claim.syncId, claim.claimToken, JSON.stringify(receipt)],
            );
            expect(synchronizedProjectCount).toBe(2);
            await client.query('commit');
            return committed.rows.length === 1;
          } catch (error) {
            await client.query('rollback');
            throw error;
          }
        },
        cancelClaim: async () => false,
        retryClaim: async () => false,
      });

      expect(summary).toEqual({
        claimed: 1,
        terminal: 1,
        pending: 0,
        retried: 0,
        stale: 0,
      });
      const snapshots = await client.query(
        `select project_id,asset_sha256
           from resonance_projects__design_asset_snapshot
          order by project_id`,
      );
      expect(snapshots.rows).toEqual([
        { project_id: 'PROJECT_A', asset_sha256: after },
        { project_id: 'PROJECT_B', asset_sha256: after },
      ]);
      const receipt = await client.query(
        `select status,claim_token,lease_expires_at
           from resonance_projects__design_asset_source_sync
          where sync_id=$1`,
        [syncId],
      );
      expect(receipt.rows).toEqual([
        {
          status: 'SYNCHRONIZED',
          claim_token: null,
          lease_expires_at: null,
        },
      ]);
    });
  },
);
