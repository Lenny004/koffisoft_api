-- Avisos editoriales administrables y publicables por ventana de vigencia.

CREATE TABLE important_announcements (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    title varchar(160) NOT NULL,
    message text NOT NULL,
    cta_label varchar(80),
    cta_url varchar(500),
    starts_at timestamptz(3),
    ends_at timestamptz(3),
    display_order integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz(3) NOT NULL DEFAULT now(),
    updated_at timestamptz(3) NOT NULL DEFAULT now(),
    CONSTRAINT important_announcements_dates_check CHECK (
        ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at
    ),
    CONSTRAINT important_announcements_order_check CHECK (display_order >= 0)
);

CREATE INDEX important_announcements_public_idx
    ON important_announcements (location_id, active, display_order);

CREATE TRIGGER important_announcements_set_updated_at
    BEFORE UPDATE ON important_announcements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
