const crypto = require('crypto');
const { getPool, isAppDbConfigured, query } = require('./postgres-client.cjs');

function shouldUsePostgresDocumentStore() {
  const provider = String(process.env.DATA_STORE_PROVIDER || process.env.FIRESTORE_DATA_PROVIDER || '').trim().toLowerCase();
  if (provider === 'firestore' || provider === 'firebase') return false;
  if (provider === 'postgres' || provider === 'postgresql' || provider === 'app-db') return isAppDbConfigured();
  if (String(process.env.POSTGRES_DOCUMENT_STORE_ENABLED || '').toLowerCase() === 'false') return false;
  return isAppDbConfigured();
}

function randomDocId() {
  return crypto.randomBytes(15).toString('base64url').slice(0, 20);
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value, (_key, entry) => {
    if (entry instanceof Date) return entry.toISOString();
    if (entry && typeof entry.toDate === 'function') return entry.toDate().toISOString();
    return entry === undefined ? null : entry;
  }));
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'object' && Number.isFinite(value._seconds)) {
    return new Date(value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1000000));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getNested(target, fieldPath) {
  if (fieldPath === '__name__' || fieldPath === 'id') return target?.id;
  const parts = String(fieldPath || '').split('.').filter(Boolean);
  let current = target;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
}

function setNested(target, fieldPath, value) {
  const parts = String(fieldPath || '').split('.').filter(Boolean);
  if (!parts.length) return;
  let current = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== 'object' || Array.isArray(current[part])) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function deleteNested(target, fieldPath) {
  const parts = String(fieldPath || '').split('.').filter(Boolean);
  if (!parts.length) return;
  let current = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    current = current?.[parts[i]];
    if (!current || typeof current !== 'object') return;
  }
  delete current[parts[parts.length - 1]];
}

function isTransform(value, name) {
  return value && typeof value === 'object' && value.constructor?.name === name;
}

function applyTransform(existingValue, transform) {
  if (isTransform(transform, 'ServerTimestampTransform')) return new Date().toISOString();
  if (isTransform(transform, 'NumericIncrementTransform')) {
    const current = Number(existingValue || 0);
    const operand = Number(transform.operand || 0);
    return (Number.isFinite(current) ? current : 0) + (Number.isFinite(operand) ? operand : 0);
  }
  if (isTransform(transform, 'ArrayUnionTransform')) {
    const current = Array.isArray(existingValue) ? existingValue.slice() : [];
    const seen = new Set(current.map((item) => JSON.stringify(item)));
    for (const item of transform.elements || []) {
      const key = JSON.stringify(item);
      if (!seen.has(key)) {
        current.push(clone(item));
        seen.add(key);
      }
    }
    return current;
  }
  if (isTransform(transform, 'ArrayRemoveTransform')) {
    const remove = new Set((transform.elements || []).map((item) => JSON.stringify(item)));
    return (Array.isArray(existingValue) ? existingValue : []).filter((item) => !remove.has(JSON.stringify(item)));
  }
  return clone(transform);
}

function applyPatch(baseData, patch, { merge = true } = {}) {
  const output = merge ? clone(baseData || {}) || {} : {};
  const source = patch || {};

  for (const [field, value] of Object.entries(source)) {
    if (isTransform(value, 'DeleteTransform')) {
      deleteNested(output, field);
      continue;
    }

    if (
      isTransform(value, 'ServerTimestampTransform') ||
      isTransform(value, 'NumericIncrementTransform') ||
      isTransform(value, 'ArrayUnionTransform') ||
      isTransform(value, 'ArrayRemoveTransform')
    ) {
      setNested(output, field, applyTransform(getNested(output, field), value));
      continue;
    }

    setNested(output, field, clone(value));
  }

  return output;
}

function compareValues(left, right) {
  const leftDate = normalizeDate(left);
  const rightDate = normalizeDate(right);
  if (leftDate && rightDate) return leftDate.getTime() - rightDate.getTime();

  if (typeof left === 'number' || typeof right === 'number') {
    const a = Number(left);
    const b = Number(right);
    if (Number.isFinite(a) && Number.isFinite(b)) return a - b;
  }

  return String(left ?? '').localeCompare(String(right ?? ''));
}

function matchesFilter(row, filter) {
  const value = filter.field === '__name__' ? row.id : getNested(row.data, filter.field);
  const expected = filter.value;
  switch (filter.operator) {
    case '==':
      return JSON.stringify(value ?? null) === JSON.stringify(expected ?? null);
    case '!=':
      return JSON.stringify(value ?? null) !== JSON.stringify(expected ?? null);
    case '>':
      return compareValues(value, expected) > 0;
    case '>=':
      return compareValues(value, expected) >= 0;
    case '<':
      return compareValues(value, expected) < 0;
    case '<=':
      return compareValues(value, expected) <= 0;
    case 'in':
      return Array.isArray(expected) && expected.some((item) => JSON.stringify(item ?? null) === JSON.stringify(value ?? null));
    case 'array-contains':
      return Array.isArray(value) && value.some((item) => JSON.stringify(item ?? null) === JSON.stringify(expected ?? null));
    case 'array-contains-any':
      return Array.isArray(value) && Array.isArray(expected) && value.some((item) => expected.some((entry) => JSON.stringify(entry ?? null) === JSON.stringify(item ?? null)));
    default:
      return false;
  }
}

