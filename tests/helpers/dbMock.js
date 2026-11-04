const sql = require("mssql");

function queueOf(results) {
  return Array.isArray(results) ? results.slice() : [results];
}

function emptyResult() {
  return { recordset: [], recordsets: [[]], rowsAffected: [0] };
}

function buildRequest(results) {
  const queue = queueOf(results);
  const request = {
    input: jest.fn(function () {
      return request;
    }),
    query: jest.fn(function () {
      const next = queue.length > 1 ? queue.shift() : queue[0];
      if (next === undefined) return Promise.resolve(emptyResult());
      if (next instanceof Error) return Promise.reject(next);
      return Promise.resolve(next);
    })
  };
  return request;
}

function mockPool(results) {
  const request = buildRequest(results);
  const pool = {
    request: jest.fn(function () {
      return request;
    }),
    close: jest.fn().mockResolvedValue(undefined)
  };
  sql.connect.mockResolvedValue(pool);
  return { pool, request };
}

function mockConnectionError(message) {
  const error = new Error(message);
  sql.connect.mockRejectedValue(error);
  return error;
}

function mockTaggedQuery(results) {
  const queue = queueOf(results);
  sql.query.mockImplementation(function () {
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next === undefined) return Promise.resolve(emptyResult());
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  });
  return sql.query;
}

function mockTransaction(results) {
  const request = buildRequest(results);
  const transaction = {
    begin: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined)
  };
  sql.Transaction.mockImplementation(function () {
    return transaction;
  });
  sql.Request.mockImplementation(function () {
    return request;
  });
  return { transaction, request };
}

function rows(records) {
  return { recordset: records, recordsets: [records], rowsAffected: [records.length] };
}

function affected(count) {
  return { recordset: [], recordsets: [[]], rowsAffected: [count] };
}

module.exports = {
  mockPool,
  mockConnectionError,
  mockTaggedQuery,
  mockTransaction,
  rows,
  affected,
  emptyResult
};
