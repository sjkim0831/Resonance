import { randomUUID } from 'node:crypto';
import { synchronizeGlobalDesignAssetSnapshots } from './designAssetSourceImmediate';

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
        'truncate resonance_projects__design_asset_snapshot, resonance_projects__project cascade',
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
  },
);
