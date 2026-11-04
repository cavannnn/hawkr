function mockResponse() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  return res;
}

function mockRequest(overrides) {
  return Object.assign({ params: {}, query: {}, body: {}, headers: {} }, overrides);
}

function mockNext() {
  return jest.fn();
}

module.exports = { mockResponse, mockRequest, mockNext };
