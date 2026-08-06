CREATE TABLE IF NOT EXISTS comtnadminnotificationdeliveryhist (
    delivery_id        VARCHAR(64) PRIMARY KEY,
    sent_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_user_id      VARCHAR(200) NOT NULL DEFAULT '',
    delivery_mode      VARCHAR(40) NOT NULL,
    finding_count      INTEGER NOT NULL DEFAULT 0,
    slack_enabled      CHAR(1) NOT NULL DEFAULT 'N',
    mail_enabled       CHAR(1) NOT NULL DEFAULT 'N',
    webhook_enabled    CHAR(1) NOT NULL DEFAULT 'N',
    slack_channel      VARCHAR(255),
    mail_recipients    TEXT,
    webhook_url        TEXT,
    delivery_status    VARCHAR(80) NOT NULL,
    top_finding        TEXT,
    delivery_detail    TEXT,
    slack_status       VARCHAR(80),
    mail_status        VARCHAR(80),
    webhook_status     VARCHAR(80),
    use_at             CHAR(1) NOT NULL DEFAULT 'Y',
    CONSTRAINT ck_admin_notification_delivery_finding_count
        CHECK (finding_count >= 0),
    CONSTRAINT ck_admin_notification_delivery_slack_enabled
        CHECK (slack_enabled IN ('Y', 'N')),
    CONSTRAINT ck_admin_notification_delivery_mail_enabled
        CHECK (mail_enabled IN ('Y', 'N')),
    CONSTRAINT ck_admin_notification_delivery_webhook_enabled
        CHECK (webhook_enabled IN ('Y', 'N')),
    CONSTRAINT ck_admin_notification_delivery_use_at
        CHECK (use_at IN ('Y', 'N'))
);

CREATE TABLE IF NOT EXISTS comtnadminnotificationactivityhist (
    activity_id        VARCHAR(64) PRIMARY KEY,
    happened_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    action_code        VARCHAR(80) NOT NULL,
    actor_user_id      VARCHAR(200) NOT NULL DEFAULT '',
    target_text        TEXT,
    detail_text        TEXT,
    source_type        VARCHAR(40) NOT NULL DEFAULT 'server',
    use_at             CHAR(1) NOT NULL DEFAULT 'Y',
    CONSTRAINT ck_admin_notification_activity_use_at
        CHECK (use_at IN ('Y', 'N'))
);

CREATE INDEX IF NOT EXISTS idx_admin_notification_delivery_sent
    ON comtnadminnotificationdeliveryhist (sent_at DESC, delivery_id DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notification_delivery_filter
    ON comtnadminnotificationdeliveryhist
        (delivery_mode, delivery_status, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notification_activity_happened
    ON comtnadminnotificationactivityhist
        (happened_at DESC, activity_id DESC);

CREATE INDEX IF NOT EXISTS idx_admin_notification_activity_action
    ON comtnadminnotificationactivityhist (action_code, happened_at DESC);

COMMENT ON TABLE comtnadminnotificationdeliveryhist IS
    'Persistent delivery history for administrator security insight notifications.';
COMMENT ON TABLE comtnadminnotificationactivityhist IS
    'Persistent administrator security insight activity history.';
