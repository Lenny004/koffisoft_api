-- Koffi-Soft sample database
-- PostgreSQL 18
-- Datos de desarrollo únicamente. Reemplazar identidades, datos de contacto,
-- hashes demo, configuración fiscal y material criptográfico antes de producción.

BEGIN;

SET TIME ZONE 'America/El_Salvador';

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



-- Demo seed data
-- ---------------------------------------------------------------------------

INSERT INTO businesses (
    id, legal_name, trade_name, tax_id, nrc, economic_activity_code,
    address_line, municipality, department, phone, email, dte_environment,
    dte_enabled
) VALUES (
    '10000000-0000-0000-0000-000000000001',
    'Koffi-Soft Demo Sociedad de Responsabilidad Limitada',
    'Koffi-Soft Café Mirador',
    'DEMO-NIT-0001',
    'DEMO-NRC-0001',
    'DEMO-RESTAURANT',
    'Ruta Panorámica, sitio demo de desarrollo',
    'San Francisco Chinameca',
    'La Paz',
    '+503 0000-0000',
    'demo@koffisoft.example.invalid',
    'test',
    false
);

INSERT INTO locations (
    id, business_id, code, name, address_line, municipality, department,
    phone, email, latitude, longitude
) VALUES (
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'MAIN',
    'Koffi-Soft Café Mirador',
    'Ruta Panorámica, ubicación de demostración',
    'San Francisco Chinameca',
    'La Paz',
    '+503 0000-0000',
    'contact@koffisoft.example.invalid',
    13.650000,
    -89.050000
);

