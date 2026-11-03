import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const records=sqliteTable('records',{
  owner:text('owner').notNull(),kind:text('kind').notNull(),id:text('id').notNull(),
  payload:text('payload').notNull(),version:integer('version').notNull().default(0),
  updatedAt:integer('updated_at').notNull(),
},t=>[primaryKey({columns:[t.owner,t.kind,t.id]})]);
export const preferences=sqliteTable('preferences',{
  owner:text('owner').primaryKey(),budgetCents:integer('budget_cents').notNull().default(12000000),version:integer('version').notNull().default(0),
});
export const imports=sqliteTable('imports',{
  owner:text('owner').notNull(),digest:text('digest').notNull(),createdAt:integer('created_at').notNull(),
},t=>[primaryKey({columns:[t.owner,t.digest]})]);
