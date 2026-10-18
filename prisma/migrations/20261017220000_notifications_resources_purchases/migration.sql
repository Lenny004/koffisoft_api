-- Agrega notificaciones, recursos, órdenes de compra y recuperación de contraseña.

BEGIN;

-- Enums nuevos
CREATE TYPE notification_type AS ENUM (
  'low_stock',
  'lot_expiring',
  'supplier_reminder',
  'maintenance_due',
  'reservation_new',
  'contact_message',
  'backup_success',
  'backup_failed',
  'security_alert',
  'system'
);

CREATE TYPE notification_severity AS ENUM (
  'info',
  'warning',
  'error',
  'success'
);

CREATE TYPE resource_category AS ENUM (
  'equipment',
  'furniture',
  'supplies',
  'kitchenware',
  'electronics',
  'other'
);

CREATE TYPE resource_status AS ENUM (
  'operational',
  'maintenance',
  'broken',
  'retired'
);

CREATE TYPE purchase_order_status AS ENUM (
  'draft',
  'submitted',
  'approved',
  'received',
  'cancelled'
);

-- Extender suppliers con nuevos campos
ALTER TABLE suppliers
  ADD COLUMN delivery_days SMALLINT,
  ADD COLUMN order_reminder_days SMALLINT,
  ADD COLUMN last_order_date DATE,
  ADD COLUMN notes TEXT;

ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_delivery_days_check CHECK (delivery_days IS NULL OR delivery_days > 0),
  ADD CONSTRAINT suppliers_reminder_days_check CHECK (order_reminder_days IS NULL OR order_reminder_days > 0);

-- Notificaciones
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_role_code VARCHAR(40),
  notification_type notification_type NOT NULL,
  severity notification_severity NOT NULL,
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  internal_link VARCHAR(500),
  read_at TIMESTAMPTZ(3),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_unread_idx
  ON notifications(recipient_user_id, read_at, archived, created_at);
CREATE INDEX notifications_role_unread_idx
  ON notifications(recipient_role_code, read_at, archived, created_at);
CREATE INDEX notifications_type_idx
  ON notifications(notification_type, created_at);
CREATE INDEX notifications_severity_idx
  ON notifications(severity, created_at);

-- Recursos
CREATE TABLE resources (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  resource_code VARCHAR(40) NOT NULL,
  name VARCHAR(200) NOT NULL,
  category resource_category NOT NULL,
  location VARCHAR(200),
  status resource_status NOT NULL DEFAULT 'operational',
  purchase_date DATE,
  cost DECIMAL(14,2) CHECK (cost IS NULL OR cost >= 0),
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX resources_code_unique
  ON resources(location_id, resource_code);

-- Mantenimientos programados
CREATE TABLE resource_maintenance_schedules (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  description TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ(3),
  completed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE INDEX resource_maintenance_resource_date_idx
  ON resource_maintenance_schedules(resource_id, scheduled_date);
CREATE INDEX resource_maintenance_pending_idx
  ON resource_maintenance_schedules(completed, scheduled_date);

-- Órdenes de compra
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  order_number VARCHAR(80) NOT NULL,
  order_date DATE NOT NULL,
  expected_delivery DATE,
  status purchase_order_status NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(14,2) NOT NULL CHECK (total_amount >= 0),
  notes TEXT,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX purchase_orders_number_unique
  ON purchase_orders(location_id, order_number);
CREATE INDEX purchase_orders_supplier_date_idx
  ON purchase_orders(supplier_id, order_date);
CREATE INDEX purchase_orders_status_date_idx
  ON purchase_orders(status, order_date);

-- Líneas de órdenes de compra
CREATE TABLE purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  quantity_ordered DECIMAL(14,6) NOT NULL CHECK (quantity_ordered > 0),
  unit_cost DECIMAL(14,6) NOT NULL CHECK (unit_cost >= 0),
  total_cost DECIMAL(14,2) NOT NULL CHECK (total_cost >= 0)
);

-- Tokens de recuperación de contraseña
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuidv7(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  used_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX password_reset_tokens_hash_unique
  ON password_reset_tokens(token_hash);
CREATE INDEX password_reset_tokens_user_idx
  ON password_reset_tokens(user_id, expires_at);

-- Trigger de updated_at para nuevas tablas
CREATE TRIGGER set_resources_updated_at
  BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
