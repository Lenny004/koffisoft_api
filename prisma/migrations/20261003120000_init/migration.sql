-- Koffi-Soft — migración inicial de PostgreSQL
-- DDL completo sin datos demo. Las columnas de secretos solo contienen
-- material cifrado o hashes y las claves permanecen fuera de PostgreSQL.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TYPE employee_status AS ENUM ('active', 'inactive', 'on_leave');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'locked');
CREATE TYPE job_code AS ENUM ('manager', 'cashier', 'server', 'cook', 'barista', 'inventory');
CREATE TYPE shift_status AS ENUM ('planned', 'started', 'finished', 'absent', 'cancelled');
CREATE TYPE customer_type AS ENUM ('person', 'business');
CREATE TYPE customer_document_type AS ENUM ('dui', 'nit', 'nrc', 'passport', 'residence_card', 'other');
CREATE TYPE menu_item_type AS ENUM ('food', 'beverage', 'dessert', 'service');
CREATE TYPE menu_channel AS ENUM ('pos', 'web', 'event', 'takeaway');
CREATE TYPE promotion_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'expired');
CREATE TYPE promotion_channel AS ENUM ('pos', 'web', 'all');
CREATE TYPE reservation_status AS ENUM (
    'requested',
    'pending_confirmation',
    'confirmed',
    'seated',
    'completed',
    'cancelled',
    'no_show',
    'expired'
);
CREATE TYPE reservation_source AS ENUM ('web', 'phone', 'whatsapp', 'admin', 'walk_in');
CREATE TYPE reservation_table_status AS ENUM ('held', 'assigned', 'released');
CREATE TYPE event_type AS ENUM ('wedding', 'birthday', 'corporate', 'meeting', 'anniversary', 'other');
CREATE TYPE event_status AS ENUM (
    'inquiry',
    'quoted',
    'negotiating',
    'tentative',
    'confirmed',
    'in_progress',
    'completed',
    'cancelled',
    'lost'
);
CREATE TYPE event_space_booking_status AS ENUM ('held', 'confirmed', 'released');
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled');
CREATE TYPE event_quote_line_type AS ENUM (
    'menu',
    'beverage',
    'venue',
    'decoration',
    'staffing',
    'service',
    'other'
);
CREATE TYPE order_service_type AS ENUM ('dine_in', 'takeaway', 'catering', 'event');
CREATE TYPE order_source AS ENUM ('pos', 'web', 'phone', 'admin');
CREATE TYPE order_status AS ENUM (
    'open',
    'sent',
    'preparing',
    'ready',
    'served',
    'partially_paid',
    'paid',
    'voided'
);
CREATE TYPE order_line_status AS ENUM ('open', 'sent', 'preparing', 'ready', 'served', 'voided');
CREATE TYPE kitchen_ticket_status AS ENUM ('queued', 'preparing', 'ready', 'served', 'cancelled');
CREATE TYPE payment_method_type AS ENUM ('cash', 'card', 'bank_transfer', 'mobile_wallet', 'other');
CREATE TYPE payment_status AS ENUM ('pending', 'captured', 'failed', 'refunded', 'voided');
CREATE TYPE tip_status AS ENUM ('accepted', 'partially_distributed', 'distributed', 'cancelled', 'refunded');
CREATE TYPE tip_distribution_status AS ENUM ('pending', 'paid', 'cancelled');
CREATE TYPE cash_session_status AS ENUM ('open', 'closed');
CREATE TYPE cash_movement_type AS ENUM ('opening', 'sale', 'deposit', 'withdrawal', 'refund', 'adjustment');
CREATE TYPE inventory_movement_type AS ENUM (
    'receipt',
    'sale_consumption',
    'waste',
    'adjustment_in',
    'adjustment_out'
);
CREATE TYPE dte_status AS ENUM (
    'draft',
    'signed',
    'transmitted',
    'accepted',
    'rejected',
    'contingency',
    'invalidated'
);
CREATE TYPE dte_event_type AS ENUM (
    'generated',
    'signed',
    'transmitted',
    'accepted',
    'rejected',
    'contingency',
    'invalidated'
);
CREATE TYPE contact_message_status AS ENUM ('new', 'in_progress', 'replied', 'closed', 'spam');

CREATE TYPE mfa_factor_type AS ENUM ('totp');
CREATE TYPE mfa_factor_status AS ENUM ('pending', 'active', 'disabled');
CREATE TYPE auth_event_type AS ENUM (
    'login_succeeded',
    'login_failed',
    'mfa_succeeded',
    'mfa_failed',
    'account_locked',
    'password_changed',
    'mfa_factor_created',
    'mfa_factor_verified',
    'mfa_factor_disabled',
    'recovery_code_used',
    'session_created',
    'session_revoked'
);

