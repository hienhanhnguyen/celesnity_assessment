import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1788401842958 implements MigrationInterface {
    name = 'Init1788401842958'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "work_orders" ("work_order_id" character varying(64) NOT NULL, "line_id" character varying(64) NOT NULL, "status" character varying(32), "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_7f152ba668488a81576676dc519" PRIMARY KEY ("work_order_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cf263781f73b223c293a5ac3e5" ON "work_orders" ("line_id") `);
        await queryRunner.query(`CREATE TABLE "batches" ("batch_id" character varying(64) NOT NULL, "work_order_id" character varying(64) NOT NULL, "line_id" character varying(64) NOT NULL, "metadata" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b2f5936e453fef1dac6094ce11f" PRIMARY KEY ("batch_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_300b5fc84997efa98402ead128" ON "batches" ("work_order_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ad9e822850d1bcc599868e9c2" ON "batches" ("line_id") `);
        await queryRunner.query(`CREATE TABLE "sources" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(16) NOT NULL, "name" character varying(128) NOT NULL, "config" jsonb NOT NULL DEFAULT '{}', "selection" jsonb, "status" character varying(16) NOT NULL DEFAULT 'REGISTERED', "has_secret" boolean NOT NULL DEFAULT false, "secret_ciphertext" text, "secret_iv" text, "secret_auth_tag" text, "last_tested_at" TIMESTAMP WITH TIME ZONE, "last_error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_85523beafe5a2a6b90b02096443" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ee4027d72bd2c0c01c4d1fc110" ON "sources" ("name") `);
        await queryRunner.query(`CREATE TABLE "collection_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "source_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'PENDING', "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, "duration_ms" integer, "fetched" integer NOT NULL DEFAULT '0', "normalized" integer NOT NULL DEFAULT '0', "duplicates" integer NOT NULL DEFAULT '0', "malformed" integer NOT NULL DEFAULT '0', "errors" integer NOT NULL DEFAULT '0', "trigger" character varying(32), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8f6ea6aca75e52f42c84f657c8a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_568179b1587d6f99efe9ac0c65" ON "collection_runs" ("source_id") `);
        await queryRunner.query(`CREATE TABLE "source_observations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "source_id" uuid NOT NULL, "run_id" uuid NOT NULL, "source_record_id" character varying(128) NOT NULL, "station" character varying(16) NOT NULL, "batch_id" character varying(64) NOT NULL, "work_order_id" character varying(64), "line_id" character varying(64), "quantity" integer, "event_type" character varying(64), "event_time" TIMESTAMP WITH TIME ZONE NOT NULL, "raw_payload" jsonb NOT NULL, "ingested_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d8f360a98b903abd0f6e44bb695" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2701ed12a4e96fd679f3ef5c1b" ON "source_observations" ("source_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_56674d896b435e91ad9976b432" ON "source_observations" ("run_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_73e3a63fe726f4a6b78a9b14a5" ON "source_observations" ("source_id", "run_id", "source_record_id", "station") `);
        await queryRunner.query(`CREATE INDEX "IDX_69a8f376f9b3c8beb74fd49429" ON "source_observations" ("batch_id", "station") `);
        await queryRunner.query(`CREATE TABLE "canonical_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "batch_id" character varying(64) NOT NULL, "station" character varying(16) NOT NULL, "winning_observation_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'ACCEPTED', "source_type" character varying(16) NOT NULL, "quantity" integer, "event_time" TIMESTAMP WITH TIME ZONE NOT NULL, "superseded_observation_ids" jsonb NOT NULL DEFAULT '[]', "conflict_flags" jsonb NOT NULL DEFAULT '[]', "late" boolean NOT NULL DEFAULT false, "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c3098485528ee402b6deb4a0e65" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cffefdd640c14702a5a707021b" ON "canonical_events" ("batch_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e8d09dd38e767d46a27d8a987b" ON "canonical_events" ("batch_id", "station") `);
        await queryRunner.query(`CREATE TABLE "collection_errors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "run_id" uuid NOT NULL, "kind" character varying(24) NOT NULL, "message" text NOT NULL, "context" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c143c09fa39f442bbea82c370ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_568b341714e1d14f6e894584c8" ON "collection_errors" ("run_id") `);
        await queryRunner.query(`CREATE TABLE "management_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "batch_id" character varying(64) NOT NULL, "type" character varying(16) NOT NULL, "organization_id" character varying(128) NOT NULL, "actor" character varying(128) NOT NULL, "note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_202c13f424e1d97f266bac39901" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c48c7e8e6108dd00589c884245" ON "management_events" ("batch_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_194920ab29a84a0f0f8ab76b05" ON "management_events" ("batch_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "batches" ADD CONSTRAINT "FK_300b5fc84997efa98402ead1287" FOREIGN KEY ("work_order_id") REFERENCES "work_orders"("work_order_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collection_runs" ADD CONSTRAINT "FK_568179b1587d6f99efe9ac0c654" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "source_observations" ADD CONSTRAINT "FK_2701ed12a4e96fd679f3ef5c1b0" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "source_observations" ADD CONSTRAINT "FK_56674d896b435e91ad9976b432f" FOREIGN KEY ("run_id") REFERENCES "collection_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "canonical_events" ADD CONSTRAINT "FK_fb625961f8d3949b16b2eb7085a" FOREIGN KEY ("winning_observation_id") REFERENCES "source_observations"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "collection_errors" ADD CONSTRAINT "FK_568b341714e1d14f6e894584c83" FOREIGN KEY ("run_id") REFERENCES "collection_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "collection_errors" DROP CONSTRAINT "FK_568b341714e1d14f6e894584c83"`);
        await queryRunner.query(`ALTER TABLE "canonical_events" DROP CONSTRAINT "FK_fb625961f8d3949b16b2eb7085a"`);
        await queryRunner.query(`ALTER TABLE "source_observations" DROP CONSTRAINT "FK_56674d896b435e91ad9976b432f"`);
        await queryRunner.query(`ALTER TABLE "source_observations" DROP CONSTRAINT "FK_2701ed12a4e96fd679f3ef5c1b0"`);
        await queryRunner.query(`ALTER TABLE "collection_runs" DROP CONSTRAINT "FK_568179b1587d6f99efe9ac0c654"`);
        await queryRunner.query(`ALTER TABLE "batches" DROP CONSTRAINT "FK_300b5fc84997efa98402ead1287"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_194920ab29a84a0f0f8ab76b05"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c48c7e8e6108dd00589c884245"`);
        await queryRunner.query(`DROP TABLE "management_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_568b341714e1d14f6e894584c8"`);
        await queryRunner.query(`DROP TABLE "collection_errors"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e8d09dd38e767d46a27d8a987b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cffefdd640c14702a5a707021b"`);
        await queryRunner.query(`DROP TABLE "canonical_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_69a8f376f9b3c8beb74fd49429"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_73e3a63fe726f4a6b78a9b14a5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_56674d896b435e91ad9976b432"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2701ed12a4e96fd679f3ef5c1b"`);
        await queryRunner.query(`DROP TABLE "source_observations"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_568179b1587d6f99efe9ac0c65"`);
        await queryRunner.query(`DROP TABLE "collection_runs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ee4027d72bd2c0c01c4d1fc110"`);
        await queryRunner.query(`DROP TABLE "sources"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3ad9e822850d1bcc599868e9c2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_300b5fc84997efa98402ead128"`);
        await queryRunner.query(`DROP TABLE "batches"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cf263781f73b223c293a5ac3e5"`);
        await queryRunner.query(`DROP TABLE "work_orders"`);
    }

}