INSERT INTO location_hours (
    id, location_id, service_type, day_of_week, opens_at, closes_at
) VALUES
    ('21000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'restaurant', 1, '08:00', '19:00'),
    ('21000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'restaurant', 2, '08:00', '19:00'),
    ('21000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'restaurant', 3, '08:00', '19:00'),
    ('21000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'restaurant', 4, '08:00', '19:00'),
    ('21000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'restaurant', 5, '08:00', '20:00'),
    ('21000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'restaurant', 6, '07:30', '21:00'),
    ('21000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'restaurant', 7, '07:30', '19:00'),
    ('21000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', 'breakfast', 6, '07:30', '11:00'),
    ('21000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001', 'breakfast', 7, '07:30', '11:00'),
    ('21000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000001', 'reservations', 6, '08:00', '19:00'),
    ('21000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001', 'reservations', 7, '08:00', '17:00'),
    ('21000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000001', 'events', 6, '07:00', '23:00'),
    ('21000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000001', 'events', 7, '07:00', '21:00');

INSERT INTO location_hour_overrides (
    id, location_id, service_date, service_type, is_closed, reason
) VALUES (
    '22000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '2026-12-24',
    'events',
    true,
    'Cierre temprano de demostración por mantenimiento'
);

INSERT INTO prep_stations (id, location_id, code, name, station_type) VALUES
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'KITCHEN', 'Hot Kitchen', 'kitchen'),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'COFFEE', 'Coffee Bar', 'coffee_bar'),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'DESSERT', 'Dessert Counter', 'dessert'),
    ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'SERVICE', 'Cold Drinks and Dispatch', 'service_bar');

INSERT INTO employees (
    id, location_id, employee_code, first_name, last_name, job_code,
    phone, email, hire_date
) VALUES
    ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'EMP-001', 'Ana', 'Rivera', 'manager', '+503 0000-0101', 'ana.rivera@example.invalid', '2025-01-15'),
    ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'EMP-002', 'Diego', 'Mendoza', 'cashier', '+503 0000-0102', 'diego.mendoza@example.invalid', '2025-02-01'),
    ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'EMP-003', 'Lucía', 'Campos', 'server', '+503 0000-0103', 'lucia.campos@example.invalid', '2025-03-10'),
    ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'EMP-004', 'Mateo', 'Aguilar', 'cook', '+503 0000-0104', 'mateo.aguilar@example.invalid', '2025-04-20'),
    ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'EMP-005', 'Sofía', 'Rivas', 'barista', '+503 0000-0105', 'sofia.rivas@example.invalid', '2025-05-12'),
    ('40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'EMP-006', 'Bruno', 'Castillo', 'inventory', '+503 0000-0106', 'bruno.castillo@example.invalid', '2025-06-02');

INSERT INTO users (
    id, employee_id, username, email, password_hash,
    password_changed_at, email_verified_at
) VALUES
    (
        '41000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000001',
        'demo.admin',
        'admin@koffisoft.example.invalid',
        '$argon2id$v=19$m=19456,t=2,p=1$ZGVtby1zYWx0$ZGVtb19wYXNzd29yZF9oYXNoX2Zha2U',
        '2026-09-01 08:00:00-06',
        '2026-09-01 08:00:00-06'
    ),
    (
        '41000000-0000-0000-0000-000000000002',
        '40000000-0000-0000-0000-000000000002',
        'demo.cashier',
        'cashier@koffisoft.example.invalid',
        '$argon2id$v=19$m=19456,t=2,p=1$ZGVtby1zYWx0$ZGVtb19wYXNzd29yZF9oYXNoX2Zha2U',
        '2026-09-01 08:00:00-06',
        '2026-09-01 08:00:00-06'
    );

INSERT INTO roles (id, business_id, code, name) VALUES
    ('42000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner', 'Owner'),
    ('42000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'admin', 'Administrator'),
    ('42000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'manager', 'Manager'),
    ('42000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'cashier', 'Cashier'),
    ('42000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'waiter', 'Waiter'),
    ('42000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'kitchen', 'Kitchen'),
    ('42000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'barista', 'Barista'),
    ('42000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'events_coordinator', 'Events coordinator'),
    ('42000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'viewer', 'Viewer');


INSERT INTO permissions (id, code, description) VALUES
    ('80000000-0000-0000-0000-000000000001', 'auth.sessions.read', 'Consultar sesiones activas'),
    ('80000000-0000-0000-0000-000000000002', 'auth.sessions.revoke', 'Revocar sesiones'),
    ('80000000-0000-0000-0000-000000000003', 'auth.mfa.manage', 'Configurar y revocar MFA'),
    ('80000000-0000-0000-0000-000000000004', 'auth.password.change', 'Cambiar contraseña propia'),
    ('80000000-0000-0000-0000-000000000005', 'users.read', 'Consultar cuentas de usuario'),
    ('80000000-0000-0000-0000-000000000006', 'users.create', 'Crear cuentas de usuario'),
    ('80000000-0000-0000-0000-000000000007', 'users.update', 'Actualizar cuentas de usuario'),
    ('80000000-0000-0000-0000-000000000008', 'users.disable', 'Deshabilitar cuentas de usuario'),
    ('80000000-0000-0000-0000-000000000009', 'roles.read', 'Consultar roles'),
    ('80000000-0000-0000-0000-000000000010', 'roles.manage', 'Administrar roles'),
    ('80000000-0000-0000-0000-000000000011', 'permissions.read', 'Consultar permisos'),
    ('80000000-0000-0000-0000-000000000012', 'permissions.manage', 'Administrar permisos'),
    ('80000000-0000-0000-0000-000000000013', 'audit_logs.read', 'Consultar auditoría'),
    ('80000000-0000-0000-0000-000000000014', 'catalog.read', 'Consultar catálogo'),
    ('80000000-0000-0000-0000-000000000015', 'catalog.manage', 'Administrar productos y categorías'),
    ('80000000-0000-0000-0000-000000000016', 'menu_prices.manage', 'Administrar precios'),
    ('80000000-0000-0000-0000-000000000017', 'menu_availability.manage', 'Administrar disponibilidad'),
    ('80000000-0000-0000-0000-000000000018', 'promotions.manage', 'Administrar promociones'),
    ('80000000-0000-0000-0000-000000000019', 'modifiers.manage', 'Administrar modificadores'),
    ('80000000-0000-0000-0000-000000000020', 'customers.read', 'Consultar clientes'),
    ('80000000-0000-0000-0000-000000000021', 'customers.manage', 'Administrar clientes'),
    ('80000000-0000-0000-0000-000000000022', 'reservations.read', 'Consultar reservas'),
    ('80000000-0000-0000-0000-000000000023', 'reservations.create', 'Crear reservas'),
    ('80000000-0000-0000-0000-000000000024', 'reservations.manage', 'Administrar reservas'),
    ('80000000-0000-0000-0000-000000000025', 'events.read', 'Consultar eventos'),
    ('80000000-0000-0000-0000-000000000026', 'events.manage', 'Administrar eventos'),
    ('80000000-0000-0000-0000-000000000027', 'event_quotes.manage', 'Administrar cotizaciones de eventos'),
    ('80000000-0000-0000-0000-000000000028', 'orders.read', 'Consultar órdenes'),
    ('80000000-0000-0000-0000-000000000029', 'orders.create', 'Crear órdenes'),
    ('80000000-0000-0000-0000-000000000030', 'orders.update', 'Actualizar órdenes abiertas'),
    ('80000000-0000-0000-0000-000000000031', 'orders.void', 'Anular órdenes'),
    ('80000000-0000-0000-0000-000000000032', 'orders.discount', 'Aplicar descuentos'),
    ('80000000-0000-0000-0000-000000000033', 'kitchen.read', 'Consultar comandas'),
    ('80000000-0000-0000-0000-000000000034', 'kitchen.manage', 'Gestionar preparación'),
    ('80000000-0000-0000-0000-000000000035', 'payments.read', 'Consultar pagos'),
    ('80000000-0000-0000-0000-000000000036', 'payments.create', 'Registrar pagos'),
    ('80000000-0000-0000-0000-000000000037', 'payments.refund', 'Gestionar devoluciones'),
    ('80000000-0000-0000-0000-000000000038', 'cash.read', 'Consultar caja'),
    ('80000000-0000-0000-0000-000000000039', 'cash.open_close', 'Abrir y cerrar caja'),
    ('80000000-0000-0000-0000-000000000040', 'cash.adjust', 'Registrar ajustes de caja'),
    ('80000000-0000-0000-0000-000000000041', 'inventory.read', 'Consultar inventario'),
    ('80000000-0000-0000-0000-000000000042', 'inventory.manage', 'Administrar insumos'),
    ('80000000-0000-0000-0000-000000000043', 'inventory.receive', 'Registrar recepciones'),
    ('80000000-0000-0000-0000-000000000044', 'inventory.adjust', 'Registrar ajustes de inventario'),
    ('80000000-0000-0000-0000-000000000045', 'recipes.manage', 'Administrar recetas'),
    ('80000000-0000-0000-0000-000000000046', 'dte.read', 'Consultar documentos DTE'),
    ('80000000-0000-0000-0000-000000000047', 'dte.issue', 'Emitir documentos DTE'),
    ('80000000-0000-0000-0000-000000000048', 'reports.read', 'Consultar reportes');

INSERT INTO role_permissions (role_id, permission_id) VALUES
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000002'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000003'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000004'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000005'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000006'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000007'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000008'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000009'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000010'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000011'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000012'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000013'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000014'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000015'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000016'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000017'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000018'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000019'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000020'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000021'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000022'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000023'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000024'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000025'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000026'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000027'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000028'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000029'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000030'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000031'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000032'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000033'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000034'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000035'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000036'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000037'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000038'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000039'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000040'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000041'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000042'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000043'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000044'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000045'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000046'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000047'),
    ('42000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000048'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000003'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000004'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000005'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000006'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000007'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000008'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000009'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000010'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000011'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000012'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000013'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000014'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000015'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000016'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000017'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000018'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000019'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000020'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000021'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000022'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000023'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000024'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000025'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000026'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000027'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000028'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000029'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000030'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000031'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000032'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000033'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000034'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000035'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000036'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000037'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000038'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000039'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000040'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000041'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000042'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000043'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000044'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000045'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000046'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000047'),
    ('42000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000048'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000001'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000003'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000004'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000005'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000009'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000011'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000013'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000014'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000015'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000016'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000017'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000018'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000019'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000020'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000021'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000022'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000023'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000024'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000025'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000026'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000027'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000028'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000029'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000030'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000031'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000032'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000033'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000034'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000035'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000036'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000037'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000038'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000039'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000040'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000041'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000042'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000043'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000044'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000045'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000046'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000047'),
    ('42000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000048'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000004'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000014'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000020'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000021'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000022'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000023'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000028'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000029'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000030'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000035'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000036'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000038'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000039'),
    ('42000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000048'),
    ('42000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000004'),
    ('42000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000014'),
    ('42000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000020'),
    ('42000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000021'),
    ('42000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000022'),
    ('42000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000023'),
    ('42000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000024'),
    ('42000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000028'),
    ('42000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000029'),
    ('42000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000030'),
    ('42000000-0000-0000-0000-000000000005', '80000000-0000-0000-0000-000000000035'),
    ('42000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000004'),
    ('42000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000014'),
    ('42000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000033'),
    ('42000000-0000-0000-0000-000000000006', '80000000-0000-0000-0000-000000000034'),
    ('42000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000004'),
    ('42000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000014'),
    ('42000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000033'),
    ('42000000-0000-0000-0000-000000000007', '80000000-0000-0000-0000-000000000034'),
    ('42000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000004'),
    ('42000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000014'),
    ('42000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000020'),
    ('42000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000021'),
    ('42000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000022'),
    ('42000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000025'),
    ('42000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000026'),
    ('42000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000027'),
    ('42000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000035'),
    ('42000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000036'),
    ('42000000-0000-0000-0000-000000000008', '80000000-0000-0000-0000-000000000048'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000001'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000005'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000009'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000011'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000013'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000014'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000020'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000022'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000025'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000028'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000033'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000035'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000038'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000041'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000046'),
    ('42000000-0000-0000-0000-000000000009', '80000000-0000-0000-0000-000000000048');

INSERT INTO user_roles (user_id, role_id) VALUES
    ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000001'),
    ('41000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000002'),
    ('41000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000004');

-- Este factor está marcado como demo: el ciphertext/nonce/tag son bytes ficticios
-- y no representan un secreto TOTP válido ni una clave de aplicación.
INSERT INTO user_mfa_factors (
    id, user_id, factor_type, label, status,
    secret_ciphertext, secret_iv, secret_auth_tag, key_version, verified_at
) VALUES (
    '81000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    'totp',
    'DEMO_ONLY_NOT_A_REAL_SECRET',
    'active',
    decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
    decode('111111111111111111111111', 'hex'),
    decode('22222222222222222222222222222222', 'hex'),
    1,
    '2026-09-01 08:05:00-06'
);

INSERT INTO user_mfa_recovery_codes (id, user_id, code_hash) VALUES
    (
        '82000000-0000-0000-0000-000000000001',
        '41000000-0000-0000-0000-000000000001',
        '$argon2id$v=19$m=19456,t=2,p=1$ZGVtby1yZWNvdmVyeS0x$ZGVtb19yZWNvdmVyeV9oYXNoXzE'
    ),
    (
        '82000000-0000-0000-0000-000000000002',
        '41000000-0000-0000-0000-000000000001',
        '$argon2id$v=19$m=19456,t=2,p=1$ZGVtby1yZWNvdmVyeS0y$ZGVtb19yZWNvdmVyeV9oYXNoXzI'
    );

INSERT INTO user_sessions (
    id, user_id, session_token_hash, created_at, expires_at,
    revoked_at, last_used_at, ip_address, user_agent, mfa_verified, revoked_reason
) VALUES (
    '83000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '2026-10-03 08:00:00-06',
    '2026-10-04 08:00:00-06',
    '2026-10-03 09:00:00-06',
    '2026-10-03 08:30:00-06',
    '192.0.2.10',
    'Koffi-Soft demo browser',
    true,
    'demo_seed_revoked_session'
);

INSERT INTO auth_events (
    id, user_id, session_id, event_type, ip_address, user_agent, request_id, details, occurred_at
) VALUES
    (
        '84000000-0000-0000-0000-000000000001',
        '41000000-0000-0000-0000-000000000001',
        NULL,
        'login_succeeded',
        '192.0.2.10',
        'Koffi-Soft demo browser',
        'demo-auth-001',
        '{"demo": true, "mfa": true}'::jsonb,
        '2026-10-03 08:00:00-06'
    ),
    (
        '84000000-0000-0000-0000-000000000002',
        '41000000-0000-0000-0000-000000000001',
        NULL,
        'mfa_factor_verified',
        '192.0.2.10',
        'Koffi-Soft demo browser',
        'demo-auth-002',
        '{"demo": true, "factor": "totp"}'::jsonb,
        '2026-10-03 08:05:00-06'
    ),
    (
        '84000000-0000-0000-0000-000000000003',
        '41000000-0000-0000-0000-000000000002',
        NULL,
        'login_succeeded',
        '192.0.2.11',
        'Koffi-Soft demo browser',
        'demo-auth-003',
        '{"demo": true, "mfa": false}'::jsonb,
        '2026-10-03 08:10:00-06'
    ),
    (
        '84000000-0000-0000-0000-000000000004',
        NULL,
        NULL,
        'login_failed',
        '192.0.2.12',
        'Koffi-Soft demo browser',
        'demo-auth-004',
        '{"demo": true, "reason": "invalid_identifier"}'::jsonb,
        '2026-10-03 08:15:00-06'
    ),
    (
        '84000000-0000-0000-0000-000000000005',
        '41000000-0000-0000-0000-000000000001',
        NULL,
        'mfa_failed',
        '192.0.2.10',
        'Koffi-Soft demo browser',
        'demo-auth-005',
        '{"demo": true, "reason": "invalid_code"}'::jsonb,
        '2026-10-03 08:16:00-06'
    ),
    (
        '84000000-0000-0000-0000-000000000006',
        '41000000-0000-0000-0000-000000000001',
        '83000000-0000-0000-0000-000000000001',
        'session_revoked',
        '192.0.2.10',
        'Koffi-Soft demo browser',
        'demo-auth-006',
        '{"demo": true, "reason": "seeded_revoked_session"}'::jsonb,
        '2026-10-03 09:00:00-06'
    );


INSERT INTO shifts (
    id, location_id, business_date, starts_at, ends_at, status, notes
) VALUES
    (
        '43000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        '2026-10-03',
        '2026-10-03 06:30:00-06',
        '2026-10-03 15:00:00-06',
        'started',
        'Saturday breakfast and lunch opening shift'
    ),
    (
        '43000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000001',
        '2026-10-03',
        '2026-10-03 14:30:00-06',
        '2026-10-03 23:00:00-06',
        'planned',
        'Saturday sunset service'
    );

INSERT INTO shift_assignments (shift_id, employee_id) VALUES
    ('43000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001'),
    ('43000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002'),
    ('43000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003'),
    ('43000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004'),
    ('43000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005'),
    ('43000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001'),
    ('43000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000003'),
    ('43000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000005');

INSERT INTO tax_rates (id, code, name, rate, valid_from) VALUES
    ('54000000-0000-0000-0000-000000000001', 'IVA', 'Value Added Tax', 0.130000, '2022-01-01'),
    ('54000000-0000-0000-0000-000000000002', 'EXEMPT', 'Exempt', 0.000000, '2022-01-01');

INSERT INTO customers (
    id, customer_type, display_name, phone, email, preferred_language, marketing_opt_in
) VALUES
    ('50000000-0000-0000-0000-000000000001', 'person', 'Camila Rivera', '+503 0000-0201', 'camila.rivera@example.invalid', 'es', true),
    ('50000000-0000-0000-0000-000000000002', 'person', 'Mateo Solís', '+503 0000-0202', 'mateo.solis@example.invalid', 'en', false),
    ('50000000-0000-0000-0000-000000000003', 'business', 'Blue Fern Demo Consulting', '+503 0000-0203', 'events@bluefern.example.invalid', 'en', false),
    ('50000000-0000-0000-0000-000000000004', 'person', 'Valentina Cruz', '+503 0000-0204', 'valentina.cruz@example.invalid', 'es', false);

INSERT INTO menu_categories (
    id, location_id, slug, name_es, name_en, description_es, description_en, display_order
) VALUES
    ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'breakfast', 'Desayunos', 'Breakfast', 'Desayunos de fin de semana y platos de mañana.', 'Weekend breakfast and morning plates.', 1),
    ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'lunch', 'Almuerzos', 'Lunch', 'Platos fuertes para compartir la vista.', 'Main dishes for enjoying the view.', 2),
    ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'coffee', 'Café', 'Coffee', 'Café de especialidad y bebidas calientes.', 'Specialty coffee and hot drinks.', 3),
    ('60000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'desserts', 'Postres', 'Desserts', 'Postres para acompañar la tarde.', 'Desserts for the afternoon.', 4),
    ('60000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'cold-drinks', 'Bebidas frías', 'Cold drinks', 'Bebidas refrescantes y naturales.', 'Refreshing and natural drinks.', 5);

INSERT INTO menu_items (
    id, category_id, sku, slug, item_type, name_es, name_en,
    description_es, description_en
) VALUES
    ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'FOOD-BREAKFAST-001', 'traditional-breakfast', 'food', 'Desayuno tradicional', 'Traditional breakfast', 'Huevos, frijoles, queso y pan artesanal.', 'Eggs, beans, cheese and artisan bread.'),
    ('61000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 'FOOD-BREAKFAST-002', 'panoramic-breakfast', 'food', 'Desayuno panorámico', 'Panoramic breakfast', 'Desayuno completo con aguacate y productos locales.', 'Complete breakfast with avocado and local products.'),
    ('61000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000002', 'FOOD-LUNCH-001', 'grilled-beef-sandwich', 'food', 'Sándwich de res a la parrilla', 'Grilled beef sandwich', 'Res a la parrilla, queso y pan artesanal.', 'Grilled beef, cheese and artisan bread.'),
    ('61000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000002', 'FOOD-LUNCH-002', 'chicken-in-cream-sauce', 'food', 'Pollo en salsa cremosa', 'Chicken in cream sauce', 'Pollo, salsa cremosa y guarnición de temporada.', 'Chicken, creamy sauce and seasonal side.'),
    ('61000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000003', 'DRINK-COFFEE-001', 'latte', 'beverage', 'Latte', 'Latte', 'Espresso de origen y leche vaporizada.', 'Origin espresso and steamed milk.'),
    ('61000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000003', 'DRINK-COFFEE-002', 'pour-over-coffee', 'beverage', 'Café filtrado', 'Pour-over coffee', 'Café de especialidad preparado al momento.', 'Specialty coffee prepared to order.'),
    ('61000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000005', 'DRINK-COLD-001', 'hibiscus-iced-tea', 'beverage', 'Té frío de jamaica', 'Iced hibiscus tea', 'Infusión fría de jamaica con un toque cítrico.', 'Cold hibiscus infusion with a citrus note.'),
    ('61000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000004', 'DESSERT-001', 'cheesecake', 'dessert', 'Cheesecake de la casa', 'House cheesecake', 'Cheesecake cremoso con base de galleta.', 'Creamy cheesecake with a biscuit base.'),
    ('61000000-0000-0000-0000-000000000009', '60000000-0000-0000-0000-000000000004', 'DESSERT-002', 'chocolate-cake', 'dessert', 'Pastel de chocolate', 'Chocolate cake', 'Pastel húmedo de chocolate con crema.', 'Moist chocolate cake with cream.');

INSERT INTO menu_item_variants (
    id, menu_item_id, prep_station_id, sku, name_es, name_en, is_default
) VALUES
    ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'FOOD-BREAKFAST-001-REG', 'Porción regular', 'Regular portion', true),
    ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'FOOD-BREAKFAST-002-REG', 'Porción regular', 'Regular portion', true),
    ('62000000-0000-0000-0000-000000000003', '61000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', 'FOOD-LUNCH-001-REG', 'Porción regular', 'Regular portion', true),
    ('62000000-0000-0000-0000-000000000004', '61000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'FOOD-LUNCH-002-REG', 'Porción regular', 'Regular portion', true),
    ('62000000-0000-0000-0000-000000000005', '61000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 'DRINK-COFFEE-001-HOT', 'Caliente', 'Hot', true),
    ('62000000-0000-0000-0000-000000000006', '61000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002', 'DRINK-COFFEE-001-ICED', 'Frío', 'Iced', false),
    ('62000000-0000-0000-0000-000000000007', '61000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000002', 'DRINK-COFFEE-002-REG', 'Taza', 'Cup', true),
    ('62000000-0000-0000-0000-000000000008', '61000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000004', 'DRINK-COLD-001-REG', 'Vaso', 'Glass', true),
    ('62000000-0000-0000-0000-000000000009', '61000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000003', 'DESSERT-001-SLICE', 'Porción', 'Slice', true),
    ('62000000-0000-0000-0000-000000000010', '61000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000003', 'DESSERT-002-SLICE', 'Porción', 'Slice', true);

INSERT INTO menu_prices (
    id, variant_id, location_id, channel, price, includes_tax, tax_rate_id, valid_from
) VALUES
    ('63000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'pos', 8.95, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'web', 8.95, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000003', '62000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'pos', 12.50, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000004', '62000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'web', 12.50, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000005', '62000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'pos', 14.00, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000006', '62000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'web', 14.00, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000007', '62000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'pos', 13.50, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000008', '62000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'web', 13.50, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000009', '62000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'pos', 3.75, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000010', '62000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'web', 3.75, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000011', '62000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'pos', 4.25, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000012', '62000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'web', 4.25, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000013', '62000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'pos', 4.50, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000014', '62000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'web', 4.50, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000015', '62000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', 'pos', 3.25, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000016', '62000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', 'web', 3.25, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000017', '62000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001', 'pos', 5.25, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000018', '62000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000001', 'web', 5.25, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000019', '62000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000001', 'pos', 4.75, true, '54000000-0000-0000-0000-000000000001', '2026-01-01'),
    ('63000000-0000-0000-0000-000000000020', '62000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000001', 'web', 4.75, true, '54000000-0000-0000-0000-000000000001', '2026-01-01');

INSERT INTO menu_availability (
    id, variant_id, location_id, channel, day_of_week, starts_at, ends_at
) VALUES
    ('63100000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'pos', 6, '07:30', '11:00'),
    ('63100000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'pos', 7, '07:30', '11:00'),
    ('63100000-0000-0000-0000-000000000003', '62000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'web', 6, '07:30', '11:00'),
    ('63100000-0000-0000-0000-000000000004', '62000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'web', 7, '07:30', '11:00'),
    ('63100000-0000-0000-0000-000000000005', '62000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'pos', 6, '07:30', '11:00'),
    ('63100000-0000-0000-0000-000000000006', '62000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'pos', 7, '07:30', '11:00'),
    ('63100000-0000-0000-0000-000000000007', '62000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'web', 6, '07:30', '11:00'),
    ('63100000-0000-0000-0000-000000000008', '62000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'web', 7, '07:30', '11:00'),
    ('63100000-0000-0000-0000-000000000009', '62000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'pos', 6, '07:30', '21:00'),
    ('63100000-0000-0000-0000-000000000010', '62000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'web', 6, '07:30', '21:00'),
    ('63100000-0000-0000-0000-000000000011', '62000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'pos', 6, '07:30', '21:00'),
    ('63100000-0000-0000-0000-000000000012', '62000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'web', 6, '07:30', '21:00'),
    ('63100000-0000-0000-0000-000000000013', '62000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', 'pos', 6, '08:00', '21:00'),
    ('63100000-0000-0000-0000-000000000014', '62000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', 'web', 6, '08:00', '21:00');

INSERT INTO menu_item_outages (
    id, variant_id, location_id, starts_at, ends_at, reason, active
) VALUES (
    '63200000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000008',
    '20000000-0000-0000-0000-000000000001',
    '2026-09-01 12:00:00-06',
    '2026-09-01 14:00:00-06',
    'Demo outage already resolved',
    false
);

INSERT INTO modifier_groups (
    id, location_id, code, name_es, name_en, selection_min, selection_max
) VALUES
    ('64000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'MILK', 'Tipo de leche', 'Milk type', 0, 1),
    ('64000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'STEAK', 'Término de res', 'Steak doneness', 1, 1),
    ('64000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'EXTRAS', 'Extras', 'Extras', 0, 2);

INSERT INTO modifiers (
    id, modifier_group_id, code, name_es, name_en, price_delta
) VALUES
    ('64100000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000001', 'WHOLE', 'Leche entera', 'Whole milk', 0.00),
    ('64100000-0000-0000-0000-000000000002', '64000000-0000-0000-0000-000000000001', 'ALMOND', 'Leche de almendra', 'Almond milk', 0.75),
    ('64100000-0000-0000-0000-000000000003', '64000000-0000-0000-0000-000000000002', 'MEDIUM', 'Término medio', 'Medium', 0.00),
    ('64100000-0000-0000-0000-000000000004', '64000000-0000-0000-0000-000000000002', 'MEDIUM_WELL', 'Tres cuartos', 'Medium well', 0.00),
    ('64100000-0000-0000-0000-000000000005', '64000000-0000-0000-0000-000000000003', 'AVOCADO', 'Aguacate extra', 'Extra avocado', 1.50),
    ('64100000-0000-0000-0000-000000000006', '64000000-0000-0000-0000-000000000003', 'EGG', 'Huevo extra', 'Extra egg', 1.25);

INSERT INTO menu_item_modifier_groups (variant_id, modifier_group_id, display_order) VALUES
    ('62000000-0000-0000-0000-000000000005', '64000000-0000-0000-0000-000000000001', 1),
    ('62000000-0000-0000-0000-000000000006', '64000000-0000-0000-0000-000000000001', 1),
    ('62000000-0000-0000-0000-000000000003', '64000000-0000-0000-0000-000000000002', 1),
    ('62000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000003', 1),
    ('62000000-0000-0000-0000-000000000002', '64000000-0000-0000-0000-000000000003', 1);

INSERT INTO promotions (
    id, location_id, code, name_es, name_en, description_es, description_en,
    status, channel, discount_type, discount_value, starts_at, ends_at
) VALUES (
    '64200000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'WEEKEND-BRUNCH-DEMO',
    'Brunch de fin de semana',
    'Weekend brunch',
    'Promoción demostrativa para desayunos de sábado y domingo.',
    'Demo promotion for Saturday and Sunday breakfast.',
    'active',
    'all',
    'percentage',
    10.00,
    '2026-10-01 00:00:00-06',
    '2026-12-31 23:59:59-06'
);

INSERT INTO promotion_items (promotion_id, variant_id) VALUES
    ('64200000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000002'),
    ('64200000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000007');

INSERT INTO ingredient_categories (id, name) VALUES
    ('65000000-0000-0000-0000-000000000001', 'Dairy'),
    ('65000000-0000-0000-0000-000000000002', 'Produce'),
    ('65000000-0000-0000-0000-000000000003', 'Bakery'),
    ('65000000-0000-0000-0000-000000000004', 'Proteins'),
    ('65000000-0000-0000-0000-000000000005', 'Dry goods');

INSERT INTO units (id, code, name, precision_scale) VALUES
    ('66000000-0000-0000-0000-000000000001', 'each', 'Each', 0),
    ('66000000-0000-0000-0000-000000000002', 'g', 'Gram', 3),
    ('66000000-0000-0000-0000-000000000003', 'ml', 'Milliliter', 3),
    ('66000000-0000-0000-0000-000000000004', 'kg', 'Kilogram', 3),
    ('66000000-0000-0000-0000-000000000005', 'portion', 'Portion', 3);

INSERT INTO ingredients (
    id, category_id, base_unit_id, sku, name, description, reorder_level
) VALUES
    ('67000000-0000-0000-0000-000000000001', '65000000-0000-0000-0000-000000000005', '66000000-0000-0000-0000-000000000002', 'ING-COFFEE', 'Coffee beans', 'Specialty coffee beans.', 1000.000000),
    ('67000000-0000-0000-0000-000000000002', '65000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000003', 'ING-MILK', 'Whole milk', 'Whole milk for coffee and kitchen.', 5000.000000),
    ('67000000-0000-0000-0000-000000000003', '65000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000003', 'ING-ALMOND-MILK', 'Almond milk', 'Plant-based milk for beverage modifiers.', 3000.000000),
    ('67000000-0000-0000-0000-000000000004', '65000000-0000-0000-0000-000000000004', '66000000-0000-0000-0000-000000000001', 'ING-EGGS', 'Eggs', 'Fresh eggs.', 30.000000),
    ('67000000-0000-0000-0000-000000000005', '65000000-0000-0000-0000-000000000003', '66000000-0000-0000-0000-000000000001', 'ING-BREAD', 'Artisan bread', 'Sliced artisan bread.', 20.000000),
    ('67000000-0000-0000-0000-000000000006', '65000000-0000-0000-0000-000000000005', '66000000-0000-0000-0000-000000000002', 'ING-BEANS', 'Black beans', 'Cooked black beans.', 5000.000000),
    ('67000000-0000-0000-0000-000000000007', '65000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000002', 'ING-CHEESE', 'Fresh cheese', 'Local fresh cheese.', 1000.000000),
    ('67000000-0000-0000-0000-000000000008', '65000000-0000-0000-0000-000000000004', '66000000-0000-0000-0000-000000000002', 'ING-BEEF', 'Beef strips', 'Beef for grilled dishes.', 5000.000000),
    ('67000000-0000-0000-0000-000000000009', '65000000-0000-0000-0000-000000000004', '66000000-0000-0000-0000-000000000002', 'ING-CHICKEN', 'Chicken breast', 'Chicken for lunch plates.', 5000.000000),
    ('67000000-0000-0000-0000-000000000010', '65000000-0000-0000-0000-000000000005', '66000000-0000-0000-0000-000000000002', 'ING-HIBISCUS', 'Hibiscus flowers', 'Dried hibiscus for iced tea.', 500.000000),
    ('67000000-0000-0000-0000-000000000011', '65000000-0000-0000-0000-000000000005', '66000000-0000-0000-0000-000000000002', 'ING-SUGAR', 'Sugar', 'Granulated sugar.', 2000.000000),
    ('67000000-0000-0000-0000-000000000012', '65000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000002', 'ING-CREAM-CHEESE', 'Cream cheese', 'Cream cheese for dessert.', 1000.000000),
    ('67000000-0000-0000-0000-000000000013', '65000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000002', 'ING-BUTTER', 'Butter', 'Butter for pastry and cooking.', 500.000000),
    ('67000000-0000-0000-0000-000000000014', '65000000-0000-0000-0000-000000000005', '66000000-0000-0000-0000-000000000002', 'ING-COCOA', 'Cocoa powder', 'Cocoa for chocolate cake.', 500.000000),
    ('67000000-0000-0000-0000-000000000015', '65000000-0000-0000-0000-000000000002', '66000000-0000-0000-0000-000000000001', 'ING-AVOCADO', 'Avocado', 'Fresh avocado.', 10.000000);

INSERT INTO suppliers (
    id, location_id, supplier_code, name, tax_id, phone, email, address_line
) VALUES
    ('68000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'SUP-COF', 'Loma Verde Roasters Demo', 'DEMO-SUP-001', '+503 0000-0301', 'sales@lomaverde.example.invalid', 'Demo supplier address'),
    ('68000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'SUP-FRESH', 'Finca Fresca Demo', 'DEMO-SUP-002', '+503 0000-0302', 'orders@fincafresca.example.invalid', 'Demo supplier address'),
    ('68000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'SUP-BAKE', 'Pan del Mirador Demo', 'DEMO-SUP-003', '+503 0000-0303', 'hello@pandelmirador.example.invalid', 'Demo supplier address'),
    ('68000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'SUP-MEAT', 'Valle Proteins Demo', 'DEMO-SUP-004', '+503 0000-0304', 'orders@valleproteins.example.invalid', 'Demo supplier address');

INSERT INTO ingredient_suppliers (
    ingredient_id, supplier_id, supplier_sku, pack_quantity, pack_unit_id, unit_cost, is_preferred
) VALUES
    ('67000000-0000-0000-0000-000000000001', '68000000-0000-0000-0000-000000000001', 'COF-1KG', 1000, '66000000-0000-0000-0000-000000000002', 0.028000, true),
    ('67000000-0000-0000-0000-000000000002', '68000000-0000-0000-0000-000000000002', 'MILK-1L', 1000, '66000000-0000-0000-0000-000000000003', 0.002200, true),
    ('67000000-0000-0000-0000-000000000002', '68000000-0000-0000-0000-000000000003', 'MILK-1L-ALT', 1000, '66000000-0000-0000-0000-000000000003', 0.002350, false),
    ('67000000-0000-0000-0000-000000000004', '68000000-0000-0000-0000-000000000002', 'EGG-TRAY', 30, '66000000-0000-0000-0000-000000000001', 0.180000, true),
    ('67000000-0000-0000-0000-000000000005', '68000000-0000-0000-0000-000000000003', 'BREAD-UNIT', 1, '66000000-0000-0000-0000-000000000001', 0.220000, true),
    ('67000000-0000-0000-0000-000000000008', '68000000-0000-0000-0000-000000000004', 'BEEF-KG', 1000, '66000000-0000-0000-0000-000000000002', 0.009500, true),
    ('67000000-0000-0000-0000-000000000009', '68000000-0000-0000-0000-000000000004', 'CHICK-KG', 1000, '66000000-0000-0000-0000-000000000002', 0.008500, true);

INSERT INTO storage_locations (id, location_id, code, name) VALUES (
    '69000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'MAIN-STOCK',
    'Main stock room'
);

INSERT INTO inventory_lots (
    id, storage_location_id, ingredient_id, supplier_id, lot_code,
    received_on, expires_on, quantity_received, unit_cost
) VALUES
    ('6a000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000001', '68000000-0000-0000-0000-000000000001', 'LOT-COF-260929', '2026-09-29', '2027-01-15', 5000, 0.028000),
    ('6a000000-0000-0000-0000-000000000002', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000002', '68000000-0000-0000-0000-000000000002', 'LOT-MILK-260929', '2026-09-29', '2026-10-12', 20000, 0.002200),
    ('6a000000-0000-0000-0000-000000000003', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000004', '68000000-0000-0000-0000-000000000002', 'LOT-EGG-260929', '2026-09-29', '2026-10-15', 180, 0.180000),
    ('6a000000-0000-0000-0000-000000000004', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000005', '68000000-0000-0000-0000-000000000003', 'LOT-BREAD-260929', '2026-09-29', '2026-10-06', 120, 0.220000),
    ('6a000000-0000-0000-0000-000000000005', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000008', '68000000-0000-0000-0000-000000000004', 'LOT-BEEF-260929', '2026-09-29', '2026-10-08', 15000, 0.009500),
    ('6a000000-0000-0000-0000-000000000006', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000009', '68000000-0000-0000-0000-000000000004', 'LOT-CHICK-260929', '2026-09-29', '2026-10-08', 10000, 0.008500),
    ('6a000000-0000-0000-0000-000000000007', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000012', '68000000-0000-0000-0000-000000000002', 'LOT-CHEESE-260929', '2026-09-29', '2026-10-20', 5000, 0.008000),
    ('6a000000-0000-0000-0000-000000000008', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000014', '68000000-0000-0000-0000-000000000002', 'LOT-COCOA-260929', '2026-09-29', '2027-03-01', 3000, 0.006000);

INSERT INTO goods_receipts (
    id, location_id, supplier_id, receipt_number, received_at, received_by_user_id, notes
) VALUES (
    '6b000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '68000000-0000-0000-0000-000000000001',
    'GR-2026-0929-001',
    '2026-09-29 07:30:00-06',
    '41000000-0000-0000-0000-000000000001',
    'Demo coffee receiving batch.'
), (
    '6b000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '68000000-0000-0000-0000-000000000002',
    'GR-2026-0929-002',
    '2026-09-29 07:32:00-06',
    '41000000-0000-0000-0000-000000000001',
    'Demo fresh and dairy receiving batch.'
), (
    '6b000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    '68000000-0000-0000-0000-000000000003',
    'GR-2026-0929-003',
    '2026-09-29 07:34:00-06',
    '41000000-0000-0000-0000-000000000001',
    'Demo bakery receiving batch.'
), (
    '6b000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    '68000000-0000-0000-0000-000000000004',
    'GR-2026-0929-004',
    '2026-09-29 07:36:00-06',
    '41000000-0000-0000-0000-000000000001',
    'Demo protein receiving batch.'
);

INSERT INTO goods_receipt_lines (
    id, goods_receipt_id, ingredient_id, inventory_lot_id, unit_id,
    quantity_received, unit_cost, total_cost
) VALUES
    ('6c000000-0000-0000-0000-000000000001', '6b000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000002', 5000, 0.028000, 140.00),
    ('6c000000-0000-0000-0000-000000000002', '6b000000-0000-0000-0000-000000000002', '67000000-0000-0000-0000-000000000002', '6a000000-0000-0000-0000-000000000002', '66000000-0000-0000-0000-000000000003', 20000, 0.002200, 44.00),
    ('6c000000-0000-0000-0000-000000000003', '6b000000-0000-0000-0000-000000000002', '67000000-0000-0000-0000-000000000004', '6a000000-0000-0000-0000-000000000003', '66000000-0000-0000-0000-000000000001', 180, 0.180000, 32.40),
    ('6c000000-0000-0000-0000-000000000004', '6b000000-0000-0000-0000-000000000003', '67000000-0000-0000-0000-000000000005', '6a000000-0000-0000-0000-000000000004', '66000000-0000-0000-0000-000000000001', 120, 0.220000, 26.40),
    ('6c000000-0000-0000-0000-000000000005', '6b000000-0000-0000-0000-000000000004', '67000000-0000-0000-0000-000000000008', '6a000000-0000-0000-0000-000000000005', '66000000-0000-0000-0000-000000000002', 15000, 0.009500, 142.50),
    ('6c000000-0000-0000-0000-000000000006', '6b000000-0000-0000-0000-000000000004', '67000000-0000-0000-0000-000000000009', '6a000000-0000-0000-0000-000000000006', '66000000-0000-0000-0000-000000000002', 10000, 0.008500, 85.00),
    ('6c000000-0000-0000-0000-000000000007', '6b000000-0000-0000-0000-000000000002', '67000000-0000-0000-0000-000000000012', '6a000000-0000-0000-0000-000000000007', '66000000-0000-0000-0000-000000000002', 5000, 0.008000, 40.00),
    ('6c000000-0000-0000-0000-000000000008', '6b000000-0000-0000-0000-000000000002', '67000000-0000-0000-0000-000000000014', '6a000000-0000-0000-0000-000000000008', '66000000-0000-0000-0000-000000000002', 3000, 0.006000, 18.00);

INSERT INTO recipes (
    id, menu_item_variant_id, version_no, effective_from, yield_quantity, yield_unit_id, notes
) VALUES
    ('6d000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', 1, '2026-01-01', 1, '66000000-0000-0000-0000-000000000005', 'Traditional breakfast recipe v1'),
    ('6d000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000002', 1, '2026-01-01', 1, '66000000-0000-0000-0000-000000000005', 'Panoramic breakfast recipe v1'),
    ('6d000000-0000-0000-0000-000000000003', '62000000-0000-0000-0000-000000000003', 1, '2026-01-01', 1, '66000000-0000-0000-0000-000000000005', 'Grilled beef sandwich recipe v1'),
    ('6d000000-0000-0000-0000-000000000004', '62000000-0000-0000-0000-000000000005', 1, '2026-01-01', 1, '66000000-0000-0000-0000-000000000005', 'Hot latte recipe v1'),
    ('6d000000-0000-0000-0000-000000000005', '62000000-0000-0000-0000-000000000006', 1, '2026-01-01', 1, '66000000-0000-0000-0000-000000000005', 'Iced latte recipe v1'),
    ('6d000000-0000-0000-0000-000000000006', '62000000-0000-0000-0000-000000000007', 1, '2026-01-01', 1, '66000000-0000-0000-0000-000000000005', 'Pour-over recipe v1'),
    ('6d000000-0000-0000-0000-000000000007', '62000000-0000-0000-0000-000000000008', 1, '2026-01-01', 1, '66000000-0000-0000-0000-000000000005', 'Hibiscus iced tea recipe v1'),
    ('6d000000-0000-0000-0000-000000000008', '62000000-0000-0000-0000-000000000009', 1, '2026-01-01', 1, '66000000-0000-0000-0000-000000000005', 'Cheesecake recipe v1');

INSERT INTO recipe_lines (id, recipe_id, ingredient_id, unit_id, quantity) VALUES
    ('6e000000-0000-0000-0000-000000000001', '6d000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000004', '66000000-0000-0000-0000-000000000001', 2),
    ('6e000000-0000-0000-0000-000000000002', '6d000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000005', '66000000-0000-0000-0000-000000000001', 1),
    ('6e000000-0000-0000-0000-000000000003', '6d000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000006', '66000000-0000-0000-0000-000000000002', 120),
    ('6e000000-0000-0000-0000-000000000004', '6d000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000007', '66000000-0000-0000-0000-000000000002', 30),
    ('6e000000-0000-0000-0000-000000000005', '6d000000-0000-0000-0000-000000000002', '67000000-0000-0000-0000-000000000004', '66000000-0000-0000-0000-000000000001', 2),
    ('6e000000-0000-0000-0000-000000000006', '6d000000-0000-0000-0000-000000000002', '67000000-0000-0000-0000-000000000005', '66000000-0000-0000-0000-000000000001', 1),
    ('6e000000-0000-0000-0000-000000000007', '6d000000-0000-0000-0000-000000000002', '67000000-0000-0000-0000-000000000006', '66000000-0000-0000-0000-000000000002', 120),
    ('6e000000-0000-0000-0000-000000000008', '6d000000-0000-0000-0000-000000000002', '67000000-0000-0000-0000-000000000007', '66000000-0000-0000-0000-000000000002', 30),
    ('6e000000-0000-0000-0000-000000000009', '6d000000-0000-0000-0000-000000000002', '67000000-0000-0000-0000-000000000015', '66000000-0000-0000-0000-000000000001', 1),
    ('6e000000-0000-0000-0000-000000000010', '6d000000-0000-0000-0000-000000000003', '67000000-0000-0000-0000-000000000008', '66000000-0000-0000-0000-000000000002', 180),
    ('6e000000-0000-0000-0000-000000000011', '6d000000-0000-0000-0000-000000000003', '67000000-0000-0000-0000-000000000005', '66000000-0000-0000-0000-000000000001', 1),
    ('6e000000-0000-0000-0000-000000000012', '6d000000-0000-0000-0000-000000000003', '67000000-0000-0000-0000-000000000007', '66000000-0000-0000-0000-000000000002', 25),
    ('6e000000-0000-0000-0000-000000000013', '6d000000-0000-0000-0000-000000000004', '67000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000002', 18),
    ('6e000000-0000-0000-0000-000000000014', '6d000000-0000-0000-0000-000000000004', '67000000-0000-0000-0000-000000000002', '66000000-0000-0000-0000-000000000003', 180),
    ('6e000000-0000-0000-0000-000000000015', '6d000000-0000-0000-0000-000000000005', '67000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000002', 18),
    ('6e000000-0000-0000-0000-000000000016', '6d000000-0000-0000-0000-000000000005', '67000000-0000-0000-0000-000000000003', '66000000-0000-0000-0000-000000000003', 180),
    ('6e000000-0000-0000-0000-000000000017', '6d000000-0000-0000-0000-000000000006', '67000000-0000-0000-0000-000000000001', '66000000-0000-0000-0000-000000000002', 22),
    ('6e000000-0000-0000-0000-000000000018', '6d000000-0000-0000-0000-000000000007', '67000000-0000-0000-0000-000000000010', '66000000-0000-0000-0000-000000000002', 12),
    ('6e000000-0000-0000-0000-000000000019', '6d000000-0000-0000-0000-000000000007', '67000000-0000-0000-0000-000000000011', '66000000-0000-0000-0000-000000000002', 20),
    ('6e000000-0000-0000-0000-000000000020', '6d000000-0000-0000-0000-000000000008', '67000000-0000-0000-0000-000000000012', '66000000-0000-0000-0000-000000000002', 80),
    ('6e000000-0000-0000-0000-000000000021', '6d000000-0000-0000-0000-000000000008', '67000000-0000-0000-0000-000000000013', '66000000-0000-0000-0000-000000000002', 20),
    ('6e000000-0000-0000-0000-000000000022', '6d000000-0000-0000-0000-000000000008', '67000000-0000-0000-0000-000000000004', '66000000-0000-0000-0000-000000000001', 1);

INSERT INTO allergens (id, code, name_es, name_en) VALUES
    ('6f000000-0000-0000-0000-000000000001', 'MILK', 'Leche', 'Milk'),
    ('6f000000-0000-0000-0000-000000000002', 'EGG', 'Huevo', 'Egg'),
    ('6f000000-0000-0000-0000-000000000003', 'GLUTEN', 'Gluten', 'Gluten'),
    ('6f000000-0000-0000-0000-000000000004', 'NUTS', 'Frutos secos', 'Nuts');

INSERT INTO ingredient_allergens (ingredient_id, allergen_id, presence_type) VALUES
    ('67000000-0000-0000-0000-000000000002', '6f000000-0000-0000-0000-000000000001', 'contains'),
    ('67000000-0000-0000-0000-000000000003', '6f000000-0000-0000-0000-000000000004', 'contains'),
    ('67000000-0000-0000-0000-000000000004', '6f000000-0000-0000-0000-000000000002', 'contains'),
    ('67000000-0000-0000-0000-000000000005', '6f000000-0000-0000-0000-000000000003', 'contains'),
    ('67000000-0000-0000-0000-000000000007', '6f000000-0000-0000-0000-000000000001', 'contains'),
    ('67000000-0000-0000-0000-000000000012', '6f000000-0000-0000-0000-000000000001', 'contains'),
    ('67000000-0000-0000-0000-000000000013', '6f000000-0000-0000-0000-000000000001', 'contains');

INSERT INTO menu_item_allergens (
    menu_item_variant_id, allergen_id, presence_type, is_reviewed, reviewed_at, reviewed_by_user_id
) VALUES
    ('62000000-0000-0000-0000-000000000001', '6f000000-0000-0000-0000-000000000001', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('62000000-0000-0000-0000-000000000001', '6f000000-0000-0000-0000-000000000002', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('62000000-0000-0000-0000-000000000001', '6f000000-0000-0000-0000-000000000003', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('62000000-0000-0000-0000-000000000002', '6f000000-0000-0000-0000-000000000001', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('62000000-0000-0000-0000-000000000002', '6f000000-0000-0000-0000-000000000002', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('62000000-0000-0000-0000-000000000002', '6f000000-0000-0000-0000-000000000003', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('62000000-0000-0000-0000-000000000003', '6f000000-0000-0000-0000-000000000001', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('62000000-0000-0000-0000-000000000003', '6f000000-0000-0000-0000-000000000003', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('62000000-0000-0000-0000-000000000005', '6f000000-0000-0000-0000-000000000001', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('62000000-0000-0000-0000-000000000006', '6f000000-0000-0000-0000-000000000001', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('62000000-0000-0000-0000-000000000008', '6f000000-0000-0000-0000-000000000001', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('62000000-0000-0000-0000-000000000008', '6f000000-0000-0000-0000-000000000002', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('62000000-0000-0000-0000-000000000008', '6f000000-0000-0000-0000-000000000003', 'contains', true, '2026-09-20 10:00:00-06', '41000000-0000-0000-0000-000000000001');

INSERT INTO venue_spaces (
    id, location_id, code, name_es, name_en, space_type, seated_capacity,
    standing_capacity, allows_table_reservation, allows_private_event
) VALUES
    ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'INDOOR', 'Salón interior', 'Indoor room', 'indoor', 36, 45, true, false),
    ('70000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'VIEWPOINT', 'Mirador del lago', 'Lake viewpoint', 'viewpoint', 28, 35, true, false),
    ('70000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'TERRACE', 'Terraza panorámica', 'Panoramic terrace', 'terrace', 32, 50, true, true),
    ('70000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'GARDEN', 'Jardín privado', 'Private garden', 'garden', 80, 120, false, true),
    ('70000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'ROOM', 'Salón privado', 'Private room', 'private_room', 30, 40, true, true);

INSERT INTO dining_tables (
    id, space_id, table_code, name, seat_count, shape
) VALUES
    ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'I-01', 'Indoor 1', 2, 'square'),
    ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 'I-02', 'Indoor 2', 4, 'square'),
    ('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', 'I-03', 'Indoor 3', 6, 'rectangular'),
    ('71000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000002', 'V-01', 'Viewpoint 1', 2, 'round'),
    ('71000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000002', 'V-02', 'Viewpoint 2', 4, 'round'),
    ('71000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000003', 'T-01', 'Terrace 1', 4, 'round'),
    ('71000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000003', 'T-02', 'Terrace 2', 6, 'rectangular'),
    ('71000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000003', 'T-03', 'Terrace 3', 4, 'round'),
    ('71000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000001', 'I-04', 'Indoor 4', 4, 'round');

INSERT INTO reservations (
    id, location_id, customer_id, reservation_code, contact_name_snapshot,
    contact_phone_snapshot, contact_email_snapshot, preferred_language,
    starts_at, ends_at, party_size, status, source, preferred_space_id,
    special_requests, created_by_user_id, confirmed_at
) VALUES
    (
        '72000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000001',
        'RSV-2026-1001',
        'Camila Rivera',
        '+503 0000-0201',
        'camila.rivera@example.invalid',
        'es',
        '2026-10-10 09:30:00-06',
        '2026-10-10 11:00:00-06',
        4,
        'confirmed',
        'web',
        '70000000-0000-0000-0000-000000000002',
        'Window-side table if available.',
        '41000000-0000-0000-0000-000000000001',
        '2026-10-03 08:30:00-06'
    ),
    (
        '72000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000002',
        'RSV-2026-1002',
        'Mateo Solís',
        '+503 0000-0202',
        'mateo.solis@example.invalid',
        'en',
        '2026-10-11 10:00:00-06',
        '2026-10-11 11:30:00-06',
        2,
        'confirmed',
        'phone',
        '70000000-0000-0000-0000-000000000001',
        'English service preferred.',
        '41000000-0000-0000-0000-000000000002',
        '2026-10-03 09:00:00-06'
    ),
    (
        '72000000-0000-0000-0000-000000000003',
        '20000000-0000-0000-0000-000000000001',
        NULL,
        'RSV-2026-1003',
        'Jordan Demo Guest',
        '+503 0000-0299',
        'jordan.guest@example.invalid',
        'en',
        '2026-10-18 15:00:00-06',
        '2026-10-18 16:30:00-06',
        3,
        'requested',
        'web',
        '70000000-0000-0000-0000-000000000003',
        'Pending confirmation from the site form.',
        NULL,
        NULL
    );

INSERT INTO reservation_tables (
    id, reservation_id, dining_table_id, starts_at, ends_at, allocation_status, assigned_by_user_id
) VALUES
    (
        '72100000-0000-0000-0000-000000000001',
        '72000000-0000-0000-0000-000000000001',
        '71000000-0000-0000-0000-000000000005',
        '2026-10-10 09:30:00-06',
        '2026-10-10 11:00:00-06',
        'assigned',
        '41000000-0000-0000-0000-000000000001'
    ),
    (
        '72100000-0000-0000-0000-000000000002',
        '72000000-0000-0000-0000-000000000002',
        '71000000-0000-0000-0000-000000000002',
        '2026-10-11 10:00:00-06',
        '2026-10-11 11:30:00-06',
        'assigned',
        '41000000-0000-0000-0000-000000000002'
    );

INSERT INTO events (
    id, location_id, customer_id, event_code, event_type, title,
    contact_name_snapshot, contact_phone_snapshot, contact_email_snapshot,
    preferred_language, starts_at, ends_at, setup_starts_at,
    estimated_guest_count, confirmed_guest_count, budget_target, status,
    source, special_requirements, coordinator_user_id
) VALUES
    (
        '73000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000004',
        'EVT-2026-0001',
        'wedding',
        'Valentina and Alex Demo Wedding',
        'Valentina Cruz',
        '+503 0000-0204',
        'valentina.cruz@example.invalid',
        'es',
        '2026-11-14 16:00:00-06',
        '2026-11-14 22:00:00-06',
        '2026-11-14 14:00:00-06',
        60,
        60,
        2100.00,
        'confirmed',
        'web',
        'One vegetarian main option and accessible path to the garden.',
        '41000000-0000-0000-0000-000000000001'
    ),
    (
        '73000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000003',
        'EVT-2026-0002',
        'corporate',
        'Blue Fern Demo Team Brunch',
        'Blue Fern Demo Consulting',
        '+503 0000-0203',
        'events@bluefern.example.invalid',
        'en',
        '2026-12-05 08:00:00-06',
        '2026-12-05 13:00:00-06',
        '2026-12-05 07:00:00-06',
        24,
        NULL,
        800.00,
        'quoted',
        'web',
        'Projector table and vegetarian meal count to be confirmed.',
        '41000000-0000-0000-0000-000000000001'
    );

INSERT INTO event_space_bookings (
    id, event_id, venue_space_id, starts_at, ends_at, setup_starts_at,
    teardown_ends_at, booking_status, capacity_reserved, hold_expires_at
) VALUES
    (
        '73100000-0000-0000-0000-000000000001',
        '73000000-0000-0000-0000-000000000001',
        '70000000-0000-0000-0000-000000000004',
        '2026-11-14 16:00:00-06',
        '2026-11-14 22:00:00-06',
        '2026-11-14 14:00:00-06',
        '2026-11-15 00:00:00-06',
        'confirmed',
        60,
        NULL
    ),
    (
        '73100000-0000-0000-0000-000000000002',
        '73000000-0000-0000-0000-000000000002',
        '70000000-0000-0000-0000-000000000005',
        '2026-12-05 08:00:00-06',
        '2026-12-05 13:00:00-06',
        '2026-12-05 07:00:00-06',
        '2026-12-05 14:00:00-06',
        'held',
        24,
        '2026-11-15 23:59:00-06'
    );

INSERT INTO event_packages (
    id, location_id, package_code, name_es, name_en, description_es,
    description_en, pricing_model, base_price, min_guest_count, max_guest_count
) VALUES
    (
        '74000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        'SUNSET-WEDDING',
        'Celebración Sunset',
        'Sunset celebration',
        'Paquete demostrativo para una recepción de boda en jardín.',
        'Demo package for a garden wedding reception.',
        'flat',
        1800.00,
        30,
        80
    ),
    (
        '74000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000001',
        'CORPORATE-BRUNCH',
        'Brunch corporativo',
        'Corporate brunch',
        'Brunch por persona con café y salón privado.',
        'Per-person brunch with coffee and private room.',
        'per_person',
        28.25,
        10,
        30
    );

INSERT INTO event_package_lines (
    id, event_package_id, line_type, menu_item_variant_id, label_es,
    label_en, quantity, unit, unit_price, sort_order
) VALUES
    ('74100000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001', 'beverage', '62000000-0000-0000-0000-000000000007', 'Café de bienvenida', 'Welcome coffee', 60, 'guest', 2.50, 1),
    ('74100000-0000-0000-0000-000000000002', '74000000-0000-0000-0000-000000000001', 'menu', '62000000-0000-0000-0000-000000000004', 'Buffet de pollo y guarniciones', 'Chicken buffet and sides', 60, 'guest', 22.00, 2),
    ('74100000-0000-0000-0000-000000000003', '74000000-0000-0000-0000-000000000001', 'other', NULL, 'Postre de celebración', 'Celebration dessert', 60, 'guest', 4.50, 3),
    ('74100000-0000-0000-0000-000000000004', '74000000-0000-0000-0000-000000000001', 'service', NULL, 'Montaje básico de jardín', 'Basic garden setup', 1, 'service', 60.00, 4),
    ('74100000-0000-0000-0000-000000000005', '74000000-0000-0000-0000-000000000002', 'menu', '62000000-0000-0000-0000-000000000001', 'Brunch tradicional', 'Traditional brunch', 24, 'guest', 18.00, 1),
    ('74100000-0000-0000-0000-000000000006', '74000000-0000-0000-0000-000000000002', 'beverage', '62000000-0000-0000-0000-000000000007', 'Café filtrado', 'Pour-over coffee', 24, 'guest', 4.00, 2),
    ('74100000-0000-0000-0000-000000000007', '74000000-0000-0000-0000-000000000002', 'venue', NULL, 'Uso de salón y mesa de apoyo', 'Room and support table', 1, 'service', 150.00, 3);

INSERT INTO event_quotes (
    id, event_id, event_package_id, version_no, status, valid_until,
    subtotal_amount, discount_amount, taxable_amount, tax_amount, total_amount,
    terms_es, terms_en, sent_at, accepted_at
) VALUES
    (
        '75000000-0000-0000-0000-000000000001',
        '73000000-0000-0000-0000-000000000001',
        '74000000-0000-0000-0000-000000000001',
        1,
        'accepted',
        '2026-10-31',
        1800.00,
        0.00,
        1800.00,
        234.00,
        2034.00,
        'Anticipo demo de USD 600.00. El saldo se confirma con el coordinador.',
        'Demo deposit of USD 600.00. Balance is confirmed with the coordinator.',
        '2026-09-28 10:00:00-06',
        '2026-09-29 16:00:00-06'
    ),
    (
        '75000000-0000-0000-0000-000000000002',
        '73000000-0000-0000-0000-000000000002',
        '74000000-0000-0000-0000-000000000002',
        1,
        'sent',
        '2026-10-31',
        678.00,
        0.00,
        678.00,
        88.14,
        766.14,
        'La cantidad final de invitados se confirma antes del evento.',
        'Final guest count is confirmed before the event.',
        '2026-10-01 11:00:00-06',
        NULL
    );

INSERT INTO event_quote_lines (
    id, event_quote_id, event_package_line_id, menu_item_variant_id,
    line_type, label_es, label_en, quantity, unit, unit_price,
    discount_amount, tax_rate, taxable_amount, tax_amount, line_total, sort_order
) VALUES
    ('75100000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', '74100000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000007', 'beverage', 'Café de bienvenida', 'Welcome coffee', 60, 'guest', 2.50, 0.00, 0.130000, 150.00, 19.50, 169.50, 1),
    ('75100000-0000-0000-0000-000000000002', '75000000-0000-0000-0000-000000000001', '74100000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000004', 'menu', 'Buffet de pollo y guarniciones', 'Chicken buffet and sides', 60, 'guest', 22.00, 0.00, 0.130000, 1320.00, 171.60, 1491.60, 2),
    ('75100000-0000-0000-0000-000000000003', '75000000-0000-0000-0000-000000000001', '74100000-0000-0000-0000-000000000003', NULL, 'other', 'Postre de celebración', 'Celebration dessert', 60, 'guest', 4.50, 0.00, 0.130000, 270.00, 35.10, 305.10, 3),
    ('75100000-0000-0000-0000-000000000004', '75000000-0000-0000-0000-000000000001', '74100000-0000-0000-0000-000000000004', NULL, 'service', 'Montaje básico de jardín', 'Basic garden setup', 1, 'service', 60.00, 0.00, 0.130000, 60.00, 7.80, 67.80, 4),
    ('75100000-0000-0000-0000-000000000005', '75000000-0000-0000-0000-000000000002', '74100000-0000-0000-0000-000000000005', '62000000-0000-0000-0000-000000000001', 'menu', 'Brunch tradicional', 'Traditional brunch', 24, 'guest', 18.00, 0.00, 0.130000, 432.00, 56.16, 488.16, 1),
    ('75100000-0000-0000-0000-000000000006', '75000000-0000-0000-0000-000000000002', '74100000-0000-0000-0000-000000000006', '62000000-0000-0000-0000-000000000007', 'beverage', 'Café filtrado', 'Pour-over coffee', 24, 'guest', 4.00, 0.00, 0.130000, 96.00, 12.48, 108.48, 2),
    ('75100000-0000-0000-0000-000000000007', '75000000-0000-0000-0000-000000000002', '74100000-0000-0000-0000-000000000007', NULL, 'venue', 'Uso de salón y mesa de apoyo', 'Room and support table', 1, 'service', 150.00, 0.00, 0.130000, 150.00, 19.50, 169.50, 3);

INSERT INTO event_requirements (
    id, event_id, requirement_type, description, guest_count, severity, status
) VALUES
    ('75200000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'diet', 'One vegetarian main dish for the wedding menu.', 4, 'important', 'acknowledged'),
    ('75200000-0000-0000-0000-000000000002', '73000000-0000-0000-0000-000000000002', 'equipment', 'Demo projector table near a power outlet.', NULL, 'important', 'open');

INSERT INTO orders (
    id, location_id, order_number, business_date, service_type, source,
    customer_id, server_employee_id, status, subtotal_amount, discount_amount,
    tax_amount, service_charge_amount, tip_amount, total_amount, balance_due,
    opened_at, closed_at, notes
) VALUES
    (
        '76000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        1001,
        '2026-10-03',
        'dine_in',
        'pos',
        '50000000-0000-0000-0000-000000000001',
        '40000000-0000-0000-0000-000000000003',
        'paid',
        33.41,
        0.00,
        4.34,
        0.00,
        2.50,
        40.25,
        0.00,
        '2026-10-03 09:12:00-06',
        '2026-10-03 10:05:00-06',
        'Demo order for a four-person breakfast visit.'
    ),
    (
        '76000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000001',
        1002,
        '2026-10-03',
        'dine_in',
        'pos',
        '50000000-0000-0000-0000-000000000002',
        '40000000-0000-0000-0000-000000000003',
        'paid',
        19.69,
        0.00,
        2.56,
        0.00,
        1.75,
        24.00,
        0.00,
        '2026-10-03 10:20:00-06',
        '2026-10-03 11:00:00-06',
        'Demo order paid with two payment methods.'
    );

INSERT INTO order_table_assignments (order_id, dining_table_id, is_primary) VALUES
    ('76000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000005', true),
    ('76000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000007', true);

INSERT INTO order_lines (
    id, order_id, line_no, menu_item_variant_id, recipe_id,
    item_name_snapshot, variant_name_snapshot, sku_snapshot, quantity,
    unit_price, includes_tax, tax_rate, gross_amount, discount_amount,
    taxable_amount, tax_amount, total_amount, status
) VALUES
    ('76100000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', 1, '62000000-0000-0000-0000-000000000002', '6d000000-0000-0000-0000-000000000002', 'Panoramic breakfast', 'Regular portion', 'FOOD-BREAKFAST-002-REG', 2, 12.50, true, 0.130000, 25.00, 0.00, 22.12, 2.88, 25.00, 'served'),
    ('76100000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000001', 2, '62000000-0000-0000-0000-000000000005', '6d000000-0000-0000-0000-000000000004', 'Latte', 'Hot', 'DRINK-COFFEE-001-HOT', 2, 3.75, true, 0.130000, 7.50, 0.00, 6.64, 0.86, 7.50, 'served'),
    ('76100000-0000-0000-0000-000000000003', '76000000-0000-0000-0000-000000000001', 3, '62000000-0000-0000-0000-000000000009', '6d000000-0000-0000-0000-000000000008', 'House cheesecake', 'Slice', 'DESSERT-001-SLICE', 1, 5.25, true, 0.130000, 5.25, 0.00, 4.65, 0.60, 5.25, 'served'),
    ('76100000-0000-0000-0000-000000000004', '76000000-0000-0000-0000-000000000002', 1, '62000000-0000-0000-0000-000000000003', '6d000000-0000-0000-0000-000000000003', 'Grilled beef sandwich', 'Regular portion', 'FOOD-LUNCH-001-REG', 1, 14.00, true, 0.130000, 14.00, 0.00, 12.39, 1.61, 14.00, 'served'),
    ('76100000-0000-0000-0000-000000000005', '76000000-0000-0000-0000-000000000002', 2, '62000000-0000-0000-0000-000000000008', '6d000000-0000-0000-0000-000000000007', 'Iced hibiscus tea', 'Glass', 'DRINK-COLD-001-REG', 1, 3.25, true, 0.130000, 3.25, 0.00, 2.88, 0.37, 3.25, 'served'),
    ('76100000-0000-0000-0000-000000000006', '76000000-0000-0000-0000-000000000002', 3, '62000000-0000-0000-0000-000000000006', '6d000000-0000-0000-0000-000000000005', 'Latte', 'Iced', 'DRINK-COFFEE-001-ICED', 1, 4.25, true, 0.130000, 5.00, 0.00, 4.42, 0.58, 5.00, 'served');

INSERT INTO order_line_modifiers (
    id, order_line_id, modifier_id, name_snapshot, quantity, price_delta, total_delta
) VALUES (
    '76200000-0000-0000-0000-000000000001',
    '76100000-0000-0000-0000-000000000006',
    '64100000-0000-0000-0000-000000000002',
    'Almond milk',
    1,
    0.75,
    0.75
);

INSERT INTO kitchen_tickets (
    id, order_id, prep_station_id, ticket_number, status, sent_at, started_at, ready_at, served_at
) VALUES
    ('76300000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 1, 'served', '2026-10-03 09:13:00-06', '2026-10-03 09:14:00-06', '2026-10-03 09:31:00-06', '2026-10-03 09:35:00-06'),
    ('76300000-0000-0000-0000-000000000002', '76000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 2, 'served', '2026-10-03 09:13:00-06', '2026-10-03 09:14:00-06', '2026-10-03 09:22:00-06', '2026-10-03 09:23:00-06'),
    ('76300000-0000-0000-0000-000000000003', '76000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 3, 'served', '2026-10-03 09:13:00-06', '2026-10-03 09:14:00-06', '2026-10-03 09:40:00-06', '2026-10-03 09:42:00-06'),
    ('76300000-0000-0000-0000-000000000004', '76000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 1, 'served', '2026-10-03 10:21:00-06', '2026-10-03 10:22:00-06', '2026-10-03 10:44:00-06', '2026-10-03 10:45:00-06'),
    ('76300000-0000-0000-0000-000000000005', '76000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', 2, 'served', '2026-10-03 10:21:00-06', '2026-10-03 10:22:00-06', '2026-10-03 10:28:00-06', '2026-10-03 10:30:00-06'),
    ('76300000-0000-0000-0000-000000000006', '76000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 3, 'served', '2026-10-03 10:21:00-06', '2026-10-03 10:22:00-06', '2026-10-03 10:29:00-06', '2026-10-03 10:31:00-06');

INSERT INTO kitchen_ticket_lines (
    id, kitchen_ticket_id, order_line_id, item_name_snapshot, quantity,
    modifiers_snapshot, special_instructions, status
) VALUES
    ('76400000-0000-0000-0000-000000000001', '76300000-0000-0000-0000-000000000001', '76100000-0000-0000-0000-000000000001', 'Panoramic breakfast', 2, NULL, NULL, 'served'),
    ('76400000-0000-0000-0000-000000000002', '76300000-0000-0000-0000-000000000002', '76100000-0000-0000-0000-000000000002', 'Latte', 2, 'Whole milk', NULL, 'served'),
    ('76400000-0000-0000-0000-000000000003', '76300000-0000-0000-0000-000000000003', '76100000-0000-0000-0000-000000000003', 'House cheesecake', 1, NULL, NULL, 'served'),
    ('76400000-0000-0000-0000-000000000004', '76300000-0000-0000-0000-000000000004', '76100000-0000-0000-0000-000000000004', 'Grilled beef sandwich', 1, 'Medium', NULL, 'served'),
    ('76400000-0000-0000-0000-000000000005', '76300000-0000-0000-0000-000000000005', '76100000-0000-0000-0000-000000000005', 'Iced hibiscus tea', 1, NULL, NULL, 'served'),
    ('76400000-0000-0000-0000-000000000006', '76300000-0000-0000-0000-000000000006', '76100000-0000-0000-0000-000000000006', 'Latte', 1, 'Almond milk', NULL, 'served');

INSERT INTO payment_methods (id, location_id, code, name, method_type) VALUES
    ('77000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'CASH', 'Cash', 'cash'),
    ('77000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'CARD', 'Card', 'card'),
    ('77000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'TRANSFER', 'Bank transfer', 'bank_transfer'),
    ('77000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'WALLET', 'Mobile wallet', 'mobile_wallet');

INSERT INTO cash_registers (id, location_id, code, name) VALUES (
    '78000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'REG-01',
    'Main counter'
);

INSERT INTO cash_sessions (
    id, cash_register_id, business_date, opened_by_user_id, closed_by_user_id,
    status, opening_amount, expected_cash_amount, counted_cash_amount,
    difference_amount, opened_at, closed_at, notes
) VALUES (
    '78100000-0000-0000-0000-000000000001',
    '78000000-0000-0000-0000-000000000001',
    '2026-10-03',
    '41000000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000001',
    'closed',
    200.00,
    170.00,
    170.00,
    0.00,
    '2026-10-03 06:20:00-06',
    '2026-10-03 21:30:00-06',
    'Demo close: opening 200 + cash sale 10 - withdrawal 40.'
);

INSERT INTO cash_movements (
    id, cash_session_id, movement_type, amount, reason, created_by_user_id, created_at
) VALUES
    ('78200000-0000-0000-0000-000000000001', '78100000-0000-0000-0000-000000000001', 'opening', 200.00, 'Opening float', '41000000-0000-0000-0000-000000000002', '2026-10-03 06:20:00-06'),
    ('78200000-0000-0000-0000-000000000002', '78100000-0000-0000-0000-000000000001', 'sale', 10.00, 'Cash payment for order 1002', '41000000-0000-0000-0000-000000000002', '2026-10-03 10:55:00-06'),
    ('78200000-0000-0000-0000-000000000003', '78100000-0000-0000-0000-000000000001', 'withdrawal', 40.00, 'Demo safe drop', '41000000-0000-0000-0000-000000000001', '2026-10-03 18:00:00-06');

INSERT INTO payments (
    id, order_id, payment_method_id, cash_session_id, amount, status,
    external_reference, received_by_user_id, paid_at
) VALUES
    (
        '79000000-0000-0000-0000-000000000001',
        '76000000-0000-0000-0000-000000000001',
        '77000000-0000-0000-0000-000000000002',
        '78100000-0000-0000-0000-000000000001',
        40.25,
        'captured',
        'DEMO-CARD-1001',
        '41000000-0000-0000-0000-000000000002',
        '2026-10-03 10:04:00-06'
    ),
    (
        '79000000-0000-0000-0000-000000000002',
        '76000000-0000-0000-0000-000000000002',
        '77000000-0000-0000-0000-000000000001',
        '78100000-0000-0000-0000-000000000001',
        10.00,
        'captured',
        NULL,
        '41000000-0000-0000-0000-000000000002',
        '2026-10-03 10:54:00-06'
    ),
    (
        '79000000-0000-0000-0000-000000000003',
        '76000000-0000-0000-0000-000000000002',
        '77000000-0000-0000-0000-000000000002',
        '78100000-0000-0000-0000-000000000001',
        14.00,
        'captured',
        'DEMO-CARD-1002',
        '41000000-0000-0000-0000-000000000002',
        '2026-10-03 10:55:00-06'
    );

INSERT INTO payments (
    id, event_id, payment_method_id, amount, status,
    external_reference, received_by_user_id, paid_at, notes
) VALUES
    (
        '79000000-0000-0000-0000-000000000004',
        '73000000-0000-0000-0000-000000000001',
        '77000000-0000-0000-0000-000000000002',
        600.00,
        'captured',
        'DEMO-EVENT-DEPOSIT-001',
        '41000000-0000-0000-0000-000000000002',
        '2026-09-30 15:00:00-06',
        'Wedding package demo deposit.'
    ),
    (
        '79000000-0000-0000-0000-000000000005',
        '73000000-0000-0000-0000-000000000002',
        '77000000-0000-0000-0000-000000000003',
        300.00,
        'captured',
        'DEMO-EVENT-DEPOSIT-002',
        '41000000-0000-0000-0000-000000000002',
        '2026-10-01 12:00:00-06',
        'Corporate brunch demo deposit.'
    );

INSERT INTO tips (
    id, order_id, tip_rate, amount, status, was_informed, accepted_at,
    due_at, distributed_at, notes
) VALUES
    (
        '7a000000-0000-0000-0000-000000000001',
        '76000000-0000-0000-0000-000000000001',
        0.074828,
        2.50,
        'distributed',
        true,
        '2026-10-03 10:03:00-06',
        '2026-10-18 23:59:00-06',
        '2026-10-05 17:00:00-06',
        'Demo voluntary tip distributed to the service team.'
    ),
    (
        '7a000000-0000-0000-0000-000000000002',
        '76000000-0000-0000-0000-000000000002',
        0.088878,
        1.75,
        'accepted',
        true,
        '2026-10-03 10:53:00-06',
        '2026-10-18 23:59:00-06',
        NULL,
        'Pending demo distribution.'
    );

INSERT INTO tip_distributions (
    id, tip_id, employee_id, amount, status, due_at, paid_at, paid_by_user_id
) VALUES
    ('7b000000-0000-0000-0000-000000000001', '7a000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', 1.00, 'paid', '2026-10-18 23:59:00-06', '2026-10-05 17:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('7b000000-0000-0000-0000-000000000002', '7a000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000005', 0.75, 'paid', '2026-10-18 23:59:00-06', '2026-10-05 17:00:00-06', '41000000-0000-0000-0000-000000000001'),
    ('7b000000-0000-0000-0000-000000000003', '7a000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000004', 0.75, 'paid', '2026-10-18 23:59:00-06', '2026-10-05 17:00:00-06', '41000000-0000-0000-0000-000000000001');

INSERT INTO dte_sequences (id, location_id, document_type_code, series, next_number) VALUES
    ('7c000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '01', 'DEMO', 25),
    ('7c000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '03', 'DEMO', 8);

INSERT INTO contact_messages (
    id, location_id, customer_id, event_id, name_snapshot, email, phone,
    language_code, topic, message, status
) VALUES
    (
        '7d000000-0000-0000-0000-000000000001',
        '20000000-0000-0000-0000-000000000001',
        '50000000-0000-0000-0000-000000000003',
        '73000000-0000-0000-0000-000000000002',
        'Blue Fern Demo Consulting',
        'events@bluefern.example.invalid',
        '+503 0000-0203',
        'en',
        'event',
        'Please confirm projector setup and vegetarian menu timing.',
        'in_progress'
    ),
    (
        '7d000000-0000-0000-0000-000000000002',
        '20000000-0000-0000-0000-000000000001',
        NULL,
        NULL,
        'Jordan Demo Guest',
        'jordan.guest@example.invalid',
        '+503 0000-0299',
        'en',
        'general',
        'Question about sunset seating and weekend menu.',
        'new'
    );

INSERT INTO inventory_movements (
    id, storage_location_id, ingredient_id, inventory_lot_id, movement_type,
    quantity_delta, unit_cost, goods_receipt_line_id, order_line_id,
    created_by_user_id, reason, created_at
) VALUES
    ('7f000000-0000-0000-0000-000000000001', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-000000000001', 'receipt', 5000, 0.028000, '6c000000-0000-0000-0000-000000000001', NULL, '41000000-0000-0000-0000-000000000002', 'Receipt GR-2026-0929-001', '2026-09-29 07:31:00-06'),
    ('7f000000-0000-0000-0000-000000000002', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000002', '6a000000-0000-0000-0000-000000000002', 'receipt', 20000, 0.002200, '6c000000-0000-0000-0000-000000000002', NULL, '41000000-0000-0000-0000-000000000002', 'Receipt GR-2026-0929-002', '2026-09-29 07:32:00-06'),
    ('7f000000-0000-0000-0000-000000000003', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000004', '6a000000-0000-0000-0000-000000000003', 'receipt', 180, 0.180000, '6c000000-0000-0000-0000-000000000003', NULL, '41000000-0000-0000-0000-000000000002', 'Receipt GR-2026-0929-002', '2026-09-29 07:32:00-06'),
    ('7f000000-0000-0000-0000-000000000004', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000005', '6a000000-0000-0000-0000-000000000004', 'receipt', 120, 0.220000, '6c000000-0000-0000-0000-000000000004', NULL, '41000000-0000-0000-0000-000000000002', 'Receipt GR-2026-0929-003', '2026-09-29 07:34:00-06'),
    ('7f000000-0000-0000-0000-000000000005', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000008', '6a000000-0000-0000-0000-000000000005', 'receipt', 15000, 0.009500, '6c000000-0000-0000-0000-000000000005', NULL, '41000000-0000-0000-0000-000000000002', 'Receipt GR-2026-0929-004', '2026-09-29 07:36:00-06'),
    ('7f000000-0000-0000-0000-000000000006', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000009', '6a000000-0000-0000-0000-000000000006', 'receipt', 10000, 0.008500, '6c000000-0000-0000-0000-000000000006', NULL, '41000000-0000-0000-0000-000000000002', 'Receipt GR-2026-0929-004', '2026-09-29 07:36:00-06'),
    ('7f000000-0000-0000-0000-000000000007', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000012', '6a000000-0000-0000-0000-000000000007', 'receipt', 5000, 0.008000, '6c000000-0000-0000-0000-000000000007', NULL, '41000000-0000-0000-0000-000000000002', 'Receipt GR-2026-0929-002', '2026-09-29 07:32:00-06'),
    ('7f000000-0000-0000-0000-000000000008', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000014', '6a000000-0000-0000-0000-000000000008', 'receipt', 3000, 0.006000, '6c000000-0000-0000-0000-000000000008', NULL, '41000000-0000-0000-0000-000000000002', 'Receipt GR-2026-0929-002', '2026-09-29 07:32:00-06'),
    ('7f000000-0000-0000-0000-000000000024', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000003', NULL, 'adjustment_in', 5000, 0.002500, NULL, NULL, '41000000-0000-0000-0000-000000000002', 'Opening demo balance: almond milk', '2026-09-29 07:00:00-06'),
    ('7f000000-0000-0000-0000-000000000025', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000006', NULL, 'adjustment_in', 10000, 0.000500, NULL, NULL, '41000000-0000-0000-0000-000000000002', 'Opening demo balance: black beans', '2026-09-29 07:00:00-06'),
    ('7f000000-0000-0000-0000-000000000026', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000007', NULL, 'adjustment_in', 5000, 0.008000, NULL, NULL, '41000000-0000-0000-0000-000000000002', 'Opening demo balance: fresh cheese', '2026-09-29 07:00:00-06'),
    ('7f000000-0000-0000-0000-000000000027', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000010', NULL, 'adjustment_in', 2000, 0.010000, NULL, NULL, '41000000-0000-0000-0000-000000000002', 'Opening demo balance: hibiscus', '2026-09-29 07:00:00-06'),
    ('7f000000-0000-0000-0000-000000000028', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000011', NULL, 'adjustment_in', 5000, 0.001500, NULL, NULL, '41000000-0000-0000-0000-000000000002', 'Opening demo balance: sugar', '2026-09-29 07:00:00-06'),
    ('7f000000-0000-0000-0000-000000000029', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000013', NULL, 'adjustment_in', 2000, 0.004000, NULL, NULL, '41000000-0000-0000-0000-000000000002', 'Opening demo balance: butter', '2026-09-29 07:00:00-06'),
    ('7f000000-0000-0000-0000-000000000030', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000015', NULL, 'adjustment_in', 80, 0.750000, NULL, NULL, '41000000-0000-0000-0000-000000000002', 'Opening demo balance: avocado', '2026-09-29 07:00:00-06'),
    ('7f000000-0000-0000-0000-000000000009', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000004', '6a000000-0000-0000-0000-000000000003', 'sale_consumption', -4, 0.180000, NULL, '76100000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', 'Two panoramic breakfasts', '2026-10-03 09:30:00-06'),
    ('7f000000-0000-0000-0000-000000000010', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000005', '6a000000-0000-0000-0000-000000000004', 'sale_consumption', -2, 0.220000, NULL, '76100000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', 'Two panoramic breakfasts', '2026-10-03 09:30:00-06'),
    ('7f000000-0000-0000-0000-000000000011', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000006', NULL, 'sale_consumption', -240, 0.000500, NULL, '76100000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', 'Two panoramic breakfasts', '2026-10-03 09:30:00-06'),
    ('7f000000-0000-0000-0000-000000000012', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000007', NULL, 'sale_consumption', -60, 0.008000, NULL, '76100000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', 'Two panoramic breakfasts', '2026-10-03 09:30:00-06'),
    ('7f000000-0000-0000-0000-000000000013', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000015', NULL, 'sale_consumption', -2, 0.750000, NULL, '76100000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000002', 'Two panoramic breakfasts', '2026-10-03 09:30:00-06'),
    ('7f000000-0000-0000-0000-000000000014', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-000000000001', 'sale_consumption', -36, 0.028000, NULL, '76100000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', 'Two hot lattes', '2026-10-03 09:30:00-06'),
    ('7f000000-0000-0000-0000-000000000015', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000002', '6a000000-0000-0000-0000-000000000002', 'sale_consumption', -360, 0.002200, NULL, '76100000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', 'Two hot lattes', '2026-10-03 09:30:00-06'),
    ('7f000000-0000-0000-0000-000000000016', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000012', '6a000000-0000-0000-0000-000000000007', 'sale_consumption', -80, 0.008000, NULL, '76100000-0000-0000-0000-000000000003', '41000000-0000-0000-0000-000000000002', 'One cheesecake slice', '2026-10-03 09:40:00-06'),
    ('7f000000-0000-0000-0000-000000000017', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000013', NULL, 'sale_consumption', -20, 0.004000, NULL, '76100000-0000-0000-0000-000000000003', '41000000-0000-0000-0000-000000000002', 'One cheesecake slice', '2026-10-03 09:40:00-06'),
    ('7f000000-0000-0000-0000-000000000018', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000008', '6a000000-0000-0000-0000-000000000005', 'sale_consumption', -180, 0.009500, NULL, '76100000-0000-0000-0000-000000000004', '41000000-0000-0000-0000-000000000002', 'One grilled beef sandwich', '2026-10-03 10:45:00-06'),
    ('7f000000-0000-0000-0000-000000000019', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000005', '6a000000-0000-0000-0000-000000000004', 'sale_consumption', -1, 0.220000, NULL, '76100000-0000-0000-0000-000000000004', '41000000-0000-0000-0000-000000000002', 'One grilled beef sandwich', '2026-10-03 10:45:00-06'),
    ('7f000000-0000-0000-0000-000000000020', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000010', NULL, 'sale_consumption', -12, 0.010000, NULL, '76100000-0000-0000-0000-000000000005', '41000000-0000-0000-0000-000000000002', 'One hibiscus iced tea', '2026-10-03 10:28:00-06'),
    ('7f000000-0000-0000-0000-000000000021', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000011', NULL, 'sale_consumption', -20, 0.001500, NULL, '76100000-0000-0000-0000-000000000005', '41000000-0000-0000-0000-000000000002', 'One hibiscus iced tea', '2026-10-03 10:28:00-06'),
    ('7f000000-0000-0000-0000-000000000022', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000001', '6a000000-0000-0000-0000-000000000001', 'sale_consumption', -18, 0.028000, NULL, '76100000-0000-0000-0000-000000000006', '41000000-0000-0000-0000-000000000002', 'One iced latte', '2026-10-03 10:29:00-06'),
    ('7f000000-0000-0000-0000-000000000023', '69000000-0000-0000-0000-000000000001', '67000000-0000-0000-0000-000000000003', NULL, 'sale_consumption', -180, 0.002500, NULL, '76100000-0000-0000-0000-000000000006', '41000000-0000-0000-0000-000000000002', 'One iced latte with almond milk', '2026-10-03 10:29:00-06');

INSERT INTO audit_logs (
    id, actor_user_id, action, entity_type, entity_id, after_data, request_id, created_at
) VALUES
    (
        '7e000000-0000-0000-0000-000000000001',
        '41000000-0000-0000-0000-000000000001',
        'close',
        'cash_session',
        '78100000-0000-0000-0000-000000000001',
        '{"status":"closed","difference_amount":0.00}'::jsonb,
        'demo-request-cash-close-001',
        '2026-10-03 21:31:00-06'
    ),
    (
        '7e000000-0000-0000-0000-000000000002',
        '41000000-0000-0000-0000-000000000001',
        'create',
        'event_quote',
        '75000000-0000-0000-0000-000000000001',
        '{"status":"accepted","version_no":1,"total_amount":2034.00}'::jsonb,
        'demo-request-quote-001',
        '2026-09-29 16:01:00-06'
    );

COMMIT;