CREATE TABLE businesses (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    legal_name varchar(200) NOT NULL,
    trade_name varchar(200) NOT NULL,
    tax_id varchar(40) NOT NULL,
    nrc varchar(40),
    economic_activity_code varchar(40),
    address_line text NOT NULL,
    municipality varchar(120) NOT NULL,
    department varchar(120) NOT NULL,
    phone varchar(40),
    email varchar(200),
    country_code char(2) NOT NULL DEFAULT 'SV' CHECK (country_code = 'SV'),
    base_currency char(3) NOT NULL DEFAULT 'USD' CHECK (base_currency = 'USD'),
    timezone varchar(64) NOT NULL DEFAULT 'America/El_Salvador',
    dte_environment varchar(20) NOT NULL DEFAULT 'test'
        CHECK (dte_environment IN ('test', 'production')),
    dte_enabled boolean NOT NULL DEFAULT false,
    dte_certificate_ref text,
    dte_private_key_ref text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE locations (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    code varchar(30) NOT NULL,
    name varchar(150) NOT NULL,
    address_line text NOT NULL,
    municipality varchar(120) NOT NULL,
    department varchar(120) NOT NULL,
    country_code char(2) NOT NULL DEFAULT 'SV' CHECK (country_code = 'SV'),
    phone varchar(40),
    email varchar(200),
    latitude numeric(9, 6),
    longitude numeric(9, 6),
    timezone varchar(64) NOT NULL DEFAULT 'America/El_Salvador',
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT locations_code_unique UNIQUE (business_id, code),
    CONSTRAINT locations_latitude_check CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT locations_longitude_check CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE TABLE location_hours (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    service_type varchar(30) NOT NULL
        CHECK (service_type IN ('restaurant', 'breakfast', 'reservations', 'events')),
    day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    opens_at time NOT NULL,
    closes_at time NOT NULL,
    crosses_midnight boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT location_hours_time_check CHECK (
        opens_at <> closes_at
        AND (crosses_midnight OR closes_at > opens_at)
    ),
    CONSTRAINT location_hours_unique UNIQUE (
        location_id,
        service_type,
        day_of_week,
        opens_at
    )
);

CREATE TABLE location_hour_overrides (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    service_date date NOT NULL,
    service_type varchar(30) NOT NULL
        CHECK (service_type IN ('restaurant', 'breakfast', 'reservations', 'events')),
    opens_at time,
    closes_at time,
    is_closed boolean NOT NULL DEFAULT false,
    reason text NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT location_hour_overrides_time_check CHECK (
        is_closed OR (opens_at IS NOT NULL AND closes_at IS NOT NULL AND opens_at <> closes_at)
    ),
    CONSTRAINT location_hour_overrides_unique UNIQUE (location_id, service_date, service_type)
);

CREATE TABLE employees (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    employee_code varchar(30) NOT NULL,
    first_name varchar(80) NOT NULL,
    last_name varchar(80) NOT NULL,
    job_code job_code NOT NULL,
    status employee_status NOT NULL DEFAULT 'active',
    phone varchar(40),
    email varchar(200),
    hire_date date NOT NULL,
    termination_date date,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT employees_code_unique UNIQUE (location_id, employee_code),
    CONSTRAINT employees_dates_check CHECK (
        termination_date IS NULL OR termination_date >= hire_date
    )
);

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    employee_id uuid UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
    username varchar(100) NOT NULL,
    email varchar(200) NOT NULL,
    password_hash varchar(255) NOT NULL,
    status user_status NOT NULL DEFAULT 'active',
    password_changed_at timestamptz(3) NOT NULL DEFAULT now(),
    email_verified_at timestamptz(3),
    failed_login_attempts smallint NOT NULL DEFAULT 0
        CHECK (failed_login_attempts >= 0),
    locked_at timestamptz(3),
    locked_until timestamptz(3),
    last_failed_login_at timestamptz(3),
    last_login_at timestamptz(3),
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT users_password_hash_algorithm_check CHECK (password_hash LIKE '$argon2id$%'),
    CONSTRAINT users_lock_dates_check CHECK (
        locked_until IS NULL OR (locked_at IS NOT NULL AND locked_until > locked_at)
    ),
    CONSTRAINT users_locked_status_check CHECK (
        status <> 'locked' OR locked_at IS NOT NULL
    )
);

CREATE TABLE roles (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    code varchar(40) NOT NULL,
    name varchar(100) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT roles_code_unique UNIQUE (business_id, code)
);

CREATE TABLE user_roles (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at timestamptz(3) NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE permissions (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    code varchar(100) NOT NULL,
    description varchar(255) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT permissions_code_format_check CHECK (
        code ~ '^[a-z][a-z0-9_.-]+$'
    ),
    CONSTRAINT permissions_code_unique UNIQUE (code)
);

CREATE TABLE role_permissions (
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    assigned_at timestamptz(3) NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_mfa_factors (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    factor_type mfa_factor_type NOT NULL DEFAULT 'totp',
    label varchar(100) NOT NULL,
    status mfa_factor_status NOT NULL DEFAULT 'pending',
    secret_ciphertext bytea NOT NULL,
    secret_iv bytea NOT NULL,
    secret_auth_tag bytea NOT NULL,
    key_version smallint NOT NULL CHECK (key_version > 0),
    verified_at timestamptz(3),
    last_used_time_step bigint,
    disabled_at timestamptz(3),
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT user_mfa_factors_ciphertext_check CHECK (
        octet_length(secret_ciphertext) > 0
        AND octet_length(secret_iv) = 12
        AND octet_length(secret_auth_tag) = 16
    ),
    CONSTRAINT user_mfa_factors_step_check CHECK (
        last_used_time_step IS NULL OR last_used_time_step >= 0
    ),
    CONSTRAINT user_mfa_factors_status_dates_check CHECK (
        (status = 'pending' AND verified_at IS NULL AND disabled_at IS NULL)
        OR (status = 'active' AND verified_at IS NOT NULL AND disabled_at IS NULL)
        OR (status = 'disabled' AND disabled_at IS NOT NULL)
    )
);

CREATE TABLE user_mfa_recovery_codes (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash varchar(255) NOT NULL,
    used_at timestamptz(3),
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT user_mfa_recovery_codes_hash_unique UNIQUE (user_id, code_hash)
);

CREATE TABLE user_sessions (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash char(64) NOT NULL,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    expires_at timestamptz(3) NOT NULL,
    revoked_at timestamptz(3),
    last_used_at timestamptz(3),
    ip_address inet,
    user_agent text,
    mfa_verified boolean NOT NULL DEFAULT false,
    revoked_reason varchar(120),
    CONSTRAINT user_sessions_token_hash_check CHECK (
        session_token_hash ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT user_sessions_expiry_check CHECK (expires_at > created_at),
    CONSTRAINT user_sessions_revocation_check CHECK (
        revoked_at IS NULL OR revoked_at >= created_at
    ),
    CONSTRAINT user_sessions_last_used_check CHECK (
        last_used_at IS NULL OR last_used_at >= created_at
    ),
    CONSTRAINT user_sessions_revoked_reason_check CHECK (
        revoked_at IS NOT NULL OR revoked_reason IS NULL
    ),
    CONSTRAINT user_sessions_token_hash_unique UNIQUE (session_token_hash)
);

CREATE TABLE auth_events (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    session_id uuid REFERENCES user_sessions(id) ON DELETE SET NULL,
    event_type auth_event_type NOT NULL,
    ip_address inet,
    user_agent text,
    request_id varchar(100),
    details jsonb,
    occurred_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE shifts (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    business_date date NOT NULL,
    starts_at timestamptz(3) NOT NULL,
    ends_at timestamptz(3) NOT NULL,
    status shift_status NOT NULL DEFAULT 'planned',
    notes text,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT shifts_time_check CHECK (ends_at > starts_at)
);

CREATE TABLE shift_assignments (
    shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    assigned_at timestamptz(3) NOT NULL DEFAULT now(),
    PRIMARY KEY (shift_id, employee_id)
);

CREATE TABLE audit_logs (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    action varchar(60) NOT NULL,
    entity_type varchar(80) NOT NULL,
    entity_id uuid,
    before_data jsonb,
    after_data jsonb,
    request_id varchar(100),
    ip_address inet,
    created_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE prep_stations (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    code varchar(30) NOT NULL,
    name varchar(100) NOT NULL,
    station_type varchar(30) NOT NULL
        CHECK (station_type IN ('kitchen', 'coffee_bar', 'dessert', 'service_bar', 'dispatch')),
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT prep_stations_code_unique UNIQUE (location_id, code)
);

CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    customer_type customer_type NOT NULL DEFAULT 'person',
    display_name varchar(200) NOT NULL,
    phone varchar(40),
    email varchar(200),
    preferred_language char(2) NOT NULL DEFAULT 'es'
        CHECK (preferred_language IN ('es', 'en')),
    marketing_opt_in boolean NOT NULL DEFAULT false,
    marketing_consent_at timestamptz(3),
    notes text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE customer_documents (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    document_type customer_document_type NOT NULL,
    country_code char(2),
    document_number varchar(80) NOT NULL,
    holder_name varchar(200),
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT customer_documents_unique UNIQUE (document_type, country_code, document_number)
);

CREATE TABLE tax_rates (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    code varchar(30) NOT NULL,
    name varchar(100) NOT NULL,
    rate numeric(7, 6) NOT NULL CHECK (rate BETWEEN 0 AND 1),
    valid_from date NOT NULL,
    valid_to date,
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT tax_rates_dates_check CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT tax_rates_code_date_unique UNIQUE (code, valid_from)
);

CREATE TABLE menu_categories (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    slug varchar(120) NOT NULL,
    name_es varchar(120) NOT NULL,
    name_en varchar(120) NOT NULL,
    description_es text,
    description_en text,
    display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT menu_categories_slug_unique UNIQUE (location_id, slug)
);

CREATE TABLE menu_items (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    category_id uuid NOT NULL REFERENCES menu_categories(id) ON DELETE RESTRICT,
    sku varchar(50) NOT NULL,
    slug varchar(160) NOT NULL,
    item_type menu_item_type NOT NULL,
    name_es varchar(160) NOT NULL,
    name_en varchar(160) NOT NULL,
    description_es text,
    description_en text,
    public_visible boolean NOT NULL DEFAULT true,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT menu_items_sku_unique UNIQUE (sku),
    CONSTRAINT menu_items_slug_unique UNIQUE (category_id, slug)
);

CREATE TABLE menu_item_variants (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
    prep_station_id uuid NOT NULL REFERENCES prep_stations(id) ON DELETE RESTRICT,
    sku varchar(60) NOT NULL,
    name_es varchar(100) NOT NULL,
    name_en varchar(100) NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT menu_item_variants_sku_unique UNIQUE (sku),
    CONSTRAINT menu_item_variants_name_unique UNIQUE (menu_item_id, name_es)
);

CREATE TABLE menu_prices (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    variant_id uuid NOT NULL REFERENCES menu_item_variants(id) ON DELETE RESTRICT,
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    channel menu_channel NOT NULL,
    price numeric(14, 2) NOT NULL CHECK (price >= 0),
    currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
    includes_tax boolean NOT NULL DEFAULT true,
    tax_rate_id uuid NOT NULL REFERENCES tax_rates(id) ON DELETE RESTRICT,
    valid_from date NOT NULL,
    valid_to date,
    active boolean NOT NULL DEFAULT true,
    valid_during daterange GENERATED ALWAYS AS (
        daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[)')
    ) STORED,
    CONSTRAINT menu_prices_dates_check CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE TABLE menu_availability (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    variant_id uuid NOT NULL REFERENCES menu_item_variants(id) ON DELETE CASCADE,
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    channel menu_channel NOT NULL,
    day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    starts_at time NOT NULL,
    ends_at time NOT NULL,
    crosses_midnight boolean NOT NULL DEFAULT false,
    valid_from date,
    valid_to date,
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT menu_availability_time_check CHECK (
        starts_at <> ends_at
        AND (crosses_midnight OR ends_at > starts_at)
    ),
    CONSTRAINT menu_availability_dates_check CHECK (
        valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from
    )
);

CREATE TABLE menu_item_outages (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    variant_id uuid NOT NULL REFERENCES menu_item_variants(id) ON DELETE RESTRICT,
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    starts_at timestamptz(3) NOT NULL,
    ends_at timestamptz(3),
    reason varchar(200) NOT NULL,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT menu_item_outages_time_check CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE modifier_groups (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    code varchar(40) NOT NULL,
    name_es varchar(120) NOT NULL,
    name_en varchar(120) NOT NULL,
    selection_min smallint NOT NULL DEFAULT 0 CHECK (selection_min >= 0),
    selection_max smallint NOT NULL DEFAULT 1 CHECK (selection_max >= selection_min),
    required boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT modifier_groups_code_unique UNIQUE (location_id, code)
);

CREATE TABLE modifiers (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    code varchar(40) NOT NULL,
    name_es varchar(120) NOT NULL,
    name_en varchar(120) NOT NULL,
    price_delta numeric(14, 2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT modifiers_code_unique UNIQUE (modifier_group_id, code)
);

CREATE TABLE menu_item_modifier_groups (
    variant_id uuid NOT NULL REFERENCES menu_item_variants(id) ON DELETE CASCADE,
    modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    selection_min smallint,
    selection_max smallint,
    display_order smallint NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    PRIMARY KEY (variant_id, modifier_group_id),
    CONSTRAINT menu_item_modifier_groups_min_check CHECK (
        selection_min IS NULL OR selection_min >= 0
    ),
    CONSTRAINT menu_item_modifier_groups_max_check CHECK (
        selection_max IS NULL OR selection_max >= COALESCE(selection_min, 0)
    )
);

CREATE TABLE promotions (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    code varchar(50),
    name_es varchar(160) NOT NULL,
    name_en varchar(160) NOT NULL,
    description_es text,
    description_en text,
    status promotion_status NOT NULL DEFAULT 'draft',
    channel promotion_channel NOT NULL DEFAULT 'all',
    discount_type varchar(20) NOT NULL
        CHECK (discount_type IN ('percentage', 'fixed_amount', 'informational')),
    discount_value numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
    starts_at timestamptz(3) NOT NULL,
    ends_at timestamptz(3) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT promotions_dates_check CHECK (ends_at > starts_at),
    CONSTRAINT promotions_percentage_check CHECK (
        discount_type <> 'percentage' OR discount_value <= 100
    ),
    CONSTRAINT promotions_code_unique UNIQUE (location_id, code)
);

CREATE TABLE promotion_items (
    promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    variant_id uuid NOT NULL REFERENCES menu_item_variants(id) ON DELETE RESTRICT,
    PRIMARY KEY (promotion_id, variant_id)
);

CREATE TABLE ingredient_categories (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    name varchar(100) NOT NULL UNIQUE,
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE units (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    code varchar(20) NOT NULL UNIQUE,
    name varchar(80) NOT NULL,
    precision_scale smallint NOT NULL DEFAULT 3 CHECK (precision_scale BETWEEN 0 AND 6),
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE ingredients (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    category_id uuid NOT NULL REFERENCES ingredient_categories(id) ON DELETE RESTRICT,
    base_unit_id uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    sku varchar(50) NOT NULL UNIQUE,
    name varchar(160) NOT NULL UNIQUE,
    description text,
    reorder_level numeric(14, 6) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    track_lots boolean NOT NULL DEFAULT true,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    supplier_code varchar(40) NOT NULL,
    name varchar(200) NOT NULL,
    tax_id varchar(40),
    phone varchar(40),
    email varchar(200),
    address_line text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT suppliers_code_unique UNIQUE (location_id, supplier_code)
);

CREATE TABLE ingredient_suppliers (
    ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    supplier_sku varchar(60),
    pack_quantity numeric(14, 6) NOT NULL CHECK (pack_quantity > 0),
    pack_unit_id uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    unit_cost numeric(14, 6) NOT NULL CHECK (unit_cost >= 0),
    is_preferred boolean NOT NULL DEFAULT false,
    PRIMARY KEY (ingredient_id, supplier_id)
);

CREATE TABLE storage_locations (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    code varchar(40) NOT NULL,
    name varchar(100) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT storage_locations_code_unique UNIQUE (location_id, code)
);

CREATE TABLE inventory_lots (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    storage_location_id uuid NOT NULL REFERENCES storage_locations(id) ON DELETE RESTRICT,
    ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
    lot_code varchar(80) NOT NULL,
    received_on date NOT NULL,
    expires_on date,
    quantity_received numeric(14, 6) NOT NULL CHECK (quantity_received > 0),
    unit_cost numeric(14, 6) NOT NULL CHECK (unit_cost >= 0),
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT inventory_lots_dates_check CHECK (
        expires_on IS NULL OR expires_on >= received_on
    ),
    CONSTRAINT inventory_lots_code_unique UNIQUE (storage_location_id, ingredient_id, lot_code)
);

CREATE TABLE goods_receipts (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
    receipt_number varchar(50) NOT NULL,
    received_at timestamptz(3) NOT NULL,
    received_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    notes text,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT goods_receipts_number_unique UNIQUE (location_id, receipt_number)
);

CREATE TABLE goods_receipt_lines (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    goods_receipt_id uuid NOT NULL REFERENCES goods_receipts(id) ON DELETE RESTRICT,
    ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    inventory_lot_id uuid NOT NULL REFERENCES inventory_lots(id) ON DELETE RESTRICT,
    unit_id uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    quantity_received numeric(14, 6) NOT NULL CHECK (quantity_received > 0),
    unit_cost numeric(14, 6) NOT NULL CHECK (unit_cost >= 0),
    total_cost numeric(14, 2) NOT NULL CHECK (total_cost >= 0),
    CONSTRAINT goods_receipt_lines_total_check CHECK (
        total_cost >= round(quantity_received * unit_cost, 2) - 0.01
        AND total_cost <= round(quantity_received * unit_cost, 2) + 0.01
    )
);

CREATE TABLE recipes (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    menu_item_variant_id uuid NOT NULL REFERENCES menu_item_variants(id) ON DELETE RESTRICT,
    version_no integer NOT NULL CHECK (version_no > 0),
    effective_from date NOT NULL,
    effective_to date,
    yield_quantity numeric(14, 6) NOT NULL DEFAULT 1 CHECK (yield_quantity > 0),
    yield_unit_id uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    notes text,
    active boolean NOT NULL DEFAULT true,
    effective_during daterange GENERATED ALWAYS AS (
        daterange(effective_from, COALESCE(effective_to, 'infinity'::date), '[)')
    ) STORED,
    CONSTRAINT recipes_version_unique UNIQUE (menu_item_variant_id, version_no),
    CONSTRAINT recipes_dates_check CHECK (
        effective_to IS NULL OR effective_to > effective_from
    )
);

CREATE TABLE recipe_lines (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    recipe_id uuid NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
    ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    unit_id uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
    quantity numeric(14, 6) NOT NULL CHECK (quantity > 0),
    notes text,
    CONSTRAINT recipe_lines_ingredient_unique UNIQUE (recipe_id, ingredient_id)
);

CREATE TABLE allergens (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    code varchar(40) NOT NULL UNIQUE,
    name_es varchar(100) NOT NULL,
    name_en varchar(100) NOT NULL,
    active boolean NOT NULL DEFAULT true
);

CREATE TABLE ingredient_allergens (
    ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    allergen_id uuid NOT NULL REFERENCES allergens(id) ON DELETE RESTRICT,
    presence_type varchar(20) NOT NULL
        CHECK (presence_type IN ('contains', 'may_contain')),
    PRIMARY KEY (ingredient_id, allergen_id)
);

CREATE TABLE venue_spaces (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    code varchar(40) NOT NULL,
    name_es varchar(120) NOT NULL,
    name_en varchar(120) NOT NULL,
    space_type varchar(30) NOT NULL
        CHECK (space_type IN ('indoor', 'terrace', 'viewpoint', 'private_room', 'garden', 'other')),
    seated_capacity smallint NOT NULL CHECK (seated_capacity > 0),
    standing_capacity smallint CHECK (standing_capacity IS NULL OR standing_capacity >= seated_capacity),
    allows_table_reservation boolean NOT NULL DEFAULT true,
    allows_private_event boolean NOT NULL DEFAULT false,
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT venue_spaces_code_unique UNIQUE (location_id, code)
);

CREATE TABLE dining_tables (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    space_id uuid NOT NULL REFERENCES venue_spaces(id) ON DELETE RESTRICT,
    table_code varchar(30) NOT NULL,
    name varchar(80) NOT NULL,
    seat_count smallint NOT NULL CHECK (seat_count > 0),
    shape varchar(20) NOT NULL DEFAULT 'round'
        CHECK (shape IN ('round', 'square', 'rectangular', 'communal')),
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT dining_tables_code_unique UNIQUE (space_id, table_code)
);

CREATE TABLE reservations (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    reservation_code varchar(50) NOT NULL,
    contact_name_snapshot varchar(200) NOT NULL,
    contact_phone_snapshot varchar(40) NOT NULL,
    contact_email_snapshot varchar(200),
    preferred_language char(2) NOT NULL DEFAULT 'es'
        CHECK (preferred_language IN ('es', 'en')),
    starts_at timestamptz(3) NOT NULL,
    ends_at timestamptz(3) NOT NULL,
    party_size smallint NOT NULL CHECK (party_size > 0),
    status reservation_status NOT NULL DEFAULT 'requested',
    source reservation_source NOT NULL,
    preferred_space_id uuid REFERENCES venue_spaces(id) ON DELETE SET NULL,
    special_requests text,
    internal_notes text,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    confirmed_at timestamptz(3),
    seated_at timestamptz(3),
    completed_at timestamptz(3),
    cancelled_at timestamptz(3),
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT reservations_time_check CHECK (ends_at > starts_at),
    CONSTRAINT reservations_code_unique UNIQUE (location_id, reservation_code)
);

CREATE TABLE reservation_tables (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    reservation_id uuid NOT NULL REFERENCES reservations(id) ON DELETE RESTRICT,
    dining_table_id uuid NOT NULL REFERENCES dining_tables(id) ON DELETE RESTRICT,
    starts_at timestamptz(3) NOT NULL,
    ends_at timestamptz(3) NOT NULL,
    allocation_status reservation_table_status NOT NULL DEFAULT 'held',
    assigned_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    assigned_at timestamptz(3) NOT NULL DEFAULT now(),
    reserved_during tstzrange GENERATED ALWAYS AS (
        tstzrange(starts_at, ends_at, '[)')
    ) STORED,
    CONSTRAINT reservation_tables_time_check CHECK (ends_at > starts_at)
);

CREATE TABLE events (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    event_code varchar(50) NOT NULL,
    event_type event_type NOT NULL,
    title varchar(200) NOT NULL,
    contact_name_snapshot varchar(200) NOT NULL,
    contact_phone_snapshot varchar(40) NOT NULL,
    contact_email_snapshot varchar(200),
    preferred_language char(2) NOT NULL DEFAULT 'es'
        CHECK (preferred_language IN ('es', 'en')),
    starts_at timestamptz(3) NOT NULL,
    ends_at timestamptz(3) NOT NULL,
    setup_starts_at timestamptz(3),
    estimated_guest_count smallint NOT NULL CHECK (estimated_guest_count > 0),
    confirmed_guest_count smallint CHECK (
        confirmed_guest_count IS NULL OR confirmed_guest_count > 0
    ),
    budget_target numeric(14, 2) CHECK (budget_target IS NULL OR budget_target >= 0),
    status event_status NOT NULL DEFAULT 'inquiry',
    source varchar(30) NOT NULL DEFAULT 'web'
        CHECK (source IN ('web', 'phone', 'whatsapp', 'admin', 'referral')),
    special_requirements text,
    internal_notes text,
    coordinator_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT events_time_check CHECK (ends_at > starts_at),
    CONSTRAINT events_setup_check CHECK (
        setup_starts_at IS NULL OR setup_starts_at < starts_at
    ),
    CONSTRAINT events_confirmed_guest_check CHECK (
        confirmed_guest_count IS NULL OR confirmed_guest_count <= estimated_guest_count
    ),
    CONSTRAINT events_code_unique UNIQUE (location_id, event_code)
);

CREATE TABLE event_space_bookings (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    venue_space_id uuid NOT NULL REFERENCES venue_spaces(id) ON DELETE RESTRICT,
    starts_at timestamptz(3) NOT NULL,
    ends_at timestamptz(3) NOT NULL,
    setup_starts_at timestamptz(3),
    teardown_ends_at timestamptz(3),
    booking_status event_space_booking_status NOT NULL DEFAULT 'held',
    capacity_reserved smallint NOT NULL CHECK (capacity_reserved > 0),
    hold_expires_at timestamptz(3),
    blocked_during tstzrange GENERATED ALWAYS AS (
        tstzrange(
            COALESCE(setup_starts_at, starts_at),
            COALESCE(teardown_ends_at, ends_at),
            '[)'
        )
    ) STORED,
    CONSTRAINT event_space_bookings_time_check CHECK (ends_at > starts_at),
    CONSTRAINT event_space_bookings_setup_check CHECK (
        setup_starts_at IS NULL OR setup_starts_at < starts_at
    ),
    CONSTRAINT event_space_bookings_teardown_check CHECK (
        teardown_ends_at IS NULL OR teardown_ends_at > ends_at
    )
);

CREATE TABLE event_packages (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    package_code varchar(50) NOT NULL,
    name_es varchar(160) NOT NULL,
    name_en varchar(160) NOT NULL,
    description_es text,
    description_en text,
    pricing_model varchar(20) NOT NULL
        CHECK (pricing_model IN ('per_person', 'flat', 'hourly')),
    base_price numeric(14, 2) NOT NULL CHECK (base_price >= 0),
    min_guest_count smallint CHECK (min_guest_count IS NULL OR min_guest_count > 0),
    max_guest_count smallint CHECK (max_guest_count IS NULL OR max_guest_count > 0),
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT event_packages_guest_range_check CHECK (
        max_guest_count IS NULL OR min_guest_count IS NULL OR max_guest_count >= min_guest_count
    ),
    CONSTRAINT event_packages_code_unique UNIQUE (location_id, package_code)
);

CREATE TABLE event_package_lines (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    event_package_id uuid NOT NULL REFERENCES event_packages(id) ON DELETE CASCADE,
    line_type event_quote_line_type NOT NULL,
    menu_item_variant_id uuid REFERENCES menu_item_variants(id) ON DELETE SET NULL,
    label_es varchar(200) NOT NULL,
    label_en varchar(200) NOT NULL,
    quantity numeric(14, 6) NOT NULL CHECK (quantity > 0),
    unit varchar(40) NOT NULL,
    unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
    sort_order smallint NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT event_package_lines_variant_check CHECK (
        line_type NOT IN ('menu', 'beverage') OR menu_item_variant_id IS NOT NULL
    )
);

CREATE TABLE event_quotes (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    event_package_id uuid REFERENCES event_packages(id) ON DELETE SET NULL,
    version_no integer NOT NULL CHECK (version_no > 0),
    status quote_status NOT NULL DEFAULT 'draft',
    currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
    valid_until date NOT NULL,
    subtotal_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
    discount_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    taxable_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (taxable_amount >= 0),
    tax_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    terms_es text,
    terms_en text,
    sent_at timestamptz(3),
    accepted_at timestamptz(3),
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT event_quotes_totals_check CHECK (
        discount_amount <= subtotal_amount
        AND taxable_amount = subtotal_amount - discount_amount
        AND total_amount = taxable_amount + tax_amount
    ),
    CONSTRAINT event_quotes_version_unique UNIQUE (event_id, version_no)
);

CREATE TABLE event_quote_lines (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    event_quote_id uuid NOT NULL REFERENCES event_quotes(id) ON DELETE RESTRICT,
    event_package_line_id uuid REFERENCES event_package_lines(id) ON DELETE SET NULL,
    menu_item_variant_id uuid REFERENCES menu_item_variants(id) ON DELETE SET NULL,
    line_type event_quote_line_type NOT NULL,
    label_es varchar(200) NOT NULL,
    label_en varchar(200) NOT NULL,
    quantity numeric(14, 6) NOT NULL CHECK (quantity > 0),
    unit varchar(40) NOT NULL,
    unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
    discount_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_rate numeric(7, 6) NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 1),
    taxable_amount numeric(14, 2) NOT NULL CHECK (taxable_amount >= 0),
    tax_amount numeric(14, 2) NOT NULL CHECK (tax_amount >= 0),
    line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
    sort_order smallint NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    CONSTRAINT event_quote_lines_variant_check CHECK (
        line_type NOT IN ('menu', 'beverage') OR menu_item_variant_id IS NOT NULL
    ),
    CONSTRAINT event_quote_lines_total_check CHECK (
        line_total = taxable_amount + tax_amount
    )
);

CREATE TABLE event_requirements (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    event_id uuid NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    requirement_type varchar(30) NOT NULL
        CHECK (requirement_type IN ('allergy', 'diet', 'accessibility', 'equipment', 'schedule', 'other')),
    description text NOT NULL,
    guest_count smallint CHECK (guest_count IS NULL OR guest_count > 0),
    severity varchar(20) NOT NULL DEFAULT 'important'
        CHECK (severity IN ('informational', 'important', 'critical')),
    status varchar(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'acknowledged', 'resolved')),
    resolved_at timestamptz(3),
    created_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    order_number bigint GENERATED BY DEFAULT AS IDENTITY,
    business_date date NOT NULL,
    service_type order_service_type NOT NULL,
    source order_source NOT NULL DEFAULT 'pos',
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
    event_id uuid REFERENCES events(id) ON DELETE SET NULL,
    server_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
    status order_status NOT NULL DEFAULT 'open',
    currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
    subtotal_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
    discount_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    service_charge_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (service_charge_amount >= 0),
    tip_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tip_amount >= 0),
    total_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    balance_due numeric(14, 2) NOT NULL DEFAULT 0 CHECK (balance_due >= 0),
    notes text,
    opened_at timestamptz(3) NOT NULL DEFAULT now(),
    closed_at timestamptz(3),
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT orders_totals_check CHECK (
        discount_amount <= subtotal_amount
        AND total_amount = subtotal_amount - discount_amount
            + tax_amount + service_charge_amount + tip_amount
        AND balance_due <= total_amount
    ),
    CONSTRAINT orders_close_check CHECK (closed_at IS NULL OR closed_at >= opened_at),
    CONSTRAINT orders_number_unique UNIQUE (location_id, order_number)
);

CREATE TABLE order_table_assignments (
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    dining_table_id uuid NOT NULL REFERENCES dining_tables(id) ON DELETE RESTRICT,
    is_primary boolean NOT NULL DEFAULT false,
    assigned_at timestamptz(3) NOT NULL DEFAULT now(),
    PRIMARY KEY (order_id, dining_table_id)
);

CREATE TABLE order_lines (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    line_no smallint NOT NULL CHECK (line_no > 0),
    menu_item_variant_id uuid REFERENCES menu_item_variants(id) ON DELETE SET NULL,
    recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
    item_name_snapshot varchar(200) NOT NULL,
    variant_name_snapshot varchar(120) NOT NULL,
    sku_snapshot varchar(60) NOT NULL,
    quantity numeric(14, 6) NOT NULL CHECK (quantity > 0),
    unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
    includes_tax boolean NOT NULL DEFAULT true,
    tax_rate numeric(7, 6) NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 1),
    gross_amount numeric(14, 2) NOT NULL CHECK (gross_amount >= 0),
    discount_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    taxable_amount numeric(14, 2) NOT NULL CHECK (taxable_amount >= 0),
    tax_amount numeric(14, 2) NOT NULL CHECK (tax_amount >= 0),
    total_amount numeric(14, 2) NOT NULL CHECK (total_amount >= 0),
    status order_line_status NOT NULL DEFAULT 'open',
    special_instructions text,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT order_lines_number_unique UNIQUE (order_id, line_no),
    CONSTRAINT order_lines_discount_check CHECK (discount_amount <= gross_amount),
    CONSTRAINT order_lines_total_check CHECK (
        total_amount = taxable_amount + tax_amount
        AND total_amount = gross_amount - discount_amount
    )
);

CREATE TABLE order_line_modifiers (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    order_line_id uuid NOT NULL REFERENCES order_lines(id) ON DELETE RESTRICT,
    modifier_id uuid REFERENCES modifiers(id) ON DELETE SET NULL,
    name_snapshot varchar(120) NOT NULL,
    quantity numeric(14, 6) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    price_delta numeric(14, 2) NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
    total_delta numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total_delta >= 0),
    notes text,
    CONSTRAINT order_line_modifiers_total_check CHECK (
        total_delta = round(quantity * price_delta, 2)
    )
);

CREATE TABLE order_adjustments (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    adjustment_type varchar(20) NOT NULL
        CHECK (adjustment_type IN ('discount', 'service_charge')),
    description varchar(200) NOT NULL,
    rate numeric(7, 6) CHECK (rate IS NULL OR rate BETWEEN 0 AND 1),
    amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
    promotion_id uuid REFERENCES promotions(id) ON DELETE SET NULL,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE kitchen_tickets (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    order_id uuid NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
    prep_station_id uuid NOT NULL REFERENCES prep_stations(id) ON DELETE RESTRICT,
    ticket_number integer NOT NULL,
    status kitchen_ticket_status NOT NULL DEFAULT 'queued',
    sent_at timestamptz(3) NOT NULL DEFAULT now(),
    started_at timestamptz(3),
    ready_at timestamptz(3),
    served_at timestamptz(3),
    notes text,
    CONSTRAINT kitchen_tickets_number_unique UNIQUE (order_id, ticket_number)
);

CREATE TABLE kitchen_ticket_lines (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    kitchen_ticket_id uuid NOT NULL REFERENCES kitchen_tickets(id) ON DELETE RESTRICT,
    order_line_id uuid NOT NULL REFERENCES order_lines(id) ON DELETE RESTRICT,
    item_name_snapshot varchar(200) NOT NULL,
    quantity numeric(14, 6) NOT NULL CHECK (quantity > 0),
    modifiers_snapshot text,
    special_instructions text,
    status kitchen_ticket_status NOT NULL DEFAULT 'queued',
    created_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE payment_methods (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    code varchar(30) NOT NULL,
    name varchar(100) NOT NULL,
    method_type payment_method_type NOT NULL,
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT payment_methods_code_unique UNIQUE (location_id, code)
);

CREATE TABLE cash_registers (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    code varchar(30) NOT NULL,
    name varchar(100) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT cash_registers_code_unique UNIQUE (location_id, code)
);

CREATE TABLE cash_sessions (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    cash_register_id uuid NOT NULL REFERENCES cash_registers(id) ON DELETE RESTRICT,
    business_date date NOT NULL,
    opened_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    closed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    status cash_session_status NOT NULL DEFAULT 'open',
    opening_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (opening_amount >= 0),
    expected_cash_amount numeric(14, 2),
    counted_cash_amount numeric(14, 2),
    difference_amount numeric(14, 2),
    opened_at timestamptz(3) NOT NULL DEFAULT now(),
    closed_at timestamptz(3),
    notes text,
    CONSTRAINT cash_sessions_close_check CHECK (
        status = 'open'
        OR (
            closed_at IS NOT NULL
            AND expected_cash_amount IS NOT NULL
            AND counted_cash_amount IS NOT NULL
            AND difference_amount IS NOT NULL
        )
    ),
    CONSTRAINT cash_sessions_amounts_check CHECK (
        expected_cash_amount IS NULL OR expected_cash_amount >= 0
    ),
    CONSTRAINT cash_sessions_counted_check CHECK (
        counted_cash_amount IS NULL OR counted_cash_amount >= 0
    ),
    CONSTRAINT cash_sessions_time_check CHECK (
        closed_at IS NULL OR closed_at >= opened_at
    ),
    CONSTRAINT cash_sessions_unique_open UNIQUE (cash_register_id, business_date)
);

CREATE TABLE cash_movements (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    cash_session_id uuid NOT NULL REFERENCES cash_sessions(id) ON DELETE RESTRICT,
    movement_type cash_movement_type NOT NULL,
    amount numeric(14, 2) NOT NULL CHECK (amount > 0),
    reason varchar(200),
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE payments (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    order_id uuid REFERENCES orders(id) ON DELETE RESTRICT,
    reservation_id uuid REFERENCES reservations(id) ON DELETE RESTRICT,
    event_id uuid REFERENCES events(id) ON DELETE RESTRICT,
    payment_method_id uuid NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
    cash_session_id uuid REFERENCES cash_sessions(id) ON DELETE SET NULL,
    amount numeric(14, 2) NOT NULL CHECK (amount > 0),
    currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
    status payment_status NOT NULL DEFAULT 'pending',
    external_reference varchar(160),
    received_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    paid_at timestamptz(3),
    notes text,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT payments_single_context_check CHECK (
        num_nonnulls(order_id, reservation_id, event_id) = 1
    )
);

CREATE TABLE tips (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE RESTRICT,
    tip_rate numeric(7, 6) NOT NULL CHECK (tip_rate >= 0 AND tip_rate < 1),
    amount numeric(14, 2) NOT NULL CHECK (amount >= 0),
    status tip_status NOT NULL DEFAULT 'accepted',
    was_informed boolean NOT NULL DEFAULT false,
    accepted_at timestamptz(3),
    adjusted_at timestamptz(3),
    adjusted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    due_at timestamptz(3),
    distributed_at timestamptz(3),
    notes text,
    created_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE tip_distributions (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    tip_id uuid NOT NULL REFERENCES tips(id) ON DELETE RESTRICT,
    employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    amount numeric(14, 2) NOT NULL CHECK (amount > 0),
    status tip_distribution_status NOT NULL DEFAULT 'pending',
    due_at timestamptz(3) NOT NULL,
    paid_at timestamptz(3),
    paid_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    notes text,
    CONSTRAINT tip_distributions_employee_unique UNIQUE (tip_id, employee_id)
);

CREATE TABLE dte_sequences (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    document_type_code varchar(10) NOT NULL,
    series varchar(20),
    next_number bigint NOT NULL DEFAULT 1 CHECK (next_number > 0),
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT dte_sequences_unique UNIQUE (location_id, document_type_code, series)
);

CREATE TABLE dte_documents (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    order_id uuid REFERENCES orders(id) ON DELETE RESTRICT,
    document_type_code varchar(10) NOT NULL CHECK (length(document_type_code) BETWEEN 2 AND 10),
    status dte_status NOT NULL DEFAULT 'draft',
    generation_code uuid NOT NULL DEFAULT uuidv4() UNIQUE,
    control_number varchar(100),
    reception_stamp varchar(100),
    issue_at timestamptz(3) NOT NULL,
    transmission_type varchar(30) NOT NULL DEFAULT 'normal'
        CHECK (transmission_type IN ('normal', 'contingency', 'deferred')),
    receptor_name varchar(200),
    receptor_document_type customer_document_type,
    receptor_document_number varchar(80),
    receptor_nrc varchar(80),
    receptor_address text,
    subtotal_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal_amount >= 0),
    discount_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
    total_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    signed_dte_json jsonb,
    readable_document text,
    error_message text,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE dte_document_lines (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    dte_document_id uuid NOT NULL REFERENCES dte_documents(id) ON DELETE RESTRICT,
    source_order_line_id uuid REFERENCES order_lines(id) ON DELETE SET NULL,
    line_number integer NOT NULL CHECK (line_number > 0),
    description varchar(250) NOT NULL,
    quantity numeric(14, 6) NOT NULL CHECK (quantity > 0),
    unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
    discount_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    tax_rate numeric(7, 6) NOT NULL DEFAULT 0 CHECK (tax_rate BETWEEN 0 AND 1),
    taxable_amount numeric(14, 2) NOT NULL CHECK (taxable_amount >= 0),
    tax_amount numeric(14, 2) NOT NULL CHECK (tax_amount >= 0),
    line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
    CONSTRAINT dte_document_lines_unique UNIQUE (dte_document_id, line_number),
    CONSTRAINT dte_document_lines_total_check CHECK (
        line_total = taxable_amount + tax_amount
    )
);

CREATE TABLE dte_document_payments (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    dte_document_id uuid NOT NULL REFERENCES dte_documents(id) ON DELETE RESTRICT,
    payment_id uuid REFERENCES payments(id) ON DELETE SET NULL,
    payment_method_code varchar(40) NOT NULL,
    amount numeric(14, 2) NOT NULL CHECK (amount > 0),
    currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD')
);

CREATE TABLE dte_events (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    dte_document_id uuid NOT NULL REFERENCES dte_documents(id) ON DELETE RESTRICT,
    event_type dte_event_type NOT NULL,
    status varchar(20) NOT NULL
        CHECK (status IN ('pending', 'sent', 'accepted', 'rejected')),
    occurred_at timestamptz(3) NOT NULL DEFAULT now(),
    request_json jsonb,
    response_json jsonb,
    error_message text
);

CREATE TABLE menu_item_allergens (
    menu_item_variant_id uuid NOT NULL REFERENCES menu_item_variants(id) ON DELETE CASCADE,
    allergen_id uuid NOT NULL REFERENCES allergens(id) ON DELETE RESTRICT,
    presence_type varchar(20) NOT NULL
        CHECK (presence_type IN ('contains', 'may_contain')),
    is_reviewed boolean NOT NULL DEFAULT false,
    reviewed_at timestamptz(3),
    reviewed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (menu_item_variant_id, allergen_id)
);

CREATE TABLE contact_messages (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
    reservation_id uuid REFERENCES reservations(id) ON DELETE SET NULL,
    event_id uuid REFERENCES events(id) ON DELETE SET NULL,
    name_snapshot varchar(200) NOT NULL,
    email varchar(200) NOT NULL,
    phone varchar(40),
    language_code char(2) NOT NULL DEFAULT 'es'
        CHECK (language_code IN ('es', 'en')),
    topic varchar(30) NOT NULL
        CHECK (topic IN ('general', 'reservation', 'event', 'feedback', 'other')),
    message text NOT NULL,
    status contact_message_status NOT NULL DEFAULT 'new',
    assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    received_at timestamptz(3) NOT NULL DEFAULT now(),
    replied_at timestamptz(3)
);

CREATE TABLE inventory_movements (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    storage_location_id uuid NOT NULL REFERENCES storage_locations(id) ON DELETE RESTRICT,
    ingredient_id uuid NOT NULL REFERENCES ingredients(id) ON DELETE RESTRICT,
    inventory_lot_id uuid REFERENCES inventory_lots(id) ON DELETE SET NULL,
    movement_type inventory_movement_type NOT NULL,
    quantity_delta numeric(14, 6) NOT NULL CHECK (quantity_delta <> 0),
    unit_cost numeric(14, 6) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    goods_receipt_line_id uuid REFERENCES goods_receipt_lines(id) ON DELETE RESTRICT,
    order_line_id uuid REFERENCES order_lines(id) ON DELETE RESTRICT,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    reason varchar(200),
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT inventory_movements_source_check CHECK (
        (movement_type = 'receipt'
            AND quantity_delta > 0
            AND goods_receipt_line_id IS NOT NULL
            AND order_line_id IS NULL)
        OR
        (movement_type = 'sale_consumption'
            AND quantity_delta < 0
            AND goods_receipt_line_id IS NULL
            AND order_line_id IS NOT NULL)
        OR
        (movement_type = 'waste'
            AND quantity_delta < 0
            AND goods_receipt_line_id IS NULL
            AND order_line_id IS NULL)
        OR
        (movement_type = 'adjustment_in'
            AND quantity_delta > 0
            AND goods_receipt_line_id IS NULL
            AND order_line_id IS NULL)
        OR
        (movement_type = 'adjustment_out'
            AND quantity_delta < 0
            AND goods_receipt_line_id IS NULL
            AND order_line_id IS NULL)
    )
);

CREATE VIEW inventory_balance AS
SELECT
    storage_location_id,
    ingredient_id,
    SUM(quantity_delta)::numeric(14, 6) AS quantity_on_hand
FROM inventory_movements
GROUP BY storage_location_id, ingredient_id;

CREATE VIEW daily_sales AS
SELECT
    location_id,
    business_date,
    COUNT(*) FILTER (WHERE status <> 'voided') AS order_count,
    COALESCE(SUM(total_amount) FILTER (WHERE status <> 'voided'), 0)::numeric(14, 2) AS sales_total,
    COALESCE(SUM(tax_amount) FILTER (WHERE status <> 'voided'), 0)::numeric(14, 2) AS tax_total,
    COALESCE(SUM(tip_amount) FILTER (WHERE status <> 'voided'), 0)::numeric(14, 2) AS tip_total
FROM orders
GROUP BY location_id, business_date;

ALTER TABLE reservation_tables
    ADD CONSTRAINT reservation_tables_no_overlap
    EXCLUDE USING gist (
        dining_table_id WITH =,
        reserved_during WITH &&
    )
    WHERE (allocation_status IN ('held', 'assigned'));

ALTER TABLE event_space_bookings
    ADD CONSTRAINT event_space_bookings_no_overlap
    EXCLUDE USING gist (
        venue_space_id WITH =,
        blocked_during WITH &&
    )
    WHERE (booking_status IN ('held', 'confirmed'));

ALTER TABLE menu_prices
    ADD CONSTRAINT menu_prices_no_overlap
    EXCLUDE USING gist (
        variant_id WITH =,
        location_id WITH =,
        channel WITH =,
        valid_during WITH &&
    )
    WHERE (active);

ALTER TABLE recipes
    ADD CONSTRAINT recipes_no_overlap
    EXCLUDE USING gist (
        menu_item_variant_id WITH =,
        effective_during WITH &&
    )
    WHERE (active);

CREATE UNIQUE INDEX menu_item_variants_one_default
    ON menu_item_variants (menu_item_id)
    WHERE is_default AND active;

CREATE UNIQUE INDEX order_table_assignments_one_primary
    ON order_table_assignments (order_id)
    WHERE is_primary;

CREATE UNIQUE INDEX event_quotes_one_accepted
    ON event_quotes (event_id)
    WHERE status = 'accepted';

CREATE UNIQUE INDEX users_username_lower_unique
    ON users (lower(username));

CREATE UNIQUE INDEX users_email_lower_unique
    ON users (lower(email));

CREATE UNIQUE INDEX dte_documents_reception_stamp_unique
    ON dte_documents (reception_stamp)
    WHERE reception_stamp IS NOT NULL;

CREATE UNIQUE INDEX user_mfa_factors_one_active_type
    ON user_mfa_factors (user_id, factor_type)
    WHERE status = 'active';

CREATE INDEX user_sessions_user_expiry_idx
    ON user_sessions (user_id, expires_at, revoked_at);

CREATE INDEX user_mfa_factors_user_status_idx
    ON user_mfa_factors (user_id, status);

CREATE INDEX user_mfa_recovery_codes_user_used_idx
    ON user_mfa_recovery_codes (user_id, used_at);

CREATE INDEX auth_events_user_occurred_idx
    ON auth_events (user_id, occurred_at);

CREATE INDEX auth_events_type_occurred_idx
    ON auth_events (event_type, occurred_at);

CREATE INDEX employees_location_status_idx
    ON employees (location_id, status);

CREATE INDEX shifts_location_date_idx
    ON shifts (location_id, business_date, status);

CREATE INDEX reservations_location_start_idx
    ON reservations (location_id, starts_at, status);

CREATE INDEX reservation_tables_reservation_idx
    ON reservation_tables (reservation_id);

CREATE INDEX events_location_start_idx
    ON events (location_id, starts_at, status);

CREATE INDEX event_space_bookings_event_idx
    ON event_space_bookings (event_id);

CREATE INDEX event_quotes_event_idx
    ON event_quotes (event_id, version_no DESC);

CREATE INDEX orders_location_date_status_idx
    ON orders (location_id, business_date, status);

CREATE INDEX orders_customer_idx
    ON orders (customer_id, opened_at DESC);

CREATE INDEX order_lines_order_idx
    ON order_lines (order_id);

CREATE INDEX kitchen_tickets_station_status_idx
    ON kitchen_tickets (prep_station_id, status, sent_at);

CREATE INDEX payments_order_idx
    ON payments (order_id, paid_at);

CREATE INDEX payments_event_idx
    ON payments (event_id, paid_at);

CREATE INDEX payments_reservation_idx
    ON payments (reservation_id, paid_at);

CREATE INDEX cash_sessions_register_date_idx
    ON cash_sessions (cash_register_id, business_date);

CREATE INDEX inventory_lots_expiry_idx
    ON inventory_lots (ingredient_id, expires_on);

CREATE INDEX inventory_movements_stock_idx
    ON inventory_movements (storage_location_id, ingredient_id, created_at);

CREATE INDEX dte_documents_location_date_idx
    ON dte_documents (location_id, issue_at, status);

CREATE INDEX audit_logs_entity_idx
    ON audit_logs (entity_type, entity_id, created_at);

CREATE INDEX audit_logs_created_idx
    ON audit_logs (created_at);

CREATE TRIGGER permissions_set_updated_at
    BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER user_mfa_factors_set_updated_at
    BEFORE UPDATE ON user_mfa_factors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER businesses_set_updated_at
    BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER locations_set_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER employees_set_updated_at
    BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER customers_set_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER menu_categories_set_updated_at
    BEFORE UPDATE ON menu_categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER menu_items_set_updated_at
    BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER menu_item_variants_set_updated_at
    BEFORE UPDATE ON menu_item_variants
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER suppliers_set_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER ingredients_set_updated_at
    BEFORE UPDATE ON ingredients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER reservations_set_updated_at
    BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER events_set_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER event_quotes_set_updated_at
    BEFORE UPDATE ON event_quotes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER orders_set_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER dte_documents_set_updated_at
    BEFORE UPDATE ON dte_documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE businesses IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE locations IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE location_hours IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE location_hour_overrides IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE employees IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE users IS 'Cuentas del panel; solo se conserva un hash Argon2id de la contraseña.';
COMMENT ON TABLE roles IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE user_roles IS 'Asignación de roles a cuentas de usuario.';
COMMENT ON TABLE user_sessions IS 'Sesiones server-side; solo se almacena el hash del token opaco.';
COMMENT ON TABLE shifts IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE shift_assignments IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE audit_logs IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE prep_stations IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE customers IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE customer_documents IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE tax_rates IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE menu_categories IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE menu_items IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE menu_item_variants IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE menu_prices IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE menu_availability IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE menu_item_outages IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE modifier_groups IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE modifiers IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE menu_item_modifier_groups IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE promotions IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE promotion_items IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE ingredient_categories IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE units IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE ingredients IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE suppliers IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE ingredient_suppliers IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE storage_locations IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE inventory_lots IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE goods_receipts IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE goods_receipt_lines IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE recipes IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE recipe_lines IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE allergens IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE ingredient_allergens IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE venue_spaces IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE dining_tables IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE reservations IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE reservation_tables IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE events IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE event_space_bookings IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE event_packages IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE event_package_lines IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE event_quotes IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE event_quote_lines IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE event_requirements IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE orders IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE order_table_assignments IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE order_lines IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE order_line_modifiers IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE order_adjustments IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE kitchen_tickets IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE kitchen_ticket_lines IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE payment_methods IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE cash_registers IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE cash_sessions IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE cash_movements IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE payments IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE tips IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE tip_distributions IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE dte_sequences IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE dte_documents IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE dte_document_lines IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE dte_document_payments IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE dte_events IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE menu_item_allergens IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE contact_messages IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE inventory_movements IS 'Tabla del modelo operativo de Koffi-Soft.';
COMMENT ON TABLE permissions IS 'Catálogo de permisos estables y editables por código.';
COMMENT ON TABLE role_permissions IS 'Relación muchos-a-muchos entre roles y permisos.';
COMMENT ON TABLE user_mfa_factors IS 'Factores MFA; el secreto TOTP permanece cifrado con AES-256-GCM.';
COMMENT ON TABLE user_mfa_recovery_codes IS 'Códigos de recuperación; solo conserva hashes de un solo uso.';
COMMENT ON TABLE auth_events IS 'Registro de intentos, fallos, bloqueos y cambios de autenticación.';
COMMENT ON VIEW inventory_balance IS 'Saldo derivado de los movimientos de inventario.';
COMMENT ON VIEW daily_sales IS 'Resumen inicial de ventas para reportes.';
COMMENT ON COLUMN businesses.tax_id IS 'Identificador tributario del negocio; conserva formato y ceros iniciales.';
COMMENT ON COLUMN businesses.nrc IS 'Registro de contribuyente del negocio.';
COMMENT ON COLUMN users.password_hash IS 'Hash Argon2id ficticio en la semilla; nunca usar una contraseña demo en producción.';
COMMENT ON COLUMN users.failed_login_attempts IS 'Contador administrado por la aplicación para limitar intentos fallidos.';
COMMENT ON COLUMN user_sessions.session_token_hash IS 'Hash SHA-256 hexadecimal del token opaco; el token nunca se guarda.';
COMMENT ON COLUMN user_sessions.mfa_verified IS 'Indica si la sesión completó el segundo factor requerido.';
COMMENT ON COLUMN user_mfa_factors.secret_ciphertext IS 'Ciphertext AES-256-GCM; la llave de aplicación no vive en PostgreSQL.';
COMMENT ON COLUMN user_mfa_factors.secret_iv IS 'Nonce de 12 bytes usado por AES-256-GCM.';
COMMENT ON COLUMN user_mfa_factors.secret_auth_tag IS 'Etiqueta de autenticación de 16 bytes de AES-256-GCM.';
COMMENT ON COLUMN user_mfa_factors.last_used_time_step IS 'Último paso TOTP aceptado; la aplicación impide reutilizarlo.';
COMMENT ON COLUMN user_mfa_recovery_codes.code_hash IS 'Hash del código de recuperación; el texto original no se persiste.';
COMMENT ON COLUMN orders.business_date IS 'Fecha comercial local calculada con la zona horaria de la sede.';
COMMENT ON COLUMN orders.subtotal_amount IS 'Base imponible acumulada antes de IVA.';
COMMENT ON COLUMN order_lines.gross_amount IS 'Importe antes del descuento de línea, con modificadores y tributo incluido cuando aplica.';
COMMENT ON COLUMN order_lines.taxable_amount IS 'Base imponible después del descuento de línea.';
COMMENT ON COLUMN dte_documents.generation_code IS 'Código de generación independiente del PK, sujeto a la especificación de Hacienda.';
COMMENT ON COLUMN dte_documents.reception_stamp IS 'Sello de recepción de Hacienda; puede ser nulo en borradores o rechazos.';
COMMENT ON COLUMN tips.due_at IS 'Fecha operativa límite para distribuir la propina.';
COMMENT ON COLUMN inventory_movements.quantity_delta IS 'Positivo para entradas y negativo para consumos, mermas o salidas.';

