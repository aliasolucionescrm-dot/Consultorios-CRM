import { pgTable, uuid, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
// Typed projection for authentication. SQL migrations are the schema source of truth.
export const users = pgTable('users', {
 id: uuid('id').primaryKey(), email: text('email').notNull(), name: text('name').notNull(),
 passwordHash: text('password_hash').notNull(), active: boolean('active').notNull(),
 failedAttempts: integer('failed_attempts').notNull(), lockedUntil: timestamp('locked_until',{withTimezone:true}),
 createdAt: timestamp('created_at',{withTimezone:true}).notNull()
});
