-- Fuzzy food search. db:setup creates it as superuser; this is a no-op then (pg_trgm is a trusted extension on PG13+).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"measured_on" date NOT NULL,
	"neck_cm" double precision,
	"chest_cm" double precision,
	"waist_cm" double precision,
	"hips_cm" double precision,
	"arm_cm" double precision,
	"thigh_cm" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"target_hours" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"logged_on" date NOT NULL,
	"meal" text NOT NULL,
	"food_id" uuid,
	"name" text NOT NULL,
	"emoji" text,
	"servings" double precision DEFAULT 1 NOT NULL,
	"serving_size" double precision,
	"serving_unit" text,
	"calories" double precision NOT NULL,
	"protein_g" double precision DEFAULT 0 NOT NULL,
	"carbs_g" double precision DEFAULT 0 NOT NULL,
	"fat_g" double precision DEFAULT 0 NOT NULL,
	"fiber_g" double precision DEFAULT 0 NOT NULL,
	"sugar_g" double precision DEFAULT 0 NOT NULL,
	"sodium_mg" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"brand" text,
	"emoji" text,
	"category" text NOT NULL,
	"serving_size" double precision NOT NULL,
	"serving_unit" text NOT NULL,
	"calories" double precision NOT NULL,
	"protein_g" double precision DEFAULT 0 NOT NULL,
	"carbs_g" double precision DEFAULT 0 NOT NULL,
	"fat_g" double precision DEFAULT 0 NOT NULL,
	"fiber_g" double precision DEFAULT 0 NOT NULL,
	"sugar_g" double precision DEFAULT 0 NOT NULL,
	"sodium_mg" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "habit_checkins" (
	"habit_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"count" smallint NOT NULL,
	CONSTRAINT "habit_checkins_habit_id_day_pk" PRIMARY KEY("habit_id","day")
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text NOT NULL,
	"color" text NOT NULL,
	"target_per_day" smallint DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medication_doses" (
	"medication_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"time" text NOT NULL,
	"status" text NOT NULL,
	"taken_at" timestamp with time zone,
	CONSTRAINT "medication_doses_medication_id_day_time_pk" PRIMARY KEY("medication_id","day","time")
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"dosage" text,
	"instructions" text,
	"times" text[] NOT NULL,
	"started_on" date NOT NULL,
	"ends_on" date,
	"color" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mindful_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"logged_on" date NOT NULL,
	"pattern" text NOT NULL,
	"duration_sec" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mood_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"logged_on" date NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"mood" smallint NOT NULL,
	"energy" smallint NOT NULL,
	"stress" smallint NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"sex" text NOT NULL,
	"birth_date" date NOT NULL,
	"height_cm" double precision NOT NULL,
	"activity_level" text NOT NULL,
	"goal" text NOT NULL,
	"target_weight_kg" double precision,
	"weekly_rate_kg" double precision DEFAULT 0.5 NOT NULL,
	"unit_system" text DEFAULT 'metric' NOT NULL,
	"calorie_target" integer NOT NULL,
	"protein_target_g" integer NOT NULL,
	"carbs_target_g" integer NOT NULL,
	"fat_target_g" integer NOT NULL,
	"fiber_target_g" integer NOT NULL,
	"water_target_ml" integer NOT NULL,
	"step_target" integer NOT NULL,
	"sleep_target_minutes" integer NOT NULL,
	"active_minutes_target" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sleep_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"slept_on" date NOT NULL,
	"bed_at" timestamp with time zone NOT NULL,
	"wake_at" timestamp with time zone NOT NULL,
	"quality" smallint NOT NULL,
	"awakenings" smallint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "step_days" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"steps" integer NOT NULL,
	"active_minutes" integer,
	"floors" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "step_days_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_achievements_user_id_code_pk" PRIMARY KEY("user_id","code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vitals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"measured_on" date NOT NULL,
	"value" double precision NOT NULL,
	"value2" double precision,
	"context" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "water_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"logged_on" date NOT NULL,
	"amount_ml" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weight_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"measured_on" date NOT NULL,
	"weight_kg" double precision NOT NULL,
	"body_fat_pct" double precision,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"performed_on" date NOT NULL,
	"type" text NOT NULL,
	"title" text,
	"duration_min" integer NOT NULL,
	"intensity" text NOT NULL,
	"calories_burned" integer NOT NULL,
	"distance_km" double precision,
	"avg_heart_rate" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fasts" ADD CONSTRAINT "fasts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_checkins" ADD CONSTRAINT "habit_checkins_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_checkins" ADD CONSTRAINT "habit_checkins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_doses" ADD CONSTRAINT "medication_doses_medication_id_medications_id_fk" FOREIGN KEY ("medication_id") REFERENCES "public"."medications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medication_doses" ADD CONSTRAINT "medication_doses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medications" ADD CONSTRAINT "medications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mindful_sessions" ADD CONSTRAINT "mindful_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mood_entries" ADD CONSTRAINT "mood_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_entries" ADD CONSTRAINT "sleep_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_days" ADD CONSTRAINT "step_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "water_entries" ADD CONSTRAINT "water_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "body_measurements_user_day_uq" ON "body_measurements" USING btree ("user_id","measured_on");--> statement-breakpoint
CREATE INDEX "fasts_user_started_idx" ON "fasts" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "fasts_one_active_uq" ON "fasts" USING btree ("user_id") WHERE "fasts"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "food_entries_user_day_idx" ON "food_entries" USING btree ("user_id","logged_on");--> statement-breakpoint
CREATE INDEX "food_entries_food_idx" ON "food_entries" USING btree ("user_id","food_id");--> statement-breakpoint
CREATE INDEX "foods_name_trgm_idx" ON "foods" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "foods_user_idx" ON "foods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "habit_checkins_user_day_idx" ON "habit_checkins" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "habits_user_idx" ON "habits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "medication_doses_user_day_idx" ON "medication_doses" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "medications_user_idx" ON "medications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mindful_sessions_user_day_idx" ON "mindful_sessions" USING btree ("user_id","logged_on");--> statement-breakpoint
CREATE INDEX "mood_entries_user_day_idx" ON "mood_entries" USING btree ("user_id","logged_on");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sleep_entries_user_day_uq" ON "sleep_entries" USING btree ("user_id","slept_on");--> statement-breakpoint
CREATE INDEX "vitals_user_kind_time_idx" ON "vitals" USING btree ("user_id","kind","measured_at");--> statement-breakpoint
CREATE INDEX "water_entries_user_day_idx" ON "water_entries" USING btree ("user_id","logged_on");--> statement-breakpoint
CREATE UNIQUE INDEX "weight_entries_user_day_uq" ON "weight_entries" USING btree ("user_id","measured_on");--> statement-breakpoint
CREATE INDEX "workouts_user_day_idx" ON "workouts" USING btree ("user_id","performed_on");