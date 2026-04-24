CREATE TABLE IF NOT EXISTS signals (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(20) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('BUY', 'SELL')),
    entry_type VARCHAR(20) CHECK (entry_type IN ('MARKET', 'BUY_LIMIT', 'SELL_LIMIT')),
    entry NUMERIC(12, 5) NOT NULL,
    stop_loss NUMERIC(12, 5) NOT NULL,
    take_profit NUMERIC(12, 5) NOT NULL,
    confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'TRIGGERED', 'TP_HIT', 'SL_HIT', 'EXPIRED')),
    entry_source VARCHAR(20)
        CHECK (entry_source IN ('FVG', 'SUPPORT_ZONE', 'RESISTANCE_ZONE', 'MARKET')),
    source VARCHAR(20) NOT NULL
        CHECK (source IN ('AUTO', 'MANUAL')),
    timeframe VARCHAR(10) DEFAULT '15m',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    triggered_at TIMESTAMP,
    closed_at TIMESTAMP,
    expires_at TIMESTAMP,
    analysis_snapshot JSONB    
);
