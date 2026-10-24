-- Gear World Hub D1 (gear-world-registry): table and index structure of the LIVE database,
-- read with SELECT on sqlite_master by tools/gwh-code-export.ps1 on 24/10/2026. No rows, no data.
-- Documentation only: nothing runs this file.

-- table: categories
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  category_key TEXT NOT NULL,
  category_name TEXT NOT NULL,
  slug TEXT NOT NULL,
  audience TEXT,
  gender TEXT,
  age_min INTEGER,
  age_max INTEGER,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(site_id, category_key),
  UNIQUE(site_id, slug),
  FOREIGN KEY(site_id) REFERENCES sites(id) ON DELETE CASCADE
);

-- table: classification_log
CREATE TABLE classification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_key TEXT,
  retailer TEXT,
  merchant_product_id TEXT,
  product_name TEXT,
  selected_site_key TEXT,
  selected_category_key TEXT,
  confidence REAL,
  decision TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- table: delivery_country_policies
CREATE TABLE delivery_country_policies (
    policy_id INTEGER PRIMARY KEY,
    retailer_id INTEGER NOT NULL,

    country_code TEXT NOT NULL
        CHECK(
            length(country_code)=2
            AND country_code=upper(country_code)
            AND country_code GLOB '[A-Z][A-Z]'
        ),

    delivery_status TEXT NOT NULL DEFAULT 'UNKNOWN'
        CHECK(
            delivery_status IN ('YES','NO','CONDITIONAL','UNKNOWN')
        ),

    evidence_url TEXT,
    evidence_note TEXT,
    verified_at TEXT,
    expires_at TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(retailer_id)
        REFERENCES delivery_retailer_identities(retailer_id),

    CHECK(
        delivery_status='UNKNOWN'
        OR (
            evidence_url IS NOT NULL
            AND length(trim(evidence_url)) > 0
            AND verified_at IS NOT NULL
        )
    ),

    CHECK(
        expires_at IS NULL
        OR verified_at IS NOT NULL
    )
);

-- table: delivery_country_policy_versions
CREATE TABLE delivery_country_policy_versions (
    version_id INTEGER PRIMARY KEY,
    policy_id INTEGER NOT NULL,
    policy_version INTEGER NOT NULL
        CHECK(policy_version >= 1),

    retailer_id INTEGER NOT NULL,

    country_code TEXT NOT NULL
        CHECK(
            length(country_code)=2
            AND country_code=upper(country_code)
            AND country_code GLOB '[A-Z][A-Z]'
        ),

    delivery_status TEXT NOT NULL
        CHECK(
            delivery_status IN ('YES','NO','CONDITIONAL','UNKNOWN')
        ),

    evidence_url TEXT,
    evidence_note TEXT,
    verified_at TEXT,
    expires_at TEXT,

    source_fingerprint TEXT,
    recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(policy_id)
        REFERENCES delivery_country_policies(policy_id),

    FOREIGN KEY(retailer_id)
        REFERENCES delivery_retailer_identities(retailer_id),

    UNIQUE(policy_id,policy_version),

    CHECK(
        delivery_status='UNKNOWN'
        OR (
            evidence_url IS NOT NULL
            AND length(trim(evidence_url)) > 0
            AND verified_at IS NOT NULL
        )
    )
);

-- table: delivery_retailer_aliases
CREATE TABLE delivery_retailer_aliases (
    site_key TEXT NOT NULL,
    retailer_label TEXT NOT NULL,
    retailer_id INTEGER NOT NULL,
    PRIMARY KEY(site_key, retailer_label),
    FOREIGN KEY(retailer_id)
        REFERENCES delivery_retailer_identities(retailer_id)
);

