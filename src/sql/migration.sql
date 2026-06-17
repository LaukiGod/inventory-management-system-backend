-- ============================================================
-- Inventory Management System — Supabase SQL Migration
-- Run this in Supabase SQL Editor to set up the database
-- ============================================================

-- Enable UUID extension (already enabled in Supabase by default)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('ADMIN', 'STAFF');
CREATE TYPE log_type AS ENUM ('RECEIVED', 'CONSUMED');

-- ============================================================
-- USERS
-- Mirrors Supabase Auth users. We store role + active flag here.
-- id matches auth.users.id so we can join on it.
-- ============================================================

CREATE TABLE users (
  id          UUID PRIMARY KEY,              -- matches auth.users.id
  email       TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'STAFF',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================

CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STOCK ITEMS
-- ============================================================

CREATE TABLE stock_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  category_id         UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_url           TEXT,
  current_qty         INTEGER NOT NULL DEFAULT 0 CHECK (current_qty >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 10,
  created_by          UUID NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_stock_items_category ON stock_items(category_id);
CREATE INDEX idx_stock_items_active ON stock_items(is_active);

-- ============================================================
-- STOCK LOGS (append-only audit trail)
-- ============================================================

CREATE TABLE stock_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_item_id  UUID NOT NULL REFERENCES stock_items(id),
  type           log_type NOT NULL,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  note           TEXT,
  performed_by   UUID NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for date-range queries (admin records view)
CREATE INDEX idx_stock_logs_created_at ON stock_logs(created_at);
CREATE INDEX idx_stock_logs_item ON stock_logs(stock_item_id);
CREATE INDEX idx_stock_logs_performed_by ON stock_logs(performed_by);

-- ============================================================
-- POSTGRES FUNCTION: consume_stock
-- Atomic qty check + deduct + log insert to prevent race conditions.
-- Called from Node backend instead of doing two separate queries.
-- Returns the updated current_qty.
-- ============================================================

CREATE OR REPLACE FUNCTION consume_stock(
  p_item_id     UUID,
  p_quantity    INTEGER,
  p_note        TEXT,
  p_user_id     UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_qty INTEGER;
  v_new_qty     INTEGER;
BEGIN
  -- Lock the row so concurrent requests wait
  SELECT current_qty INTO v_current_qty
  FROM stock_items
  WHERE id = p_item_id AND is_active = TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  v_new_qty := v_current_qty - p_quantity;

  IF v_new_qty <= 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  -- Deduct qty
  UPDATE stock_items
  SET current_qty = v_new_qty
  WHERE id = p_item_id;

  -- Insert log
  INSERT INTO stock_logs (stock_item_id, type, quantity, note, performed_by)
  VALUES (p_item_id, 'CONSUMED', p_quantity, p_note, p_user_id);

  RETURN v_new_qty;
END;
$$;

-- ============================================================
-- POSTGRES FUNCTION: receive_stock
-- Atomic qty add + log insert.
-- Returns the updated current_qty.
-- ============================================================

CREATE OR REPLACE FUNCTION receive_stock(
  p_item_id     UUID,
  p_quantity    INTEGER,
  p_note        TEXT,
  p_user_id     UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_qty INTEGER;
BEGIN
  UPDATE stock_items
  SET current_qty = current_qty + p_quantity
  WHERE id = p_item_id AND is_active = TRUE
  RETURNING current_qty INTO v_new_qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  INSERT INTO stock_logs (stock_item_id, type, quantity, note, performed_by)
  VALUES (p_item_id, 'RECEIVED', p_quantity, p_note, p_user_id);

  RETURN v_new_qty;
END;
$$;

-- ============================================================
-- DISABLE Row Level Security on all tables
-- We handle auth + access control in our Node backend.
-- ============================================================

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE stock_logs DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED: default admin user
-- After running this, create the matching auth user in Supabase
-- Auth dashboard with the same email and copy the UUID here.
-- OR use the create-admin script (see README).
-- ============================================================

-- INSERT INTO users (id, email, name, role)
-- VALUES ('PASTE-AUTH-UUID-HERE', 'admin@yourdomain.com', 'Admin', 'ADMIN');