function sortRows(rows, orderBys) {
  if (!orderBys.length) {
    return rows.sort((a, b) => compareValues(b.data?.updatedAt || b.updatedAt, a.data?.updatedAt || a.updatedAt));
  }

  return rows.sort((a, b) => {
    for (const order of orderBys) {
      const left = order.field === '__name__' ? a.id : getNested(a.data, order.field);
      const right = order.field === '__name__' ? b.id : getNested(b.data, order.field);
      const diff = compareValues(left, right);
      if (diff !== 0) return order.direction === 'desc' ? -diff : diff;
    }
    return 0;
  });
}

function rowToSnapshot(store, collectionPath, row) {
  const ref = new PgDocumentReference(store, collectionPath, row.doc_id);
  return new PgDocumentSnapshot(ref, row.doc_id, row.data || {}, true);
}

class PgDocumentSnapshot {
  constructor(ref, id, data, exists) {
    this.ref = ref;
    this.id = id;
    this.exists = Boolean(exists);
    this._data = data || {};
  }

  data() {
    return this.exists ? clone(this._data) : undefined;
  }
}

class PgQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }

  forEach(callback) {
    this.docs.forEach(callback);
  }

  docChanges() {
    return this.docs.map((doc) => ({ type: 'added', doc }));
  }
}

class PgDocumentReference {
  constructor(store, collectionPath, id = randomDocId()) {
    this._store = store;
    this.collectionPath = collectionPath;
    this.id = id || randomDocId();
    this.path = `${collectionPath}/${this.id}`;
  }

  collection(name) {
    return new PgCollectionReference(this._store, `${this.path}/${name}`);
  }

  async get() {
    const result = await this._store._query(
      `SELECT doc_id, data, created_at, updated_at
       FROM app_documents
       WHERE collection_path = $1 AND doc_id = $2
       LIMIT 1`,
      [this.collectionPath, this.id]
    );
    if (!result.rows.length) return new PgDocumentSnapshot(this, this.id, undefined, false);
    return rowToSnapshot(this._store, this.collectionPath, result.rows[0]);
  }

  async set(data, options = {}) {
    const current = options?.merge ? (await this.get()).data() || {} : {};
    const next = applyPatch(current, data, { merge: Boolean(options?.merge) });
    await this._store._query(
      `INSERT INTO app_documents (collection_path, doc_id, data, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW(), NOW())
       ON CONFLICT (collection_path, doc_id) DO UPDATE SET
         data = EXCLUDED.data,
         updated_at = NOW()`,
      [this.collectionPath, this.id, JSON.stringify(next)]
    );
    return this;
  }

  async update(data) {
    const snapshot = await this.get();
    if (!snapshot.exists) {
      throw new Error(`Document ${this.path} does not exist.`);
    }
    return this.set(data, { merge: true });
  }

  async delete() {
    await this._store._query(
      `DELETE FROM app_documents WHERE collection_path = $1 AND doc_id = $2`,
      [this.collectionPath, this.id]
    );
  }
}

class PgQuery {
  constructor(store, collectionPath, filters = [], orderBys = [], limitValue = null, startAfterValue = null) {
    this._store = store;
    this.collectionPath = collectionPath;
    this._filters = filters;
    this._orderBys = orderBys;
    this._limitValue = limitValue;
    this._startAfterValue = startAfterValue;
  }

  where(field, operator, value) {
    return new PgQuery(this._store, this.collectionPath, this._filters.concat([{ field, operator, value }]), this._orderBys, this._limitValue, this._startAfterValue);
  }

  orderBy(field, direction = 'asc') {
    return new PgQuery(this._store, this.collectionPath, this._filters, this._orderBys.concat([{ field, direction: String(direction).toLowerCase() === 'desc' ? 'desc' : 'asc' }]), this._limitValue, this._startAfterValue);
  }

  limit(value) {
    const parsed = Math.max(1, Math.min(Number(value) || 100, 10000));
    return new PgQuery(this._store, this.collectionPath, this._filters, this._orderBys, parsed, this._startAfterValue);
  }

  select() {
    return new PgQuery(this._store, this.collectionPath, this._filters, this._orderBys, this._limitValue, this._startAfterValue);
  }

  startAfter(value) {
    const docId = typeof value === 'string' ? value : value?.id || value?.doc_id || '';
    return new PgQuery(this._store, this.collectionPath, this._filters, this._orderBys, this._limitValue, docId);
  }

