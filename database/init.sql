CREATE TABLE IF NOT EXISTS incidents (
  id BIGSERIAL PRIMARY KEY,
  incident_number VARCHAR(32) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'NEW',
  priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_location ON incidents(latitude, longitude);


CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'OFFICER',
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

INSERT INTO users (username, display_name, role, password_hash)
VALUES
  ('admin', 'ผู้ดูแลระบบ', 'ADMIN', 'incident-admin-salt:6eaffedef59c311473e3252f69eba37445ca161e25d4f867d25436a26060dc00eb50b10c98eef768a9aaca96c6073d05de82c566102cf0799bcf7ca2fa0831a9'),
  ('officer', 'เจ้าหน้าที่', 'OFFICER', 'incident-officer-salt:5e09b58b3ba514d4ad5254bed45505785f2924d692203448d959763b304416034c20d95526cecdbd8a0a32e5d9e3a606381224cb545d4a33c3b8baa91fd2500c')
ON CONFLICT (username) DO NOTHING;
