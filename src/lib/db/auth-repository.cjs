const { query } = require('./postgres-client.cjs');

function toIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function rowToProfile(row) {
  if (!row) return null;
  const data = row.data || {};
  return {
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    photoUrl: row.photo_url,
    phoneNumber: row.phone_number,
    location: row.location,
    bio: row.bio,
    role: row.role,
    isAdmin: row.is_admin,
    kycStatus: row.kyc_status,
    emailVerified: row.email_verified,
    signInProvider: row.sign_in_provider,
    passwordAlgo: row.password_algo,
    failedLoginAttempts: row.failed_login_attempts,
    lockedUntil: toIso(row.locked_until),
    authMigratedAt: toIso(row.auth_migrated_at),
    ...data,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

// Includes password_hash -- callers that need to verify a password should
// use this; general profile reads should use getUserProfileById/getUserProfileByEmail
// which omit it via rowToProfile.
async function getCredentialsByEmail(email) {
  const result = await query(
    `SELECT user_id, email, password_hash, password_algo, failed_login_attempts, locked_until
     FROM app_user_profiles WHERE lower(email) = lower($1) LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function getUserProfileById(userId) {
  const result = await query(`SELECT * FROM app_user_profiles WHERE user_id = $1`, [userId]);
  return rowToProfile(result.rows[0]);
}

async function getUserProfileByEmail(email) {
  const result = await query(`SELECT * FROM app_user_profiles WHERE lower(email) = lower($1) LIMIT 1`, [email]);
  return rowToProfile(result.rows[0]);
}

async function createUserProfile({
  userId, email, displayName = null, photoUrl = null, passwordHash = null,
  passwordAlgo = null, signInProvider = 'password', emailVerified = false,
  authMigrated = false
}) {
  const result = await query(
    `INSERT INTO app_user_profiles (
       user_id, email, display_name, photo_url, sign_in_provider, email_verified,
       password_hash, password_algo, password_updated_at, auth_migrated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $7 IS NULL THEN NULL ELSE NOW() END, CASE WHEN $9 THEN NOW() ELSE NULL END)
     ON CONFLICT (user_id) DO UPDATE SET
       email = EXCLUDED.email,
       display_name = COALESCE(EXCLUDED.display_name, app_user_profiles.display_name),
       photo_url = COALESCE(EXCLUDED.photo_url, app_user_profiles.photo_url),
       sign_in_provider = EXCLUDED.sign_in_provider,
       updated_at = NOW()
     RETURNING *`,
    [userId, email, displayName, photoUrl, signInProvider, emailVerified, passwordHash, passwordAlgo, authMigrated]
  );
  return rowToProfile(result.rows[0]);
}

async function setPasswordHash(userId, { passwordHash, passwordAlgo = 'bcrypt' }) {
  const result = await query(
    `UPDATE app_user_profiles
     SET password_hash = $2, password_algo = $3, password_updated_at = NOW(),
         failed_login_attempts = 0, locked_until = NULL, auth_migrated_at = COALESCE(auth_migrated_at, NOW()),
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [userId, passwordHash, passwordAlgo]
  );
  return rowToProfile(result.rows[0]);
}

async function markAuthMigrated(userId) {
  await query(
    `UPDATE app_user_profiles SET auth_migrated_at = COALESCE(auth_migrated_at, NOW()), updated_at = NOW() WHERE user_id = $1`,
    [userId]
  );
}

async function recordFailedLogin(userId, { maxAttempts = 5, lockMinutes = 15 } = {}) {
  const result = await query(
    `UPDATE app_user_profiles
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until = CASE WHEN failed_login_attempts + 1 >= $2 THEN NOW() + ($3 || ' minutes')::interval ELSE locked_until END,
         updated_at = NOW()
     WHERE user_id = $1
     RETURNING failed_login_attempts, locked_until`,
    [userId, maxAttempts, lockMinutes]
  );
  return result.rows[0] || null;
}

async function resetFailedLogins(userId) {
  await query(
    `UPDATE app_user_profiles SET failed_login_attempts = 0, locked_until = NULL, updated_at = NOW() WHERE user_id = $1`,
    [userId]
  );
}

async function setEmailVerified(userId, verified = true) {
  await query(
    `UPDATE app_user_profiles SET email_verified = $2, updated_at = NOW() WHERE user_id = $1`,
    [userId, verified]
  );
}

async function updateProfileFields(userId, patch = {}) {
  const typedColumns = {
    displayName: 'display_name', photoUrl: 'photo_url', phoneNumber: 'phone_number',
    location: 'location', bio: 'bio', role: 'role', isAdmin: 'is_admin', kycStatus: 'kyc_status'
  };
  const sets = [];
  const params = [];
  const extraData = {};

  Object.entries(patch).forEach(([key, value]) => {
    if (typedColumns[key]) {
      params.push(value);
      sets.push(`${typedColumns[key]} = $${params.length}`);
    } else {
      extraData[key] = value;
    }
  });

  if (Object.keys(extraData).length > 0) {
    params.push(JSON.stringify(extraData));
    sets.push(`data = data || $${params.length}::jsonb`);
  }

  if (sets.length === 0) return getUserProfileById(userId);

  sets.push('updated_at = NOW()');
  params.push(userId);

  const result = await query(
    `UPDATE app_user_profiles SET ${sets.join(', ')} WHERE user_id = $${params.length} RETURNING *`,
    params
  );
  return rowToProfile(result.rows[0]);
}

// --- Password reset tokens ---

async function createPasswordResetToken(userId, tokenHash, expiresAt) {
  await query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

async function consumePasswordResetToken(tokenHash) {
  const result = await query(
    `UPDATE password_reset_tokens
     SET used_at = NOW()
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [tokenHash]
  );
  return result.rows[0]?.user_id || null;
}

// --- Refresh tokens ---

async function createRefreshToken(userId, tokenHash, expiresAt, { userAgent = null, ipAddress = null } = {}) {
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, userAgent, ipAddress]
  );
}

async function getActiveRefreshToken(tokenHash) {
  const result = await query(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

// Rotation: revoke the presented token and issue a new one in a single
// transaction-equivalent (two statements, but the revoke's WHERE clause
// guards against reuse -- a token can only be rotated once).
async function rotateRefreshToken(oldTokenHash, newTokenHash, newExpiresAt) {
  const revoked = await query(
    `UPDATE refresh_tokens
     SET revoked_at = NOW(), replaced_by_token_hash = $2
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
     RETURNING user_id`,
    [oldTokenHash, newTokenHash]
  );
  if (!revoked.rows[0]) return null;

  const userId = revoked.rows[0].user_id;
  await createRefreshToken(userId, newTokenHash, newExpiresAt);
  return userId;
}

async function revokeRefreshToken(tokenHash) {
  await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`, [tokenHash]);
}

async function revokeAllUserRefreshTokens(userId) {
  await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
}

module.exports = {
  getCredentialsByEmail,
  getUserProfileById,
  getUserProfileByEmail,
  createUserProfile,
  setPasswordHash,
  markAuthMigrated,
  recordFailedLogin,
  resetFailedLogins,
  setEmailVerified,
  updateProfileFields,
  createPasswordResetToken,
  consumePasswordResetToken,
  createRefreshToken,
  getActiveRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
  rowToProfile
};