  count() {
    return {
      get: async () => {
        const snapshot = await this.get();
        return { data: () => ({ count: snapshot.size }) };
      }
    };
  }

  async get() {
    const result = await this._store._query(
      `SELECT doc_id, data, created_at, updated_at
       FROM app_documents
       WHERE collection_path = $1
       ORDER BY doc_id ASC
       LIMIT 10000`,
      [this.collectionPath]
    );

    let rows = result.rows.map((row) => ({
      id: row.doc_id,
      doc_id: row.doc_id,
      data: row.data || {},
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    if (this._startAfterValue) {
      rows = rows.filter((row) => row.id > this._startAfterValue);
    }

    rows = rows.filter((row) => this._filters.every((filter) => matchesFilter(row, filter)));
    rows = sortRows(rows, this._orderBys);
    if (this._limitValue) rows = rows.slice(0, this._limitValue);

    return new PgQuerySnapshot(rows.map((row) => rowToSnapshot(this._store, this.collectionPath, {
      doc_id: row.id,
      data: row.data,
      created_at: row.createdAt,
      updated_at: row.updatedAt
    })));
  }

  onSnapshot(onNext, onError) {
    let closed = false;
    let timeout = null;
    const pollMs = Math.max(1000, Number(process.env.POSTGRES_SNAPSHOT_POLL_MS || 5000));

    const run = async () => {
      if (closed) return;
      try {
        const snapshot = await this.get();
        if (!closed && typeof onNext === 'function') {
          onNext(snapshot);
        }
      } catch (error) {
        if (!closed && typeof onError === 'function') {
          onError(error);
        }
      } finally {
        if (!closed) {
          timeout = setTimeout(run, pollMs);
        }
      }
    };

    run();

    return () => {
      closed = true;
      if (timeout) clearTimeout(timeout);
    };
  }
}

class PgCollectionReference extends PgQuery {
  constructor(store, collectionPath) {
    super(store, collectionPath);
    this.id = collectionPath.split('/').filter(Boolean).slice(-1)[0] || collectionPath;
    this.path = collectionPath;
  }

  doc(id = randomDocId()) {
    return new PgDocumentReference(this._store, this.collectionPath, id);
  }

  async add(data) {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }
}

class PgWriteBatch {
  constructor(store) {
    this._store = store;
    this._ops = [];
  }

  set(ref, data, options) {
    this._ops.push(() => ref.set(data, options));
    return this;
  }

  update(ref, data) {
    this._ops.push(() => ref.update(data));
    return this;
  }

  delete(ref) {
    this._ops.push(() => ref.delete());
    return this;
  }

  async commit() {
    for (const op of this._ops) {
      await op();
    }
  }
}

class PgTransaction {
  constructor(store, client) {
    this._store = store;
    this._client = client;
    this._ops = [];
  }

  async get(ref) {
    return ref._store._withClient(this._client).collection(ref.collectionPath).doc(ref.id).get();
  }

  set(ref, data, options) {
    this._ops.push(() => ref._store._withClient(this._client).collection(ref.collectionPath).doc(ref.id).set(data, options));
    return this;
  }

  update(ref, data) {
    this._ops.push(() => ref._store._withClient(this._client).collection(ref.collectionPath).doc(ref.id).update(data));
    return this;
  }

  delete(ref) {
    this._ops.push(() => ref._store._withClient(this._client).collection(ref.collectionPath).doc(ref.id).delete());
    return this;
  }

  async _commit() {
    for (const op of this._ops) {
      await op();
    }
  }
}

class PgDocumentStore {
  constructor(client = null) {
    this._client = client;
  }

  _withClient(client) {
    return new PgDocumentStore(client);
  }

  _query(sql, params = []) {
    return this._client ? this._client.query(sql, params) : query(sql, params);
  }

  collection(path) {
    return new PgCollectionReference(this, String(path || '').replace(/^\/+|\/+$/g, ''));
  }

  doc(path) {
    const cleanPath = String(path || '').replace(/^\/+|\/+$/g, '');
    const parts = cleanPath.split('/');
    const id = parts.pop();
    return new PgDocumentReference(this, parts.join('/'), id);
  }

  batch() {
    return new PgWriteBatch(this);
  }

  async runTransaction(callback) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const store = this._withClient(client);
      const transaction = new PgTransaction(store, client);
      const result = await callback(transaction);
      await transaction._commit();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}

function getPostgresDocumentStore() {
  return new PgDocumentStore();
}

async function upsertAppDocument(collectionPath, docId, data) {
  const store = getPostgresDocumentStore();
  await store.collection(collectionPath).doc(docId).set(data || {});
  return { collectionPath, docId };
}

module.exports = {
  PgDocumentStore,
  getPostgresDocumentStore,
  shouldUsePostgresDocumentStore,
  upsertAppDocument
};