-- table: delivery_retailer_identities
CREATE TABLE delivery_retailer_identities (
    retailer_id INTEGER PRIMARY KEY,
    canonical_name TEXT NOT NULL UNIQUE,
    identity_status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'
        CHECK(identity_status IN ('PENDING_VERIFICATION','VERIFIED')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- table: delivery_verification_queue
CREATE TABLE delivery_verification_queue (
    queue_id INTEGER PRIMARY KEY,

    site_key TEXT NOT NULL,
    retailer_label TEXT NOT NULL,

    country_code TEXT NOT NULL DEFAULT 'GB'
        CHECK(
            length(country_code)=2
            AND country_code=upper(country_code)
            AND country_code GLOB '[A-Z][A-Z]'
        ),

    review_cycle INTEGER NOT NULL DEFAULT 1
        CHECK(review_cycle >= 1),

    review_reason TEXT NOT NULL DEFAULT 'INITIAL_DISCOVERY'
        CHECK(
            review_reason IN (
                'INITIAL_DISCOVERY',
                'NEW_RETAILER',
                'NEW_SITE_MAPPING',
                'POLICY_EXPIRED',
                'POLICY_CONFLICT',
                'MANUAL_REVIEW'
            )
        ),

    review_status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'
        CHECK(
            review_status IN (
                'PENDING_VERIFICATION',
                'IN_REVIEW',
                'RESOLVED'
            )
        ),

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at TEXT,
    resolved_at TEXT,

    CHECK(
        (
            review_status='PENDING_VERIFICATION'
            AND started_at IS NULL
            AND resolved_at IS NULL
        )
        OR
        (
            review_status='IN_REVIEW'
            AND started_at IS NOT NULL
            AND resolved_at IS NULL
        )
        OR
        (
            review_status='RESOLVED'
            AND started_at IS NOT NULL
            AND resolved_at IS NOT NULL
        )
    ),

    UNIQUE(
        site_key,
        retailer_label,
        country_code,
        review_cycle
    )
);

-- table: feed_sources
CREATE TABLE feed_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  retailer TEXT NOT NULL,
  network TEXT,
  feed_name TEXT,
  source_key TEXT UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- table: hub_subscribers
CREATE TABLE hub_subscribers (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL COLLATE NOCASE UNIQUE, locale TEXT NOT NULL DEFAULT 'en-GB', marketing_consent INTEGER NOT NULL DEFAULT 1 CHECK(marketing_consent IN (0,1)), consent_version TEXT NOT NULL DEFAULT '2026-10-05', source TEXT NOT NULL DEFAULT 'hub-homepage', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

-- table: routing_rules
CREATE TABLE routing_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  rule_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  match_value TEXT NOT NULL,
  weight INTEGER NOT NULL DEFAULT 10,
  is_negative INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- table: sites
CREATE TABLE sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_key TEXT NOT NULL UNIQUE,
  site_name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  audience TEXT,
  gender TEXT,
  age_min INTEGER,
  age_max INTEGER,
  destination_db TEXT,
  destination_worker TEXT,
  priority INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- index: idx_categories_active
CREATE INDEX idx_categories_active
ON categories(is_active);

-- index: idx_categories_site_id
CREATE INDEX idx_categories_site_id
ON categories(site_id);

-- index: idx_classification_log_product
CREATE INDEX idx_classification_log_product
ON classification_log(retailer, merchant_product_id);

-- index: idx_delivery_one_active_review
CREATE UNIQUE INDEX idx_delivery_one_active_review
ON delivery_verification_queue(
    site_key,
    retailer_label,
    country_code
)
WHERE review_status IN ('PENDING_VERIFICATION','IN_REVIEW');

-- index: idx_delivery_policy_lookup
CREATE UNIQUE INDEX idx_delivery_policy_lookup
ON delivery_country_policies(retailer_id,country_code);

-- index: idx_delivery_policy_version_fingerprint
CREATE UNIQUE INDEX idx_delivery_policy_version_fingerprint
ON delivery_country_policy_versions(policy_id,source_fingerprint)
WHERE source_fingerprint IS NOT NULL;

-- index: idx_hub_subscribers_status
CREATE INDEX idx_hub_subscribers_status ON hub_subscribers(status);

-- index: idx_routing_rules_active
CREATE INDEX idx_routing_rules_active
ON routing_rules(is_active);

-- index: idx_routing_rules_category
CREATE INDEX idx_routing_rules_category
ON routing_rules(category_id);

-- index: ux_routing_rule
CREATE UNIQUE INDEX ux_routing_rule
ON routing_rules(category_id, rule_type, field_name, match_value, is_negative);
