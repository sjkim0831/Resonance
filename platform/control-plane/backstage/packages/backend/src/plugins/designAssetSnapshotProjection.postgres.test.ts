import { randomBytes, randomUUID } from 'node:crypto';
import {
  lockGlobalDesignSourceAuthority,
  synchronizeGlobalDesignAssetSnapshotBatch,
  synchronizeGlobalDesignAssetSnapshots,
  type SourceDesignAssetSnapshotTransition,
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
      create unique index resonance_design_asset_source_sync_active_uq
        on resonance_projects__design_asset_source_sync(asset_type,asset_id)
        where status in ('PREPARED','PENDING','RUNNING');
      create table test_runtime_design_head(
        asset_type varchar(32) not null,
        asset_id varchar(200) not null,
        asset_fingerprint varchar(64) not null,
        primary key(asset_type,asset_id)
      );
      create table resonance_projects__design_asset_role_assignment(
        assignment_id bigserial primary key,
        project_id varchar(64) not null,
        principal_ref varchar(300) not null,
        role_code varchar(32) not null,
        active boolean not null default true
      );
      create table test_global_design_write_probe(
        write_id bigserial primary key,
        principal_ref varchar(300) not null
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
        `truncate test_global_design_write_probe,
                  resonance_projects__design_asset_role_assignment,
                  resonance_projects__design_asset_source_sync,
                  resonance_projects__design_asset_snapshot,
                  resonance_projects__project,
                  test_runtime_design_head cascade`,
      );
    });

    it('rejects a self-created project approver with 403 semantics and zero global writes', async () => {
      const attacker = 'user:default/project-owner';
      await client.query(
        `insert into resonance_projects__design_asset_role_assignment(
           project_id,principal_ref,role_code,active)
         values('PROJECT_ATTACKER',$1,'DESIGN_APPROVER',true)`,
        [attacker],
      );

      await client.query('begin');
      const authority = await lockGlobalDesignSourceAuthority(transaction, [
        attacker,
      ]);
      if (authority) {
        await client.query(
          `insert into test_global_design_write_probe(principal_ref) values($1)`,
          [authority],
        );
      }
      await client.query('commit');

      expect(authority).toBeUndefined();
      expect(authority ? 200 : 403).toBe(403);
      expect(
        Number(
          (
            await client.query(
              `select count(*) count from test_global_design_write_probe`,
            )
          ).rows[0].count,
        ),
      ).toBe(0);
    });

    it('serializes a revocation ahead of source mutation and fences the write to zero', async () => {
      const approver = 'user:default/platform-approver';
      await client.query(
        `insert into resonance_projects__design_asset_role_assignment(
           project_id,principal_ref,role_code,active)
         values('CCUS-PLATFORM',$1,'DESIGN_APPROVER',true)`,
        [approver],
      );
      expect(
        Number(
          (
            await client.query(
              `select count(*) count
                 from resonance_projects__design_asset_role_assignment
                where active and principal_ref=$1`,
              [approver],
            )
          ).rows[0].count,
        ),
      ).toBe(1);

      const revoker = new Client(connection);
      await revoker.connect();
      await revoker.query(`set search_path to "${schema}"`);
      try {
        await revoker.query('begin');
        await revoker.query(
          `update resonance_projects__design_asset_role_assignment
              set active=false
            where project_id='CCUS-PLATFORM' and principal_ref=$1
              and role_code='DESIGN_APPROVER'`,
          [approver],
        );

        await client.query('begin');
        const lockedAuthority = lockGlobalDesignSourceAuthority(transaction, [
          approver,
        ]);
        await new Promise(resolve => setTimeout(resolve, 75));
        await revoker.query('commit');
        const authority = await lockedAuthority;
        if (authority) {
          await client.query(
            `insert into test_global_design_write_probe(principal_ref) values($1)`,
            [authority],
          );
        }
        await client.query('commit');

        expect(authority).toBeUndefined();
        expect(authority ? 200 : 403).toBe(403);
        expect(
          Number(
            (
              await client.query(
                `select count(*) count from test_global_design_write_probe`,
              )
            ).rows[0].count,
          ),
        ).toBe(0);
      } finally {
        await revoker.query('rollback').catch(() => undefined);
        await revoker.end();
      }
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

    it('rolls back the whole cascade batch instead of overwriting a newer dependent snapshot', async () => {
      const componentBase = '0'.repeat(64);
      const componentAfter = '1'.repeat(64);
      const screenBase = 'a'.repeat(64);
      const screenCascade = 'b'.repeat(64);
      const screenNewer = 'c'.repeat(64);
      await client.query(`
        insert into resonance_projects__project(project_id)
        values('PROJECT_A'),('PROJECT_B');
        insert into resonance_projects__design_asset_snapshot(
          project_id,asset_type,asset_id,asset_name,asset_payload,
          asset_sha256,synced_at)
        values
          ('PROJECT_A','SCREEN','DEPENDENT_SCREEN','Newer','{}',repeat('c',64),current_timestamp),
          ('PROJECT_B','SCREEN','DEPENDENT_SCREEN','Newer','{}',repeat('c',64),current_timestamp)
      `);
      const batch: SourceDesignAssetSnapshotTransition[] = [
        {
          assetType: 'COMPONENT',
          assetId: 'TARGET_COMPONENT',
          assetName: 'Component after',
          routePath: '',
          version: 'v2',
          active: true,
          payload: {},
          baseFingerprint: componentBase,
          fingerprint: componentAfter,
        },
        {
          assetType: 'SCREEN',
          assetId: 'DEPENDENT_SCREEN',
          assetName: 'Cascade screen',
          routePath: '/dependent',
          version: 'v1',
          active: true,
          payload: {},
          baseFingerprint: screenBase,
          fingerprint: screenCascade,
        },
      ];

      await client.query('begin');
      await expect(
        synchronizeGlobalDesignAssetSnapshotBatch(
          transaction,
          batch,
          new Date('2026-08-16T12:00:00.000Z'),
        ),
      ).rejects.toThrow('global design snapshot CAS diverged for SCREEN:DEPENDENT_SCREEN');
      await client.query('rollback');

      expect(
        Number(
          (
            await client.query(
              `select count(*) count from resonance_projects__design_asset_snapshot
                where asset_type='COMPONENT' and asset_id='TARGET_COMPONENT'`,
            )
          ).rows[0].count,
        ),
      ).toBe(0);
      expect(
        new Set(
          (
            await client.query(
              `select asset_sha256 from resonance_projects__design_asset_snapshot
                where asset_type='SCREEN' and asset_id='DEPENDENT_SCREEN'`,
            )
          ).rows.map(row => row.asset_sha256),
        ),
      ).toEqual(new Set([screenNewer]));
    });

    it('recovers a PREPARED receipt after a runtime commit and projects it to every project', async () => {
      const before = '0'.repeat(64);
      const after = 'a'.repeat(64);
      const syncId = randomBytes(32).toString('hex');
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
            sourceSnapshots: [
              {
                assetType: mutation.assetType,
                assetId: mutation.assetId,
                assetName: mutation.assetName,
                routePath: mutation.routePath,
                version: mutation.version,
                active: mutation.active,
                payload: mutation.payload,
                baseFingerprint: before,
                fingerprint: after,
              },
            ],
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
            const batch = receipt.sourceSnapshots as
              | SourceDesignAssetSnapshotTransition[]
              | undefined;
            if (!batch) throw new Error('missing runtime source snapshot batch');
            const synchronized = await synchronizeGlobalDesignAssetSnapshotBatch(
              transaction,
              batch,
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
            expect(synchronized).toEqual({
              projectCount: 2,
              snapshotCount: 1,
              synchronizedProjectionCount: 2,
            });
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

    it('allows a fresh A-to-B receipt after terminal A-to-B-to-A history but only one active transition', async () => {
      const a = 'a'.repeat(64);
      const b = 'b'.repeat(64);
      const insert = (
        syncId: string,
        baseFingerprint: string,
        assetFingerprint: string,
        status: string,
      ) =>
        client.query(
          `insert into resonance_projects__design_asset_source_sync(
             sync_id,project_id,asset_type,asset_id,snapshot_base_fingerprint,
             asset_fingerprint,mutation_payload,actor_ref,status,next_attempt_at)
           values($1,'PROJECT_A','THEME','REPEAT_THEME',$2,$3,'{}'::jsonb,
                  'user:default/approver',$4,current_timestamp)`,
          [syncId, baseFingerprint, assetFingerprint, status],
        );

      await insert(randomBytes(32).toString('hex'), a, b, 'SYNCHRONIZED');
      await insert(randomBytes(32).toString('hex'), b, a, 'SYNCHRONIZED');
      await insert(randomBytes(32).toString('hex'), a, b, 'PREPARED');

      expect(
        Number(
          (
            await client.query(
              `select count(*) count
                 from resonance_projects__design_asset_source_sync
                where asset_type='THEME' and asset_id='REPEAT_THEME'`,
            )
          ).rows[0].count,
        ),
      ).toBe(3);
      await expect(
        insert(randomBytes(32).toString('hex'), a, b, 'PENDING'),
      ).rejects.toMatchObject({ code: '23505' });
    });
  },
);
